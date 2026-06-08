import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, createReadStream, statSync, renameSync } from "fs";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer, Agent as HttpsAgent } from "https";
import { fileURLToPath } from "url";
import { dirname, join, extname, basename } from "path";
import { exec } from "child_process";
import { promisify } from "util";

// Allow self-signed certs for internal NAS / Tailscale CouchDB calls
// undici is the underlying HTTP library for Node 18+ built-in fetch
let _undiciAgent = null;
async function insecureFetch(url, opts={}) {
  if (!url.startsWith("https://")) return fetch(url, opts);
  if (!_undiciAgent) {
    try {
      const undici = await import("undici");
      _undiciAgent = new undici.Agent({ connect:{ rejectUnauthorized:false } });
    } catch {
      // undici not available — fall back to env flag
      _undiciAgent = "env";
    }
  }
  if (_undiciAgent !== "env") {
    return fetch(url, { ...opts, dispatcher:_undiciAgent });
  }
  // env flag fallback
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try { return await fetch(url, opts); }
  finally { process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev ?? undefined; }
}
import multer from "multer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE   = process.env.DATA_PATH || join(__dirname, "data.json");
const DATA_DIR    = dirname(DATA_FILE);
const AUDIO_DIR   = join(DATA_DIR, "audio");
const PORT        = process.env.PORT       || 3001;
const HTTPS_PORT  = process.env.HTTPS_PORT || 3443;
const HTTPS_HOST  = process.env.HTTPS_HOST || "";
const SSL_DIR     = join(DATA_DIR, "ssl");
const CERT_FILE   = join(SSL_DIR, "cert.pem");
const KEY_FILE    = join(SSL_DIR, "key.pem");

mkdirSync(AUDIO_DIR, { recursive: true });

const RECORDINGS_DIR = join(DATA_DIR, "recordings");
mkdirSync(RECORDINGS_DIR, { recursive: true });

const execAsync = promisify(exec);

function readData() {
  if (!existsSync(DATA_FILE)) return {};
  try { return JSON.parse(readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}

function writeData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Seed Obsidian config on first run (values set here are overridable from settings UI)
(function seedObsidianConfig() {
  const data = readData();
  if (!data.music_obsidian_config?.url) {
    data.music_obsidian_config = {
      url:        "http://192.168.68.79:5984",
      db:         "obsidian",
      user:       "admin",
      pass:       "Plains789",
      passphrase: "BorisVilly",
      folder:     "AIOS/Orbit",
    };
    writeData(data);
  }
})();

/* ── audio analysis via ffmpeg ──
   Parse only the Summary block so we never pick up a per-frame I: value
   (per-frame values start near -70 LUFS and converge; the Summary is final). */
async function analyzeAudio(filePath) {
  let duration = 0, lufsIntegrated = null, lufsShort = null, dr = null, truePeak = null;

  // Duration via ffprobe
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}"`,
      { timeout: 30_000 }
    );
    const probe = JSON.parse(stdout);
    duration = Math.round(parseFloat(probe.format?.duration || 0));
  } catch (e) {
    console.error("ffprobe error:", e.message);
  }

  // Loudness via ebur128 filter — parse Summary section only
  try {
    let out = "";
    try {
      const r = await execAsync(
        `ffmpeg -nostats -i "${filePath}" -af ebur128=peak=true -f null -`,
        { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 }
      );
      out = r.stderr;
    } catch (e) {
      // ffmpeg exits non-zero when output is /dev/null — stderr still has the data
      out = e.stderr || "";
    }

    // Scope all regexes to the Summary block at the end of the output
    const summaryMatch = out.match(/Summary:([\s\S]*)$/);
    const s = summaryMatch ? summaryMatch[1] : "";

    if (s) {
      const intMatch     = s.match(/I:\s*([-\d.]+)\s*LUFS/);
      const lraMatch     = s.match(/LRA:\s*([\d.]+)\s*LU/);
      const peakMatch    = s.match(/Peak:\s*([-\d.]+)\s*dBFS/);
      const lraHighMatch = s.match(/LRA high:\s*([-\d.]+)\s*LUFS/);

      if (intMatch)     lufsIntegrated = parseFloat(intMatch[1]);
      if (lraHighMatch) lufsShort      = parseFloat(lraHighMatch[1]);
      if (lraMatch)     dr             = parseFloat(lraMatch[1]);
      if (peakMatch)    truePeak       = parseFloat(peakMatch[1]);
    }
  } catch (e) {
    console.error("ffmpeg analysis error:", e.message);
  }

  return { duration, lufsIntegrated, lufsShort, dr, truePeak };
}

/* ── SSE broadcast ── */
const sseClients = new Set();

