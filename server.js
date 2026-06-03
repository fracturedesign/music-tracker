import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, createReadStream, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname, basename } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import multer from "multer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.DATA_PATH || join(__dirname, "data.json");
const DATA_DIR  = dirname(DATA_FILE);
const AUDIO_DIR = join(DATA_DIR, "audio");
const PORT = process.env.PORT || 3001;

mkdirSync(AUDIO_DIR, { recursive: true });

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

/* ── key-value data API ── */
app.get("/api/data/:key", (req, res) => {
  const data = readData();
  res.json({ value: data[req.params.key] ?? null });
});

app.post("/api/data/:key", (req, res) => {
  const data = readData();
  data[req.params.key] = req.body.value;
  writeData(data);
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

// Scan a folder — finds .wav/.mp3 files and registers them without copying
app.post("/api/audio/:project/scan", async (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: "folderPath required" });
  if (!existsSync(folderPath)) return res.status(404).json({ error: "Folder not found" });

  let entries;
  try {
    entries = readdirSync(folderPath);
  } catch (e) {
    return res.status(500).json({ error: `Cannot read folder: ${e.message}` });
  }

  const data = readData();
  if (!data.music_audio_files) data.music_audio_files = {};
  if (!data.music_audio_files[req.params.project]) data.music_audio_files[req.params.project] = [];
  const existing = data.music_audio_files[req.params.project];
  const existingPaths = new Set(existing.map(f => f.linkedPath).filter(Boolean));

  const { nameFilter } = req.body; // optional: only register files whose basename contains this string
  const audioExts = [".wav", ".mp3"];
  const toAdd = entries
    .filter(e => audioExts.includes(extname(e).toLowerCase()))
    .filter(e => !nameFilter || basename(e, extname(e)).toLowerCase().includes(nameFilter.toLowerCase()))
    .map(e => join(folderPath, e))
    .filter(p => !existingPaths.has(p));

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

/* ── SPA fallback ── */
app.get("*", (req, res) => {
  const index = join(distPath, "index.html");
  if (existsSync(index)) res.sendFile(index);
  else res.status(404).send("Run `npm run build` first.");
});

app.listen(PORT, () => console.log(`Music Tracker running on http://localhost:${PORT}`));
