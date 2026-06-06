import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, createReadStream, statSync } from "fs";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { fileURLToPath } from "url";
import { dirname, join, extname, basename } from "path";
import { exec } from "child_process";
import { promisify } from "util";
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
  const toAdd = walkDir(folderPath)
    .filter(f => audioExts.includes(extname(f).toLowerCase()))
    .filter(f => nameMatchesProject(f, nameFilter))
    .filter(f => !existingPaths.has(f));

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
  if (name  !== undefined) files[idx] = { ...files[idx], name };
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
      const ts  = Date.now().toString();
      const rnd = Math.random().toString(36).slice(2, 6);
      const ext = extname(file.originalname).toLowerCase() || ".m4a";
      cb(null, `${ts}${rnd}${ext}`);
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
  res.json({ recordings: data.music_recordings || [] });
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
  const id  = filename.replace(ext, "");
  const meta = {
    id,
    name:         name || `tape-${id}`,
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
  if (name        !== undefined) recs[idx] = { ...recs[idx], name };
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