function broadcast(key) {
  const msg = `data: ${JSON.stringify({ key })}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

/* ── express setup ── */
const app = express();
app.use(express.json({ limit: "2mb" }));

// Serve built frontend
const distPath = join(__dirname, "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Serve uploaded audio files
app.use("/api/audio/files", express.static(AUDIO_DIR));

/* ── multer ── */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AUDIO_DIR),
    filename:    (req, file, cb) => {
      const id  = Date.now().toString();
      const ext = extname(file.originalname).toLowerCase();
      cb(null, id + ext);
    },
  }),
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    [".wav", ".mp3"].includes(ext)
      ? cb(null, true)
      : cb(new Error("Only .wav and .mp3 files are allowed"));
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

/* ── SSE endpoint ── */
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  sseClients.add(res);
  // Keep-alive ping every 25s so proxies/browsers don't close idle connections
  const ping = setInterval(() => {
    try { res.write(":ping\n\n"); } catch { sseClients.delete(res); clearInterval(ping); }
  }, 25000);
  req.on("close", () => { sseClients.delete(res); clearInterval(ping); });
});

/* ── key-value data API ── */
app.get("/api/data/:key", (req, res) => {
  const data = readData();
  res.json({ value: data[req.params.key] ?? null });
});

app.post("/api/data/:key", (req, res) => {
  const data = readData();
  data[req.params.key] = req.body.value;
  writeData(data);
  broadcast(req.params.key);
  res.json({ ok: true });
  // Auto-sync Obsidian on sessions or projects change
  const k = req.params.key;
  if (k === "music_sessions" || k === "music_projects") {
    syncAllObsidianNotes().catch(e=>console.error("[Obsidian sync]", e.message));
  }
});

/* ── audio API ── */

// List files for a project
app.get("/api/audio/:project", (req, res) => {
  const data  = readData();
  const files = (data.music_audio_files || {})[req.params.project] || [];
  res.json({ files });
});

// Stream a linked (scanned) file by project + id
app.get("/api/audio/:project/stream/:id", (req, res) => {
  const { project, id } = req.params;
  const data  = readData();
  const files = (data.music_audio_files || {})[project] || [];
  const file  = files.find(f => f.id === id);
  if (!file?.linkedPath || !existsSync(file.linkedPath)) {
    return res.status(404).json({ error: "File not found" });
  }
  const stat = statSync(file.linkedPath);
  const ext  = extname(file.linkedPath).toLowerCase();
  const mime = ext === ".wav" ? "audio/wav" : "audio/mpeg";
  const range = req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Range":  `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges":  "bytes",
      "Content-Length": end - start + 1,
      "Content-Type":   mime,
    });
    createReadStream(file.linkedPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": stat.size, "Content-Type": mime });
    createReadStream(file.linkedPath).pipe(res);
  }
});

// Upload + analyse
app.post("/api/audio/:project/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const { filename, originalname, size } = req.file;
  const ext  = extname(originalname).toLowerCase();
  const id   = filename.replace(ext, "");
  const analysis = await analyzeAudio(join(AUDIO_DIR, filename));
  const meta = {
    id,
    name:     originalname.replace(/\.[^.]+$/, ""),
    filename,
    format:   ext === ".wav" ? "WAV" : "MP3",
    size:     parseFloat((size / (1024 * 1024)).toFixed(2)),
    ...analysis,
    uploadedAt: new Date().toISOString(),
  };
  const data = readData();
  if (!data.music_audio_files) data.music_audio_files = {};
  if (!data.music_audio_files[req.params.project]) data.music_audio_files[req.params.project] = [];
  data.music_audio_files[req.params.project].push(meta);
  writeData(data);
  res.json({ file: meta });
});

// Recursively walk a directory, returning full file paths (skips unreadable dirs)
function walkDir(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walkDir(full));
      else results.push(full);
    }
  } catch {} // silently skip permission-denied dirs
  return results;
}

