import { useState, useEffect, useCallback } from "react";

const PHASES = [
  { name: "Defrost", weeks: [1, 4], color: "#6366f1", bg: "#1e1b4b", text: "#a5b4fc" },
  { name: "Momentum", weeks: [5, 10], color: "#8b5cf6", bg: "#2e1065", text: "#c4b5fd" },
  { name: "Album Mode", weeks: [11, Infinity], color: "#a78bfa", bg: "#3b0764", text: "#ddd6fe" },
];
const MOOD_EMOJI = ["", "😓", "😐", "🙂", "😊", "🔥"];
const DAYS_MON = ["M","T","W","T","F","S","S"];
const DAYS_FULL = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateStr(d) { return d.toLocaleDateString("en-CA", { timeZone: "Europe/Budapest" }); }
function parseDate(str) { const [y,m,d]=str.split("-").map(Number); return new Date(y,m-1,d); }
function daysBetween(a,b) { return Math.round((parseDate(b)-parseDate(a))/86400000); }
function getPhaseByWeek(w) { return PHASES.find(p=>w>=p.weeks[0]&&w<=p.weeks[1])||PHASES[2]; }
function heatColor(mins) {
  if(!mins) return "var(--cell-empty)";
  if(mins<45) return "#312e81";
  if(mins<90) return "#4338ca";
  if(mins<150) return "#6366f1";
  return "#a5b4fc";
}

