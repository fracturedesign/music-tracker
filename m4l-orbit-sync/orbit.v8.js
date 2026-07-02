/*
 * orbit.v8.js  —  runs inside a [v8 orbit.v8.js] object in the OrbitSync M4L device.
 *
 * Responsibilities:
 *   - Watch the Live Set via the Live Object Model (tempo, key/scale, tracks,
 *     devices, clips, scenes).
 *   - Maintain an activity-based work timer (accumulates seconds only while you're
 *     actually playing or editing, with an idle timeout).
 *   - Every FLUSH_INTERVAL, build a payload (stats + new milestone events),
 *     base64-encode it, and push it out to the [node.script orbit.node.js] object,
 *     which handles the HTTP POST + offline buffering.
 *
 * The LOM does NOT expose the .als file path (Ableton keeps it private), so the
 * Orbit-project name is resolved on the Node side (window-title sniff) or via the
 * manual "project" field in the device UI. This script just forwards whatever the
 * UI gives it as `projectOverride`.
 *
 * Outlets:
 *   0: "sync" <base64 payload>   -> node.script
 *   1: status string            -> UI comment/live.text
 */

autowatch = 1;
inlets = 1;
outlets = 2;

var FLUSH_INTERVAL_MS = 8000;   // how often we snapshot + push
var IDLE_TIMEOUT_MS   = 180000; // 3 min of no activity => timer pauses (mirrors Orbit's thinking window)
var MAX_SLOTS_PER_TRACK = 256;  // safety cap when counting session clips

var NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

var state = {
  sessionId: null,
  startedAt: 0,
  activeSeconds: 0,
  lastActivityAt: 0,
  projectOverride: "",     // set from UI
  prevSnapshot: null,
  pendingEvents: [],       // events not yet confirmed sent (node clears via "sent")
  task: null,
  observers: []
};

/* ───────────────────────── lifecycle ───────────────────────── */

function loadbang() { init(); }

function init() {
  cleanup();
  state.sessionId = "s_" + Date.now() + "_" + Math.floor(Math.random() * 1e6).toString(36);
  state.startedAt = Date.now();
  state.activeSeconds = 0;
  state.lastActivityAt = Date.now();
  state.prevSnapshot = null;
  state.pendingEvents = [];

  setupObservers();

  // seed the baseline snapshot so the first diff doesn't report the whole set as "added"
  state.prevSnapshot = buildSnapshot();
  pushEvent("session_start", state.prevSnapshot.setLabel || "Live Set", {});

  state.task = new Task(tick, this);
  state.task.interval = FLUSH_INTERVAL_MS;
  state.task.repeat();

  status("Orbit sync active");
  flush(); // send an immediate first payload
}

function cleanup() {
  if (state.task) { state.task.cancel(); state.task = null; }
  for (var i = 0; i < state.observers.length; i++) {
    try { state.observers[i].id = 0; } catch (e) {}
  }
  state.observers = [];
}

// Called by Live when the device/patcher is freed
function notifydeleted() { cleanup(); }

/* ───────────────────────── UI inlets ───────────────────────── */

// message: "project <name...>"  — manual Orbit-project override
function project() {
  var a = arrayfromargs(arguments);
  state.projectOverride = a.join(" ").trim();
  status("Project set: " + (state.projectOverride || "(auto)"));
  flush();
}

// message: "flushnow" — force an immediate sync (wired to a UI button)
function flushnow() { flush(); }

// message: "sent" — node confirmed the last payload was delivered; drop buffered events
function sent() { state.pendingEvents = []; }

/* ─────────────────────── LOM observers ─────────────────────── */

function setupObservers() {
  // These fire the moment the value changes, so tempo/key edits are captured precisely.
  observe("live_set", "tempo",      function () { markActivity(); });
  observe("live_set", "is_playing", function () { markActivity(); });
  observe("live_set", "scale_name", function () { markActivity(); });
  observe("live_set", "root_note",  function () { markActivity(); });
}

function observe(path, prop, cb) {
  try {
    var api = new LiveAPI(function () {
      // args: property name then value(s); ignore the initial callback with property==='id'
      if (arguments[0] === prop || arguments.length > 0) cb();
    }, path);
    api.property = prop;
    state.observers.push(api);
  } catch (e) { /* property may not exist on older Live builds */ }
}

function markActivity() { state.lastActivityAt = Date.now(); }

/* ───────────────────────── snapshot ────────────────────────── */