// Scan a folder (recursively) — finds .wav/.mp3 files and registers them without copying
app.post("/api/audio/:project/scan", async (req, res) => {
  const { folderPath, nameFilter } = req.body;
  if (!folderPath) return res.status(400).json({ error: "folderPath required" });
  if (!existsSync(folderPath)) return res.status(404).json({ error: "Folder not found" });

  const data = readData();
  if (!data.music_audio_files) data.music_audio_files = {};
  if (!data.music_audio_files[req.params.project]) data.music_audio_files[req.params.project] = [];
  const existing = data.music_audio_files[req.params.project];
  const existingPaths = new Set(existing.map(f => f.linkedPath).filter(Boolean));

  const audioExts = [".wav", ".mp3"];
  // Match files whose basename equals the project name OR follows one of these patterns:
  //   "Project - anything"   (dash-separated version/mix label)
  //   "Project v2" / "Project_v2"  (version number)
  //   "Project (anything)"   (parenthesised label)
  //   "Project Final" / "Project Mixdown" / "Project Final Mixdown" (wildcard words only)
  // This prevents "Overgrown Statue" from matching project "Overgrown".
  const WILDCARD_WORDS = new Set(['final', 'mixdown']);
  const matchesBase = (base, f) => {
    if (base === f) return true;
    if (!base.startsWith(f)) return false;
    const rest = base.slice(f.length);
    if (/^ - /.test(rest)) return true;           // " - Mix 1", " - Master"
    if (/^[_ ]v\d/.test(rest)) return true;       // "_v2", " v2"
    if (/^ \(/.test(rest)) return true;           // " (Master)"
    // Wildcard-only suffix: one or more of the allowed words separated by space/underscore
    const words = rest.replace(/^[\s_]+/, '').split(/[\s_]+/);
    return words.length > 0 && words[0] !== '' && words.every(w => WILDCARD_WORDS.has(w));
  };
  const nameMatchesProject = (filePath, filter) => {
    if (!filter) return true;
    const base = basename(filePath, extname(filePath)).toLowerCase();
    const f = filter.toLowerCase();
    if (matchesBase(base, f)) return true;
    // If the project name ends with a version suffix (e.g. "Moss v3"),
    // also try matching against the stripped name ("Moss") so that
    // files named "Moss v4.mp3" etc. still match.
    const stripped = f.replace(/[\s_]v\d+$/i, '').trim();
    if (stripped && stripped !== f) return matchesBase(base, stripped);
    return false;
  };
  const allFound = walkDir(folderPath)
    .filter(f => audioExts.includes(extname(f).toLowerCase()))
    .filter(f => nameMatchesProject(f, nameFilter));

  // Reconcile stale linked entries: if a known file no longer exists at its
  // linkedPath but a newly found file lives in the same directory, treat it as
  // a rename rather than adding a duplicate.
  const reconciledPaths = new Set();
  for (const entry of existing) {
    if (!entry.linkedPath) continue;
    if (existsSync(entry.linkedPath)) continue; // still alive — no action needed
    const staleDir = dirname(entry.linkedPath);
    const staleExt = extname(entry.linkedPath).toLowerCase();
    const candidates = allFound.filter(f =>
      dirname(f) === staleDir &&
      extname(f).toLowerCase() === staleExt &&
      !existingPaths.has(f) &&
      !reconciledPaths.has(f)
    );
    if (candidates.length === 1) {
      // Exactly one new file in the same dir with the same ext → it's a rename
      const newPath = candidates[0];
      reconciledPaths.add(newPath);
      entry.linkedPath = newPath;
      entry.name       = basename(newPath, extname(newPath));
    }
  }

  const toAdd = allFound.filter(f => !existingPaths.has(f) && !reconciledPaths.has(f));

  const added = [];
  for (const filePath of toAdd) {
    const ext     = extname(filePath).toLowerCase();
    const id      = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    const rawName = basename(filePath, ext);
    let   stat;
    try { stat = statSync(filePath); } catch { continue; }
    const analysis = await analyzeAudio(filePath);
    const meta = {
      id,
      name:       rawName,
      linkedPath: filePath,
      format:     ext === ".wav" ? "WAV" : "MP3",
      size:       parseFloat((stat.size / (1024 * 1024)).toFixed(2)),
      ...analysis,
      isNew:      true,
      scannedAt:  new Date().toISOString(),
    };
    existing.push(meta);
    added.push(meta);
    // small delay so IDs are unique when folder has many files
    await new Promise(r => setTimeout(r, 2));
  }

  writeData(data);
  res.json({ added: added.length, files: existing });
});

// Rename / update metadata fields
app.patch("/api/audio/:project/:id", (req, res) => {
  const { project, id } = req.params;
  const { name, isNew } = req.body;
  const data  = readData();
  const files = (data.music_audio_files || {})[project];
  if (!files) return res.status(404).json({ error: "Project not found" });
  const idx = files.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: "File not found" });

  if (name !== undefined) {
    const file = files[idx];
    // Determine which path to rename on disk
    const oldDiskPath = file.linkedPath || (file.filename ? join(AUDIO_DIR, file.filename) : null);
    let updated = { ...file, name };
    if (oldDiskPath && existsSync(oldDiskPath)) {
      const dir     = dirname(oldDiskPath);
      const ext     = extname(oldDiskPath).toLowerCase();
      const newBase = name.replace(/[^\w\s.()\-]/g, "_").trim() || "audio";
      let   newFile = `${newBase}${ext}`;
      let   n       = 1;
      while (existsSync(join(dir, newFile)) && join(dir, newFile) !== oldDiskPath) {
        newFile = `${newBase}_${n++}${ext}`;
      }
      const newPath = join(dir, newFile);
      try {
        renameSync(oldDiskPath, newPath);
        if (file.linkedPath) updated.linkedPath = newPath;
        else                  updated.filename   = newFile;
      } catch (e) {
        console.error("rename failed:", e.message);
      }
    }
    files[idx] = updated;
  }
  if (isNew !== undefined) files[idx] = { ...files[idx], isNew };
  writeData(data);
  res.json({ ok: true });
});

// Delete
app.delete("/api/audio/:project/:id", (req, res) => {
  const { project, id } = req.params;
  const data  = readData();
  const files = (data.music_audio_files || {})[project];
  if (!files) return res.status(404).json({ error: "Project not found" });
  const file = files.find(f => f.id === id);
  if (!file) return res.status(404).json({ error: "File not found" });
  // Only delete from disk if it was uploaded (not linked)
  if (!file.linkedPath) {
    try { unlinkSync(join(AUDIO_DIR, file.filename)); } catch {}
  }
  data.music_audio_files[project] = files.filter(f => f.id !== id);
  writeData(data);
  res.json({ ok: true });
});

// Rename a project — updates the key in music_audio_files
app.post("/api/projects/rename", (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: "oldName and newName required" });
  const data = readData();
  if (data.music_audio_files?.[oldName] !== undefined) {
    data.music_audio_files[newName] = data.music_audio_files[oldName];
    delete data.music_audio_files[oldName];
  }
  writeData(data);
  res.json({ ok: true });
});

