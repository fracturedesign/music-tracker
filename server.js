import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname } from "path";
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

/* ── audio analysis via ffmpeg ── */
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

  // Loudness via ebur128 filter
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

    const intMatch     = out.match(/\bI:\s*([-\d.]+)\s*LUFS/);
    const lraMatch     = out.match(/\bLRA:\s*([\d.]+)\s*LU/);
    const peakMatch    = out.match(/\bPeak:\s*([-\d.]+)\s*dBFS/);
    const lraHighMatch = out.match(/LRA high:\s*([-\d.]+)\s*LUFS/);

    if (intMatch)     lufsIntegrated = parseFloat(intMatch[1]);
    if (lraHighMatch) lufsShort      = parseFloat(lraHighMatch[1]);
    if (lraMatch)     dr             = parseFloat(lraMatch[1]);
    if (peakMatch)    truePeak       = parseFloat(peakMatch[1]);
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

// Rename
app.patch("/api/audio/:project/:id", (req, res) => {
  const { project, id } = req.params;
  const { name } = req.body;
  const data  = readData();
  const files = (data.music_audio_files || {})[project];
  if (!files) return res.status(404).json({ error: "Project not found" });
  const idx = files.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: "File not found" });
  files[idx] = { ...files[idx], name };
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
  try { unlinkSync(join(AUDIO_DIR, file.filename)); } catch {}
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
