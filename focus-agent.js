import { createServer } from "https";
import { readFileSync } from "fs";
import { exec } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3099;
const SHORTCUT = "Music Production";

const ssl = {
  key:  readFileSync(join(__dirname, ".focus-agent-ssl/key.pem")),
  cert: readFileSync(join(__dirname, ".focus-agent-ssl/cert.pem")),
};

createServer(ssl, (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/focus") {
    exec(`osascript -e 'tell application "Shortcuts Events" to run shortcut "${SHORTCUT}"'`, { timeout: 10_000 }, (err) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, "127.0.0.1", () =>
  console.log(`Orbit focus agent → https://127.0.0.1:${PORT}`)
);