/* ── recordings API ── */
const recordingUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const d      = readData();
      const folder = d.music_recordings_folder || RECORDINGS_DIR;
      try { mkdirSync(folder, { recursive: true }); } catch {}
      cb(null, folder);
    },
    filename: (req, file, cb) => {
      const ext  = extname(file.originalname).toLowerCase() || ".m4a";
      const base = basename(file.originalname, ext)
        .replace(/[^\w\s.-]/g, "_").replace(/\s+/g, "-").trim() || "tape";
      const d   = readData();
      const dir = d.music_recordings_folder || RECORDINGS_DIR;
      let name  = `${base}${ext}`;
      let n     = 1;
      while (existsSync(join(dir, name))) { name = `${base}_${n++}${ext}`; }
      cb(null, name);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.get("/api/recordings/folder", (req, res) => {
  const data = readData();
  res.json({ path: data.music_recordings_folder || RECORDINGS_DIR });
});

app.get("/api/recordings", (req, res) => {
  const data = readData();
  const recs = data.music_recordings || [];
  const audioExts = new Set([".m4a", ".webm", ".ogg", ".wav", ".mp3"]);

  // Build set of all currently-tracked paths so we don't steal a path
  // that belongs to another entry.
  const trackedPaths = new Set(recs.map(r => r.absolutePath || join(RECORDINGS_DIR, r.filename)).filter(Boolean));

  let dirty = false;
  for (const rec of recs) {
    const currentPath = rec.absolutePath || join(RECORDINGS_DIR, rec.filename);
    if (existsSync(currentPath)) continue; // still alive, nothing to do

    // File is gone — look for a renamed file in the same directory
    const dir = dirname(currentPath);
    const ext = extname(currentPath).toLowerCase();
    let candidates;
    try {
      candidates = readdirSync(dir)
        .filter(f => audioExts.has(extname(f).toLowerCase()) && extname(f).toLowerCase() === ext)
        .map(f => join(dir, f))
        .filter(f => !trackedPaths.has(f));
    } catch { continue; }

    if (candidates.length === 0) continue;

    // Pick best candidate by mtime proximity to the recording's createdAt timestamp.
    // If the recording has no createdAt, fall back to single-candidate rule.
    let best = null;
    if (rec.createdAt) {
      const created = new Date(rec.createdAt).getTime();
      let minDiff = Infinity;
      for (const f of candidates) {
        try {
          const mtime = statSync(f).mtimeMs;
          const diff = Math.abs(mtime - created);
          if (diff < minDiff) { minDiff = diff; best = f; }
        } catch {}
      }
      // Only accept if mtime is within 10 minutes of createdAt (avoids wild mismatches)
      if (minDiff > 10 * 60 * 1000) best = candidates.length === 1 ? candidates[0] : null;
    } else {
      best = candidates.length === 1 ? candidates[0] : null;
    }

    if (best) {
      trackedPaths.delete(currentPath);
      trackedPaths.add(best);
      rec.absolutePath = best;
      rec.filename     = basename(best);
      rec.name         = basename(best, ext);
      dirty = true;
    }
  }

  if (dirty) {
    data.music_recordings = recs;
    writeData(data);
    broadcast("music_recordings");
  }

  res.json({ recordings: recs });
});

app.post("/api/recordings/upload", recordingUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const { name, projectName } = req.body;
  const { filename, size, destination } = req.file;
  const absolutePath = join(destination, filename);
  let duration = 0;
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format "${absolutePath}"`,
      { timeout: 30_000 }
    );
    duration = parseFloat(JSON.parse(stdout).format?.duration || 0);
  } catch {}
  const ext = extname(filename).toLowerCase();
  const id  = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const meta = {
    id,
    name:         name || basename(filename, ext),
    filename,
    absolutePath,
    duration,
    size:         parseFloat((size / (1024 * 1024)).toFixed(2)),
    projectName:  projectName || null,
    createdAt:    new Date().toISOString(),
  };
  const data = readData();
  if (!data.music_recordings) data.music_recordings = [];
  data.music_recordings.push(meta);
  writeData(data);
  broadcast("music_recordings");
  res.json({ recording: meta });
});

app.get("/api/recordings/stream/:id", (req, res) => {
  const data = readData();
  const rec  = (data.music_recordings || []).find(r => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: "Not found" });
  const filePath = rec.absolutePath || join(RECORDINGS_DIR, rec.filename);
  if (!existsSync(filePath)) return res.status(404).json({ error: "File missing" });
  const stat = statSync(filePath);
  const ext  = extname(rec.filename).toLowerCase();
  const mime = ext === ".m4a" || ext === ".mp4" ? "audio/mp4"
             : ext === ".webm" ? "audio/webm"
             : ext === ".ogg"  ? "audio/ogg"
             : "audio/mpeg";
  const range = req.headers.range;
  if (range) {
    const [s, e] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(s, 10);
    const end   = e ? parseInt(e, 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Range":  `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges":  "bytes",
      "Content-Length": end - start + 1,
      "Content-Type":   mime,
    });
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": stat.size, "Content-Type": mime, "Accept-Ranges": "bytes" });
    createReadStream(filePath).pipe(res);
  }
});