function buildSnapshot() {
  var ls = new LiveAPI(null, "live_set");
  var snap = {
    setLabel: "Live Set",
    tempo: round2(getNum(ls, "tempo")),
    rootNote: getNum(ls, "root_note"),
    scaleName: getStr(ls, "scale_name"),
    scaleOn: getNum(ls, "scale_mode"),
    isPlaying: getNum(ls, "is_playing"),
    sceneCount: countChildren(ls, "scenes"),
    tracks: {} // name -> { type, devices:[names], clips:int }
  };

  var trackIds = idList(ls.get("tracks"));
  for (var i = 0; i < trackIds.length; i++) {
    var t = new LiveAPI(null, "id " + trackIds[i]);
    var name = getStr(t, "name");
    var isMidi = getNum(t, "has_midi_input") === 1;
    snap.tracks[trackIds[i]] = {
      name: name,
      type: isMidi ? "midi" : "audio",
      devices: deviceNames(t),
      clips: clipCount(t)
    };
  }
  snap.trackCount = trackIds.length;
  snap.deviceCount = sumDevices(snap.tracks);
  snap.clipCount = sumClips(snap.tracks);
  snap.key = keyLabel(snap.rootNote, snap.scaleName, snap.scaleOn);
  return snap;
}

function deviceNames(track) {
  var names = [];
  var ids = idList(track.get("devices"));
  for (var i = 0; i < ids.length; i++) {
    var d = new LiveAPI(null, "id " + ids[i]);
    names.push(getStr(d, "name"));
  }
  return names;
}

function clipCount(track) {
  var n = 0;
  // Session clips
  var slots = idList(track.get("clip_slots"));
  var cap = Math.min(slots.length, MAX_SLOTS_PER_TRACK);
  for (var i = 0; i < cap; i++) {
    var s = new LiveAPI(null, "id " + slots[i]);
    if (getNum(s, "has_clip") === 1) n++;
  }
  // Arrangement clips (Live 11+)
  var arr = idList(track.get("arrangement_clips"));
  n += arr.length;
  return n;
}

/* ─────────────────────── diff -> events ────────────────────── */

function diffSnapshots(prev, cur) {
  if (!prev) return;

  if (prev.tempo !== cur.tempo && cur.tempo)
    pushEvent("tempo_changed", cur.tempo + " BPM", { from: prev.tempo, to: cur.tempo });

  if (prev.key !== cur.key && cur.key)
    pushEvent("key_changed", cur.key, { from: prev.key, to: cur.key });

  if (cur.sceneCount > prev.sceneCount)
    pushEvent("scene_added", (cur.sceneCount) + " scenes", { delta: cur.sceneCount - prev.sceneCount });
  else if (cur.sceneCount < prev.sceneCount)
    pushEvent("scene_removed", (cur.sceneCount) + " scenes", { delta: cur.sceneCount - prev.sceneCount });

  // Track add / remove / rename, plus per-track device & clip deltas
  var prevIds = keys(prev.tracks), curIds = keys(cur.tracks);

  for (var i = 0; i < curIds.length; i++) {
    var id = curIds[i];
    if (!prev.tracks[id]) {
      pushEvent("track_added", cur.tracks[id].name, { type: cur.tracks[id].type });
    } else {
      var a = prev.tracks[id], b = cur.tracks[id];
      if (a.name !== b.name)
        pushEvent("track_renamed", b.name, { from: a.name, to: b.name });

      var addedDev = diffList(a.devices, b.devices);
      var removedDev = diffList(b.devices, a.devices);
      for (var d = 0; d < addedDev.length; d++)
        pushEvent("device_added", addedDev[d], { track: b.name });
      for (var d2 = 0; d2 < removedDev.length; d2++)
        pushEvent("device_removed", removedDev[d2], { track: b.name });

      if (b.clips > a.clips)
        pushEvent("clip_added", b.name + " (" + b.clips + ")", { track: b.name, delta: b.clips - a.clips });
      else if (b.clips < a.clips)
        pushEvent("clip_removed", b.name + " (" + b.clips + ")", { track: b.name, delta: a.clips - b.clips });
    }
  }
  for (var j = 0; j < prevIds.length; j++) {
    if (!cur.tracks[prevIds[j]])
      pushEvent("track_removed", prev.tracks[prevIds[j]].name, { type: prev.tracks[prevIds[j]].type });
  }
}

