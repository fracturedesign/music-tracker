import { exec } from "child_process";

const ORBIT_URL = process.env.ORBIT_URL || "https://tower-1.tail88bb12.ts.net:3443";
const POLL_MS   = 2000;
const SHORTCUT  = "Music Production";

let prevPhase = null;

async function poll() {
  try {
    const res  = await fetch(`${ORBIT_URL}/api/timer-phase`);
    const { phase } = await res.json();

    if (prevPhase !== null && prevPhase !== phase) {
      const wasRunning = prevPhase === "running";
      const isRunning  = phase     === "running";
      if (wasRunning !== isRunning) {
        console.log(`[focus-agent] ${prevPhase} → ${phase}, toggling focus`);
        exec(`osascript -e 'tell application "Shortcuts Events" to run shortcut "${SHORTCUT}"'`,
          (err) => { if (err) console.error("[focus-agent] shortcut error:", err.message); }
        );
      }
    }
    prevPhase = phase;
  } catch (e) {
    // server unreachable — silent, will retry
  }
}

console.log(`Orbit focus agent polling ${ORBIT_URL} every ${POLL_MS}ms`);
poll();
setInterval(poll, POLL_MS);