app.patch("/api/recordings/:id", (req, res) => {
  const { name, projectName } = req.body;
  const data = readData();
  const recs = data.music_recordings || [];
  const idx  = recs.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  if (name !== undefined) {
    const rec     = recs[idx];
    const oldPath = rec.absolutePath || join(RECORDINGS_DIR, rec.filename);
    if (existsSync(oldPath)) {
      const dir     = dirname(oldPath);
      const ext     = extname(rec.filename).toLowerCase();
      const newBase = name.replace(/[^\w\s.-]/g, "_").replace(/\s+/g, "-").trim() || "tape";
      let   newFile = `${newBase}${ext}`;
      let   n       = 1;
      while (existsSync(join(dir, newFile)) && join(dir, newFile) !== oldPath) {
        newFile = `${newBase}_${n++}${ext}`;
      }
      const newPath = join(dir, newFile);
      try {
        renameSync(oldPath, newPath);
        recs[idx] = { ...recs[idx], name, filename: newFile, absolutePath: newPath };
      } catch { recs[idx] = { ...recs[idx], name }; }
    } else {
      recs[idx] = { ...recs[idx], name };
    }
  }

  if (projectName !== undefined) recs[idx] = { ...recs[idx], projectName };
  writeData(data);
  broadcast("music_recordings");
  res.json({ ok: true });
});

app.delete("/api/recordings/:id", (req, res) => {
  const data = readData();
  const recs = data.music_recordings || [];
  const rec  = recs.find(r => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: "Not found" });
  try { unlinkSync(rec.absolutePath || join(RECORDINGS_DIR, rec.filename)); } catch {}
  data.music_recordings = recs.filter(r => r.id !== req.params.id);
  writeData(data);
  broadcast("music_recordings");
  res.json({ ok: true });
});

/* ── Obsidian LiveSync integration ── */

function getObsidianCfg() { return readData().music_obsidian_config || null; }

// Compute a LiveSync-compatible chunk ID: "h:+" + first 8 bytes of SHA-256 as base36
import { createHash } from "crypto";
function liveSyncChunkId(content) {
  const hash = createHash("sha256").update(content).digest();
  const num = BigInt("0x" + hash.slice(0, 8).toString("hex"));
  return "h:+" + num.toString(36).padStart(13, "0");
}

// Write one note using LiveSync's actual chunked "plain" format:
//   parent doc  → { type:"plain", children:[chunkId], path, ctime, mtime, size, eden:{} }
//   chunk doc   → { type:"leaf", data: markdown }
async function obsidianPut(docPath, markdown) {
  const cfg = getObsidianCfg();
  if (!cfg?.url || !cfg?.db) throw new Error("Obsidian not configured");
  const auth = "Basic " + Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64");
  const base  = `${cfg.url}/${cfg.db}`;
  const now   = Date.now();

  // ── 1. Write chunk document (content-addressed, skip if already exists) ──
  const chunkId  = liveSyncChunkId(markdown);
  const chunkUrl = `${base}/${encodeURIComponent(chunkId)}`;
  const chunkGet = await insecureFetch(chunkUrl, { headers:{ Authorization:auth }, signal:AbortSignal.timeout(8000) });
  if (chunkGet.status === 404) {
    const cp = await insecureFetch(chunkUrl, { method:"PUT",
      headers:{ "Content-Type":"application/json", Authorization:auth },
      body: JSON.stringify({ _id:chunkId, type:"leaf", data:markdown }),
      signal: AbortSignal.timeout(10000) });
    if (!cp.ok) {
      const txt = await cp.text().catch(()=>"");
      throw new Error(`CouchDB chunk PUT ${cp.status}: ${txt.slice(0,200)}`);
    }
  }

  // ── 2. Get current _rev of parent doc ──
  const parentUrl = `${base}/${encodeURIComponent(docPath)}`;
  let rev;
  try {
    const r = await insecureFetch(parentUrl, { headers:{ Authorization:auth }, signal:AbortSignal.timeout(8000) });
    if (r.ok) { const j = await r.json(); rev = j._rev; }
    else if (r.status !== 404) {
      const txt = await r.text().catch(()=>"");
      throw new Error(`CouchDB GET ${r.status}: ${txt.slice(0,120)}`);
    }
  } catch(e) { if (e.message?.startsWith("CouchDB")) throw e; }

  // ── 3. Write parent document ──
  const doc = { _id:docPath, ...(rev?{_rev:rev}:{}),
    type:"plain", children:[chunkId], path:docPath,
    ctime:now, mtime:now, size:markdown.length, eden:{} };
  const pr = await insecureFetch(parentUrl, { method:"PUT",
    headers:{ "Content-Type":"application/json", Authorization:auth },
    body: JSON.stringify(doc), signal: AbortSignal.timeout(10000) });
  if (!pr.ok) {
    const txt = await pr.text().catch(()=>"");
    throw new Error(`CouchDB PUT ${pr.status}: ${txt.slice(0,200)}`);
  }
}

// ── Markdown generators ──

const MD_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MD_DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function mdDurMins(m) { const h=Math.floor(m/60),mn=m%60; return h?`${h}h${mn?` ${mn}m`:""}`:`${mn}m`; }
function mdWeekStart(dateStr, off=0) {
  const d=new Date(dateStr+"T12:00:00"); const dow=(d.getDay()+6)%7;
  d.setDate(d.getDate()-dow-off*7); return d.toISOString().slice(0,10);
}
function mdWeekEnd(weekStartStr) {
  const d=new Date(weekStartStr+"T12:00:00"); d.setDate(d.getDate()+6); return d.toISOString().slice(0,10);
}
function mdISOWeek(dateStr) {
  const d=new Date(dateStr+"T12:00:00");
  const jan4=new Date(d.getFullYear(),0,4); const dow=(jan4.getDay()+6)%7;
  const wk=Math.ceil((((d-jan4)/86400000)+dow+1)/7);
  return `${d.getFullYear()}-W${String(wk).padStart(2,"0")}`;
}
function mdSyncLine() {
  return new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
// Values in data.json may be raw objects/arrays OR JSON strings depending on client
function mdVal(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return raw; } }
  return raw;
}
function mdParseQuests(data) {
  try { return mdVal(data.music_quests); } catch { return null; }
}