function pushEvent(type, detail, meta) {
  state.pendingEvents.push({
    id: "e_" + Date.now() + "_" + Math.floor(Math.random() * 1e6).toString(36),
    ts: Date.now(),
    type: type,
    detail: String(detail),
    meta: meta || {}
  });
  markActivity();
}

/* ───────────────────────── tick / flush ────────────────────── */

function tick() {
  var snap = buildSnapshot();
  diffSnapshots(state.prevSnapshot, snap);
  state.prevSnapshot = snap;

  // accrue work time: always count while playing, else only if recent activity
  var idle = Date.now() - state.lastActivityAt;
  if (snap.isPlaying === 1 || idle < IDLE_TIMEOUT_MS) {
    state.activeSeconds += FLUSH_INTERVAL_MS / 1000;
  }

  flush();
}

function flush() {
  var snap = state.prevSnapshot || buildSnapshot();
  var payload = {
    kind: "ableton_sync",
    sessionId: state.sessionId,
    projectOverride: state.projectOverride,
    stats: {
      tempo: snap.tempo,
      rootNote: snap.rootNote,
      scaleName: snap.scaleName,
      scaleOn: snap.scaleOn,
      key: snap.key,
      trackCount: snap.trackCount,
      sceneCount: snap.sceneCount,
      clipCount: snap.clipCount,
      deviceCount: snap.deviceCount,
      activeSeconds: Math.round(state.activeSeconds),
      startedAt: state.startedAt,
      updatedAt: Date.now()
    },
    events: state.pendingEvents.slice(0)
  };

  var json = JSON.stringify(payload);
  outlet(0, "sync", b64encode(json));
  status("synced " + fmtTime(state.activeSeconds) + " · " + snap.trackCount + " trk · " +
         snap.tempo + " BPM · " + (snap.key || "—"));
}

/* ─────────────────────────── helpers ───────────────────────── */

function idList(arr) {
  // LiveAPI list props return ["id", 1, "id", 2, ...]
  var out = [];
  if (!arr) return out;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === "id" && i + 1 < arr.length) { out.push(arr[i + 1]); i++; }
  }
  return out;
}
function countChildren(api, prop) { return idList(api.get(prop)).length; }
function getNum(api, prop) { var v = api.get(prop); return (v && v.length) ? Number(v[0]) : 0; }
function getStr(api, prop) { var v = api.get(prop); return (v && v.length) ? String(v[0]) : ""; }
function keys(o) { var k = []; for (var x in o) if (o.hasOwnProperty(x)) k.push(x); return k; }
function sumDevices(tracks) { var n = 0; for (var k in tracks) if (tracks.hasOwnProperty(k)) n += tracks[k].devices.length; return n; }
function sumClips(tracks) { var n = 0; for (var k in tracks) if (tracks.hasOwnProperty(k)) n += tracks[k].clips; return n; }
function diffList(a, b) { // items in b not in a (by value)
  var out = [], seen = {};
  for (var i = 0; i < a.length; i++) seen[a[i]] = (seen[a[i]] || 0) + 1;
  for (var j = 0; j < b.length; j++) { if (seen[b[j]]) seen[b[j]]--; else out.push(b[j]); }
  return out;
}
function round2(n) { return Math.round(n * 100) / 100; }
function keyLabel(root, scale, on) {
  if (!on) return "";
  var name = (root >= 0 && root < 12) ? NOTE_NAMES[root] : "";
  return (name + " " + (scale || "")).trim();
}
function fmtTime(sec) {
  sec = Math.round(sec);
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? (h + "h" + (m < 10 ? "0" : "") + m + "m") : (m + "m");
}
function status(s) { outlet(1, "set", s); }

/* base64 (no btoa in the Max js/v8 sandbox) */
function b64encode(str) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // UTF-8 encode
  var utf8 = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) utf8.push(c);
    else if (c < 0x800) { utf8.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else { utf8.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
  }
  var out = "";
  for (var j = 0; j < utf8.length; j += 3) {
    var b0 = utf8[j], b1 = utf8[j + 1], b2 = utf8[j + 2];
    var enc0 = b0 >> 2;
    var enc1 = ((b0 & 3) << 4) | ((b1 || 0) >> 4);
    var enc2 = ((b1 & 15) << 2) | ((b2 || 0) >> 6);
    var enc3 = b2 & 63;
    out += chars.charAt(enc0) + chars.charAt(enc1);
    out += (j + 1 < utf8.length) ? chars.charAt(enc2) : "=";
    out += (j + 2 < utf8.length) ? chars.charAt(enc3) : "=";
  }
  return out;
}
