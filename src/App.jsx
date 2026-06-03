import { useState, useEffect, useCallback, useRef } from "react";

/* ─────────────────────────  constants & helpers  ───────────────────────── */

const MOOD_EMOJI = ["", "😓", "😐", "🙂", "😊", "🔥"];

const PROMPTS = [
  "Make something beautiful today.",
  "Chase the sound in your head.",
  "Press record, see what happens.",
  "One loop can become a song.",
  "Start before you feel ready.",
  "Trust your ears today.",
  "Finish something today.",
  "Show up for the music.",
  "Turn an idea into a take.",
];
const DAYS_MON = ["M", "T", "W", "T", "F", "S", "S"];
const DAYS_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const C = {
  bg: "#0b0b10", surf: "#131320", surf2: "#1a1a2a",
  line: "rgba(255,255,255,0.055)", lineS: "rgba(255,255,255,0.1)",
  text: "#f3f3f8", muted: "#8a8a9e", faint: "#6a6a86", dim: "#55556a",
  indigo: "#818cf8", deep: "#6366f1", green: "#34d399", greenS: "#6ee7b7", flame: "#fb923c",
};

function toDateStr(d) { return d.toLocaleDateString("en-CA", { timeZone: "Europe/Budapest" }); }
function parseDate(str) { const [y, m, d] = str.split("-").map(Number); return new Date(y, m - 1, d); }
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function heatColor(mins) {
  if (!mins) return "#16162a";
  if (mins < 45) return "#312e81";
  if (mins < 90) return "#4f46e5";
  if (mins < 150) return "#7c8cf8";
  return "#a5b4fc";
}
function fmtDur(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}
function fmtDate(ds) {
  const d = parseDate(ds);
  return `${DAYS_FULL[(d.getDay() + 6) % 7]} ${monthNames[d.getMonth()]} ${d.getDate()}`;
}
function dayKeyUTC(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
function keyToUTCms(s) { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); }

function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = n => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}

const today = toDateStr(new Date());
const yesterday = toDateStr(new Date(Date.now() - 86400000));
const newForm = (date = today) => ({ date, duration: 60, mood: 3, note: "", project: "" });