function generateDashboardMd(data) {
  const sessions = mdVal(data.music_sessions) || [];
  const projects = (mdVal(data.music_projects) || []).filter(p=>!p.parentGroup&&!["done","released","idea"].includes(p.status||"active"));
  const quests = mdParseQuests(data);
  const today = new Date().toISOString().slice(0,10);
  const ws = mdWeekStart(today), we = mdWeekEnd(ws);
  const wSess = sessions.filter(s=>s.date>=ws&&s.date<=we);
  const wMins = wSess.reduce((a,s)=>a+s.duration,0);
  const tMins = sessions.reduce((a,s)=>a+s.duration,0);
  const goal  = (mdVal(data.music_goal)||0)*60;

  // streak
  const dateSet=new Set(sessions.map(s=>s.date));
  let streak=0; const sd=new Date();
  while(dateSet.has(sd.toISOString().slice(0,10))){ streak++; sd.setDate(sd.getDate()-1); }

  const last = sessions.length ? sessions.reduce((a,b)=>a.date>b.date?a:b) : null;
  const xp   = quests?.xp||0;
  const lvl  = Math.floor(xp/50)+1;
  const xpIn = xp%50;

  const goalRow = goal ? `| Goal progress | ${mdDurMins(wMins)} / ${mdDurMins(goal)} (${Math.min(100,Math.round(wMins/goal*100))}%) |\n` : "";
  const projRows = projects.map(p=>`- [[${p.name}]] · ${p.status||"active"}`).join("\n")||"_No active projects_";
  const dailyQ  = quests?.currentDaily ? quests.currentDaily.map(q=>`- [${q.done?"x":" "}] ${q.text||""}`).join("\n") : "";
  const weeklyQ = quests?.currentWeekly ? `- [${quests.currentWeekly.done?"x":" "}] ${quests.currentWeekly.text||""}` : "";

  return `---
type: orbit-dashboard
updated: ${today}
---

# 🎵 Orbit Dashboard
*Last synced: ${mdSyncLine()}*

## 📊 This Week (${ws} → ${we})

| Metric | Value |
|--------|-------|
| Sessions | ${wSess.length} |
| Time logged | ${mdDurMins(wMins)} |
| Days active | ${[...new Set(wSess.map(s=>s.date))].length}/7 |
${goalRow}
## 🔥 Overall

| | |
|--|--|
| Current streak | ${streak} day${streak!==1?"s":""} |
| Total sessions | ${sessions.length} |
| Total time | ${mdDurMins(tMins)} |
| Last session | ${last?last.date:"—"} |
| XP Level | ⭐ Level ${lvl} · ${xpIn}/50 XP |

## 🎯 Active Projects (${projects.length})

${projRows}

${dailyQ?`## ✅ Daily Quests\n\n${dailyQ}\n`:""}
${weeklyQ?`## 🗓 Weekly Quest\n\n${weeklyQ}\n`:""}`;
}

function generateActiveProjectsMd(data) {
  const sessions = mdVal(data.music_sessions) || [];
  const allProjects = mdVal(data.music_projects) || [];
  const active  = allProjects.filter(p=>!p.parentGroup&&!["done","released","idea"].includes(p.status||"active"));
  const done    = allProjects.filter(p=>["done","released"].includes(p.status||""));
  const today   = new Date().toISOString().slice(0,10);
  const ws = mdWeekStart(today), we = mdWeekEnd(ws);

  const rows = active.map(p => {
    const ps = sessions.filter(s=>s.project===p.name);
    const last = ps.length ? ps.reduce((a,b)=>a.date>b.date?a:b).date : "—";
    const wm = ps.filter(s=>s.date>=ws&&s.date<=we).reduce((a,s)=>a+s.duration,0);
    const tm = ps.reduce((a,s)=>a+s.duration,0);
    return `| [[${p.name}]] | ${p.status||"active"} | ${last} | ${wm?mdDurMins(wm):"—"} | ${tm?mdDurMins(tm):"—"} |`;
  });

  return `---
type: orbit-projects
updated: ${today}
---

# 🎵 Active Projects
*Last synced: ${mdSyncLine()}*

| Project | Status | Last Session | This Week | Total |
|---------|--------|--------------|-----------|-------|
${rows.join("\n")||"| _None_ | — | — | — | — |"}

---

## ✅ Done / Released

${done.map(p=>`- [[${p.name}]] · ${p.status}`).join("\n")||"_None yet_"}`;
}

function generateSessionMd(data, dateStr) {
  const daySessions = (mdVal(data.music_sessions)||[]).filter(s=>s.date===dateStr).sort((a,b)=>(a.hour||0)-(b.hour||0));
  const d = new Date(dateStr+"T12:00:00");
  const heading = `${MD_DAYS[d.getDay()]} ${d.getDate()} ${MD_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const totalMins = daySessions.reduce((a,s)=>a+s.duration,0);
  const moodMap = { great:"🟢 Great", good:"🟡 Good", okay:"🟠 Okay", rough:"🔴 Rough" };

  const blocks = daySessions.map(s => {
    const timeStr = s.hour!=null ? ` · ${String(s.hour).padStart(2,"0")}:00` : "";
    const mood    = s.mood ? ` · ${moodMap[s.mood]||s.mood}` : "";
    return `### ${s.project?`[[${s.project}]]`:"_No project_"} · ${mdDurMins(s.duration)}${timeStr}${mood}

${s.notes||"_No notes_"}`;
  }).join("\n\n");

  return `---
type: orbit-session
date: ${dateStr}
sessions: ${daySessions.length}
total_mins: ${totalMins}
projects: [${[...new Set(daySessions.filter(s=>s.project).map(s=>s.project))].join(", ")}]
---

# Sessions — ${heading}

${daySessions.length ? `**${daySessions.length} session${daySessions.length!==1?"s":""} · ${mdDurMins(totalMins)} total**\n\n${blocks}` : "_No sessions logged this day._"}`;
}

function generateWeeklyReviewMd(data, weekStart) {
  const sessions = mdVal(data.music_sessions) || [];
  const projects = (mdVal(data.music_projects)||[]).filter(p=>!p.parentGroup&&!["done","released","idea"].includes(p.status||"active"));
  const quests   = mdParseQuests(data);
  const we  = mdWeekEnd(weekStart);
  const wk  = mdISOWeek(weekStart);
  const wSess = sessions.filter(s=>s.date>=weekStart&&s.date<=we);
  const wMins = wSess.reduce((a,s)=>a+s.duration,0);
  const wDays = [...new Set(wSess.map(s=>s.date))].length;

  const byProj = {};
  wSess.forEach(s=>{ if(s.project) byProj[s.project]=(byProj[s.project]||0)+s.duration; });
  const topProj = Object.entries(byProj).sort((a,b)=>b[1]-a[1]);

  const inactive = projects.filter(p=>{
    const last = sessions.filter(s=>s.project===p.name).reduce((best,s)=>s.date>best?s.date:best,"");
    return !last||last<weekStart;
  });

  const dailyXp = quests ? (quests.completedDailyHistory||[]).filter(h=>h.date>=weekStart&&h.date<=we).length : 0;
  const weeklyXp = quests?.currentWeekly?.done ? 10 : 0;
  const totalXp = dailyXp+weeklyXp;

  const d1=new Date(weekStart+"T12:00:00"), d2=new Date(we+"T12:00:00");
  const fmt=d=>`${d.getDate()} ${MD_MONTHS[d.getMonth()]}`;

  const projBars = topProj.map(([name,mins])=>{
    const pct=wMins>0?Math.round(mins/wMins*10):0;
    return `- **[[${name}]]** · ${mdDurMins(mins)} \`${"█".repeat(pct)}${"░".repeat(10-pct)}\``;
  }).join("\n")||"_No sessions this week_";

  return `---
type: orbit-weekly-review
week: ${wk}
week_start: ${weekStart}
week_end: ${we}
sessions: ${wSess.length}
total_mins: ${wMins}
days_active: ${wDays}
xp_earned: ${totalXp}
---

# Weekly Review — ${wk}
## ${fmt(d1)} – ${fmt(d2)} ${d2.getFullYear()}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Sessions | ${wSess.length} |
| Time logged | ${mdDurMins(wMins)} |
| Days active | ${wDays}/7 |
| ⭐ XP earned | +${totalXp}${dailyXp?` (${dailyXp} daily${weeklyXp?" + weekly":""})`:""}  |

## 🎵 Time by Project

${projBars}

${inactive.length ? `## 😴 No Activity This Week\n\n${inactive.map(p=>`- [[${p.name}]]`).join("\n")}` : ""}`;
}

async function syncAllObsidianNotes(specificDate) {
  const cfg = getObsidianCfg();
  if (!cfg?.url || !cfg?.db) return;
  const folder = (cfg.folder||"AIOS/Orbit").replace(/\/+$/,"");
  const data = readData();
  const today = new Date().toISOString().slice(0,10);
  const dateToSync = specificDate || today;
  const ws = mdWeekStart(today);
  await Promise.all([
    obsidianPut(`${folder}/Dashboard.md`,             generateDashboardMd(data)),
    obsidianPut(`${folder}/Active Projects.md`,       generateActiveProjectsMd(data)),
    obsidianPut(`${folder}/Sessions/${dateToSync}.md`,generateSessionMd(data,dateToSync)),
    obsidianPut(`${folder}/Weekly Review/${mdISOWeek(ws)}.md`, generateWeeklyReviewMd(data,ws)),
  ]);
}

// Config endpoints
app.get("/api/obsidian/config", (req, res) => {
  const cfg = getObsidianCfg() || {};
  res.json({ url:cfg.url||"", db:cfg.db||"", user:cfg.user||"",
    pass:cfg.pass||"", passphrase:cfg.passphrase||"",
    folder:cfg.folder||"AIOS/Orbit" });
});

app.post("/api/obsidian/config", (req, res) => {
  const { url, db, user, pass, passphrase, folder } = req.body;
  const data = readData();
  const existing = data.music_obsidian_config || {};
  data.music_obsidian_config = {
    url: url||existing.url||"",
    db:  db||existing.db||"",
    user:user||existing.user||"",
    pass:pass!==undefined?pass:existing.pass||"",
    passphrase:passphrase!==undefined?passphrase:existing.passphrase||"",
    folder:folder||existing.folder||"AIOS/Orbit",
  };
  writeData(data);
  res.json({ ok:true });
});

// Manual sync endpoint
app.post("/api/obsidian/sync", async (req, res) => {
  const cfg = getObsidianCfg();
  if (!cfg?.url || !cfg?.db) return res.status(400).json({ error:"Obsidian not configured" });
  try {
    await syncAllObsidianNotes();
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Diagnostic: list all CouchDB databases, then inspect docs in configured db
app.get("/api/obsidian/inspect", async (req, res) => {
  const cfg = getObsidianCfg();
  if (!cfg?.url) return res.status(400).json({ error:"not configured" });
  const auth = "Basic " + Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64");
  try {
    // List all databases
    const dbsR = await insecureFetch(`${cfg.url}/_all_dbs`, { headers:{Authorization:auth}, signal:AbortSignal.timeout(10000) });
    const dbs = await dbsR.json();

    // Try to read docs from configured db
    let docs = [];
    if (cfg.db) {
      try {
        const allR = await insecureFetch(`${cfg.url}/${cfg.db}/_all_docs?limit=20&include_docs=true`, { headers:{Authorization:auth}, signal:AbortSignal.timeout(10000) });
        const allJ = await allR.json();
        docs = (allJ.rows||[]).map(r=>({
          id: r.id,
          type: r.doc?.type,
          dataType: Array.isArray(r.doc?.data) ? "array" : typeof r.doc?.data,
          dataPreview: typeof r.doc?.data === "string" ? r.doc.data.slice(0,80) : JSON.stringify(r.doc?.data)?.slice(0,80),
          children: r.doc?.children,
          size: r.doc?.size,
          fields: Object.keys(r.doc||{})
        }));
      } catch(e2) { docs = [{error: e2.message}]; }
    }
    res.json({ allDatabases: dbs, configuredDb: cfg.db, docs });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── SSL info & cert download ── */
app.get("/api/ssl-info", (req, res) => {
  const available = existsSync(CERT_FILE) && existsSync(KEY_FILE);
  res.json({
    httpsAvailable: available,
    httpsPort:      Number(HTTPS_PORT),
    httpsHost:      HTTPS_HOST || null,
    httpsUrl:       available && HTTPS_HOST ? `https://${HTTPS_HOST}:${HTTPS_PORT}` : null,
  });
});

// Served with x509 MIME type so iOS Safari triggers the "Install Certificate" flow
app.get("/api/ssl-cert", (req, res) => {
  if (!existsSync(CERT_FILE)) return res.status(404).json({ error: "No cert" });
  res.setHeader("Content-Type", "application/x-x509-ca-cert");
  res.setHeader("Content-Disposition", 'attachment; filename="music-tracker.crt"');
  createReadStream(CERT_FILE).pipe(res);
});

/* ── SPA fallback ── */
app.get("*", (req, res) => {
  const index = join(distPath, "index.html");
  if (existsSync(index)) res.sendFile(index);
  else res.status(404).send("Run `npm run build` first.");
});

/* ── Self-signed cert generation ── */
async function ensureSslCert() {
  if (existsSync(CERT_FILE) && existsSync(KEY_FILE)) return true;
  if (!HTTPS_HOST) return false;
  try {
    mkdirSync(SSL_DIR, { recursive: true });
    const cfgPath = join(SSL_DIR, "openssl.cnf");
    writeFileSync(cfgPath,
`[req]
distinguished_name = req_dn
x509_extensions    = v3_req
prompt             = no
[req_dn]
CN = MusicTracker
[v3_req]
subjectAltName     = @alt_names
keyUsage           = critical,digitalSignature,keyEncipherment
extendedKeyUsage   = serverAuth
basicConstraints   = critical,CA:TRUE
[alt_names]
IP.1  = ${HTTPS_HOST}
DNS.1 = ${HTTPS_HOST}
`);
    await execAsync(
      `openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
       -keyout "${KEY_FILE}" -out "${CERT_FILE}" -config "${cfgPath}"`,
      { timeout: 30_000 }
    );
    console.log(`SSL cert generated for ${HTTPS_HOST} → ${CERT_FILE}`);
    return true;
  } catch (e) {
    console.error("SSL cert generation failed:", e.message);
    return false;
  }
}

/* ── Start servers ── */
createHttpServer(app).listen(PORT, () =>
  console.log(`Music Tracker HTTP  → http://localhost:${PORT}`)
);

ensureSslCert().then(ok => {
  if (!ok) return;
  try {
    const opts = { cert: readFileSync(CERT_FILE), key: readFileSync(KEY_FILE) };
    createHttpsServer(opts, app).listen(HTTPS_PORT, () =>
      console.log(`Music Tracker HTTPS → https://${HTTPS_HOST}:${HTTPS_PORT}`)
    );
  } catch (e) {
    console.error("HTTPS server failed to start:", e.message);
  }
});
