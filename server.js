import express from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data.json");
const PORT = process.env.PORT || 3001;

function readData() {
  if (!existsSync(DATA_FILE)) return {};
  try { return JSON.parse(readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}

function writeData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json({ limit: "2mb" }));

// Serve built frontend in production
const distPath = join(__dirname, "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get("/api/data/:key", (req, res) => {
  const data = readData();
  const value = data[req.params.key] ?? null;
  res.json({ value });
});

app.post("/api/data/:key", (req, res) => {
  const data = readData();
  data[req.params.key] = req.body.value;
  writeData(data);
  res.json({ ok: true });
});

// SPA fallback (production)
app.get("*", (req, res) => {
  const index = join(distPath, "index.html");
  if (existsSync(index)) res.sendFile(index);
  else res.status(404).send("Run `npm run build` first.");
});

app.listen(PORT, () => console.log(`Music Tracker running on http://localhost:${PORT}`));
