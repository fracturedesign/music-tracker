# OrbitSync — Ableton ↔ Orbit Max for Live device

Tracks how long you actually work in a Live Set, records a milestone timeline of
what you change (tracks, clips, devices, scenes, tempo, key), captures project
stats (BPM, key, counts), and syncs it all to your Orbit app.

## Why Max for Live (and not an Extension or VST)

Ableton's new **Extensions SDK** only runs on-demand from a right-click menu, once,
then stops — it explicitly can't run in the background or react to events, so it
can't do continuous time-tracking or a live change feed. A **VST/AU** plugin has no
native access to Live's project structure. **Max for Live** runs persistently inside
the Set with full Live Object Model (LOM) access and can make outbound HTTP calls —
exactly what this needs.

## Architecture

```
Live Set ──LOM──▶ [v8 orbit.v8.js] ──base64 payload──▶ [node.script orbit.node.js] ──HTTP POST──▶ Orbit /api/ableton/sync
                    observers + timer                     buffering + retry
```

- **`orbit.v8.js`** — watches the LOM. Live observers on tempo / key / play state
  for precise capture, plus an 8-second snapshot-diff that detects track/clip/device/
  scene add · remove · rename. Runs an **activity-based work timer**: it accrues
  seconds only while you're playing or editing, and pauses after 3 minutes idle
  (mirrors Orbit's "thinking window").
- **`orbit.node.js`** — receives payloads, resolves the Orbit project name, POSTs to
  Orbit, and **queues to disk** (`~/OrbitSync/queue/`) so nothing is lost when you're
  offline or off the Tailnet. Retries the whole queue on every sync.

### Project matching
The LOM does **not** expose the `.als` filename (Ableton keeps it private). So:
1. If you type a name in the device's **project** field → that wins.
2. Else on macOS the Node script sniffs Live's window title via AppleScript
   (needs Accessibility permission for Max/Live under System Settings → Privacy).
3. Else falls back to `"Untitled"`.

The project name must match an Orbit project (case-insensitive) for the **Ableton**
tab to appear on that project.

## Install (one-time, ~2 min)

The two `.js` files do all the work; the device is just wiring. Because a Live device
must be an `.amxd` created in the editor, copy the provided patch in:

1. Copy `orbit.v8.js` and `orbit.node.js` next to where you'll save the device, or into
   your Max search path (e.g. `~/Documents/Max 8/Library/`), so the objects can find them.
2. In Live: drag a **Max Audio Effect** onto any track (e.g. the Master). Click the
   **edit** (pencil/wrench) button to open the Max editor.
3. Open `OrbitSync.maxpat` in Max (File → Open). Select all (⌘A), copy (⌘C).
4. Switch to the empty device editor, paste (⌘V). You should see the URL field,
   project field, `v8`, `node.script`, and status boxes wired together.
5. **⌘S** to save the device — name it `OrbitSync.amxd`. Freeze it (padlock icon in
   the editor toolbar) if you want the two `.js` files bundled inside the `.amxd`.

## Configure

- **Orbit URL** field — defaults to the NAS LAN IP `http://192.168.68.79:3001`.
  For access outside your home network, paste your **Tailscale** URL for the NAS
  (e.g. `http://<nas-name>.<tailnet>.ts.net:3001` or `http://100.x.x.x:3001`).
  The Mac running Ableton must be on the Tailnet. The value is remembered in
  `~/OrbitSync/config.json`.
- **Project** field — leave blank for auto-detect, or type the exact Orbit project name.
- **Sync now** — forces an immediate flush (also retries any queued payloads).

Add the device to any Set you want tracked (drop it on the Master track). Data appears
under the project's new **Ableton** tab in Orbit, updating live over SSE.

## Payload contract (device → Orbit)

`POST {url}/api/ableton/sync`

```json
{
  "kind": "ableton_sync",
  "sessionId": "s_...",
  "projectOverride": "",
  "project": "Midnight Drive",
  "host": "mac",
  "stats": {
    "tempo": 124, "key": "A Minor", "rootNote": 9, "scaleName": "Minor", "scaleOn": 1,
    "trackCount": 8, "sceneCount": 5, "clipCount": 22, "deviceCount": 12,
    "activeSeconds": 4530, "startedAt": 0, "updatedAt": 0
  },
  "events": [
    { "id": "e_...", "ts": 0, "type": "track_added", "detail": "808 Bass", "meta": {} }
  ]
}
```

Event `type`s: `session_start`, `tempo_changed`, `key_changed`,
`track_added` · `track_removed` · `track_renamed`,
`device_added` · `device_removed`, `clip_added` · `clip_removed`,
`scene_added` · `scene_removed`.

Server stores everything under the `music_ableton_sessions` key (keyed by `sessionId`,
events deduped by `id`, latest stats snapshot wins), and broadcasts SSE so the Orbit
UI updates in real time.

## Notes / limits

- Clip counting walks each track's session slots every 8s (capped at 256 slots/track)
  plus arrangement clips — fine for normal Sets; very large Sets add a little CPU.
- `v8` object requires Max 8.5+ (bundled with Live 12 Suite). If you're on an older
  build, rename the object to `js` — the code is ES5-compatible.
- Node for Max requires Node installed with Max; it ships with Live Suite.
