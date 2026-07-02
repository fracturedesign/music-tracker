/*
 * orbit.node.js  —  runs inside a [node.script orbit.node.js] object in OrbitSync.
 *
 * Receives base64 payloads from orbit.v8.js, resolves the Orbit project name,
 * POSTs to the Orbit server, and buffers to disk when the server is unreachable
 * so nothing is lost when you're offline / off the Tailnet.
 *
 * Messages in (from Max):
 *   "sync" <base64>   -> queue + attempt flush
 *   "url"  <string>   -> set the Orbit base URL (from the UI field)
 *   "project" <name>  -> manual project override (also forwarded to v8)
 *   "flushnow"        -> retry the queue now
 *
 * Messages out (to Max):
 *   "sent"            -> tell v8 the buffered events were delivered
 *   "status" <string> -> UI feedback
 */

const Max = require("max-api");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

// Persist queue + config next to the user's home so it survives set reloads.
const BASE_DIR = path.join(os.homedir(), "OrbitSync");
const QUEUE_DIR = path.join(BASE_DIR, "queue");
const CONFIG_FILE = path.join(BASE_DIR, "config.json");
try { fs.mkdirSync(QUEUE_DIR, { recursive: true }); } catch (e) {}

let config = loadConfig();
let flushing = false;
let cachedProject = null; // { name, at }

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
  catch (e) { return { url: "http://192.168.68.79:3001", projectOverride: "" }; }
}
function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch (e) {}
}

/* ───────────────────────── Max handlers ───────────────────────── */

Max.addHandler("url", (...args) => {
  config.url = String(args.join(" ")).trim().replace(/\/+$/, "");
  saveConfig();
  Max.outlet("status", "URL: " + config.url);
});

Max.addHandler("project", (...args) => {
  config.projectOverride = String(args.join(" ")).trim();
  saveConfig();
});

Max.addHandler("sync", async (b64) => {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(String(b64), "base64").toString("utf8"));
  } catch (e) {
    Max.post("orbit: bad payload " + e.message);
    return;
  }
  // Resolve project: manual override wins, else sniff Live's window title.
  payload.project =
    (payload.projectOverride && payload.projectOverride.length ? payload.projectOverride : null) ||
    config.projectOverride ||
    (await detectProject()) ||
    "Untitled";
  payload.host = os.hostname();

  // Persist to queue, then try to flush the whole queue.
  const file = path.join(QUEUE_DIR, payload.stats.updatedAt + "_" + payload.sessionId + ".json");
  try { fs.writeFileSync(file, JSON.stringify(payload)); } catch (e) {}
  flushQueue();
});

Max.addHandler("flushnow", () => flushQueue());

/* ─────────────────────── project detection ─────────────────────── */
// The LOM can't reveal the .als filename, so on macOS we read Live's window
// title ("My Set [Ableton Live 12 Suite]") via AppleScript. Best-effort.
function detectProject() {
  if (cachedProject && Date.now() - cachedProject.at < 15000) {
    return Promise.resolve(cachedProject.name);
  }
  if (process.platform !== "darwin") return Promise.resolve(null);
  const script =
    'tell application "System Events" to tell (first process whose name contains "Live") to get name of front window';
  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      // Strip trailing "[Ableton Live 12 Suite]" / "- Ableton Live" and "*" dirty marker
      let name = stdout.trim()
        .replace(/\s*[\[(].*Ableton.*[\])]\s*$/i, "")
        .replace(/\s*[-—]\s*Ableton Live.*$/i, "")
        .replace(/\*$/, "").trim();
      name = name || null;
      cachedProject = { name, at: Date.now() };
      resolve(name);
    });
  });
}

/* ─────────────────────────── flushing ──────────────────────────── */

async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    const files = fs.readdirSync(QUEUE_DIR).filter((f) => f.endsWith(".json")).sort();
    let deliveredEvents = false;
    for (const f of files) {
      const full = path.join(QUEUE_DIR, f);
      let payload;
      try { payload = JSON.parse(fs.readFileSync(full, "utf8")); }
      catch (e) { fs.unlinkSync(full); continue; } // corrupt -> drop
      const ok = await postToOrbit(payload);
      if (!ok) { Max.outlet("status", "offline · " + files.length + " queued"); break; }
      if (payload.events && payload.events.length) deliveredEvents = true;
      fs.unlinkSync(full);
    }
    const remaining = fs.readdirSync(QUEUE_DIR).filter((f) => f.endsWith(".json")).length;
    if (remaining === 0) {
      if (deliveredEvents) Max.outlet("sent"); // let v8 drop its event buffer
      Max.outlet("status", "synced ✓");
    }
  } catch (e) {
    Max.post("orbit flush error: " + e.message);
  } finally {
    flushing = false;
  }
}

function postToOrbit(payload) {
  const url = (config.url || "").replace(/\/+$/, "") + "/api/ableton/sync";
  const body = JSON.stringify(payload);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(6000)
  })
    .then((r) => r.ok)
    .catch(() => false);
}

Max.outlet("status", "orbit.node ready");
Max.post("OrbitSync node started. URL=" + config.url + " queue=" + QUEUE_DIR);