// Storage helpers — talk to the Express backend
const storage = {
  async get(key) {
    const r = await fetch(`/api/data/${key}`);
    return r.json();
  },
  async set(key, value) {
    await fetch(`/api/data/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  },
};

const today = toDateStr(new Date());
const yesterday = toDateStr(new Date(Date.now()-86400000));
const EMPTY_FORM = { date:today, duration:60, phase:"Defrost", mood:3, note:"", project:"" };

function parseLines(text) {
  return (text||"").split("\n").map(line => {
    if (/^-x /i.test(line)) return { type:"check", checked:true,  content:line.slice(3) };
    if (/^- /.test(line))   return { type:"check", checked:false, content:line.slice(2) };
    return { type:"text", content:line };
  });
}
function serializeLines(lines) {
  return lines.map(l => l.type==="check" ? (l.checked?"-x ":"- ")+l.content : l.content).join("\n");
}

function ProjectNotes({ name, notes, onSave, onClose }) {
  const [text, setText] = useState(notes || "");
  const [lines, setLines] = useState(() => parseLines(notes));
  const [mode, setMode] = useState("preview");

  function toPreview() { setLines(parseLines(text)); setMode("preview"); }
  function toEdit() { setText(serializeLines(lines)); setMode("edit"); }

  function toggle(i) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, checked: !l.checked } : l));
  }

  function close() {
    const final = mode === "edit" ? text : serializeLines(lines);
    onSave(final);
    onClose();
  }

  const empty = lines.length === 0 || (lines.length === 1 && lines[0].content === "");

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}
      onClick={e => e.target === e.currentTarget && close()}>
      <div style={{ background:"#1a1828", borderRadius:12, border:"0.5px solid #2d2b45", width:"100%", maxWidth:460, display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:"0.5px solid #2d2b45" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:"#e2e0f0" }}>{name}</div>
            <div style={{ fontSize:10, color:"#6b6890", marginTop:2 }}>start a line with <code style={{ color:"#a5b4fc" }}>- </code> to add a checkbox</div>
          </div>
          <button onClick={close} style={{ background:"transparent", border:"none", color:"#6b6890", cursor:"pointer", fontSize:20, lineHeight:1 }}>✕</button>
        </div>

        <div style={{ display:"flex", gap:2, padding:"7px 10px", background:"#0f0e17", borderBottom:"0.5px solid #2d2b45" }}>
          {[["preview","Preview"], ["edit","Edit"]].map(([m, label]) => (
            <button key={m} onClick={m === "preview" ? toPreview : toEdit}
              style={{ fontSize:11, padding:"3px 12px", borderRadius:5, border:"none", cursor:"pointer", background:mode===m?"#2d2b45":"transparent", color:mode===m?"#e2e0f0":"#6b6890" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ minHeight:240, maxHeight:"55vh", overflowY:"auto" }}>
          {mode === "preview" ? (
            <div style={{ padding:"13px 16px" }}>
              {empty
                ? <div style={{ color:"#4a4870", fontSize:12 }}>No notes yet — switch to Edit to add some.</div>
                : lines.map((l, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:5 }}>
                    {l.type === "check" ? (
                      <>
                        <button onClick={() => toggle(i)} style={{ flexShrink:0, marginTop:3, width:14, height:14, borderRadius:3, border:"1.5px solid " + (l.checked ? "#6366f1" : "#4a4870"), background:l.checked ? "#6366f1" : "transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
                          {l.checked && <span style={{ color:"#fff", fontSize:9 }}>✓</span>}
                        </button>
                        <span style={{ fontSize:13, lineHeight:1.5, color:l.checked ? "#4a4870" : "#e2e0f0", textDecoration:l.checked ? "line-through" : "none" }}>{l.content}</span>
                      </>
                    ) : (
                      <span style={{ fontSize:13, lineHeight:1.5, color:"#a0a0c0", paddingLeft:22, fontFamily:"var(--font-mono)" }}>{l.content || " "}</span>
                    )}
                  </div>
                ))
              }
            </div>
          ) : (
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder={"Notes and to-dos…\n\nExample:\n- Record main melody\n- Mix bass\n\nPlain text lines work too."}
              style={{ display:"block", width:"100%", minHeight:240, background:"#0f0e17", border:"none", color:"#e2e0f0", padding:"13px 16px", fontSize:13, lineHeight:1.7, resize:"none", outline:"none", fontFamily:"var(--font-mono)", boxSizing:"border-box" }} />
          )}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", padding:"10px 16px", borderTop:"0.5px solid #2d2b45" }}>
          <button onClick={close} style={{ background:"#4338ca", border:"none", borderRadius:6, color:"#e0e7ff", padding:"7px 18px", fontSize:12, fontWeight:500, cursor:"pointer" }}>
            Save &amp; close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [calMonth, setCalMonth] = useState(() => { const n=new Date(); return { y:n.getFullYear(), m:n.getMonth() }; });
  const [tab, setTab] = useState("log");
  const [newProject, setNewProject] = useState("");
  const [confirmDelProject, setConfirmDelProject] = useState(null);
  const [notesModal, setNotesModal] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r=await storage.get("music_sessions"); if(r?.value) setSessions(JSON.parse(r.value)); } catch {}
      try {
        const p=await storage.get("music_projects");
        if(p?.value) {
          const raw=JSON.parse(p.value);
          setProjects(raw.map(x=>typeof x==="string"?{name:x,notes:""}:x));
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const persistSessions = useCallback(async next => {
    try { await storage.set("music_sessions", JSON.stringify(next)); } catch {}
  }, []);
  const persistProjects = useCallback(async next => {
    try { await storage.set("music_projects", JSON.stringify(next)); } catch {}
  }, []);

  const sessionsByDate = sessions.reduce((acc,s)=>{ acc[s.date]=(acc[s.date]||0)+s.duration; return acc; },{});
  const sortedDates = Object.keys(sessionsByDate).sort();

  const { currentStreak, longestStreak } = (() => {
    if(!sortedDates.length) return { currentStreak:0, longestStreak:0 };
    const set=new Set(sortedDates);
    let cur=0, anchor=set.has(today)?today:set.has(yesterday)?yesterday:null;
    if(anchor){ let d=parseDate(anchor); while(set.has(toDateStr(d))){ cur++; d=new Date(d-86400000); } }
    let longest=0, streak=0, prev=null;
    for(const d of sortedDates){ if(prev&&daysBetween(prev,d)===1){streak++;}else{streak=1;} longest=Math.max(longest,streak); prev=d; }
    return { currentStreak:cur, longestStreak:longest };
  })();

  const totalSessions=sessions.length, totalMins=sessions.reduce((a,s)=>a+s.duration,0);
  const avgMins=totalSessions?Math.round(totalMins/totalSessions):0;
  const dayCount=Array(7).fill(0);
  sessions.forEach(s=>{ dayCount[(parseDate(s.date).getDay()+6)%7]+=s.duration; });
  const bestDay=DAYS_FULL[dayCount.indexOf(Math.max(...dayCount))];

  const { phaseInfo, phaseProgress, weekNum } = (() => {
    if(!sortedDates.length) return { phaseInfo:PHASES[0], phaseProgress:0, weekNum:0 };
    const first=sortedDates[0];
    const wk=Math.floor(daysBetween(first,today)/7)+1;
    const ph=getPhaseByWeek(wk);
    const start=ph.weeks[0], end=ph.weeks[1]===Infinity?start+6:ph.weeks[1];
    return { phaseInfo:ph, phaseProgress:Math.min(1,(wk-start)/(end-start+1)), weekNum:wk };
  })();

  const heatmapCells = (() => {
    const todayD=new Date(); todayD.setHours(0,0,0,0);
    const startD=new Date(todayD); startD.setDate(todayD.getDate()-83);
    const dow=(startD.getDay()+6)%7; startD.setDate(startD.getDate()-dow);
    const cells=[];
    for(let i=0;i<84;i++){
      const d=new Date(startD); d.setDate(startD.getDate()+i);
      const ds=toDateStr(d);
      cells.push({ ds, mins:sessionsByDate[ds]||0, future:d>todayD });
    }
    return cells;
  })();

  const calCells = (() => {
    const {y,m}=calMonth;
    const firstDay=new Date(y,m,1), lastDay=new Date(y,m+1,0);
    const startOffset=(firstDay.getDay()+6)%7;
    const cells=[];
    for(let i=0;i<startOffset;i++) cells.push(null);
    for(let d=1;d<=lastDay.getDate();d++)
      cells.push(`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    return cells;
  })();

  const todayHasSession = sessionsByDate[today]>0;
  const projectCounts = sessions.reduce((acc,s)=>{ if(s.project) acc[s.project]=(acc[s.project]||0)+1; return acc; },{});
  const projectMap = Object.fromEntries(projects.map(p=>[p.name,p]));

  const handleSubmit = async () => {
    setSaving(true);
    let next = editId!==null
      ? sessions.map(s=>s.id===editId?{...form,id:editId}:s)
      : [{...form,id:Date.now()},...sessions];
    next=next.sort((a,b)=>b.date.localeCompare(a.date));
    setSessions(next); await persistSessions(next);
    setEditId(null); setSaving(false); setSaved(true);
    setForm(EMPTY_FORM);
    setTimeout(()=>setSaved(false),2000);
  };

  const startEdit = s => {
    setEditId(s.id);
    setForm({ date:s.date, duration:s.duration, phase:s.phase, mood:s.mood, note:s.note||"", project:s.project||"" });
    setTab("log");
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  const deleteSession = async id => {
    const next=sessions.filter(s=>s.id!==id);
    setSessions(next); await persistSessions(next); setConfirmDel(null);
  };

  const addProject = async () => {
    const name=newProject.trim();
    if(!name||projects.find(p=>p.name===name)) return;
    const next=[...projects,{name,notes:""}];
    setProjects(next); await persistProjects(next); setNewProject("");
  };

  const removeProject = async name => {
    const next=projects.filter(p=>p.name!==name);
    setProjects(next); await persistProjects(next); setConfirmDelProject(null);
  };

  const saveNotes = async (name, notes) => {
    const next=projects.map(p=>p.name===name?{...p,notes}:p);
    setProjects(next); await persistProjects(next);
  };

  if(!loaded) return <div style={{ color:"#6b6890", padding:"2rem", fontSize:14 }}>Loading…</div>;

  const inp = { background:"#0f0e17", border:"0.5px solid #2d2b45", borderRadius:6, color:"#e2e0f0", padding:"7px 10px", fontSize:12, width:"100%", boxSizing:"border-box" };

  return (
    <div style={{ background:"#0f0e17", minHeight:"100vh", color:"#e2e0f0", fontFamily:"var(--font-sans)", padding:"18px", "--cell-empty":"#1a1828" }}>

      {notesModal && (
        <ProjectNotes
          name={notesModal}
          notes={projectMap[notesModal]?.notes||""}
          onSave={notes=>saveNotes(notesModal,notes)}
          onClose={()=>setNotesModal(null)}
        />
      )}

      {!todayHasSession && (
        <div style={{ background:"#1e1b4b", border:"0.5px solid #4338ca", borderRadius:8, padding:"8px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:10, fontSize:12 }}>
          <span style={{ fontSize:15 }}>🎛</span>
          <span style={{ color:"#a5b4fc" }}>No session logged today. Keep the streak alive.</span>
        </div>
      )}

      <div style={{ fontSize:12, fontWeight:500, color:"#a5b4fc", marginBottom:16, letterSpacing:"0.08em", textTransform:"uppercase" }}>
        Music Production Tracker
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
        {[["Sessions",totalSessions],["Total hours",(totalMins/60).toFixed(1)],["Avg length",`${avgMins}m`],["Best day",bestDay]].map(([l,v])=>(
          <div key={l} style={{ background:"#1a1828", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:"#6b6890", marginBottom:3 }}>{l}</div>
            <div style={{ fontSize:18, fontWeight:500, color:"#e2e0f0" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Streaks + Phase */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        <div style={{ background:"#1a1828", borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, color:"#6b6890", marginBottom:8 }}>Streaks</div>
          <div style={{ display:"flex", gap:20 }}>
            {[["current",currentStreak,"#a5b4fc"],["longest",longestStreak,"#6366f1"]].map(([l,v,c])=>(
              <div key={l}><div style={{ fontSize:26, fontWeight:500, color:c }}>{v}</div><div style={{ fontSize:10, color:"#6b6890" }}>{l}</div></div>
            ))}
          </div>
        </div>
        <div style={{ background:"#1a1828", borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:10, color:"#6b6890", marginBottom:6 }}>Phase · week {weekNum||"—"}</div>
          <div style={{ fontSize:13, fontWeight:500, color:phaseInfo.text, marginBottom:8 }}>{phaseInfo.name}</div>
          <div style={{ background:"#0f0e17", borderRadius:4, height:5, overflow:"hidden" }}>
            <div style={{ width:`${Math.round(phaseProgress*100)}%`, height:"100%", background:phaseInfo.color, borderRadius:4 }} />
          </div>
          <div style={{ fontSize:10, color:"#6b6890", marginTop:4 }}>{Math.round(phaseProgress*100)}% through phase</div>
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ background:"#1a1828", borderRadius:8, padding:"12px 14px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#6b6890", marginBottom:10 }}>Activity · last 12 weeks · Mon–Sun</div>
        <div style={{ display:"flex", gap:2 }}>
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", paddingRight:5, paddingBottom:2 }}>
            {DAYS_MON.map((d,i)=><div key={i} style={{ fontSize:9, color:"#4a4870", lineHeight:"13px" }}>{d}</div>)}
          </div>
          {Array.from({length:12}).map((_,col)=>(
            <div key={col} style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {Array.from({length:7}).map((_,row)=>{
                const cell=heatmapCells[col*7+row];
                return <div key={row} title={cell?`${cell.ds}: ${cell.mins}m`:""} style={{ width:13, height:13, borderRadius:2, background:cell?.future?"transparent":heatColor(cell?.mins||0) }} />;
              })}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:10 }}>
          <span style={{ fontSize:10, color:"#4a4870" }}>less</span>
          {["#1a1828","#312e81","#4338ca","#6366f1","#a5b4fc"].map(c=>(
            <div key={c} style={{ width:10, height:10, borderRadius:2, background:c }} />
          ))}
          <span style={{ fontSize:10, color:"#4a4870" }}>more</span>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background:"#1a1828", borderRadius:8, padding:"12px 14px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:10, color:"#6b6890" }}>Calendar</div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setCalMonth(({y,m})=>m===0?{y:y-1,m:11}:{y,m:m-1})} style={{ background:"transparent", border:"none", color:"#6b6890", cursor:"pointer", fontSize:14 }}>‹</button>
            <span style={{ fontSize:12, color:"#e2e0f0", minWidth:60, textAlign:"center" }}>{monthNames[calMonth.m]} {calMonth.y}</span>
            <button onClick={()=>setCalMonth(({y,m})=>m===11?{y:y+1,m:0}:{y,m:m+1})} style={{ background:"transparent", border:"none", color:"#6b6890", cursor:"pointer", fontSize:14 }}>›</button>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:4 }}>
          {DAYS_MON.map((d,i)=><div key={i} style={{ fontSize:10, color:"#4a4870", textAlign:"center" }}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {calCells.map((ds,i)=>{
            if(!ds) return <div key={i} />;
            const isPast=ds<today, isToday=ds===today, hasSess=!!sessionsByDate[ds], missed=isPast&&!hasSess;
            return (
              <div key={ds} style={{ background:isToday?"#1e1b4b":"transparent", border:isToday?"0.5px solid #6366f1":"0.5px solid transparent", borderRadius:6, padding:"4px 2px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:isToday?"#a5b4fc":"#6b6890", lineHeight:1.2 }}>{Number(ds.slice(8))}</div>
                <div style={{ fontSize:12, marginTop:1 }}>
                  {hasSess?<span style={{ color:"#6ee7b7" }}>✓</span>:missed?<span style={{ color:"#4a4870", fontSize:10 }}>✕</span>:null}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:14, marginTop:10 }}>
          {[["✓","#6ee7b7","Session logged"],["✕","#4a4870","Missed"]].map(([sym,col,lbl])=>(
            <span key={lbl} style={{ fontSize:10, color:"#4a4870", display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ color:col }}>{sym}</span>{lbl}
            </span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:2, marginBottom:12, background:"#1a1828", borderRadius:8, padding:4 }}>
        {[["log",editId?"Edit session":"Log session"],["projects",`Projects${projects.length?` (${projects.length})`:""}`]].map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ flex:1, background:tab===t?"#2d2b45":"transparent", border:"none", borderRadius:6, color:tab===t?"#e2e0f0":"#6b6890", padding:"7px 0", fontSize:12, fontWeight:tab===t?500:400, cursor:"pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Log session tab */}
      {tab==="log" && (
        <div style={{ background:"#1a1828", borderRadius:8, padding:"14px 16px", marginBottom:16 }}>
          {editId && (
            <div style={{ fontSize:10, color:"#a78bfa", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Editing session</span>
              <button onClick={()=>{ setEditId(null); setForm(EMPTY_FORM); }} style={{ fontSize:10, color:"#6b6890", background:"transparent", border:"none", cursor:"pointer" }}>cancel</button>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:10, color:"#6b6890", marginBottom:4 }}>Date</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp} />
            </div>
            <div>
              <div style={{ fontSize:10, color:"#6b6890", marginBottom:4 }}>Phase</div>
              <select value={form.phase} onChange={e=>setForm(f=>({...f,phase:e.target.value}))} style={inp}>
                {PHASES.map(p=><option key={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:"#6b6890", marginBottom:4 }}>
              Project <span style={{ color:"#4a4870" }}>(optional)</span>
              {projects.length===0&&<span style={{ color:"#4a4870" }}> — add projects in the Projects tab</span>}
            </div>
            <select value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))} style={inp} disabled={projects.length===0}>
              <option value="">— none —</option>
              {projects.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:10, color:"#6b6890" }}>Duration</span>
              <span style={{ fontSize:12, fontWeight:500, color:"#a5b4fc" }}>{form.duration} min</span>
            </div>
            <input type="range" min="15" max="240" step="1" value={form.duration} onChange={e=>setForm(f=>({...f,duration:Number(e.target.value)}))} style={{ width:"100%", accentColor:"#6366f1" }} />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#4a4870", marginTop:2 }}>
              <span>15m</span><span>1h</span><span>2h</span><span>4h</span>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:"#6b6890", marginBottom:6 }}>Mood</div>
            <div style={{ display:"flex", gap:6 }}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setForm(f=>({...f,mood:n}))}
                  style={{ fontSize:18, background:form.mood===n?"#312e81":"transparent", border:form.mood===n?"1px solid #6366f1":"1px solid #2d2b45", borderRadius:8, padding:"4px 8px", cursor:"pointer" }}>
                  {MOOD_EMOJI[n]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#6b6890", marginBottom:4 }}>Note <span style={{ color:"#4a4870" }}>(optional)</span></div>
            <input type="text" value={form.note} placeholder="What did you work on?" onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={inp} />
          </div>
          <button onClick={handleSubmit} disabled={saving}
            style={{ background:saved?"#1e3a5f":editId?"#3b0764":"#4338ca", border:"none", borderRadius:6, color:saved?"#93c5fd":editId?"#ddd6fe":"#e0e7ff", padding:"9px 20px", fontSize:13, fontWeight:500, cursor:"pointer" }}>
            {saving?"Saving…":saved?"Saved ✓":editId?"Save changes":"Log session"}
          </button>
        </div>
      )}

      {/* Projects tab */}
      {tab==="projects" && (
        <div style={{ background:"#1a1828", borderRadius:8, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#6b6890", marginBottom:12 }}>Active projects</div>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <input type="text" value={newProject} placeholder="Track or project name…"
              onChange={e=>setNewProject(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addProject()}
              style={{ ...inp, flex:1 }} />
            <button onClick={addProject} disabled={!newProject.trim()}
              style={{ background:"#4338ca", border:"none", borderRadius:6, color:"#e0e7ff", padding:"7px 16px", fontSize:12, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap", opacity:newProject.trim()?1:0.4 }}>
              Add
            </button>
          </div>
          {projects.length===0 ? (
            <div style={{ color:"#4a4870", fontSize:12, textAlign:"center", padding:"12px 0" }}>No projects yet. Add your first track above.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {projects.map(p=>(
                <div key={p.name} style={{ background:"#0f0e17", borderRadius:8, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:"#e2e0f0" }}>{p.name}</div>
                      <div style={{ fontSize:10, color:"#6b6890", marginTop:2, display:"flex", gap:10 }}>
                        {projectCounts[p.name]&&<span>{projectCounts[p.name]} session{projectCounts[p.name]>1?"s":""}</span>}
                        {p.notes&&<span style={{ color:"#4a4870" }}>has notes</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <button onClick={()=>setNotesModal(p.name)}
                        style={{ background:"#1e1b4b", border:"0.5px solid #4338ca", borderRadius:5, color:"#a5b4fc", cursor:"pointer", fontSize:11, padding:"4px 10px" }}>
                        {p.notes?"edit notes":"add notes"}
                      </button>
                      {confirmDelProject===p.name
                        ? <div style={{ display:"flex", gap:4 }}>
                            <button onClick={()=>removeProject(p.name)} style={{ background:"#7f1d1d", border:"none", borderRadius:5, color:"#fca5a5", cursor:"pointer", fontSize:11, padding:"4px 10px" }}>remove</button>
                            <button onClick={()=>setConfirmDelProject(null)} style={{ background:"transparent", border:"0.5px solid #2d2b45", borderRadius:5, color:"#6b6890", cursor:"pointer", fontSize:11, padding:"4px 10px" }}>cancel</button>
                          </div>
                        : <button onClick={()=>setConfirmDelProject(p.name)} style={{ background:"transparent", border:"0.5px solid #2d2b45", borderRadius:5, color:"#6b6890", cursor:"pointer", fontSize:11, padding:"4px 10px" }}>remove</button>
                      }
                    </div>
                  </div>
                  {p.notes && (
                    <div onClick={()=>setNotesModal(p.name)} style={{ borderTop:"0.5px solid #1a1828", padding:"8px 14px", cursor:"pointer" }}>
                      <pre style={{ margin:0, fontSize:11, color:"#6b6890", fontFamily:"var(--font-mono)", whiteSpace:"pre-wrap", lineHeight:1.6, maxHeight:60, overflow:"hidden", maskImage:"linear-gradient(to bottom,#6b6890 60%,transparent)" }}>
                        {p.notes}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent sessions */}
      {sessions.length>0 && (
        <div>
          <div style={{ fontSize:10, color:"#6b6890", marginBottom:10 }}>Recent sessions</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {sessions.slice(0,7).map(s=>{
              const ph=PHASES.find(p=>p.name===s.phase)||PHASES[0];
              const proj=s.project?projectMap[s.project]:null;
              return (
                <div key={s.id} style={{ background:"#1a1828", borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                      <span style={{ fontSize:12, fontWeight:500, color:"#e2e0f0" }}>{s.date}</span>
                      <span style={{ fontSize:10, background:ph.bg, color:ph.text, padding:"2px 6px", borderRadius:4 }}>{s.phase}</span>
                      {s.project && (
                        <button onClick={()=>setNotesModal(s.project)}
                          title={proj?.notes?"View/edit notes":"Add notes"}
                          style={{ fontSize:10, background:proj?.notes?"#1a2e1a":"#1e2a1e", color:proj?.notes?"#86efac":"#6ee7b7", padding:"2px 7px", borderRadius:4, border:proj?.notes?"0.5px solid #166534":"0.5px solid #14532d", cursor:"pointer", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
                          {s.project}{proj?.notes&&<span style={{ fontSize:9, opacity:0.7 }}>📝</span>}
                        </button>
                      )}
                    </div>
                    {s.note&&<div style={{ fontSize:11, color:"#6b6890", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.note}</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"#a5b4fc" }}>{s.duration}m</div>
                      <div style={{ fontSize:15 }}>{MOOD_EMOJI[s.mood]}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      <button onClick={()=>startEdit(s)} style={{ background:"transparent", border:"0.5px solid #2d2b45", borderRadius:5, color:"#6b6890", cursor:"pointer", fontSize:11, padding:"3px 8px" }}>edit</button>
                      {confirmDel===s.id
                        ? <div style={{ display:"flex", gap:4 }}>
                            <button onClick={()=>deleteSession(s.id)} style={{ background:"#7f1d1d", border:"none", borderRadius:5, color:"#fca5a5", cursor:"pointer", fontSize:11, padding:"3px 7px" }}>yes</button>
                            <button onClick={()=>setConfirmDel(null)} style={{ background:"transparent", border:"0.5px solid #2d2b45", borderRadius:5, color:"#6b6890", cursor:"pointer", fontSize:11, padding:"3px 7px" }}>no</button>
                          </div>
                        : <button onClick={()=>setConfirmDel(s.id)} style={{ background:"transparent", border:"0.5px solid #2d2b45", borderRadius:5, color:"#6b6890", cursor:"pointer", fontSize:11, padding:"3px 8px" }}>del</button>
                      }
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length===0&&tab!=="projects"&&(
        <div style={{ textAlign:"center", color:"#4a4870", fontSize:13, padding:"20px 0" }}>No sessions yet. Log your first one above.</div>
      )}
    </div>
  );
}