// Storage helpers — talk to the Express backend
const storage = {
  async get(key) { const r = await fetch(`/api/data/${key}`); return r.json(); },
  async set(key, value) {
    await fetch(`/api/data/${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }),
    });
  },
};

/* ─────────────────────────  shared style atoms  ───────────────────────── */

const card = { background: C.surf, border: `1px solid ${C.line}`, borderRadius: 20, padding: 20, marginBottom: 14 };
const eyebrow = { fontSize: 11.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.faint, whiteSpace: "nowrap" };
const iconBtn = {
  width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer",
  border: `1px solid ${C.lineS}`, background: "rgba(255,255,255,0.03)", flexShrink: 0, padding: 0,
};

const Icon = {
  pencil: (c = "#9a9ab2") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/><path d="M14 6l4 4" stroke={c} strokeWidth="1.8"/></svg>,
  trash: (c = "#c08a8a") => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  close: (c = "#9a9ab2") => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  note: (c = "#9a9ab2") => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 4h14v12l-5 5H5V4z" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/><path d="M14 21v-5h5" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/></svg>,
};

/* ─────────────────────────  project notes modal  ───────────────────────── */

function parseLines(text) {
  return (text || "").split("\n").map(line => {
    if (/^-x /i.test(line)) return { type: "check", checked: true, content: line.slice(3) };
    if (/^- /.test(line)) return { type: "check", checked: false, content: line.slice(2) };
    return { type: "text", content: line };
  });
}
function serializeLines(lines) {
  return lines.map(l => l.type === "check" ? (l.checked ? "-x " : "- ") + l.content : l.content).join("\n");
}

function ProjectNotes({ name, notes, onSave, onClose }) {
  const [text, setText] = useState(notes || "");
  const [lines, setLines] = useState(() => parseLines(notes));
  const [mode, setMode] = useState("preview");

  const toPreview = () => { setLines(parseLines(text)); setMode("preview"); };
  const toEdit = () => { setText(serializeLines(lines)); setMode("edit"); };
  const toggle = i => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, checked: !l.checked } : l));
  const close = () => { onSave(mode === "edit" ? text : serializeLines(lines)); onClose(); };

  const empty = lines.length === 0 || (lines.length === 1 && lines[0].content === "");

  return (
    <div className="overlay" style={{ alignItems: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && close()}>
      <div style={{ background: C.surf, borderRadius: 22, border: `1px solid ${C.lineS}`, width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", animation: "mtpop .22s ease" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 20px" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>start a line with <span className="mono" style={{ color: C.indigo }}>-</span> for a checkbox</div>
          </div>
          <button onClick={close} style={iconBtn}>{Icon.close()}</button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "0 20px 14px" }}>
          {[["preview", "Preview"], ["edit", "Edit"]].map(([m, label]) => (
            <button key={m} onClick={m === "preview" ? toPreview : toEdit}
              style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                background: mode === m ? "rgba(129,140,248,0.16)" : "transparent", color: mode === m ? C.indigo : C.faint }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: 220, maxHeight: "52vh", overflowY: "auto", borderTop: `1px solid ${C.line}` }}>
          {mode === "preview" ? (
            <div style={{ padding: "18px 20px" }}>
              {empty
                ? <div style={{ color: C.dim, fontSize: 13.5 }}>No notes yet — switch to Edit to add some.</div>
                : lines.map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    {l.type === "check" ? (
                      <>
                        <button onClick={() => toggle(i)} style={{ flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: 5,
                          border: `1.5px solid ${l.checked ? C.deep : "#3a3a52"}`, background: l.checked ? C.deep : "transparent",
                          cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>
                          {l.checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                        <span style={{ fontSize: 14, lineHeight: 1.5, color: l.checked ? C.dim : C.text, textDecoration: l.checked ? "line-through" : "none" }}>{l.content}</span>
                      </>
                    ) : (
                      <span className="mono" style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, paddingLeft: 28 }}>{l.content || " "}</span>
                    )}
                  </div>
                ))
              }
            </div>
          ) : (
            <textarea className="mt" value={text} onChange={e => setText(e.target.value)}
              placeholder={"Notes and to-dos…\n\n- Record main melody\n- Mix bass\n\nPlain text lines work too."}
              style={{ minHeight: 220, borderRadius: 0, border: "none", background: "transparent", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7, padding: "18px 20px" }} />
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 20px", borderTop: `1px solid ${C.line}` }}>
          <button onClick={close} style={{ background: "linear-gradient(135deg,#818cf8,#6366f1)", border: "none", borderRadius: 12, color: "#fff", padding: "11px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Save &amp; close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  date picker (custom calendar)  ───────────────────────── */

function CalendarPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const d = parseDate(value); return { y: d.getFullYear(), m: d.getMonth() }; });

  const pad = n => String(n).padStart(2, "0");
  const mk = d => `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
  const firstDay = new Date(view.y, view.m, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: dim }, (_, i) => mk(i + 1))];

  const pick = ds => { onChange(ds); setOpen(false); };
  const step = dir => setView(({ y, m }) => {
    const nm = m + dir;
    return nm < 0 ? { y: y - 1, m: 11 } : nm > 11 ? { y: y + 1, m: 0 } : { y, m: nm };
  });

  return (
    <div>
      <button type="button" onClick={() => { const d = parseDate(value); setView({ y: d.getFullYear(), m: d.getMonth() }); setOpen(o => !o); }}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left",
          background: C.surf2, border: `1px solid ${open ? "rgba(129,140,248,0.5)" : C.line}`, borderRadius: 12,
          color: C.text, fontFamily: "var(--font-sans)", fontSize: 14, padding: "13px 14px" }}>
        <span style={{ fontWeight: 600 }}>{value === today ? "Today" : value === yesterday ? "Yesterday" : fmtDate(value)}</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="16.5" rx="3" stroke={C.muted} strokeWidth="1.7"/><path d="M3 9h18M8 2.5v4M16 2.5v4" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round"/></svg>
      </button>

      {open && (
        <div style={{ marginTop: 10, background: C.surf2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button type="button" onClick={() => step(-1)} style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{monthNames[view.m]} {view.y}</span>
            <button type="button" onClick={() => step(1)} style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 5 }}>
            {DAYS_MON.map((d, i) => <div key={i} style={{ fontSize: 10.5, color: C.dim, textAlign: "center" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {cells.map((ds, i) => {
              if (!ds) return <div key={i} />;
              const isSel = ds === value, isToday = ds === today, future = ds > today;
              return (
                <button key={ds} type="button" disabled={future} onClick={() => pick(ds)} style={{
                  aspectRatio: "1", borderRadius: 10, border: isToday && !isSel ? `1.5px solid ${C.indigo}` : "1.5px solid transparent",
                  background: isSel ? "linear-gradient(135deg,#818cf8,#6366f1)" : "transparent",
                  color: isSel ? "#fff" : future ? "#3a3a4c" : isToday ? C.indigo : C.text,
                  fontSize: 13, fontWeight: isSel ? 700 : 500, cursor: future ? "default" : "pointer", fontFamily: "var(--font-sans)",
                }}>{Number(ds.slice(8))}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {[["Today", today], ["Yesterday", yesterday]].map(([label, ds]) => (
              <button key={label} type="button" onClick={() => pick(ds)} style={{
                flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                border: value === ds ? "1px solid rgba(129,140,248,0.6)" : `1px solid ${C.lineS}`,
                background: value === ds ? "rgba(129,140,248,0.16)" : "transparent", color: value === ds ? C.indigo : C.muted,
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────  project picker (custom dropdown)  ───────────────────────── */

function ProjectPicker({ value, projects, onChange }) {
  const [open, setOpen] = useState(false);
  const opts = [{ name: "", label: "— none —" }, ...projects.map(p => ({ name: p.name, label: p.name }))];
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left",
        background: C.surf2, border: `1px solid ${open ? "rgba(129,140,248,0.5)" : C.line}`, borderRadius: 12,
        color: value ? C.text : C.muted, fontFamily: "var(--font-sans)", fontSize: 14, padding: "13px 14px" }}>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "— none —"}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }}><path d="M6 9l6 6 6-6" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div style={{ marginTop: 8, background: C.surf2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
          {opts.map(o => {
            const sel = o.name === value;
            return (
              <button key={o.name || "none"} type="button" onClick={() => { onChange(o.name); setOpen(false); }} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: 10, border: "none",
                cursor: "pointer", background: sel ? "rgba(129,140,248,0.16)" : "transparent",
                color: o.name ? (sel ? C.indigo : C.text) : C.muted, fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)", textAlign: "left" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                {sel && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M5 13l4 4L19 7" stroke={C.indigo} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────  log session sheet  ───────────────────────── */

function LogSheet({ initial, editing, projects, onSubmit, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const set = patch => setForm(f => ({ ...f, ...patch }));

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>{editing ? "Edit session" : "Log a session"}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{fmtDate(form.date)}</div>
          </div>
          <button onClick={onClose} style={iconBtn}>{Icon.close()}</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Date</div>
            <CalendarPicker value={form.date} onChange={d => set({ date: d })} />
          </div>
          <div>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Project</div>
            <ProjectPicker value={form.project} projects={projects} onChange={p => set({ project: p })} />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={eyebrow}>Duration</span>
              <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: C.indigo }}>{fmtDur(form.duration)}</span>
            </div>
            <input type="range" className="mt" min="5" max="480" step="5" value={form.duration} onChange={e => set({ duration: Number(e.target.value) })} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.dim, marginTop: 7 }}>
              <span>5m</span><span>2h</span><span>4h</span><span>8h</span>
            </div>
          </div>

          <div>
            <div style={{ ...eyebrow, marginBottom: 10 }}>Mood</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => set({ mood: n })} style={{
                  flex: 1, aspectRatio: "1", borderRadius: 14, fontSize: 23, cursor: "pointer",
                  border: form.mood === n ? `2px solid ${C.indigo}` : "2px solid transparent",
                  background: form.mood === n ? "rgba(129,140,248,0.18)" : C.surf2,
                  transform: form.mood === n ? "translateY(-3px)" : "none", transition: "all .16s",
                }}>{MOOD_EMOJI[n]}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ ...eyebrow, marginBottom: 10 }}>Note <span style={{ textTransform: "none", letterSpacing: 0, color: C.dim }}>(optional)</span></div>
            <input type="text" className="mt-text" value={form.note} placeholder="What did you work on?" onChange={e => set({ note: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {editing && (
              <button onClick={onDelete} style={{ ...iconBtn, width: 52, height: "auto", borderColor: "rgba(192,138,138,0.3)", background: "rgba(192,138,138,0.08)" }}>
                {Icon.trash()}
              </button>
            )}
            <button onClick={() => onSubmit(form)} style={{
              flex: 1, padding: 16, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "var(--font-sans)",
              fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#818cf8,#6366f1)",
              boxShadow: "0 8px 22px -8px rgba(99,102,241,0.6)",
            }}>{editing ? "Save changes" : "Log session"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  all sessions (filterable)  ───────────────────────── */

function AllSessions({ sessions, projects, projectMap, onEdit, onDelete, onClose }) {
  const NONE = "__none__";
  const [filter, setFilter] = useState("All");

  const hasNoProj = sessions.some(s => !s.project);
  const chips = ["All", ...projects.map(p => p.name), ...(hasNoProj ? [NONE] : [])];
  const countFor = c => c === "All" ? sessions.length : c === NONE ? sessions.filter(s => !s.project).length : sessions.filter(s => s.project === c).length;
  const filtered = sessions.filter(s => filter === "All" ? true : filter === NONE ? !s.project : s.project === filter);
  const totalMin = filtered.reduce((a, s) => a + s.duration, 0);

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="grab" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>All sessions</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{filtered.length} session{filtered.length !== 1 ? "s" : ""} · {fmtDur(totalMin)} total</div>
          </div>
          <button onClick={onClose} style={iconBtn}>{Icon.close()}</button>
        </div>

        {/* project filter */}
        <div className="scrollless" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, margin: "0 -2px 16px" }}>
          {chips.map(c => {
            const active = filter === c;
            const label = c === "All" ? "All" : c === NONE ? "No project" : c;
            return (
              <button key={c} onClick={() => setFilter(c)} style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
                padding: "8px 14px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
                border: active ? "1px solid rgba(129,140,248,0.6)" : `1px solid ${C.lineS}`,
                background: active ? "rgba(129,140,248,0.18)" : "transparent",
                color: active ? C.indigo : C.muted,
              }}>
                {label}<span style={{ opacity: 0.55, fontWeight: 500 }}>{countFor(c)}</span>
              </button>
            );
          })}
        </div>

        {/* list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13.5, color: C.dim, textAlign: "center", padding: "28px 0" }}>No sessions for this filter.</div>
          ) : filtered.map(s => {
            const proj = s.project ? projectMap[s.project] : null;
            return (
              <div key={s.id} style={{ background: C.surf2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 11.5, color: C.faint, marginBottom: 4 }}>{s.date}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {s.project && <span style={{ fontSize: 12.5, fontWeight: 600, color: C.indigo, background: "rgba(129,140,248,0.12)", borderRadius: 7, padding: "3px 9px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.project}{proj?.notes ? " 📝" : ""}</span>}
                    {s.note && <span style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.note}</span>}
                    {!s.project && !s.note && <span style={{ fontSize: 12.5, color: C.dim }}>session</span>}
                  </div>
                </div>
                <span style={{ fontSize: 17 }}>{MOOD_EMOJI[s.mood]}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.indigo, minWidth: 52, textAlign: "right" }}>{fmtDur(s.duration)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onEdit(s)} style={iconBtn}>{Icon.pencil()}</button>
                  <button onClick={() => onDelete(s.id)} style={iconBtn}>{Icon.trash()}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  main app  ───────────────────────── */

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [newProject, setNewProject] = useState("");
  const [confirmDelProject, setConfirmDelProject] = useState(null);
  const [notesModal, setNotesModal] = useState(null);
  const [sheet, setSheet] = useState(null); // { form, editing, id } | null
  const [allOpen, setAllOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try { const r = await storage.get("music_sessions"); if (r?.value) setSessions(JSON.parse(r.value)); } catch {}
      try {
        const p = await storage.get("music_projects");
        if (p?.value) { const raw = JSON.parse(p.value); setProjects(raw.map(x => typeof x === "string" ? { name: x, notes: "" } : x)); }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const persistSessions = useCallback(async next => { try { await storage.set("music_sessions", JSON.stringify(next)); } catch {} }, []);
  const persistProjects = useCallback(async next => { try { await storage.set("music_projects", JSON.stringify(next)); } catch {} }, []);

  const flash = msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1900);
  };

  /* countdown timer — persisted per-device */
  const TIMER_PRESETS = [30, 45, 60, 90];
  const [timer, setTimer] = useState(() => {
    try { const r = JSON.parse(localStorage.getItem("music_timer")); if (r && typeof r === "object" && r.phase) return r; } catch {}
    return { phase: "idle", target: 0, endsAt: 0, remaining: 0 };
  });
  const [customMin, setCustomMin] = useState("");
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [tick, setTick] = useState(0);
  useEffect(() => { try { localStorage.setItem("music_timer", JSON.stringify(timer)); } catch {} }, [timer]);
  useEffect(() => {
    if (timer.phase !== "running") return;
    const iv = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(iv);
  }, [timer.phase]);
  useEffect(() => {
    if (timer.phase === "running" && Date.now() >= timer.endsAt) {
      setTimer(t => t.phase === "running" ? { ...t, phase: "done", remaining: 0, endsAt: 0 } : t);
    }
  }, [tick, timer.phase, timer.endsAt]);

  const timerRemaining = timer.phase === "running" ? Math.max(0, timer.endsAt - Date.now()) : timer.remaining;
  const timerElapsed = Math.max(0, timer.target - timerRemaining);
  const timerProgress = timer.target ? Math.min(1, timerElapsed / timer.target) : 0;
  const timerTargetMin = Math.round(timer.target / 60000);
  const timerLogMin = Math.min(480, Math.max(5, Math.round(timerElapsed / 60000 / 5) * 5));
  const showTimerUI = timer.phase !== "idle";

  const openTimerSetup = () => { setCustomMin(""); setTimer({ phase: "setup", target: 0, endsAt: 0, remaining: 0 }); };
  const cancelTimer = () => setTimer({ phase: "idle", target: 0, endsAt: 0, remaining: 0 });
  const startCountdown = mins => {
    const ms = Math.min(480, Math.max(1, Math.round(mins))) * 60000;
    setTimer({ phase: "running", target: ms, endsAt: Date.now() + ms, remaining: ms });
  };
  const pauseCountdown = () => setTimer(t => ({ ...t, phase: "paused", remaining: Math.max(0, t.endsAt - Date.now()), endsAt: 0 }));
  const resumeCountdown = () => setTimer(t => ({ ...t, phase: "running", endsAt: Date.now() + t.remaining }));
  const logCountdown = () => {
    setTimer(t => ({ ...t, phase: t.phase === "running" ? "paused" : t.phase, remaining: timerRemaining, endsAt: 0 }));
    setSheet({ form: { ...newForm(), duration: timerLogMin }, editing: false, id: null, fromTimer: true });
  };

  /* derived */
  const sessionsByDate = sessions.reduce((acc, s) => { acc[s.date] = (acc[s.date] || 0) + s.duration; return acc; }, {});
  const sortedDates = Object.keys(sessionsByDate).sort();

  const { currentStreak, longestStreak } = (() => {
    if (!sortedDates.length) return { currentStreak: 0, longestStreak: 0 };
    const set = new Set(sortedDates);
    const dayMs = 86400000;
    // current streak = consecutive days ending at the most recent logged day
    // (spans across months/years; never resets monthly)
    let cur = 0;
    let t = keyToUTCms(sortedDates[sortedDates.length - 1]);
    while (set.has(dayKeyUTC(t))) { cur++; t -= dayMs; }
    // longest streak anywhere in history
    let longest = 0, streak = 0, prev = null;
    for (const d of sortedDates) {
      if (prev && keyToUTCms(d) - keyToUTCms(prev) === dayMs) streak++; else streak = 1;
      longest = Math.max(longest, streak); prev = d;
    }
    return { currentStreak: cur, longestStreak: longest };
  })();

  const totalSessions = sessions.length, totalMins = sessions.reduce((a, s) => a + s.duration, 0);
  const avgMins = totalSessions ? Math.round(totalMins / totalSessions) : 0;
  const dayCount = Array(7).fill(0);
  sessions.forEach(s => { dayCount[(parseDate(s.date).getDay() + 6) % 7] += s.duration; });
  const bestDay = totalSessions ? DAYS_FULL[dayCount.indexOf(Math.max(...dayCount))] : "—";

  const heatmapCells = (() => {
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const startD = new Date(todayD); startD.setDate(todayD.getDate() - 83);
    const dow = (startD.getDay() + 6) % 7; startD.setDate(startD.getDate() - dow);
    const cells = [];
    for (let i = 0; i < 84; i++) {
      const d = new Date(startD); d.setDate(startD.getDate() + i);
      const ds = toDateStr(d);
      cells.push({ ds, mins: sessionsByDate[ds] || 0, future: d > todayD });
    }
    return cells;
  })();

  // current week (Mon–Sun) strip
  const weekStrip = (() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      const ds = toDateStr(d);
      return { ds, dn: d.getDate(), logged: (sessionsByDate[ds] || 0) > 0, isToday: ds === today, future: d > t };
    });
  })();
  const weekLogged = weekStrip.filter(d => d.logged).length;

  const calCells = (() => {
    const { y, m } = calMonth;
    const firstDay = new Date(y, m, 1), lastDay = new Date(y, m + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    return cells;
  })();

  const todayHasSession = (sessionsByDate[today] || 0) > 0;
  const projectCounts = sessions.reduce((acc, s) => { if (s.project) acc[s.project] = (acc[s.project] || 0) + 1; return acc; }, {});
  const projectMap = Object.fromEntries(projects.map(p => [p.name, p]));
  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  /* actions */
  const commitSession = async (form, id, fromTimer) => {
    let next = id != null ? sessions.map(s => s.id === id ? { ...form, id } : s) : [{ ...form, id: Date.now() }, ...sessions];
    next = next.sort((a, b) => b.date.localeCompare(a.date));
    setSessions(next); await persistSessions(next);
    setSheet(null);
    if (fromTimer) cancelTimer();
    flash(id != null ? "Session updated" : "Session logged ✓");
  };

  const deleteSession = async id => {
    const next = sessions.filter(s => s.id !== id);
    setSessions(next); await persistSessions(next); setSheet(null); flash("Session deleted");
  };

  const startEdit = s => setSheet({ form: { date: s.date, duration: s.duration, mood: s.mood, note: s.note || "", project: s.project || "" }, editing: true, id: s.id });

  const addProject = async () => {
    const name = newProject.trim();
    if (!name || projects.find(p => p.name === name)) return;
    const next = [...projects, { name, notes: "" }];
    setProjects(next); await persistProjects(next); setNewProject("");
  };
  const removeProject = async name => {
    const next = projects.filter(p => p.name !== name);
    setProjects(next); await persistProjects(next); setConfirmDelProject(null);
  };
  const saveNotes = async (name, notes) => {
    const next = projects.map(p => p.name === name ? { ...p, notes } : p);
    setProjects(next); await persistProjects(next);
  };

  if (!loaded) return <div className="app"><div style={{ color: C.faint, padding: "40px 4px", fontSize: 14 }}>Loading…</div></div>;

  const streakLabel = todayHasSession ? currentStreak : (currentStreak || 0);

  return (
    <div className="app">
      {notesModal && (
        <ProjectNotes name={notesModal} notes={projectMap[notesModal]?.notes || ""} onSave={n => saveNotes(notesModal, n)} onClose={() => setNotesModal(null)} />
      )}
      {allOpen && (
        <AllSessions sessions={recent} projects={projects} projectMap={projectMap}
          onEdit={s => startEdit(s)} onDelete={deleteSession} onClose={() => setAllOpen(false)} />
      )}
      {sheet && (
        <LogSheet initial={sheet.form} editing={sheet.editing} projects={projects}
          onSubmit={form => commitSession(form, sheet.id, sheet.fromTimer)} onDelete={() => deleteSession(sheet.id)} onClose={() => setSheet(null)} />
      )}
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 2px 4px" }}>
        <div>
          <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em" }}>Studio Log</div>
          <div style={{ fontSize: 13, color: C.faint, marginTop: 1 }}>Keep the habit. One session at a time.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.surf, border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 13px" }}>
          <span style={{ fontSize: 15 }}>🔥</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{currentStreak}</span>
        </div>
      </div>

      <div className="cols">
      <div className="col col-a">
      {/* Today card */}
      <div className="card" style={{ ...card, padding: 22,
        background: showTimerUI ? (timer.phase === "done" ? "linear-gradient(160deg,#16261f,#111a17)" : "linear-gradient(160deg,#241c3a,#15131f)") : todayHasSession ? "linear-gradient(160deg,#16261f,#111a17)" : "linear-gradient(160deg,#1c1c34,#131326)",
        border: showTimerUI ? (timer.phase === "done" ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(129,140,248,0.4)") : todayHasSession ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(129,140,248,0.28)" }}>
        {timer.phase === "setup" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ ...eyebrow, color: C.indigo }}>Set a timer</span>
              <button onClick={cancelTimer} style={{ fontSize: 12.5, fontWeight: 600, color: C.faint, background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, margin: "16px 0 12px" }}>
              {TIMER_PRESETS.map(m => (
                <button key={m} onClick={() => startCountdown(m)} style={{
                  padding: "16px 0", borderRadius: 13, border: `1px solid ${C.lineS}`, background: C.surf2,
                  color: C.text, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)",
                }}>{m}<span style={{ fontSize: 11.5, fontWeight: 500, color: C.faint }}>m</span></button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input type="number" min="1" max="480" value={customMin} placeholder="Custom minutes…" className="mt-text"
                onChange={e => setCustomMin(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && Number(customMin) > 0) startCountdown(Number(customMin)); }}
                style={{ flex: 1 }} />
              <button onClick={() => { const v = Number(customMin); if (v > 0) startCountdown(v); }} disabled={!(Number(customMin) > 0)} style={{
                border: "none", borderRadius: 12, color: "#fff", padding: "0 22px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                background: "linear-gradient(135deg,#818cf8,#6366f1)", opacity: Number(customMin) > 0 ? 1 : 0.4, fontFamily: "var(--font-sans)",
              }}>Start</button>
            </div>
          </>
        ) : showTimerUI ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ ...eyebrow, color: timer.phase === "done" ? C.greenS : timer.phase === "running" ? C.indigo : C.muted, display: "flex", alignItems: "center", gap: 8 }}>
                <span className={timer.phase === "running" ? "pulse-dot" : ""} style={{ width: 9, height: 9, borderRadius: "50%", background: timer.phase === "done" ? C.green : timer.phase === "running" ? C.indigo : C.dim, boxShadow: timer.phase === "running" ? `0 0 10px ${C.indigo}` : "none" }} />
                {timer.phase === "done" ? "Time’s up" : timer.phase === "running" ? "Focusing" : "Paused"} · {timerTargetMin}m
              </span>
              <button onClick={cancelTimer} style={{ fontSize: 12.5, fontWeight: 600, color: C.faint, background: "transparent", border: "none", cursor: "pointer" }}>Discard</button>
            </div>
            <div className="mono" style={{ fontSize: 50, fontWeight: 700, letterSpacing: "-0.02em", margin: "10px 0 12px", fontVariantNumeric: "tabular-nums", color: timer.phase === "done" ? C.greenS : C.text }}>{fmtClock(timerRemaining)}</div>
            <div style={{ height: 5, borderRadius: 5, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ height: "100%", width: `${timerProgress * 100}%`, borderRadius: 5, background: timer.phase === "done" ? "linear-gradient(90deg,#6ee7b7,#34d399)" : "linear-gradient(90deg,#818cf8,#6366f1)", transition: "width .3s linear" }} />
            </div>
            {timer.phase === "done" ? (
              <button onClick={logCountdown} style={{
                width: "100%", padding: 15, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "var(--font-sans)",
                fontSize: 15.5, fontWeight: 700, color: "#0b0b10", background: "linear-gradient(135deg,#6ee7b7,#34d399)",
              }}>✓ Log {timerTargetMin}m session</button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={timer.phase === "running" ? pauseCountdown : resumeCountdown} style={{
                  flex: 1, padding: 15, borderRadius: 14, cursor: "pointer", border: `1px solid ${C.lineS}`,
                  background: "transparent", color: "#c7c7d6", fontFamily: "var(--font-sans)", fontSize: 15.5, fontWeight: 600,
                }}>{timer.phase === "running" ? "⏸ Pause" : "▶ Resume"}</button>
                <button onClick={logCountdown} style={{
                  flex: 1, padding: 15, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "var(--font-sans)",
                  fontSize: 15.5, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#818cf8,#6366f1)",
                  boxShadow: "0 8px 22px -8px rgba(99,102,241,0.6)",
                }}>✓ Log {timerLogMin}m</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ ...eyebrow, color: todayHasSession ? C.greenS : C.indigo }}>{todayHasSession ? "✓ Logged today" : `Today · ${fmtDate(today)}`}</span>
              {todayHasSession && <span style={{ fontSize: 12.5, color: C.muted }}>{fmtDur(sessionsByDate[today])} total</span>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, margin: "12px 0 18px", lineHeight: 1.3 }}>
              {todayHasSession ? "Nice — today’s in the books." : prompt}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSheet({ form: newForm(), editing: false, id: null })} style={{
                flex: 1, padding: 15, borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "var(--font-sans)",
                fontSize: 15.5, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#818cf8,#6366f1)",
                boxShadow: "0 8px 22px -8px rgba(99,102,241,0.6)",
              }}>{todayHasSession ? "＋ Log another session" : "＋ Log a session"}</button>
              <button onClick={openTimerSetup} style={{
                padding: "15px 18px", borderRadius: 14, cursor: "pointer", border: `1px solid ${C.lineS}`,
                background: "transparent", color: "#c7c7d6", fontFamily: "var(--font-sans)", fontSize: 15.5, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 7,
              }}>▶ Timer</button>
            </div>
          </>
        )}
      </div>

      {/* Week strip */}
      <div className="card" style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <span style={eyebrow}>This week</span>
          <span style={{ fontSize: 12.5, color: C.faint }}>{weekLogged} of 7 logged</span>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {weekStrip.map((d, i) => (
            <button key={d.ds} onClick={() => setSheet({ form: newForm(d.ds), editing: false, id: null })}
              style={{ flex: 1, textAlign: "center", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 7 }}>{DAYS_MON[i]}</div>
              <div style={{
                aspectRatio: "1", borderRadius: 12, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600,
                background: d.logged ? "linear-gradient(135deg,#818cf8,#6366f1)" : d.isToday ? "rgba(129,140,248,0.14)" : "#1b1b2b",
                border: d.isToday && !d.logged ? `1.5px solid ${C.indigo}` : "1.5px solid transparent",
                color: d.logged ? "#fff" : d.isToday ? C.indigo : C.dim, opacity: d.future ? 0.45 : 1,
              }}>{d.logged ? "✓" : d.dn}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="card" style={{ ...card, display: "flex", padding: "18px 8px" }}>
        {[[totalSessions, "sessions"], [(totalMins / 60).toFixed(1) + "h", "total"], [avgMins + "m", "avg"], [bestDay, "best day"]].map(([v, k], i) => (
          <div key={k} style={{ flex: 1, textAlign: "center", borderRight: i < 3 ? `1px solid ${C.line}` : "none" }}>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em" }}>{v}</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{k}</div>
          </div>
        ))}
      </div>

      {/* Activity heatmap */}
      <div className="card" style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <span style={eyebrow}>Activity · 12 weeks</span>
          <span style={{ fontSize: 12.5, color: C.faint }}>longest {longestStreak}d</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: 12 }).map((_, col) => (
            <div key={col} style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              {Array.from({ length: 7 }).map((_, row) => {
                const cell = heatmapCells[col * 7 + row];
                return <div key={row} title={cell && !cell.future ? `${cell.ds}: ${cell.mins}m` : ""}
                  style={{ aspectRatio: "1", borderRadius: 3.5, background: cell?.future ? "transparent" : heatColor(cell?.mins || 0) }} />;
              })}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "flex-end", marginTop: 12, fontSize: 11, color: C.dim }}>
          less
          {["#16162a", "#312e81", "#4f46e5", "#7c8cf8", "#a5b4fc"].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />)}
          more
        </div>
      </div>

      {/* Calendar */}
      <div className="card" style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={eyebrow}>Calendar</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setCalMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })} style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 82, textAlign: "center" }}>{monthNames[calMonth.m]} {calMonth.y}</span>
            <button onClick={() => setCalMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })} style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
          {DAYS_MON.map((d, i) => <div key={i} style={{ fontSize: 10.5, color: C.dim, textAlign: "center" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {calCells.map((ds, i) => {
            if (!ds) return <div key={i} />;
            const isPast = ds < today, isToday = ds === today, hasSess = !!sessionsByDate[ds], missed = isPast && !hasSess;
            return (
              <button key={ds} onClick={() => setSheet({ form: newForm(ds), editing: false, id: null })} style={{
                aspectRatio: "1", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                cursor: "pointer", padding: 0,
                background: isToday ? "rgba(129,140,248,0.14)" : hasSess ? "rgba(129,140,248,0.07)" : "transparent",
                border: isToday ? `1.5px solid ${C.indigo}` : "1.5px solid transparent",
              }}>
                <span style={{ fontSize: 12.5, color: isToday ? C.indigo : hasSess ? C.text : C.faint, fontWeight: hasSess ? 600 : 400 }}>{Number(ds.slice(8))}</span>
                {hasSess ? <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} />
                  : missed ? <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2a2a3c" }} /> : <span style={{ height: 5 }} />}
              </button>
            );
          })}
        </div>
      </div>

      </div>
      <div className="col col-b">
      {/* Projects */}
      <div className="card" style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <span style={eyebrow}>Projects</span>
          {projects.length > 0 && <span style={{ fontSize: 12.5, color: C.faint }}>{projects.length} active</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: projects.length ? 16 : 0 }}>
          <input type="text" className="mt-text" value={newProject} placeholder="Track or project name…"
            onChange={e => setNewProject(e.target.value)} onKeyDown={e => e.key === "Enter" && addProject()} style={{ flex: 1 }} />
          <button onClick={addProject} disabled={!newProject.trim()} style={{
            border: "none", borderRadius: 12, color: "#fff", padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: "linear-gradient(135deg,#818cf8,#6366f1)", opacity: newProject.trim() ? 1 : 0.4, whiteSpace: "nowrap",
          }}>Add</button>
        </div>
        {projects.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map(p => (
              <div key={p.name} style={{ background: C.surf2, borderRadius: 14, padding: "13px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                      {projectCounts[p.name] ? `${projectCounts[p.name]} session${projectCounts[p.name] > 1 ? "s" : ""}` : "no sessions yet"}
                    </div>
                  </div>
                  <button onClick={() => setNotesModal(p.name)} style={{ ...iconBtn, width: "auto", padding: "0 12px", height: 32, gap: 6, display: "flex" }}>
                    {Icon.note(C.indigo)}<span style={{ fontSize: 12, fontWeight: 600, color: C.indigo }}>{p.notes ? "Notes" : "Add"}</span>
                  </button>
                  {confirmDelProject === p.name ? (
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => removeProject(p.name)} style={{ ...iconBtn, width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600, color: "#fca5a5", borderColor: "rgba(192,138,138,0.35)" }}>remove</button>
                      <button onClick={() => setConfirmDelProject(null)} style={{ ...iconBtn, width: "auto", padding: "0 10px", fontSize: 12, color: C.faint }}>×</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelProject(p.name)} style={iconBtn}>{Icon.trash()}</button>
                  )}
                </div>
                {p.notes && (
                  <div onClick={() => setNotesModal(p.name)} style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 11, cursor: "pointer" }}>
                    <pre className="mono" style={{ margin: 0, fontSize: 11.5, color: C.faint, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 56, overflow: "hidden", maskImage: "linear-gradient(to bottom,#000 55%,transparent)", WebkitMaskImage: "linear-gradient(to bottom,#000 55%,transparent)" }}>{p.notes}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent sessions */}
      <div className="card" style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <span style={eyebrow}>Recent sessions</span>
          {recent.length > 0 && (
            <button onClick={() => setAllOpen(true)} style={{
              fontSize: 12.5, fontWeight: 600, color: C.indigo, background: "rgba(129,140,248,0.12)", border: "none",
              borderRadius: 8, padding: "5px 12px", cursor: "pointer",
            }}>See all {recent.length}</button>
          )}
        </div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 13.5, color: C.dim, textAlign: "center", padding: "12px 0" }}>No sessions yet. Quick-log above to start.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {recent.slice(0, 10).map(s => {
              const proj = s.project ? projectMap[s.project] : null;
              return (
                <div key={s.id} style={{ background: C.surf2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 11.5, color: C.faint, marginBottom: 4 }}>{s.date}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {s.project && (
                        <button onClick={() => setNotesModal(s.project)} style={{
                          fontSize: 12.5, fontWeight: 600, color: C.indigo, background: "rgba(129,140,248,0.12)", border: "none",
                          borderRadius: 7, padding: "3px 9px", cursor: "pointer", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{s.project}{proj?.notes ? " 📝" : ""}</button>
                      )}
                      {s.note && <span style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.note}</span>}
                      {!s.project && !s.note && <span style={{ fontSize: 12.5, color: C.dim }}>session</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 17 }}>{MOOD_EMOJI[s.mood]}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.indigo, minWidth: 52, textAlign: "right" }}>{fmtDur(s.duration)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(s)} style={iconBtn}>{Icon.pencil()}</button>
                    <button onClick={() => deleteSession(s.id)} style={iconBtn}>{Icon.trash()}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
