import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import WaveSurfer from "wavesurfer.js";

/* ─── global audio event bus (one-playing-at-a-time) ─── */
const audioEventBus = new EventTarget();

/* ─── theme system ─── */
const ThemeCtx = createContext(null);
const useTheme = () => useContext(ThemeCtx);

const THEMES = {
  calm:  { name:"Calm Stack",   emoji:"🌌", dark:true,  bg:"#0b0b10", surf:"#131320", surf2:"#1a1a2a", line:"rgba(255,255,255,0.055)", lineS:"rgba(255,255,255,0.1)", text:"#f3f3f8", muted:"#8a8a9e", faint:"#6a6a86", dim:"#55556a", indigo:"#818cf8", deep:"#6366f1", green:"#34d399", greenS:"#6ee7b7", flame:"#fb923c", accentGrad:"linear-gradient(135deg,#818cf8,#6366f1)", accentGlow:"rgba(99,102,241,0.6)", accentAlpha:"rgba(129,140,248,0.16)", accentAlpha2:"rgba(129,140,248,0.12)", accentBorder:"rgba(129,140,248,0.5)", todayBg:"linear-gradient(160deg,#1c1c34,#131326)", timerBg:"linear-gradient(160deg,#241c3a,#15131f)", loggedBg:"linear-gradient(160deg,#16261f,#111a17)", loggedBorder:"rgba(52,211,153,0.35)", heat:["#16162a","#312e81","#4f46e5","#7c8cf8","#a5b4fc"] },
  paper: { name:"Paper",        emoji:"📄", dark:false, bg:"#f7f7f5", surf:"#ffffff", surf2:"#eeeeeb", line:"rgba(0,0,0,0.07)", lineS:"rgba(0,0,0,0.12)", text:"#16162a", muted:"#6b6b82", faint:"#9090a8", dim:"#b4b4c8", indigo:"#5558e8", deep:"#4f46e5", green:"#059669", greenS:"#10b981", flame:"#ea580c", accentGrad:"linear-gradient(135deg,#6366f1,#4f46e5)", accentGlow:"rgba(99,102,241,0.22)", accentAlpha:"rgba(99,102,241,0.1)", accentAlpha2:"rgba(99,102,241,0.07)", accentBorder:"rgba(99,102,241,0.3)", todayBg:"linear-gradient(160deg,#eef0ff,#f4f4ff)", timerBg:"linear-gradient(160deg,#f0ecff,#ece8ff)", loggedBg:"linear-gradient(160deg,#ecfdf5,#f0fdf6)", loggedBorder:"rgba(5,150,105,0.3)", heat:["#e4e4ee","#c4b5fd","#818cf8","#4f46e5","#312e81"] },
  sand:  { name:"Warm Sand",    emoji:"🏖", dark:false, bg:"#faf7f0", surf:"#ffffff", surf2:"#f2ede3", line:"rgba(0,0,0,0.07)", lineS:"rgba(0,0,0,0.12)", text:"#1c1608", muted:"#786a52", faint:"#9e9078", dim:"#c0b49a", indigo:"#c2611a", deep:"#b45309", green:"#059669", greenS:"#10b981", flame:"#ea580c", accentGrad:"linear-gradient(135deg,#f59e0b,#d97706)", accentGlow:"rgba(217,119,6,0.22)", accentAlpha:"rgba(217,119,6,0.1)", accentAlpha2:"rgba(217,119,6,0.07)", accentBorder:"rgba(217,119,6,0.35)", todayBg:"linear-gradient(160deg,#fffbeb,#fef3c7)", timerBg:"linear-gradient(160deg,#fff7ed,#feebc8)", loggedBg:"linear-gradient(160deg,#ecfdf5,#f0fdf6)", loggedBorder:"rgba(5,150,105,0.3)", heat:["#e8dfc8","#fcd34d","#f59e0b","#d97706","#92400e"] },
  slate: { name:"Slate",        emoji:"🪨", dark:true,  bg:"#1c1f26", surf:"#252930", surf2:"#2e333c", line:"rgba(255,255,255,0.07)", lineS:"rgba(255,255,255,0.12)", text:"#dde2ec", muted:"#8892a4", faint:"#666e80", dim:"#454d5e", indigo:"#60a5fa", deep:"#3b82f6", green:"#34d399", greenS:"#6ee7b7", flame:"#fb923c", accentGrad:"linear-gradient(135deg,#60a5fa,#3b82f6)", accentGlow:"rgba(59,130,246,0.5)", accentAlpha:"rgba(96,165,250,0.15)", accentAlpha2:"rgba(96,165,250,0.1)", accentBorder:"rgba(96,165,250,0.4)", todayBg:"linear-gradient(160deg,#1a2540,#16213a)", timerBg:"linear-gradient(160deg,#1c2545,#18213e)", loggedBg:"linear-gradient(160deg,#142820,#10201a)", loggedBorder:"rgba(52,211,153,0.3)", heat:["#22262e","#1e3a5c","#1d4f8a","#2563eb","#60a5fa"] },
  dusk:  { name:"Dusk",         emoji:"🌅", dark:true,  bg:"#1c1824", surf:"#252132", surf2:"#2e2a3e", line:"rgba(255,220,255,0.06)", lineS:"rgba(255,220,255,0.1)", text:"#ece8f5", muted:"#9890b0", faint:"#726888", dim:"#504868", indigo:"#c084fc", deep:"#a855f7", green:"#34d399", greenS:"#6ee7b7", flame:"#fb923c", accentGrad:"linear-gradient(135deg,#c084fc,#a855f7)", accentGlow:"rgba(168,85,247,0.5)", accentAlpha:"rgba(192,132,252,0.16)", accentAlpha2:"rgba(192,132,252,0.11)", accentBorder:"rgba(192,132,252,0.4)", todayBg:"linear-gradient(160deg,#2a1e3c,#221830)", timerBg:"linear-gradient(160deg,#321e46,#281840)", loggedBg:"linear-gradient(160deg,#162420,#121e1a)", loggedBorder:"rgba(52,211,153,0.3)", heat:["#201c2c","#3b1a5e","#6b21a8","#9333ea","#c084fc"] },
};

function getStyles(C) {
  return {
    card: { background:C.surf, border:`1px solid ${C.line}`, borderRadius:20, padding:20, marginBottom:14 },
    eyebrow: { fontSize:11.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:C.faint, whiteSpace:"nowrap" },
    iconBtn: { width:32, height:32, borderRadius:9, display:"grid", placeItems:"center", cursor:"pointer", border:`1px solid ${C.lineS}`, background:C.surf2, flexShrink:0, padding:0 },
  };
}

/* ─── feature constants ─── */
const TAGS = ["Producing","Mixing","Mastering","Learning","Editing","Experimenting"];
const TAG_COLOR = { Producing:"#818cf8", Mixing:"#60a5fa", Mastering:"#c084fc", Learning:"#34d399", Editing:"#fb923c", Experimenting:"#f472b6" };

const STATUS_ORDER = ["idea","active","mixing","mastering","done","released"];
const STATUS_CFG = {
  idea:      { label:"Idea",       dot:"#6b6b82" },
  active:    { label:"Active",     dot:"#34d399" },
  mixing:    { label:"Mixing",     dot:"#818cf8" },
  mastering: { label:"Mastering",  dot:"#c084fc" },
  done:      { label:"Done",       dot:"#60a5fa" },
  released:  { label:"Released",   dot:"#fbbf24" },
};

// 12 perceptually distinct colors for project identity — spread across hue wheel
const PROJECT_PALETTE = [
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#a3e635", // lime
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#818cf8", // indigo
  "#c084fc", // purple
  "#f472b6", // pink
  "#e11d48", // rose-red
  "#0ea5e9", // sky
];
const pickProjectColor=(usedColors)=>{
  const free=PROJECT_PALETTE.find(c=>!usedColors.has(c));
  return free||PROJECT_PALETTE[usedColors.size%PROJECT_PALETTE.length];
};

const GROUP_TYPE_CFG = {
  album: { label:"Album", badge:"LP", dot:"#fb923c" },
  ep:    { label:"EP",    badge:"EP", dot:"#60a5fa" },
};

const MILESTONES = [
  { id:"s1",    emoji:"🎵", label:"First session",     check:(s)=>s.length>=1 },
  { id:"s10",   emoji:"🎶", label:"10 sessions",       check:(s)=>s.length>=10 },
  { id:"s50",   emoji:"🎸", label:"50 sessions",       check:(s)=>s.length>=50 },
  { id:"s100",  emoji:"🎹", label:"100 sessions",      check:(s)=>s.length>=100 },
  { id:"h10",   emoji:"⏱", label:"10 hours logged",   check:(s)=>totalMin(s)>=600 },
  { id:"h50",   emoji:"⌛", label:"50 hours logged",   check:(s)=>totalMin(s)>=3000 },
  { id:"h100",  emoji:"💿", label:"100 hours logged",  check:(s)=>totalMin(s)>=6000 },
  { id:"str3",  emoji:"🔥", label:"3-day streak",      check:(s,p,streak)=>streak>=3 },
  { id:"str7",  emoji:"⚡", label:"7-day streak",      check:(s,p,streak)=>streak>=7 },
  { id:"str30", emoji:"💎", label:"30-day streak",     check:(s,p,streak)=>streak>=30 },
  { id:"rel1",  emoji:"🚀", label:"First release",     check:(s,p)=>p.some(x=>x.status==="released") },
];

const TOD = [
  { label:"Morning",   emoji:"🌅", test:h=>h>=6&&h<12  },
  { label:"Afternoon", emoji:"☀️",  test:h=>h>=12&&h<18 },
  { label:"Evening",   emoji:"🌆", test:h=>h>=18&&h<22 },
  { label:"Night",     emoji:"🌙", test:h=>h>=22||h<6  },
];

/* ─── helpers ─── */
const MOOD_EMOJI = ["","😓","😐","🙂","😊","🔥"];
const DAYS_MON   = ["M","T","W","T","F","S","S"];
const DAYS_FULL  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateStr(d) { return d.toLocaleDateString("en-CA",{timeZone:"Europe/Budapest"}); }
function parseDate(s) { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function dayKeyUTC(ms) { const d=new Date(ms),p=n=>String(n).padStart(2,"0"); return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`; }
function keyToUTCms(s) { const [y,m,d]=s.split("-").map(Number); return Date.UTC(y,m-1,d); }
function fmtDur(min) { if(min<60)return`${min}m`; const h=Math.floor(min/60),m=min%60; return m?`${h}h ${String(m).padStart(2,"0")}m`:`${h}h`; }
function fmtDate(ds) { const d=parseDate(ds); return `${DAYS_FULL[(d.getDay()+6)%7]} ${monthNames[d.getMonth()]} ${d.getDate()}`; }
function fmtClock(ms) { const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60,p=n=>String(n).padStart(2,"0"); return h>0?`${h}:${p(m)}:${p(ss)}`:`${m}:${p(ss)}`; }
function totalMin(sessions) { return sessions.reduce((a,s)=>a+s.duration,0); }
function getWeekStart(offsetWeeks=0) { const t=new Date();t.setHours(0,0,0,0);const dow=(t.getDay()+6)%7,mon=new Date(t);mon.setDate(t.getDate()-dow-offsetWeeks*7);return toDateStr(mon); }
function weekHours(sessions,startStr) { const s=parseDate(startStr),e=new Date(s);e.setDate(s.getDate()+6);return sessions.filter(x=>{const d=parseDate(x.date);return d>=s&&d<=e;}).reduce((a,x)=>a+x.duration,0)/60; }

function fmtSeconds(s) { s=Math.floor(s||0); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }
function fmtRelativeDate(ds) {
  if(!ds)return null;
  const diff=Math.round((keyToUTCms(today)-keyToUTCms(ds))/86400000);
  if(diff===0)return"today";
  if(diff===1)return"yesterday";
  if(diff<7)return`${diff}d ago`;
  if(diff<30)return`${Math.round(diff/7)}w ago`;
  if(diff<365)return`${Math.round(diff/30)}mo ago`;
  return`${Math.round(diff/365)}y ago`;
}

const today     = toDateStr(new Date());
const yesterday = toDateStr(new Date(Date.now()-86400000));
const newForm   = (date=today)=>({date,duration:60,mood:3,note:"",project:"",tag:"",hour:new Date().getHours()});

const storage = {
  async get(key) { const r=await fetch(`/api/data/${key}`); return r.json(); },
  async set(key,value) { await fetch(`/api/data/${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value})}); },
};

/* ─── icons ─── */
const Icon = {
  pencil:(c="#9a9ab2")=><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={c} strokeWidth="1.8" strokeLinejoin="round"/><path d="M14 6l4 4" stroke={c} strokeWidth="1.8"/></svg>,
  trash: (c="#c08a8a")=><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  close: (c="#9a9ab2")=><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  note:  (c="#9a9ab2")=><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 4h14v12l-5 5H5V4z" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/><path d="M14 21v-5h5" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/></svg>,
  gear:  (c="#9a9ab2")=><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>,
  download:(c="#9a9ab2")=><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v13M7 12l5 5 5-5M3 21h18" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ─── goal ring ─── */
function GoalRing({pct,label,sub}) {
  const C=useTheme();
  const size=96,sw=8,r=(size-sw)/2,circ=2*Math.PI*r,filled=Math.min(1,pct)*circ;
  const col=pct>=1?C.green:C.indigo;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.surf2} strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={`${filled} ${circ-filled}`} strokeLinecap="round"
          style={{transition:"stroke-dasharray .5s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
        <div style={{fontSize:17,fontWeight:700,color:col,lineHeight:1}}>{label}</div>
        <div style={{fontSize:9.5,color:C.faint}}>{sub}</div>
      </div>
    </div>
  );
}

/* ─── weekly goal card ─── */
function WeeklyGoalCard({sessions,goalHours,onEditGoal}) {
  const C=useTheme(); const {card,eyebrow}=getStyles(C);
  const thisWeekStart=getWeekStart(0);
  const thisWeekH=weekHours(sessions,thisWeekStart);
  const pct=goalHours>0?thisWeekH/goalHours:0;

  const past6=Array.from({length:6},(_,i)=>{
    const start=getWeekStart(6-i);
    const h=weekHours(sessions,start);
    return {start,h,hit:goalHours>0&&h>=goalHours};
  });

  return (
    <div className="card" style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
        <span style={eyebrow}>Weekly goal</span>
        <button onClick={onEditGoal} style={{fontSize:12,fontWeight:600,color:C.indigo,background:C.accentAlpha,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>
          {goalHours}h / week
        </button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:20}}>
        <GoalRing pct={pct} label={`${fmtDur(Math.round(thisWeekH*60))}`} sub={`of ${goalHours}h`}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>
            {pct>=1 ? <span style={{color:C.green,fontWeight:600}}>✓ Goal reached this week!</span>
              : `${fmtDur(Math.round(Math.max(0,goalHours-thisWeekH)*60))} to go`}
          </div>
          <div style={{fontSize:11,color:C.faint,marginBottom:6}}>Past 6 weeks</div>
          <div style={{display:"flex",gap:6}}>
            {past6.map((w,i)=>(
              <div key={i} title={`${w.start}: ${w.h.toFixed(1)}h`} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:"100%",height:32,borderRadius:5,background:C.surf2,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,
                    height:`${goalHours>0?Math.min(1,w.h/goalHours)*100:0}%`,
                    background:w.hit?C.green:C.indigo,opacity:w.hit?0.9:0.5,transition:"height .3s ease"}}/>
                </div>
                <div style={{width:7,height:7,borderRadius:"50%",background:w.hit?C.green:C.dim}}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── analytics card ─── */
function AnalyticsCard({sessions}) {
  const C=useTheme(); const {card,eyebrow}=getStyles(C);
  const [tab,setTab]=useState("tags");

  /* tag breakdown */
  const tagCounts={};
  sessions.forEach(s=>{const t=s.tag||"Untagged";tagCounts[t]=(tagCounts[t]||0)+s.duration;});
  const tagTotal=Object.values(tagCounts).reduce((a,b)=>a+b,0)||1;
  const tagRows=Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]);

  /* time of day */
  const todCounts=TOD.map(t=>({...t,count:0}));
  let todTotal=0;
  sessions.forEach(s=>{
    if(s.hour==null)return;
    const slot=todCounts.findIndex(t=>t.test(s.hour));
    if(slot>=0){todCounts[slot].count++;todTotal++;}
  });
  const hasTod=todTotal>0;

  /* weekly hours — last 8 weeks */
  const weeks8=Array.from({length:8},(_,i)=>{
    const start=getWeekStart(7-i);
    return{start,h:weekHours(sessions,start)};
  });
  const maxH=Math.max(...weeks8.map(w=>w.h),1);

  return (
    <div className="card" style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={eyebrow}>Analytics</span>
        <div style={{display:"flex",gap:2,background:C.surf2,borderRadius:8,padding:2}}>
          {[["tags","By type"],["tod","Time of day"],["weeks","Weekly"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",
              background:tab===t?C.surf:C.surf2,color:tab===t?C.text:C.faint}}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{minHeight:120}}>
      {tab==="tags" && (
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {tagRows.length===0
            ? <div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"12px 0"}}>No sessions yet.</div>
            : tagRows.map(([tag,min])=>{
              const pct=min/tagTotal;
              const col=TAG_COLOR[tag]||C.muted;
              return (
                <div key={tag}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12.5,fontWeight:600,color:C.text}}>{tag}</span>
                    <span style={{fontSize:12,color:C.faint}}>{fmtDur(min)} · {Math.round(pct*100)}%</span>
                  </div>
                  <div style={{height:6,borderRadius:4,background:C.surf2}}>
                    <div style={{height:"100%",width:`${pct*100}%`,borderRadius:4,background:col,transition:"width .4s ease"}}/>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {tab==="tod" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {!hasTod
            ? <div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"12px 0"}}>Log a few sessions to see your patterns.</div>
            : todCounts.map(slot=>{
              const pct=todTotal>0?slot.count/todTotal:0;
              return (
                <div key={slot.label} style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16,width:22}}>{slot.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12.5,fontWeight:600,color:C.text}}>{slot.label}</span>
                      <span style={{fontSize:12,color:C.faint}}>{slot.count} session{slot.count!==1?"s":""}</span>
                    </div>
                    <div style={{height:6,borderRadius:4,background:C.surf2}}>
                      <div style={{height:"100%",width:`${pct*100}%`,borderRadius:4,background:C.indigo,transition:"width .4s ease"}}/>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {tab==="weeks" && (
        <div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80}}>
            {weeks8.map((w,i)=>{
              const barH=Math.max(0,w.h/maxH)*72;
              return (
                <div key={i} title={`${w.start}: ${w.h.toFixed(1)}h`}
                  style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:80}}>
                  <div style={{width:"100%",height:barH,borderRadius:4,background:C.indigo,opacity:0.8,minHeight:w.h>0?3:0,transition:"height .3s ease"}}/>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:4,marginTop:6}}>
            {weeks8.map((_,i)=>(
              <div key={i} style={{flex:1,textAlign:"center",fontSize:9.5,color:C.dim}}>{i===7?"now":""}</div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/* ─── version badge helper ─── */
function extractVersion(name) {
  // Match: v1, v2, v1.3, v2.1.0, final, master, demo, draft (case-insensitive)
  const m = (name||"").match(/\b(v\d+(?:[._]\d+)*|final|master|demo|draft)\b/i);
  return m ? m[0].toLowerCase() : null;
}

/* ─── audio file card ─── */
function AudioFileCard({file,projectName,onDelete,onRename,onMarkSeen}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const waveRef=useRef(null);
  const wsRef=useRef(null);
  const [playing,setPlaying]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const [wsReady,setWsReady]=useState(false);
  const [loadProgress,setLoadProgress]=useState(0);    // 0-100 during initial download
  const [buffering,setBuffering]=useState(false);      // stall during playback
  const [pendingPlay,setPendingPlay]=useState(false);  // play was clicked before ready
  const [editing,setEditing]=useState(false);
  const [nameVal,setNameVal]=useState(file.name);
  const markedRef=useRef(false);
  const bufferingTimer=useRef(null);
  const userPlayingRef=useRef(false); // true only after user explicitly pressed play

  const audioUrl=file.linkedPath
    ?`/api/audio/${encodeURIComponent(projectName)}/stream/${file.id}`
    :`/api/audio/files/${encodeURIComponent(file.filename)}`;

  // Stop this card when another card starts playing
  useEffect(()=>{
    const handler=e=>{
      if(e.detail.id!==file.id){
        wsRef.current?.pause();
        pendingPlayRef.current=false;
        userPlayingRef.current=false;
        setPendingPlay(false);
        setBuffering(false);
      }
    };
    audioEventBus.addEventListener("audioplay",handler);
    return()=>audioEventBus.removeEventListener("audioplay",handler);
  },[file.id]);

  // Register handback listener first, then announce mount in the same effect
  // so MiniPlayer's synchronous audiohandback response is already caught.
  const handbackPosRef=useRef(null);
  const handbackAutoplayRef=useRef(false);
  useEffect(()=>{
    const handler=e=>{
      if(e.detail.id!==file.id)return;
      const pos=e.detail.position||0;
      const auto=e.detail.autoplay||false;
      const ws=wsRef.current;
      const dur=ws?.getDuration?.();
      if(ws&&dur>0){
        ws.seekTo(Math.min(1,pos/dur));
        if(auto)ws.play();
      } else {
        handbackPosRef.current=pos;
        handbackAutoplayRef.current=auto;
      }
    };
    audioEventBus.addEventListener("audiohandback",handler);
    // Announce after listener is registered so we don't miss the response
    audioEventBus.dispatchEvent(new CustomEvent("audiomounted",{detail:{id:file.id}}));
    return()=>audioEventBus.removeEventListener("audiohandback",handler);
  },[]);// eslint-disable-line

  useEffect(()=>{
    const container=waveRef.current;
    if(!container)return;
    const ws=WaveSurfer.create({
      container,waveColor:C.dim,progressColor:C.indigo,
      height:44,barWidth:2,barGap:1,barRadius:2,cursorWidth:1,cursorColor:C.muted,
    });
    wsRef.current=ws;
    ws.load(audioUrl);

    // Download progress
    ws.on("loading",pct=>setLoadProgress(pct));

    ws.on("ready",()=>{
      setWsReady(true);
      setLoadProgress(100);
      setBuffering(false);
      // Apply position + optional autoplay handed back from MiniPlayer
      if(handbackPosRef.current!=null){
        const dur=ws.getDuration?.();
        if(dur>0)ws.seekTo(Math.min(1,handbackPosRef.current/dur));
        const shouldAutoplay=handbackAutoplayRef.current;
        handbackPosRef.current=null;handbackAutoplayRef.current=false;
        if(shouldAutoplay){ws.play();return;}
      }
      // If user clicked play while loading, start now
      if(pendingPlayRef.current){
        pendingPlayRef.current=false;
        setPendingPlay(false);
        ws.play();
      }
      // Hook into media element for buffering stalls during playback
      try{
        const media=ws.getMediaElement?.();
        if(media){
          const onWaiting=()=>{
            if(!userPlayingRef.current)return;
            setBuffering(true);
            clearTimeout(bufferingTimer.current);
            bufferingTimer.current=setTimeout(()=>{
              if(wsRef.current&&userPlayingRef.current&&!wsRef.current.isPlaying?.())wsRef.current.play().catch(()=>{});
            },1500);
          };
          const onResume=()=>{clearTimeout(bufferingTimer.current);setBuffering(false);};
          media.addEventListener("waiting",onWaiting);
          media.addEventListener("stalled",onWaiting);
          media.addEventListener("playing",onResume);
          media.addEventListener("canplay",onResume);
        }
      }catch{}
    });

    ws.on("timeupdate",t=>setCurrentTime(t));
    ws.on("play",()=>{
      userPlayingRef.current=true;
      setPlaying(true);
      setBuffering(false);
      audioEventBus.dispatchEvent(new CustomEvent("audioplay",{detail:{id:file.id}}));
      if(file.isNew&&!markedRef.current){markedRef.current=true;onMarkSeen?.(file.id);}
    });
    ws.on("pause",()=>{userPlayingRef.current=false;setPlaying(false);});
    ws.on("finish",()=>{userPlayingRef.current=false;setPlaying(false);setCurrentTime(0);setBuffering(false);});

    return()=>{
      clearTimeout(bufferingTimer.current);
      if(userPlayingRef.current){
        const pos=ws.getCurrentTime?.()??0;
        audioEventBus.dispatchEvent(new CustomEvent("audiohandoff",{detail:{file,projectName,src:audioUrl,position:pos}}));
      }
      ws.destroy();wsRef.current=null;
    };
  },[]);// eslint-disable-line

  // Ref mirror for pendingPlay (accessible inside the ready callback closure)
  const pendingPlayRef=useRef(false);
  const handlePlayPause=()=>{
    if(wsReady){
      wsRef.current?.playPause();
    } else {
      // Queue play for when ready
      pendingPlayRef.current=!pendingPlayRef.current;
      setPendingPlay(pendingPlayRef.current);
    }
  };

  const saveRename=()=>{
    const t=nameVal.trim();
    if(t&&t!==file.name)onRename(file.id,t); else setNameVal(file.name);
    setEditing(false);
  };

  const version=extractVersion(file.name);
  const peakWarn=file.truePeak!=null&&file.truePeak>-1;
  const metrics=[
    file.lufsIntegrated!=null&&{v:file.lufsIntegrated.toFixed(1),l:"INT"},
    file.lufsShort!=null&&{v:file.lufsShort.toFixed(1),l:"ST"},
    file.truePeak!=null&&{v:file.truePeak.toFixed(1),l:"dBTP",warn:peakWarn},
    file.dr!=null&&{v:file.dr.toFixed(1),l:"LRA"},
  ].filter(Boolean);

  const showSpinner=(!wsReady&&pendingPlay)||buffering;

  return (
    <div style={{background:C.surf,border:`1px solid ${C.line}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
      {/* Name row */}
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10}}>
        {version&&<span style={{flexShrink:0,fontSize:10,fontWeight:700,color:C.indigo,background:C.accentAlpha,border:`1px solid ${C.accentBorder}`,borderRadius:5,padding:"2px 7px",textTransform:"uppercase",letterSpacing:"0.05em"}}>{version}</span>}
        <span style={{flexShrink:0,fontSize:10,fontWeight:600,color:C.dim,background:C.surf2,border:`1px solid ${C.line}`,borderRadius:5,padding:"2px 7px",letterSpacing:"0.04em"}}>{file.format}</span>
        {file.isNew&&<span style={{flexShrink:0,fontSize:10,fontWeight:700,color:C.green,background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.28)",borderRadius:5,padding:"2px 7px",letterSpacing:"0.05em"}}>NEW</span>}
        {editing?(
          <input autoFocus value={nameVal} onChange={e=>setNameVal(e.target.value)}
            onBlur={saveRename} onKeyDown={e=>{if(e.key==="Enter")saveRename();if(e.key==="Escape"){setNameVal(file.name);setEditing(false);}}}
            className="mt-text" style={{flex:1,padding:"3px 9px",fontSize:13,height:"auto"}}/>
        ):(
          <span onClick={()=>setEditing(true)} title="Click to rename"
            style={{flex:1,fontSize:13,fontWeight:600,color:C.text,cursor:"text",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</span>
        )}
        <span style={{fontSize:10.5,color:C.dim,flexShrink:0,whiteSpace:"nowrap"}}>
          {file.size!=null&&`${file.size} MB`}{file.duration?` · ${fmtSeconds(file.duration)}`:""}
        </span>
        <button onClick={()=>onDelete(file.id)} style={{...iconBtn,flexShrink:0,width:26,height:26,borderRadius:7}}>{Icon.trash()}</button>
      </div>

      {/* Inline analysis strip */}
      {metrics.length>0&&(
        <div style={{display:"flex",alignItems:"center",borderTop:`1px solid ${C.line}`,borderBottom:`1px solid ${C.line}`,margin:"0 0 10px",padding:"6px 0",gap:0,flexWrap:"wrap"}}>
          {metrics.map((m,i)=>(
            <span key={i} style={{display:"flex",alignItems:"baseline",gap:2,paddingRight:14,
              borderRight:i<metrics.length-1?`1px solid ${C.line}`:"none",
              marginRight:i<metrics.length-1?14:0}}>
              <span style={{fontSize:13.5,fontWeight:700,letterSpacing:"-0.02em",color:m.warn?"#fb923c":C.text}}>{m.v}</span>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:m.warn?"#fb923c":C.dim}}>{m.l}</span>
            </span>
          ))}
        </div>
      )}

      {/* Loading progress bar (visible while file downloads) */}
      {!wsReady&&(
        <div style={{height:2,borderRadius:2,background:C.surf2,marginBottom:10,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${loadProgress}%`,background:C.indigo,borderRadius:2,transition:"width .4s ease"}}/>
        </div>
      )}

      {/* Waveform */}
      <div ref={waveRef} style={{marginBottom:8,opacity:wsReady?1:0.14,transition:"opacity .3s"}}/>

      {/* Transport */}
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={handlePlayPause}
          style={{width:28,height:28,borderRadius:8,border:`1px solid ${playing||pendingPlay?C.accentBorder:C.lineS}`,
            background:playing||pendingPlay?C.accentAlpha:C.surf2,
            cursor:"pointer",display:"grid",placeItems:"center",flexShrink:0,padding:0}}>
          {showSpinner
            ?<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{animation:"spin 1s linear infinite"}}><circle cx="12" cy="12" r="9" stroke={C.indigo} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="28 56"/></svg>
            :playing
              ?<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" rx="1.5" fill={C.indigo}/><rect x="14" y="5" width="4" height="14" rx="1.5" fill={C.indigo}/></svg>
              :<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill={C.indigo}/></svg>
          }
        </button>
        <span className="mono" style={{fontSize:11,color:C.faint}}>{fmtSeconds(currentTime)} / {fmtSeconds(file.duration)}</span>
        {!wsReady&&<span style={{fontSize:10.5,color:C.dim}}>{loadProgress>0?`${loadProgress}%`:"Connecting…"}</span>}
        {buffering&&wsReady&&<span style={{fontSize:10.5,color:C.dim}}>Buffering…</span>}
        {pendingPlay&&!wsReady&&<span style={{fontSize:10.5,color:C.indigo}}>▶ queued</span>}
        {file.linkedPath&&<span style={{marginLeft:"auto",fontSize:9.5,color:C.dim,opacity:.6}} title={file.linkedPath}>linked</span>}
      </div>
    </div>
  );
}

/* ─── sort audio files: NEW first, final next, then by version desc, then by date desc ─── */
function sortAudioFiles(files) {
  const isFinal=name=>/\bfinal\b/i.test(name||"");
  const vNum=name=>{
    const m=(name||"").match(/\bv(\d+(?:[._]\d+)*)\b/i);
    if(!m)return -1;
    return parseFloat(m[1].replace(/_/g,"."));
  };
  return [...files].sort((a,b)=>{
    if(a.isNew&&!b.isNew)return -1;
    if(!a.isNew&&b.isNew)return 1;
    const fa=isFinal(a.name),fb=isFinal(b.name);
    if(fa&&!fb)return -1;
    if(!fa&&fb)return 1;
    const vd=vNum(b.name)-vNum(a.name);
    if(vd!==0)return vd;
    return new Date(b.scannedAt||b.uploadedAt||0)-new Date(a.scannedAt||a.uploadedAt||0);
  });
}

/* ─── versions tab ─── */
function VersionsTab({projectName,onCountChange,globalAudioFolder,sectionLabel,sectionOpen,onToggleSec}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [files,setFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [scanning,setScanning]=useState(false);
  const [loading,setLoading]=useState(true);
  const [scanPath,setScanPath]=useState("");
  const [scanMsg,setScanMsg]=useState("");
  const [showScan,setShowScan]=useState(false);
  const [activeFilters,setActiveFilters]=useState({formats:[],versions:[]});
  const [abOpen,setAbOpen]=useState(false);
  const [addMenuOpen,setAddMenuOpen]=useState(false);
  const [showFilters,setShowFilters]=useState(false);
  const fileInputRef=useRef(null);
  const addMenuRef=useRef(null);
  useEffect(()=>{
    if(!addMenuOpen)return;
    const h=e=>{if(addMenuRef.current&&!addMenuRef.current.contains(e.target))setAddMenuOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[addMenuOpen]);

  useEffect(()=>{if(!loading)onCountChange?.(files.length);},[loading,files.length]);// eslint-disable-line

  useEffect(()=>{
    (async()=>{
      try{
        const[fr,pr]=await Promise.all([
          fetch(`/api/audio/${encodeURIComponent(projectName)}`).then(r=>r.json()),
          fetch(`/api/data/music_scan_folders`).then(r=>r.json()),
        ]);
        const loadedFiles=fr.files||[];
        setFiles(loadedFiles);
        const savedPath=pr?.value?(JSON.parse(pr.value)?.[projectName]||""):"";
        const autoScanPath=savedPath||globalAudioFolder||"";
        if(autoScanPath){
          if(savedPath)setScanPath(savedPath);
          // don't auto-open the panel — path is shown as folder badge in group mode
          const sr=await fetch(`/api/audio/${encodeURIComponent(projectName)}/scan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({folderPath:autoScanPath})});
          if(sr.ok){const sd=await sr.json();if(sd.added>0||sd.files)setFiles(sd.files||[]);}
        }
      }catch{}
      setLoading(false);
    })();
  },[projectName]);// eslint-disable-line

  const toggleFilter=(type,value)=>{
    setActiveFilters(prev=>{
      const cur=prev[type]||[];
      const next=cur.includes(value)?cur.filter(v=>v!==value):[...cur,value];
      return{...prev,[type]:next};
    });
  };

  const saveScanPath=async path=>{
    try{
      const r=await fetch(`/api/data/music_scan_folders`).then(x=>x.json());
      const existing=r?.value?JSON.parse(r.value):{};
      if(path)existing[projectName]=path; else delete existing[projectName];
      await fetch(`/api/data/music_scan_folders`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value:JSON.stringify(existing)})});
    }catch{}
  };

  const handleUpload=async e=>{
    const file=e.target.files?.[0];if(!file)return;e.target.value="";
    setUploading(true);
    try{
      const fd=new FormData();fd.append("file",file);
      const r=await fetch(`/api/audio/${encodeURIComponent(projectName)}/upload`,{method:"POST",body:fd});
      if(r.ok){const{file:meta}=await r.json();setFiles(f=>[...f,meta]);}
    }catch{}
    setUploading(false);
  };

  const handleScan=async()=>{
    const path=scanPath.trim();if(!path)return;
    setScanning(true);setScanMsg("");
    try{
      await saveScanPath(path);
      const r=await fetch(`/api/audio/${encodeURIComponent(projectName)}/scan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({folderPath:path})});
      const d=await r.json();
      if(r.ok){setFiles(d.files||[]);setScanMsg(d.added===0?"No new files found.":`Found ${d.added} new file${d.added!==1?"s":""}`);}
      else setScanMsg(d.error||"Scan failed");
    }catch(e){setScanMsg("Scan failed: "+e.message);}
    setScanning(false);
  };

  const handleDelete=async id=>{
    try{
      await fetch(`/api/audio/${encodeURIComponent(projectName)}/${id}`,{method:"DELETE"});
      setFiles(f=>f.filter(x=>x.id!==id));
    }catch{}
  };

  const handleRename=async(id,name)=>{
    try{
      await fetch(`/api/audio/${encodeURIComponent(projectName)}/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
      setFiles(f=>f.map(x=>x.id===id?{...x,name}:x));
    }catch{}
  };

  const handleMarkSeen=async id=>{
    try{
      await fetch(`/api/audio/${encodeURIComponent(projectName)}/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isNew:false})});
      setFiles(f=>f.map(x=>x.id===id?{...x,isNew:false}:x));
    }catch{}
  };

  const handleUnlink=async()=>{
    await saveScanPath("");
    setScanPath("");
    setScanMsg("");
    setShowScan(false);
  };

  const Spinner=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{animation:"spin 1s linear infinite",flexShrink:0}}><circle cx="12" cy="12" r="9" stroke={C.dim} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="28 56"/></svg>;

  const hasPerProjectPath=!!scanPath;
  const hasGlobalFolder=!!globalAudioFolder;

  // Format badges derived from files — used in group summary header
  const fileFmts=!loading?[...new Set(files.map(f=>(f.format||"").toUpperCase()))].filter(f=>["WAV","MP3"].includes(f)):[];

  // Shared scan panel JSX
  const ScanPanel=(
    <div style={{background:C.surf2,border:`1px solid ${hasPerProjectPath?C.accentBorder:C.line}`,borderRadius:10,padding:"11px 13px",marginBottom:12}}>
      <div style={{fontSize:11,color:C.faint,marginBottom:7}}>
        {hasPerProjectPath?"Saved path · auto-scans on open · no duplicates":"Absolute folder path on the server"}
      </div>
      <div style={{display:"flex",gap:7}}>
        <input className="mt-text" value={scanPath} onChange={e=>setScanPath(e.target.value)}
          placeholder="/mnt/user/data/music/my-track"
          onKeyDown={e=>e.key==="Enter"&&handleScan()}
          style={{flex:1,padding:"8px 11px",fontSize:12}}/>
        <button onClick={handleScan} disabled={scanning||!scanPath.trim()}
          style={{border:"none",borderRadius:8,padding:"0 14px",background:C.accentGrad,color:"#fff",fontSize:12.5,fontWeight:600,
            cursor:scanning?"default":"pointer",opacity:scanning||!scanPath.trim()?0.5:1,
            whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,fontFamily:"var(--font-sans)"}}>
          {scanning?<><Spinner/>Scanning…</>:"Scan"}
        </button>
        {hasPerProjectPath&&(
          <button onClick={handleUnlink} title="Unlink folder" style={{...iconBtn,flexShrink:0,borderColor:"rgba(192,138,138,0.3)",background:"rgba(192,138,138,0.08)"}}>
            {Icon.trash()}
          </button>
        )}
      </div>
      {scanMsg&&<div style={{fontSize:11.5,marginTop:7,color:scanMsg.startsWith("No new")||scanMsg.startsWith("Found")?C.green:C.flame}}>{scanMsg}</div>}
    </div>
  );

  // Shared file list renderer
  const FileList=(()=>{
    if(loading)return <div style={{fontSize:13,color:C.dim,textAlign:"center",padding:"16px 0"}}>Loading…</div>;
    if(files.length===0)return <div style={{fontSize:13,color:C.dim,textAlign:"center",padding:"16px 0",fontStyle:"italic"}}>No files yet.</div>;
    const availFmts=new Set(files.map(f=>(f.format||"").toUpperCase()).filter(f=>["WAV","MP3"].includes(f)));
    const availVers=new Set(files.map(f=>extractVersion(f.name)).filter(Boolean));
    const hasVNum=files.some(f=>/\bv\d/i.test(f.name||""));
    if(hasVNum)availVers.add("versioned");
    const fmtF=(activeFilters.formats||[]).filter(v=>availFmts.has(v));
    const verF=(activeFilters.versions||[]).filter(v=>availVers.has(v));
    const visible=sortAudioFiles(files).filter(f=>{
      if(fmtF.length>0){const fmt=(f.format||"").toUpperCase();if(fmt&&!fmtF.includes(fmt))return false;}
      if(verF.length>0){
        const ver=extractVersion(f.name);
        const matchFinal=verF.includes("final")&&ver==="final";
        const matchVersioned=verF.includes("versioned")&&/\bv\d/i.test(f.name||"");
        const matchLabel=verF.some(v=>v!=="final"&&v!=="versioned"&&ver===v);
        if(!matchFinal&&!matchVersioned&&!matchLabel)return false;
      }
      return true;
    });
    if(visible.length===0)return <div style={{fontSize:13,color:C.dim,textAlign:"center",padding:"16px 0"}}>No files match the filters.</div>;
    return visible.map(f=><AudioFileCard key={f.id} file={f} projectName={projectName}
      onDelete={handleDelete} onRename={handleRename} onMarkSeen={handleMarkSeen}/>);
  })();

  // Shared filter pills renderer
  const FilterPills=(()=>{
    if(loading||files.length===0)return null;
    const verLabels=[...new Set(files.map(f=>extractVersion(f.name)).filter(Boolean))];
    const hasFinal=verLabels.includes("final");
    const vTagLabels=verLabels.filter(v=>v!=="final"&&!/^v\d/.test(v));
    const hasVNum=files.some(f=>/\bv\d/i.test(f.name||""));
    const pills=[
      ...fileFmts.map(f=>({type:"formats",value:f,label:f})),
      ...(hasFinal?[{type:"versions",value:"final",label:"Final"}]:[]),
      ...(hasVNum?[{type:"versions",value:"versioned",label:"Versioned"}]:[]),
      ...vTagLabels.map(v=>({type:"versions",value:v,label:v.charAt(0).toUpperCase()+v.slice(1)})),
    ];
    if(pills.length===0)return null;
    const anyActive=(activeFilters.formats||[]).length>0||(activeFilters.versions||[]).length>0;
    const clearFilters=()=>setActiveFilters({formats:[],versions:[]});
    return(
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10,alignItems:"center"}}>
        {pills.map(({type,value,label})=>{
          const on=activeFilters[type]?.includes(value);
          return(
            <button key={type+value} onClick={()=>toggleFilter(type,value)}
              style={{fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:20,cursor:"pointer",
                letterSpacing:"0.04em",textTransform:"uppercase",fontFamily:"var(--font-sans)",
                border:`1px solid ${on?C.accentBorder:C.lineS}`,background:on?C.accentAlpha:"transparent",
                color:on?C.indigo:C.dim,transition:"all .15s"}}>
              {label}
            </button>
          );
        })}
        {anyActive&&<button onClick={clearFilters} style={{fontSize:10.5,fontWeight:600,padding:"3px 9px",borderRadius:20,cursor:"pointer",fontFamily:"var(--font-sans)",border:"none",background:"transparent",color:C.dim}}>Clear</button>}
      </div>
    );
  })();

  return (
    <div style={{padding: sectionLabel?"10px 18px 14px":"14px 18px 20px"}}>
      <input ref={fileInputRef} type="file" accept=".wav,.mp3" onChange={handleUpload} style={{display:"none"}}/>

      {sectionLabel ? (
        /* ── GROUP MODE: compact summary header + collapsible content ── */
        <>
          {/* Summary header row */}
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none",minHeight:36}}
            onClick={onToggleSec}>
            {/* Chevron */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              style={{transform:sectionOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform .18s",flexShrink:0}}>
              <path d="M9 6l6 6-6 6" stroke={C.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {/* Name */}
            <span style={{flex:1,fontSize:13,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sectionLabel}</span>
            {/* Format badges */}
            {!loading&&fileFmts.map(f=>(
              <span key={f} style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:4,letterSpacing:"0.05em",
                background:C.surf2,border:`1px solid ${C.lineS}`,color:C.dim}}>
                {f}
              </span>
            ))}
            {/* File count */}
            {!loading&&files.length>0&&(
              <span style={{fontSize:11,color:C.faint,flexShrink:0}}>
                {files.length} file{files.length!==1?"s":""}
              </span>
            )}
            {!loading&&files.length===0&&(
              <span style={{fontSize:11,color:C.dim,fontStyle:"italic",flexShrink:0}}>no files</span>
            )}
            {/* Folder badge — highlighted when a scan path is saved */}
            <button onClick={e=>{e.stopPropagation();setShowScan(s=>!s);setScanMsg("");}}
              title={hasPerProjectPath?`Folder: ${scanPath}`:"Set scan folder"}
              style={{width:26,height:26,borderRadius:7,flexShrink:0,cursor:"pointer",display:"flex",
                alignItems:"center",justifyContent:"center",
                border:`1px solid ${hasPerProjectPath?C.accentBorder:C.lineS}`,
                background:hasPerProjectPath?C.accentAlpha:C.surf2}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                  stroke={hasPerProjectPath?C.indigo:C.faint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* Filter toggle button */}
            <button onClick={e=>{e.stopPropagation();setShowFilters(s=>!s);}} title="Toggle filters"
              style={{width:26,height:26,borderRadius:7,flexShrink:0,cursor:"pointer",display:"flex",
                alignItems:"center",justifyContent:"center",
                border:`1px solid ${showFilters?C.accentBorder:C.lineS}`,
                background:showFilters?C.accentAlpha:C.surf2}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M7 12h10M11 18h2" stroke={showFilters?C.indigo:C.faint} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
            {/* + action menu (upload + A/B) */}
            <div ref={addMenuRef} style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setAddMenuOpen(v=>!v)}
                style={{width:26,height:26,borderRadius:7,border:`1px solid ${C.lineS}`,background:C.surf2,
                  color:C.faint,fontSize:15,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",
                  justifyContent:"center",fontFamily:"var(--font-sans)"}}>
                {uploading?<Spinner/>:"+"}
              </button>
              <SmartDropdown anchorRef={addMenuRef} open={addMenuOpen} align="right" minHeight={100}
                style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:12,padding:4,minWidth:140,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
                <button onClick={()=>{fileInputRef.current?.click();setAddMenuOpen(false);}} style={{
                  display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 10px",borderRadius:8,
                  border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-sans)",
                  fontSize:13,fontWeight:600,color:C.text,textAlign:"left"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 21V10M7 15l5-5 5 5M3 21h18" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Upload file
                </button>
                {files.length>=2&&(
                  <button onClick={()=>{setAbOpen(true);setAddMenuOpen(false);}} style={{
                    display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 10px",borderRadius:8,
                    border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-sans)",
                    fontSize:13,fontWeight:600,color:C.text,textAlign:"left"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    A/B compare
                  </button>
                )}
              </SmartDropdown>
            </div>
          </div>

          {/* Expanded content */}
          {sectionOpen&&(
            <div style={{marginTop:8}}>
              {abOpen&&<ABCompare files={files} projectName={projectName} onClose={()=>setAbOpen(false)}/>}
              {showScan&&ScanPanel}
              {showFilters&&FilterPills}
              {FileList}
            </div>
          )}
        </>
      ) : (
        /* ── STANDALONE MODE: folder badge + filter + + menu ── */
        <>
          <div style={{display:"flex",gap:6,marginBottom:12,justifyContent:"flex-end"}}>
            {/* Folder badge — matches group mode style; globe dot when using global folder */}
            <button onClick={()=>{setShowScan(s=>!s);setScanMsg("");}}
              title={hasPerProjectPath?`Folder: ${scanPath}`:hasGlobalFolder?"Using global folder from Settings":"Set scan folder"}
              style={{width:26,height:26,borderRadius:7,flexShrink:0,cursor:"pointer",display:"flex",
                alignItems:"center",justifyContent:"center",position:"relative",
                border:`1px solid ${hasPerProjectPath?C.accentBorder:C.lineS}`,
                background:hasPerProjectPath?C.accentAlpha:C.surf2}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                  stroke={hasPerProjectPath?C.indigo:C.faint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {!hasPerProjectPath&&hasGlobalFolder&&(
                <span style={{position:"absolute",top:-3,right:-3,width:7,height:7,borderRadius:"50%",background:C.indigo,border:`1.5px solid ${C.bg}`}}/>
              )}
            </button>
            {/* Filter toggle button */}
            <button onClick={()=>setShowFilters(s=>!s)} title="Toggle filters"
              style={{width:26,height:26,borderRadius:7,flexShrink:0,cursor:"pointer",display:"flex",
                alignItems:"center",justifyContent:"center",
                border:`1px solid ${showFilters?C.accentBorder:C.lineS}`,
                background:showFilters?C.accentAlpha:C.surf2}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M7 12h10M11 18h2" stroke={showFilters?C.indigo:C.faint} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
            {/* + menu: upload + A/B — matches group mode style */}
            <div ref={addMenuRef} style={{position:"relative",flexShrink:0}}>
              <button onClick={()=>setAddMenuOpen(v=>!v)} disabled={uploading}
                style={{width:26,height:26,borderRadius:7,border:`1px solid ${C.lineS}`,background:C.surf2,
                  color:C.faint,fontSize:15,lineHeight:1,cursor:uploading?"default":"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-sans)"}}>
                {uploading?<Spinner/>:"+"}
              </button>
              <SmartDropdown anchorRef={addMenuRef} open={addMenuOpen} align="right" minHeight={100}
                style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:12,padding:4,minWidth:150,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
                <button onClick={()=>{fileInputRef.current?.click();setAddMenuOpen(false);}} style={{
                  display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",borderRadius:8,
                  border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-sans)",
                  fontSize:13,fontWeight:600,color:C.text,textAlign:"left"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 21V10M7 15l5-5 5 5M3 21h18" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Upload file
                </button>
                {files.length>=2&&(
                  <button onClick={()=>{setAbOpen(true);setAddMenuOpen(false);}} style={{
                    display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",borderRadius:8,
                    border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-sans)",
                    fontSize:13,fontWeight:600,color:C.text,textAlign:"left"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    A/B compare
                  </button>
                )}
              </SmartDropdown>
            </div>
          </div>
          {abOpen&&<ABCompare files={files} projectName={projectName} onClose={()=>setAbOpen(false)}/>}
          {showScan&&ScanPanel}
          {showFilters&&FilterPills}
          {FileList}
        </>
      )}
    </div>
  );
}

/* ─── track card inside group panel Tracks tab ─── */
function TrackCard({c,sessions,audioFileCounts,projectColorMap,onOpenProject,onRemoveFromGroup,onStatusChange}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [statusOpen,setStatusOpen]=useState(false);
  const [dropUp,setDropUp]=useState(false);
  const dropRef=useRef(null);
  const btnRef=useRef(null);
  useEffect(()=>{
    if(!statusOpen)return;
    const handler=e=>{if(dropRef.current&&!dropRef.current.contains(e.target))setStatusOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[statusOpen]);
  const handleStatusClick=e=>{
    e.stopPropagation();
    if(btnRef.current){
      const rect=btnRef.current.getBoundingClientRect();
      // dropdown is ~220px tall; open upward if less than 240px below
      setDropUp(window.innerHeight-rect.bottom<240);
    }
    setStatusOpen(v=>!v);
  };
  const sc=STATUS_CFG[c.status||"active"]||STATUS_CFG.active;
  const sd=sc.dot||C.indigo;
  const fmt=ds=>ds?new Date(ds+"T00:00:00").toLocaleDateString("en",{month:"short",day:"numeric"}):"";
  const tlLabel=(()=>{
    if(c.plannedStart&&c.plannedEnd&&c.plannedStart!==c.plannedEnd)return`${fmt(c.plannedStart)} → ${fmt(c.plannedEnd)}`;
    if(c.plannedStart&&c.plannedEnd&&c.plannedStart===c.plannedEnd)return fmt(c.plannedStart);
    if(c.plannedStart)return fmt(c.plannedStart);
    if(c.plannedEnd)return`due ${fmt(c.plannedEnd)}`;
    return null;
  })();
  const tlColor=(c.plannedStart||c.plannedEnd)?(projectColorMap[c.name]||C.indigo):C.dim;
  const cnt=sessions?.filter(s=>s.project===c.name).length||0;
  const audioCount=audioFileCounts[c.name]||0;
  return(
    <div onClick={()=>onOpenProject?.(c.name)} style={{background:C.surf2,borderRadius:12,padding:"11px 12px 11px 14px",display:"flex",gap:10,alignItems:"center",cursor:"pointer"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
        <div style={{fontSize:11.5,color:C.dim,marginTop:2,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
          {tlLabel&&(
            <span style={{display:"flex",alignItems:"center",gap:2,color:tlColor,fontWeight:500}}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="16.5" rx="3" stroke={tlColor} strokeWidth="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4" stroke={tlColor} strokeWidth="2" strokeLinecap="round"/></svg>
              {tlLabel}
            </span>
          )}
          {tlLabel&&<span style={{color:C.dim}}>·</span>}
          <span>{cnt?`${cnt} session${cnt>1?"s":""}`:  "no sessions"}</span>
          {audioCount>0&&<><span style={{color:C.dim}}>·</span>
            <button onClick={e=>{e.stopPropagation();onOpenProject?.(c.name,"versions");}} style={{display:"flex",alignItems:"center",gap:2,background:"transparent",border:"none",cursor:"pointer",padding:0,color:C.green,fontSize:11.5,fontFamily:"var(--font-sans)"}}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M2 13h4l2-9 4 18 3-12 2 5 3-2h2" stroke={C.green} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>{audioCount}
            </button>
          </>}
        </div>
      </div>
      {/* Status pill — click opens dropdown, direction chosen by available space */}
      <div ref={dropRef} style={{position:"relative",flexShrink:0}}>
        <button ref={btnRef} onClick={handleStatusClick}
          style={{fontSize:10.5,fontWeight:700,color:sd,background:`${sd}1a`,border:`1.5px solid ${sd}55`,borderRadius:20,padding:"2px 8px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"var(--font-sans)",lineHeight:1.4}}>
          {sc.label}
        </button>
        {statusOpen&&(
          <div style={{position:"absolute",[dropUp?"bottom":"top"]:"calc(100% + 4px)",right:0,zIndex:50,
            background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:12,padding:4,
            minWidth:130,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
            {STATUS_ORDER.map(s=>{
              const sc2=STATUS_CFG[s],sd2=sc2.dot||C.indigo,isActive=s===(c.status||"active");
              return(
                <button key={s} onClick={e=>{e.stopPropagation();onStatusChange?.(c.name,s);setStatusOpen(false);}} style={{
                  display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",
                  borderRadius:8,border:"none",background:isActive?`${sd2}18`:"transparent",
                  cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:12.5,fontWeight:600,
                  color:isActive?sd2:C.text,textAlign:"left",
                }}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:sd2,flexShrink:0}}/>
                  {sc2.label}
                  {isActive&&<svg style={{marginLeft:"auto"}} width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={sd2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button onClick={e=>{e.stopPropagation();onRemoveFromGroup?.(c.name);}} title="Remove from group" style={{...iconBtn,width:28,height:28,borderRadius:8,flexShrink:0}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={C.faint} strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

/* ─── project panel (notes + versions) ─── */
function NotesEditor({value,onChange}) {
  const C=useTheme();
  const ref=useRef(null);
  // Auto-grow: reset height to auto then set to scrollHeight
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    el.style.height="auto";el.style.height=el.scrollHeight+"px";
  },[value]);
  return(
    <div style={{borderTop:`1px solid ${C.line}`,padding:"8px 16px 4px"}}>
      <textarea
        ref={ref}
        value={value||""}
        onChange={e=>onChange(e.target.value)}
        placeholder="Notes…"
        style={{width:"100%",minHeight:120,background:"transparent",border:"none",outline:"none",
          resize:"none",overflow:"hidden",fontSize:13,lineHeight:1.7,
          fontFamily:"var(--font-mono)",padding:0,color:C.text,
          boxSizing:"border-box",display:"block"}}
      />
    </div>
  );
}

function CollapsibleVersionsSection({projectName,label,globalAudioFolder,onCountChange,borderTop=false,forcedOpen,onIndividualToggle}) {
  const C=useTheme();
  const [open,setOpen]=useState(false); // collapsed by default
  const isOpen=forcedOpen!=null?forcedOpen:open;
  const handleToggle=()=>{setOpen(v=>!v);onIndividualToggle?.();};
  return(
    <div style={{borderTop:borderTop?`1px solid ${C.line}`:"none"}}>
      <VersionsTab projectName={projectName} onCountChange={onCountChange} globalAudioFolder={globalAudioFolder}
        sectionLabel={label} sectionOpen={isOpen} onToggleSec={handleToggle}/>
    </div>
  );
}

function ProjectPanel({name,notes,onSave,onClose,globalAudioFolder,onRename,plannedStart,plannedEnd,onSaveTimeline,sessions,initialTab,status,onStatusChange,type,childProjects=[],ungroupedProjects=[],onOpenProject,onAddToGroup,onRemoveFromGroup,onCreateTrack,audioFileCounts={},projectColorMap={},canGoBack=false}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const isGroupType=!!GROUP_TYPE_CFG[type];
  const [tab,setTab]=useState(initialTab&&initialTab!=="open"?initialTab:isGroupType?"tracks":"open");
  const [versionsCount,setVersionsCount]=useState(null);
  const [versionsCountMap,setVersionsCountMap]=useState({});
  const totalGroupVersions=Object.values(versionsCountMap).reduce((a,b)=>a+b,0);
  // Pre-fetch audio counts for all group children on panel open so the tab label is populated immediately
  useEffect(()=>{
    if(!isGroup||childProjects.length===0)return;
    childProjects.forEach(async c=>{
      try{
        const r=await fetch(`/api/audio/${encodeURIComponent(c.name)}`).then(x=>x.json());
        setVersionsCountMap(prev=>({...prev,[c.name]:r.files?.length??0}));
      }catch{}
    });
  },[]);// eslint-disable-line
  const [renamingProject,setRenamingProject]=useState(false);
  const [renameVal,setRenameVal]=useState(name);
  const [tlStart,setTlStart]=useState(plannedStart||"");
  const [tlEnd,setTlEnd]=useState(plannedEnd||"");
  const [tlEditing,setTlEditing]=useState(false);
  const [statusDropOpen,setStatusDropOpen]=useState(false);
  const statusDropRef=useRef(null);
  const tlDropRef=useRef(null);
  useEffect(()=>{
    fetch(`/api/audio/${encodeURIComponent(name)}`).then(r=>r.json())
      .then(d=>setVersionsCount(d.files?.length??0)).catch(()=>{});
  },[name]);
  useEffect(()=>{
    if(!statusDropOpen)return;
    const h=e=>{if(statusDropRef.current&&!statusDropRef.current.contains(e.target))setStatusDropOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[statusDropOpen]);
  useEffect(()=>{
    if(!tlEditing)return;
    const h=e=>{if(tlDropRef.current&&!tlDropRef.current.contains(e.target))setTlEditing(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[tlEditing]);
  const commitRename=()=>{
    const trimmed=renameVal.trim();
    if(trimmed&&trimmed!==name)onRename?.(name,trimmed);
    setRenamingProject(false);
  };
  const commitTimeline=()=>{onSaveTimeline?.(tlStart,tlEnd);setTlEditing(false);};
  const clearTimeline=()=>{setTlStart("");setTlEnd("");onSaveTimeline?.("","");setTlEditing(false);};
  const [text,setText]=useState(notes||"");
  const [historyOpen,setHistoryOpen]=useState(false);
  const [addTrackOpen,setAddTrackOpen]=useState(false);
  const [newTrackName,setNewTrackName]=useState("");
  const [versionsAllOpen,setVersionsAllOpen]=useState(null); // null=individual, true=all open, false=all closed
  const isGroup=isGroupType;
  const close=()=>{onSave(text);onClose()};

  const projectSessions=(sessions||[]).filter(s=>s.project===name).sort((a,b)=>b.date.localeCompare(a.date)||((b.hour??0)-(a.hour??0)));
  const totalProjMins=projectSessions.reduce((a,s)=>a+s.duration,0);
  const lastSession=projectSessions[0];
  const tlFmt=ds=>ds?new Date(ds+"T00:00:00").toLocaleDateString("en",{month:"short",day:"numeric"}):"";
  const tlFmtFull=ds=>ds?new Date(ds+"T00:00:00").toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"}):"";
  const hasTl=plannedStart||plannedEnd;
  const curStatus=status||"active";
  const statusCfg=STATUS_CFG[curStatus]||STATUS_CFG.active;
  const statusDot=statusCfg.dot||C.indigo;

  return (
    <div className="overlay" style={{alignItems:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&close()}>
      <div style={{background:C.surf,borderRadius:22,border:`1px solid ${C.lineS}`,width:"100%",maxWidth:500,display:"flex",flexDirection:"column",animation:"mtmodal .22s ease",maxHeight:"88vh"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 0",gap:10}}>
          {renamingProject?(
            <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
              <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")commitRename();if(e.key==="Escape"){setRenameVal(name);setRenamingProject(false);}}}
                className="mt-text" style={{flex:1,padding:"6px 12px",fontSize:15,fontWeight:700,height:"auto"}}/>
              <button onClick={commitRename} style={{background:C.accentGrad,border:"none",borderRadius:10,color:"#fff",padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Save</button>
              <button onClick={()=>{setRenameVal(name);setRenamingProject(false);}} style={iconBtn}>{Icon.close()}</button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
              <button onClick={()=>{setRenameVal(name);setRenamingProject(true);}} style={{background:"none",border:"none",padding:4,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center"}} title="Rename project">{Icon.pencil()}</button>
            </div>
          )}
          {!renamingProject&&<button onClick={close} style={{...iconBtn,flexShrink:0}}>{Icon.close()}</button>}
        </div>

        {/* Metadata strip — status · dates · stats */}
        {!renamingProject&&(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px 0",flexWrap:"wrap"}}>
            {/* Status pill + dropdown */}
            <div ref={statusDropRef} style={{position:"relative"}}>
              <button onClick={()=>setStatusDropOpen(o=>!o)} style={{
                fontSize:11,fontWeight:700,color:statusDot,background:`${statusDot}1a`,
                border:`1.5px solid ${statusDot}55`,borderRadius:20,padding:"3px 10px",
                cursor:"pointer",whiteSpace:"nowrap",fontFamily:"var(--font-sans)",lineHeight:1.4,
              }}>{statusCfg.label}</button>
              <SmartDropdown anchorRef={statusDropRef} open={statusDropOpen} align="left" minHeight={240}
                style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:5,minWidth:140,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
                  {STATUS_ORDER.map(s=>{
                    const sc=STATUS_CFG[s],sd=sc.dot||C.indigo,isActive=s===curStatus;
                    return(
                      <button key={s} onClick={()=>{onStatusChange?.(name,s);setStatusDropOpen(false);}} style={{
                        display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 12px",
                        borderRadius:9,border:"none",background:isActive?`${sd}18`:"transparent",
                        cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,
                        color:isActive?sd:C.text,textAlign:"left",
                      }}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:sd,flexShrink:0}}/>
                        {sc.label}
                        {isActive&&<svg style={{marginLeft:"auto"}} width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={sd} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                    );
                  })}
                </SmartDropdown>
            </div>

            {/* Dates chip + dropdown */}
            <div ref={tlDropRef} style={{position:"relative"}}>
              <button onClick={()=>setTlEditing(v=>!v)} style={{
                display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,
                color:hasTl?C.indigo:C.faint,background:hasTl?C.accentAlpha:"transparent",
                border:`1.5px solid ${hasTl?C.accentBorder:C.line}`,
                borderRadius:20,padding:"3px 10px",cursor:"pointer",
                fontFamily:"var(--font-sans)",lineHeight:1.4,whiteSpace:"nowrap",
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="16.5" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                {hasTl?`${tlFmt(plannedStart)}${plannedEnd&&plannedEnd!==plannedStart?` → ${tlFmt(plannedEnd)}`:""}` : "Set dates"}
              </button>
              <RangePicker open={tlEditing} start={tlStart} end={tlEnd}
                onChange={(s,e)=>{setTlStart(s);setTlEnd(e);if(!s&&!e){onSaveTimeline?.("","");setTlEditing(false);}else if(s&&e){onSaveTimeline?.(s,e);setTlEditing(false);}}}
                onClose={()=>setTlEditing(false)}/>
            </div>

            {/* Stats */}
            {projectSessions.length>0&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:C.faint}}>{fmtDur(totalProjMins)}</span>
                <span style={{fontSize:11,color:C.dim}}>·</span>
                <span style={{fontSize:11,color:C.faint}}>{projectSessions.length} session{projectSessions.length!==1?"s":""}</span>
                {lastSession&&<><span style={{fontSize:11,color:C.dim}}>·</span><span style={{fontSize:11,color:C.faint}}>{tlFmtFull(lastSession.date)}</span></>}
              </div>
            )}
          </div>
        )}

        {/* Timeline dropdown — rendered relative to the dates chip in the metadata strip */}

        {/* Tab bar */}
        <div style={{display:"flex",gap:0,padding:"12px 20px 0",borderBottom:`1px solid ${C.line}`}}>
          {[
            ...(isGroup?[["tracks",`Tracks · ${childProjects.length}`]]:[]),
            ["open","Notes"],
            ["versions",isGroup?(totalGroupVersions>0?`Versions · ${totalGroupVersions}`:"Versions"):(versionsCount!=null?`Versions · ${versionsCount}`:"Versions")],
          ].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"8px 18px",fontSize:13.5,fontWeight:600,border:"none",cursor:"pointer",
              borderBottom:`2px solid ${tab===t?C.indigo:"transparent"}`,background:"transparent",
              color:tab===t?C.indigo:C.faint,marginBottom:"-1px",fontFamily:"var(--font-sans)",whiteSpace:"nowrap",
            }}>{l}</button>
          ))}
        </div>

        {/* Notes tab */}
        {tab==="open"&&(
          <>
            <div style={{flex:1,overflowY:"auto",maxHeight:"58vh"}}>
              <NotesEditor value={text} onChange={setText}/>
              {/* Collapsible session history */}
              <div style={{borderTop:`1px solid ${C.line}`}}>
                <button onClick={()=>setHistoryOpen(v=>!v)} style={{
                  width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 16px",background:"transparent",border:"none",cursor:"pointer",
                  fontFamily:"var(--font-sans)"}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:"0.06em",textTransform:"uppercase"}}>
                    Session history {projectSessions.length>0&&`· ${projectSessions.length}`}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{transform:historyOpen?"rotate(180deg)":"none",transition:"transform .18s",flexShrink:0}}><path d="M6 9l6 6 6-6" stroke={C.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {historyOpen&&(
                  <div style={{padding:"0 16px 12px",display:"flex",flexDirection:"column"}}>
                    {projectSessions.length===0
                      ?<div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"12px 0"}}>No sessions logged yet.</div>
                      :projectSessions.map((s,i)=>{
                        const tagCol=s.tag?TAG_COLOR[s.tag]:null;
                        const isNewDate=i===0||projectSessions[i-1].date!==s.date;
                        return(
                          <div key={s.id}>
                            {isNewDate&&<div style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:"0.05em",textTransform:"uppercase",padding:i>0?"12px 0 4px":"4px 0"}}>{fmtRelativeDate(s.date)||s.date}</div>}
                            <div style={{display:"flex",gap:10,padding:"6px 0",borderTop:`1px solid ${C.line}`}}>
                              <div style={{width:3,borderRadius:2,background:tagCol||C.indigo,flexShrink:0,alignSelf:"stretch",minHeight:24}}/>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2,flexWrap:"wrap"}}>
                                  {s.hour!=null&&<span style={{fontSize:11.5,fontWeight:600,color:C.text}}>{`${s.hour%12||12}${s.hour<12?"am":"pm"}`}</span>}
                                  {s.mood!=null&&<span style={{fontSize:11}}>{MOOD_EMOJI[s.mood]}</span>}
                                  {s.tag&&<span style={{fontSize:10,fontWeight:600,color:tagCol,background:`${tagCol}1e`,borderRadius:4,padding:"1px 6px"}}>{s.tag}</span>}
                                  <span style={{fontSize:11,color:C.dim,marginLeft:"auto"}}>{fmtDur(s.duration)}</span>
                                </div>
                                {s.note?<div style={{fontSize:12.5,color:C.text,lineHeight:1.5}}>{s.note}</div>
                                  :<div style={{fontSize:11.5,color:C.dim,fontStyle:"italic"}}>no note</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",padding:"14px 20px",borderTop:`1px solid ${C.line}`}}>
              <button onClick={close} style={{background:C.accentGrad,border:"none",borderRadius:12,color:"#fff",padding:"11px 22px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Save &amp; close</button>
            </div>
          </>
        )}

        {/* Tracks tab — group projects only */}
        {tab==="tracks"&&(
          <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
            {/* Add track button — top */}
            {!addTrackOpen?(
              <button onClick={()=>{setAddTrackOpen(true);setNewTrackName("");}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:`1px dashed ${C.lineS}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",color:C.dim,fontSize:13,fontWeight:600,width:"100%",fontFamily:"var(--font-sans)"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={C.dim} strokeWidth="2" strokeLinecap="round"/></svg>
                Add track to group
              </button>
            ):(
              <div style={{background:C.surf2,borderRadius:12,padding:10,display:"flex",flexDirection:"column",gap:6}}>
                {/* Create new track */}
                <div style={{display:"flex",gap:6}}>
                  <input autoFocus className="mt-text" value={newTrackName} onChange={e=>setNewTrackName(e.target.value)}
                    placeholder="New track name…"
                    onKeyDown={e=>{if(e.key==="Enter"&&newTrackName.trim()){onCreateTrack?.(newTrackName.trim(),name);setAddTrackOpen(false);}
                      else if(e.key==="Escape")setAddTrackOpen(false);}}
                    style={{flex:1,fontSize:13,padding:"7px 11px"}}/>
                  <button onClick={()=>{if(newTrackName.trim()){onCreateTrack?.(newTrackName.trim(),name);setAddTrackOpen(false);}}}
                    disabled={!newTrackName.trim()}
                    style={{border:"none",borderRadius:9,background:C.accentGrad,color:"#fff",fontSize:13,fontWeight:600,padding:"0 14px",cursor:"pointer",opacity:newTrackName.trim()?1:0.4,fontFamily:"var(--font-sans)"}}>
                    Create
                  </button>
                </div>
                {/* Add existing */}
                {ungroupedProjects.length>0&&(
                  <>
                    <div style={{fontSize:10.5,fontWeight:600,color:C.faint,letterSpacing:"0.05em",textTransform:"uppercase",padding:"2px 4px"}}>Or add existing</div>
                    {ungroupedProjects.map(p=>(
                      <button key={p.name} onClick={()=>{onAddToGroup?.(p.name,name);setAddTrackOpen(false);}} style={{
                        display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 10px",
                        borderRadius:9,border:"none",background:C.surf,cursor:"pointer",
                        fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,color:C.text,textAlign:"left",
                      }}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:C.indigo,flexShrink:0}}/>
                        {p.name}
                      </button>
                    ))}
                  </>
                )}
                <button onClick={()=>setAddTrackOpen(false)} style={{fontSize:12,color:C.faint,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",textAlign:"left",fontFamily:"var(--font-sans)"}}>Cancel</button>
              </div>
            )}
            {/* Child project cards */}
            {childProjects.map(c=>(
              <TrackCard key={c.name} c={c} sessions={sessions} audioFileCounts={audioFileCounts}
                projectColorMap={projectColorMap} onOpenProject={onOpenProject}
                onRemoveFromGroup={onRemoveFromGroup} onStatusChange={onStatusChange}/>
            ))}
            {childProjects.length===0&&(
              <div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"16px 0",fontStyle:"italic"}}>No tracks yet</div>
            )}
          </div>
        )}

        {/* Versions tab */}
        {tab==="versions"&&(
          <div style={{flex:1,overflowY:"auto"}}>
            {isGroup?(
              <>
                {childProjects.length>0&&(
                  <div style={{display:"flex",justifyContent:"flex-end",padding:"8px 16px 2px"}}>
                    <button onClick={()=>setVersionsAllOpen(v=>v===true?false:true)}
                      style={{fontSize:11,fontWeight:600,color:C.faint,background:"none",border:"none",cursor:"pointer",fontFamily:"var(--font-sans)",padding:"2px 0"}}>
                      {versionsAllOpen===true?"Collapse all":"Expand all"}
                    </button>
                  </div>
                )}
                {childProjects.map((c,i)=>(
                  <CollapsibleVersionsSection key={c.name} projectName={c.name} label={c.name}
                    onCountChange={n=>setVersionsCountMap(prev=>({...prev,[c.name]:n}))}
                    globalAudioFolder={globalAudioFolder} borderTop={i>0}
                    forcedOpen={versionsAllOpen} onIndividualToggle={()=>setVersionsAllOpen(null)}/>
                ))}
                {childProjects.length===0&&<div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"32px 0",fontStyle:"italic"}}>No tracks in this group yet</div>}
              </>
            ):(
              <VersionsTab projectName={name} onCountChange={setVersionsCount} globalAudioFolder={globalAudioFolder}/>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── smart dropdown: auto-flips up/down based on available viewport space ─── */
function SmartDropdown({anchorRef,open,align="right",minHeight=220,style={},children}) {
  const [up,setUp]=useState(false);
  useEffect(()=>{
    if(!open||!anchorRef?.current)return;
    const rect=anchorRef.current.getBoundingClientRect();
    setUp(window.innerHeight-rect.bottom<minHeight);
  },[open]);// eslint-disable-line
  if(!open)return null;
  return(
    <div style={{position:"absolute",[up?"bottom":"top"]:"calc(100% + 6px)",[align==="right"?"right":"left"]:0,zIndex:50,...style}}>
      {children}
    </div>
  );
}

/* ─── calendar picker ─── */
function CalendarPicker({value,onChange}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [open,setOpen]=useState(false);
  const [view,setView]=useState(()=>{const d=parseDate(value);return{y:d.getFullYear(),m:d.getMonth()};});
  const pad=n=>String(n).padStart(2,"0");
  const mk=d=>`${view.y}-${pad(view.m+1)}-${pad(d)}`;
  const firstDay=new Date(view.y,view.m,1),startOffset=(firstDay.getDay()+6)%7,dim=new Date(view.y,view.m+1,0).getDate();
  const cells=[...Array(startOffset).fill(null),...Array.from({length:dim},(_,i)=>mk(i+1))];
  const pick=ds=>{onChange(ds);setOpen(false);};
  const step=dir=>setView(({y,m})=>{const nm=m+dir;return nm<0?{y:y-1,m:11}:nm>11?{y:y+1,m:0}:{y,m:nm};});
  return (
    <div>
      <button type="button" onClick={()=>{const d=parseDate(value);setView({y:d.getFullYear(),m:d.getMonth()});setOpen(o=>!o);}}
        style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left",
          background:C.surf2,border:`1px solid ${open?C.accentBorder:C.line}`,borderRadius:12,color:C.text,fontFamily:"var(--font-sans)",fontSize:14,padding:"13px 14px"}}>
        <span style={{fontWeight:600}}>{value===today?"Today":value===yesterday?"Yesterday":fmtDate(value)}</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="16.5" rx="3" stroke={C.muted} strokeWidth="1.7"/><path d="M3 9h18M8 2.5v4M16 2.5v4" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round"/></svg>
      </button>
      {open&&(
        <div style={{marginTop:10,background:C.surf2,border:`1px solid ${C.line}`,borderRadius:16,padding:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <button type="button" onClick={()=>step(-1)} style={iconBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <span style={{fontSize:14,fontWeight:700,color:C.text}}>{monthNames[view.m]} {view.y}</span>
            <button type="button" onClick={()=>step(1)} style={iconBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:5}}>
            {DAYS_MON.map((d,i)=><div key={i} style={{fontSize:10.5,color:C.dim,textAlign:"center"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {cells.map((ds,i)=>{
              if(!ds)return<div key={i}/>;
              const isSel=ds===value,isToday=ds===today,future=ds>today;
              return(
                <button key={ds} type="button" disabled={future} onClick={()=>pick(ds)} style={{
                  aspectRatio:"1",borderRadius:10,border:isToday&&!isSel?`1.5px solid ${C.indigo}`:"1.5px solid transparent",
                  background:isSel?C.accentGrad:"transparent",color:isSel?"#fff":future?"#3a3a4c":isToday?C.indigo:C.text,
                  fontSize:13,fontWeight:isSel?700:500,cursor:future?"default":"pointer",fontFamily:"var(--font-sans)",
                }}>{Number(ds.slice(8))}</button>
              );
            })}
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            {[["Today",today],["Yesterday",yesterday]].map(([label,ds])=>(
              <button key={label} type="button" onClick={()=>pick(ds)} style={{
                flex:1,padding:"9px 0",borderRadius:10,cursor:"pointer",fontSize:12.5,fontWeight:600,
                border:value===ds?`1px solid ${C.accentBorder}`:`1px solid ${C.lineS}`,
                background:value===ds?C.accentAlpha:"transparent",color:value===ds?C.indigo:C.muted,
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── range date picker — single calendar, click start then end ─── */
/* ─── compact range picker — same look as old PlanDatePicker, one calendar for start+end ─── */
function RangePicker({start,end,onChange,open,onClose}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const initView=()=>{const ref=start||end||today;const d=parseDate(ref);return{y:d.getFullYear(),m:d.getMonth()};};
  const [view,setView]=useState(initView);
  const [phase,setPhase]=useState(start?"end":"start");
  const [hover,setHover]=useState(null);
  useEffect(()=>{if(open)setPhase(start&&!end?"end":"start");},[open]);// eslint-disable-line

  const pad=n=>String(n).padStart(2,"0");
  const mk=d=>`${view.y}-${pad(view.m+1)}-${pad(d)}`;
  const firstDay=new Date(view.y,view.m,1),startOffset=(firstDay.getDay()+6)%7,dim=new Date(view.y,view.m+1,0).getDate();
  const cells=[...Array(startOffset).fill(null),...Array.from({length:dim},(_,i)=>mk(i+1))];
  const step=dir=>setView(({y,m})=>{const nm=m+dir;return nm<0?{y:y-1,m:11}:nm>11?{y:y+1,m:0}:{y,m:nm};});

  const pick=ds=>{
    if(phase==="start"||!start){
      onChange(ds,"");setPhase("end");
    } else if(ds===start){
      // tap same date twice → single-day
      onChange(ds,ds);setPhase("start");setHover(null);onClose?.();
    } else {
      const s=ds<start?ds:start,e=ds<start?start:ds;
      onChange(s,e);setPhase("start");setHover(null);onClose?.();
    }
  };

  const pvLo=phase==="end"&&hover&&start?(start<hover?start:hover):null;
  const pvHi=phase==="end"&&hover&&start?(start<hover?hover:start):null;
  const lo=start&&end?(start<end?start:end):start;
  const hi=start&&end?(start<end?end:start):end;

  if(!open)return null;
  return(
    <div style={{marginTop:6,background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:12,
      position:"absolute",zIndex:40,boxShadow:`0 8px 28px -6px rgba(0,0,0,0.3)`,minWidth:230,left:0}}>
      {/* Month nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button type="button" onClick={()=>step(-1)} style={iconBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <span style={{fontSize:13,fontWeight:700,color:C.text}}>{monthNames[view.m]} {view.y}</span>
        <button type="button" onClick={()=>step(1)} style={iconBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DAYS_MON.map((d,i)=><div key={i} style={{fontSize:9.5,color:C.dim,textAlign:"center"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((ds,i)=>{
          if(!ds)return<div key={i}/>;
          const isCap=ds===lo||ds===hi,isT=ds===today;
          const inR=lo&&hi&&ds>lo&&ds<hi;
          const inPv=pvLo&&pvHi&&ds>pvLo&&ds<pvHi;
          const isPvCap=pvLo&&pvHi&&(ds===pvLo||ds===pvHi);
          const filled=isCap||isPvCap;
          return(
            <button key={ds} type="button" onClick={()=>pick(ds)}
              onMouseEnter={()=>phase==="end"&&setHover(ds)}
              onMouseLeave={()=>setHover(null)}
              style={{aspectRatio:"1",borderRadius:8,border:isT&&!filled?`1.5px solid ${C.indigo}`:"1.5px solid transparent",
                background:filled?C.accentGrad:inR||inPv?C.accentAlpha2:"transparent",
                color:filled?"#fff":isT?C.indigo:C.text,
                fontSize:11.5,fontWeight:filled?700:400,cursor:"pointer",fontFamily:"var(--font-sans)",
              }}>{Number(ds.slice(8))}</button>
          );
        })}
      </div>
      {/* Hint + clear */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,paddingTop:8,borderTop:`1px solid ${C.line}`}}>
        <span style={{fontSize:10.5,color:C.dim}}>{phase==="start"?"Pick start date":"Pick end date"}</span>
        {(start||end)&&<button type="button" onClick={()=>{onChange("","");setPhase("start");}} style={{fontSize:11,color:C.faint,background:"none",border:"none",cursor:"pointer",padding:0}}>Clear</button>}
      </div>
    </div>
  );
}

/* ─── project picker ─── */
function ProjectPicker({value,projects,onChange}) {
  const C=useTheme();
  const [open,setOpen]=useState(false);
  const activeProjects=projects.filter(p=>!["done","released"].includes(p.status||"active"));
  const opts=[{name:"",label:"— none —"},...activeProjects.map(p=>({name:p.name,label:p.name}))];
  return (
    <div>
      <button type="button" onClick={()=>setOpen(o=>!o)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left",
        background:C.surf2,border:`1px solid ${open?C.accentBorder:C.line}`,borderRadius:12,
        color:value?C.text:C.muted,fontFamily:"var(--font-sans)",fontSize:14,padding:"13px 14px"}}>
        <span style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value||"— none —"}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,transform:open?"rotate(180deg)":"none",transition:"transform .18s"}}><path d="M6 9l6 6 6-6" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open&&(
        <div style={{marginTop:8,background:C.surf2,border:`1px solid ${C.line}`,borderRadius:14,padding:6,display:"flex",flexDirection:"column",gap:2}}>
          {opts.map(o=>{
            const sel=o.name===value;
            return(
              <button key={o.name||"none"} type="button" onClick={()=>{onChange(o.name);setOpen(false);}} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",borderRadius:10,border:"none",
                cursor:"pointer",background:sel?C.accentAlpha:"transparent",
                color:o.name?(sel?C.indigo:C.text):C.muted,fontSize:14,fontWeight:600,fontFamily:"var(--font-sans)",textAlign:"left"}}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</span>
                {sel&&<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={C.indigo} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── log sheet ─── */
function LogSheet({initial,editing,projects,onSubmit,onDelete,onClose}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [form,setForm]=useState(initial);
  const set=patch=>setForm(f=>({...f,...patch}));
  const todSlot=TOD.find(t=>t.test(form.hour||new Date().getHours()));
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:19,fontWeight:700,letterSpacing:"-0.01em",color:C.text}}>{editing?"Edit session":"Log a session"}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:3}}>{fmtDate(form.date)} {todSlot?`· ${todSlot.emoji} ${todSlot.label}`:""}</div>
          </div>
          <button onClick={onClose} style={iconBtn}>{Icon.close()}</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <div>
            <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:8}}>Date</div>
            <CalendarPicker value={form.date} onChange={d=>set({date:d})}/>
          </div>
          <div>
            <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:8}}>Project</div>
            <ProjectPicker value={form.project} projects={projects} onChange={p=>set({project:p})}/>
          </div>
          <div>
            <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>Session type</div>
            <div className="scrollless" style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
              {TAGS.map(tag=>{
                const active=form.tag===tag;
                const col=TAG_COLOR[tag];
                return(
                  <button key={tag} onClick={()=>set({tag:active?"":tag})} style={{
                    flexShrink:0,padding:"7px 13px",borderRadius:20,border:`1.5px solid ${active?col:C.lineS}`,
                    background:active?`${col}22`:"transparent",color:active?col:C.muted,
                    fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-sans)",
                    transition:"all .15s",
                  }}>{tag}</button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
              <span style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint}}>Duration</span>
              <span className="mono" style={{fontSize:16,fontWeight:700,color:C.indigo}}>{fmtDur(form.duration)}</span>
            </div>
            <input type="range" className="mt" min="1" max="480" step="1" value={form.duration} onChange={e=>set({duration:Number(e.target.value)})}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.dim,marginTop:7}}>
              <span>5m</span><span>2h</span><span>4h</span><span>8h</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>Mood</div>
            <div style={{display:"flex",gap:8}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>set({mood:n})} style={{
                  flex:1,aspectRatio:"1",borderRadius:14,fontSize:23,cursor:"pointer",
                  border:form.mood===n?`2px solid ${C.indigo}`:"2px solid transparent",
                  background:form.mood===n?C.accentAlpha:C.surf2,
                  transform:form.mood===n?"translateY(-3px)":"none",transition:"all .16s",
                }}>{MOOD_EMOJI[n]}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>
              Note <span style={{textTransform:"none",letterSpacing:0,color:C.dim}}>(optional)</span>
            </div>
            <input type="text" className="mt-text" value={form.note} placeholder="What did you work on?" onChange={e=>set({note:e.target.value})}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            {editing&&<button onClick={onDelete} style={{...iconBtn,width:52,height:"auto",borderColor:"rgba(192,138,138,0.3)",background:"rgba(192,138,138,0.08)"}}>{Icon.trash()}</button>}
            <button onClick={()=>onSubmit(form)} style={{flex:1,padding:16,borderRadius:14,border:"none",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:16,fontWeight:700,color:"#fff",background:C.accentGrad,boxShadow:`0 8px 22px -8px ${C.accentGlow}`}}>
              {editing?"Save changes":"Log session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── all sessions sheet ─── */
function AllSessions({sessions,projects,projectMap,onEdit,onDelete,onClose}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const NONE="__none__";
  const [filter,setFilter]=useState("All");
  const hasNoProj=sessions.some(s=>!s.project);
  const chips=["All",...projects.map(p=>p.name),...(hasNoProj?[NONE]:[])];
  const countFor=c=>c==="All"?sessions.length:c===NONE?sessions.filter(s=>!s.project).length:sessions.filter(s=>s.project===c).length;
  const filtered=sessions.filter(s=>filter==="All"?true:filter===NONE?!s.project:s.project===filter);
  const tMin=filtered.reduce((a,s)=>a+s.duration,0);
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="grab"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:19,fontWeight:700,letterSpacing:"-0.01em",color:C.text}}>All sessions</div>
            <div style={{fontSize:13,color:C.muted,marginTop:3}}>{filtered.length} session{filtered.length!==1?"s":""} · {fmtDur(tMin)} total</div>
          </div>
          <button onClick={onClose} style={iconBtn}>{Icon.close()}</button>
        </div>
        <div className="scrollless" style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,margin:"0 -2px 16px"}}>
          {chips.map(c=>{
            const active=filter===c,label=c==="All"?"All":c===NONE?"No project":c;
            return(
              <button key={c} onClick={()=>setFilter(c)} style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:600,padding:"8px 14px",borderRadius:999,cursor:"pointer",whiteSpace:"nowrap",border:active?`1px solid ${C.accentBorder}`:`1px solid ${C.lineS}`,background:active?C.accentAlpha:"transparent",color:active?C.indigo:C.muted}}>
                {label}<span style={{opacity:.55,fontWeight:500}}>{countFor(c)}</span>
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {filtered.length===0
            ?<div style={{fontSize:13.5,color:C.dim,textAlign:"center",padding:"28px 0"}}>No sessions.</div>
            :filtered.map(s=>{
              const proj=s.project?projectMap[s.project]:null;
              const tagCol=s.tag?TAG_COLOR[s.tag]:null;
              const todSlot=s.hour!=null?TOD.find(t=>t.test(s.hour)):null;
              const smBtn={...iconBtn,width:28,height:28,borderRadius:8};
              return(
                <div key={s.id} style={{background:C.surf2,border:`1px solid ${C.line}`,borderRadius:14,padding:"11px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                    <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:5,minWidth:0}}>
                      {s.project&&<span style={{fontSize:13,fontWeight:600,color:C.indigo,background:C.accentAlpha2,borderRadius:8,padding:"3px 10px"}}>{s.project}{proj?.notes?" 📝":""}</span>}
                      {s.tag&&<span style={{fontSize:12,fontWeight:600,color:tagCol,background:`${tagCol}1e`,borderRadius:6,padding:"3px 9px"}}>{s.tag}</span>}
                      {!s.project&&!s.tag&&<span style={{fontSize:12.5,color:C.dim}}>session</span>}
                    </div>
                    <span style={{fontSize:17,flexShrink:0}}>{MOOD_EMOJI[s.mood]}</span>
                    <span style={{fontSize:14,fontWeight:700,color:C.indigo,flexShrink:0}}>{fmtDur(s.duration)}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:4,flexWrap:"nowrap",overflow:"hidden"}}>
                      <span className="mono" style={{fontSize:10.5,color:C.dim,flexShrink:0}}>{s.date}</span>
                      {todSlot&&<span style={{fontSize:11,flexShrink:0}}>{todSlot.emoji}</span>}
                      {s.note&&<span style={{fontSize:12,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {s.note}</span>}
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>onEdit(s)} style={smBtn}>{Icon.pencil()}</button>
                      <button onClick={()=>onDelete(s.id)} style={smBtn}>{Icon.trash()}</button>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}

/* ─── settings sheet ─── */
function SettingsSheet({themeDark,themeLight,onThemeDarkChange,onThemeLightChange,goalHours,onGoalChange,onDownloadBackup,onClose,globalAudioFolder,onGlobalFolderChange,archivedProjects,onRestoreArchived,onDeleteArchived}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [editingGoal,setEditingGoal]=useState(false);
  const [goalInput,setGoalInput]=useState(String(goalHours));
  const [editingFolder,setEditingFolder]=useState(false);
  const [folderInput,setFolderInput]=useState(globalAudioFolder||"");
  const saveGoal=()=>{const v=Number(goalInput);if(v>0&&v<=168){onGoalChange(v);setEditingGoal(false);}};
  const saveFolder=()=>{onGlobalFolderChange(folderInput.trim());setEditingFolder(false);};
  const clearFolder=()=>{setFolderInput("");onGlobalFolderChange("");setEditingFolder(false);};
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div style={{fontSize:19,fontWeight:700,letterSpacing:"-0.01em",color:C.text}}>Settings</div>
          <button onClick={onClose} style={iconBtn}>{Icon.close()}</button>
        </div>

        {/* Goal */}
        <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:12}}>Weekly goal</div>
        <div style={{background:C.surf2,borderRadius:14,padding:"14px 16px",marginBottom:22}}>
          {editingGoal?(
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <input type="number" min="1" max="168" value={goalInput} onChange={e=>setGoalInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&saveGoal()}
                className="mt-text" style={{flex:1,padding:"10px 12px"}} autoFocus/>
              <span style={{fontSize:13,color:C.faint}}>h/week</span>
              <button onClick={saveGoal} style={{background:C.accentGrad,border:"none",borderRadius:10,color:"#fff",padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save</button>
              <button onClick={()=>setEditingGoal(false)} style={{...iconBtn}}>{Icon.close()}</button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:22,fontWeight:700,color:C.text}}>{goalHours}h<span style={{fontSize:13,fontWeight:400,color:C.faint}}> per week</span></div>
                <div style={{fontSize:12,color:C.faint,marginTop:2}}>Target for your weekly progress ring</div>
              </div>
              <button onClick={()=>{setGoalInput(String(goalHours));setEditingGoal(true);}} style={{...iconBtn}}>{Icon.pencil()}</button>
            </div>
          )}
        </div>

        {/* Backup */}
        <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:12}}>Data</div>
        <button onClick={onDownloadBackup} style={{
          width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,
          border:`1px solid ${C.line}`,background:C.surf2,cursor:"pointer",textAlign:"left",marginBottom:22,
        }}>
          {Icon.download(C.indigo)}
          <div>
            <div style={{fontSize:14,fontWeight:600,color:C.text}}>Download backup</div>
            <div style={{fontSize:12,color:C.faint,marginTop:2}}>Export all sessions &amp; projects as JSON</div>
          </div>
        </button>

        {/* Global audio folder */}
        <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:12}}>Global audio folder</div>
        <div style={{background:C.surf2,borderRadius:14,padding:"14px 16px",marginBottom:6}}>
          {editingFolder?(
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input value={folderInput} onChange={e=>setFolderInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&saveFolder()}
                placeholder="/mnt/user/Music/Vault"
                className="mt-text" style={{flex:1,minWidth:0,padding:"9px 12px",fontSize:12.5}} autoFocus/>
              <button onClick={saveFolder} style={{background:C.accentGrad,border:"none",borderRadius:10,color:"#fff",padding:"10px 14px",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Save</button>
              <button onClick={()=>setEditingFolder(false)} style={iconBtn}>{Icon.close()}</button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                {globalAudioFolder
                  ?<div className="mono" style={{fontSize:12,color:C.text,wordBreak:"break-all",lineHeight:1.5}}>{globalAudioFolder}</div>
                  :<div style={{fontSize:13,color:C.dim}}>Not set</div>
                }
                <div style={{fontSize:11.5,color:C.faint,marginTop:4}}>Files are matched to projects by name. Per-project folders override this.</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>{setFolderInput(globalAudioFolder||"");setEditingFolder(true);}} style={iconBtn}>{Icon.pencil()}</button>
                {globalAudioFolder&&<button onClick={clearFolder} style={iconBtn}>{Icon.close()}</button>}
              </div>
            </div>
          )}
        </div>
        <div style={{fontSize:11,color:C.dim,marginBottom:22,padding:"0 2px"}}>
          On each launch, files matching a project name are auto-registered. Filenames must <em>contain</em> the project name.
        </div>

        {/* Theme — dark / light pair */}
        <div style={{fontSize:11,color:C.dim,marginBottom:16,padding:"0 2px"}}>Follows your system appearance and switches automatically.</div>
        {[{label:"Dark theme",current:themeDark,onChange:onThemeDarkChange,filter:T=>T.dark},{label:"Light theme",current:themeLight,onChange:onThemeLightChange,filter:T=>!T.dark}].map(({label,current,onChange,filter})=>(
          <div key={label} style={{marginBottom:18}}>
            <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>{label}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {Object.entries(THEMES).filter(([,T])=>filter(T)).map(([key,T])=>{
                const active=current===key;
                return(
                  <button key={key} onClick={()=>onChange(key)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,cursor:"pointer",textAlign:"left",border:active?`1px solid ${C.accentBorder}`:`1px solid ${C.line}`,background:active?C.accentAlpha:C.surf2}}>
                    <span style={{fontSize:24,lineHeight:1}}>{T.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:active?C.indigo:C.text,marginBottom:8}}>{T.name}</div>
                      <div style={{display:"flex",gap:4}}>{T.heat.map((c,i)=><div key={i} style={{flex:1,height:6,borderRadius:3,background:c}}/>)}</div>
                    </div>
                    {active&&<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={C.indigo} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Archived projects */}
        {archivedProjects?.length>0&&(<>
          <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,margin:"22px 0 12px"}}>Archived projects</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {archivedProjects.map(p=>(
              <div key={p.name} style={{background:C.surf2,borderRadius:14,padding:"12px 15px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  {p.archivedAt&&<div style={{fontSize:11,color:C.dim,marginTop:2}}>Archived {new Date(p.archivedAt).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</div>}
                </div>
                <button onClick={()=>onRestoreArchived(p.name)}
                  style={{fontSize:11.5,fontWeight:600,color:C.indigo,background:C.accentAlpha,border:`1px solid ${C.accentBorder}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"var(--font-sans)"}}>
                  Restore
                </button>
                <button onClick={()=>onDeleteArchived(p.name)} style={iconBtn}>{Icon.trash()}</button>
              </div>
            ))}
          </div>
        </>)}

      </div>
    </div>
  );
}

/* ─── goal edit mini-sheet ─── */
function GoalEditSheet({goalHours,onSave,onClose}) {
  const C=useTheme();
  const [val,setVal]=useState(goalHours);
  const presets=[3,5,7,10,14,20];
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div style={{fontSize:19,fontWeight:700,color:C.text,marginBottom:6}}>Weekly goal</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>How many hours do you want to produce each week?</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
          {presets.map(h=>(
            <button key={h} onClick={()=>setVal(h)} style={{padding:"16px 0",borderRadius:13,border:`1.5px solid ${val===h?C.accentBorder:C.lineS}`,background:val===h?C.accentAlpha:C.surf2,color:val===h?C.indigo:C.text,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-sans)"}}>
              {h}<span style={{fontSize:12,fontWeight:400,color:val===h?C.indigo:C.faint}}>h</span>
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center"}}>
          <input type="number" min="1" max="168" value={val} onChange={e=>setVal(Number(e.target.value))}
            className="mt-text" style={{flex:1}} placeholder="Custom hours…"/>
          <span style={{fontSize:13,color:C.faint,whiteSpace:"nowrap"}}>h / week</span>
        </div>
        <button onClick={()=>{if(val>0)onSave(val);}} style={{width:"100%",padding:16,borderRadius:14,border:"none",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:16,fontWeight:700,color:"#fff",background:C.accentGrad}}>
          Set goal
        </button>
      </div>
    </div>
  );
}

/* ─── persistent mini player ─── */
function MiniPlayer({nowPlaying,onEnd,onClear,onOpenProject}) {
  const C=useTheme();
  const audioRef=useRef(null);
  const nowPlayingRef=useRef(nowPlaying);
  const [playing,setPlaying]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const [duration,setDuration]=useState(0);
  useEffect(()=>{nowPlayingRef.current=nowPlaying;},[nowPlaying]);

  // Attach all audio listeners once — audioRef is always in the DOM
  useEffect(()=>{
    const a=audioRef.current;
    const onTime=()=>setCurrentTime(a.currentTime);
    const onDur=()=>setDuration(isFinite(a.duration)?a.duration:0);
    const onPlay=()=>setPlaying(true);
    const onPause=()=>setPlaying(false);
    const onEnded=()=>{setPlaying(false);setCurrentTime(0);setDuration(0);onEnd();};
    a.addEventListener("timeupdate",onTime);
    a.addEventListener("durationchange",onDur);
    a.addEventListener("play",onPlay);
    a.addEventListener("pause",onPause);
    a.addEventListener("ended",onEnded);
    return()=>{a.removeEventListener("timeupdate",onTime);a.removeEventListener("durationchange",onDur);a.removeEventListener("play",onPlay);a.removeEventListener("pause",onPause);a.removeEventListener("ended",onEnded);};
  },[]);// eslint-disable-line

  // Load + seek + play when nowPlaying changes
  useEffect(()=>{
    const a=audioRef.current;
    if(!nowPlaying){a.pause();a.src="";return;}
    a.src=nowPlaying.src;
    setCurrentTime(nowPlaying.position||0);
    setDuration(nowPlaying.file?.duration||0);
    const onMeta=()=>{a.currentTime=nowPlaying.position||0;a.play().catch(()=>{});};
    a.addEventListener("loadedmetadata",onMeta,{once:true});
    a.load();
    return()=>a.removeEventListener("loadedmetadata",onMeta);
  },[nowPlaying?.src]);// eslint-disable-line

  // When the matching AudioFileCard mounts (Versions tab opened), auto hand back if playing
  const playingRef=useRef(false);
  useEffect(()=>{playingRef.current=playing;},[playing]);
  useEffect(()=>{
    const h=e=>{
      const np=nowPlayingRef.current;
      if(!np||e.detail.id!==np.file.id)return;
      const a=audioRef.current;
      const pos=a?.currentTime||0;
      audioEventBus.dispatchEvent(new CustomEvent("audiohandback",{detail:{id:np.file.id,position:pos,autoplay:playingRef.current}}));
      a.pause();a.src="";
      onClear();
    };
    audioEventBus.addEventListener("audiomounted",h);
    return()=>audioEventBus.removeEventListener("audiomounted",h);
  },[]);// eslint-disable-line

  // When any card starts playing manually, just hide the mini player
  useEffect(()=>{
    const h=()=>{const a=audioRef.current;a.pause();a.src="";onClear();};
    audioEventBus.addEventListener("audioplay",h);
    return()=>audioEventBus.removeEventListener("audioplay",h);
  },[]);// eslint-disable-line

  const dur=duration||nowPlaying?.file?.duration||0;
  const pct=dur>0?Math.min(1,currentTime/dur):0;
  const seekTo=e=>{const r=e.currentTarget.getBoundingClientRect();const a=audioRef.current;if(a&&a.duration)a.currentTime=(e.clientX-r.left)/r.width*a.duration;};

  return(
    <>
      <audio ref={audioRef}/>
      {nowPlaying&&(
        <div style={{position:"fixed",bottom:"calc(16px + env(safe-area-inset-bottom,0px))",
          left:"50%",transform:"translateX(-50%)",
          width:"calc(100% - 32px)",maxWidth:420,zIndex:60,
          background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:20,
          boxShadow:"0 8px 32px -8px rgba(0,0,0,0.35), 0 2px 8px -2px rgba(0,0,0,0.18)",
          overflow:"hidden"}}>
          {/* Seekable bar */}
          <div onClick={seekTo} style={{height:3,background:C.surf2,cursor:"pointer",position:"relative",userSelect:"none"}}>
            <div style={{position:"absolute",top:0,left:0,bottom:0,width:`${pct*100}%`,background:C.accentGrad,transition:"width .25s linear"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px 12px"}}>
            <button onClick={()=>playing?audioRef.current.pause():audioRef.current.play().catch(()=>{})}
              style={{width:32,height:32,borderRadius:9,border:`1.5px solid ${C.accentBorder}`,background:C.accentAlpha,
                cursor:"pointer",display:"grid",placeItems:"center",flexShrink:0,padding:0}}>
              {playing
                ?<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" rx="1.5" fill={C.indigo}/><rect x="14" y="5" width="4" height="14" rx="1.5" fill={C.indigo}/></svg>
                :<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill={C.indigo}/></svg>
              }
            </button>
            <div onClick={()=>onOpenProject?.(nowPlaying.projectName,"versions")} style={{flex:1,minWidth:0,cursor:onOpenProject?"pointer":"default"}}>
              <div style={{fontSize:12.5,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nowPlaying.file.name}</div>
              <div style={{fontSize:11,color:C.faint,marginTop:1}}>{nowPlaying.projectName}</div>
            </div>
            <span className="mono" style={{fontSize:11,color:C.faint,flexShrink:0}}>{fmtSeconds(currentTime)} / {fmtSeconds(dur)}</span>
            <button onClick={()=>{audioRef.current.pause();audioRef.current.src="";onClear();}}
              style={{width:26,height:26,borderRadius:7,border:"none",background:"transparent",cursor:"pointer",display:"grid",placeItems:"center",padding:0,color:C.faint}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── analytics sheet ─── */
const MOOD_LABEL=["","Rough","Neutral","Good","Great","Flow"];
function AnalyticsSheet({sessions,goalHours,currentStreak,longestStreak,onClose}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [tab,setTab]=useState("overview");

  // ── totals ──────────────────────────────────────────────────
  const totalMins=totalMin(sessions);
  const totalSess=sessions.length;
  const avgMins=totalSess?Math.round(totalMins/totalSess):0;
  const longestSess=totalSess?[...sessions].sort((a,b)=>b.duration-a.duration)[0]:null;

  // this week vs last
  const thisStart=getWeekStart(0),lastStart=getWeekStart(1);
  const thisH=weekHours(sessions,thisStart),lastH=weekHours(sessions,lastStart);
  const weekDiff=thisH-lastH;

  // best day of week (all-time duration)
  const dowMins=Array(7).fill(0),dowCount=Array(7).fill(0);
  sessions.forEach(s=>{const d=(parseDate(s.date).getDay()+6)%7;dowMins[d]+=s.duration;dowCount[d]++;});
  const bestDayIdx=dowMins.indexOf(Math.max(...dowMins));
  const maxDowMins=Math.max(...dowMins,1);

  // best time of day
  const todAcc=TOD.map(t=>({...t,count:0,mins:0}));
  let todTotal=0;
  sessions.forEach(s=>{if(s.hour==null)return;const i=todAcc.findIndex(t=>t.test(s.hour));if(i>=0){todAcc[i].count++;todAcc[i].mins+=s.duration;todTotal++;}});
  const bestTOD=todAcc.reduce((a,b)=>b.mins>a.mins?b:a,todAcc[0]);

  // consistency — % of last 12 weeks with ≥1 session
  const weeks12starts=Array.from({length:12},(_,i)=>getWeekStart(11-i));
  const activeWeeks=weeks12starts.filter(ws=>{
    const we=new Date(parseDate(ws));we.setDate(parseDate(ws).getDate()+6);
    return sessions.some(s=>s.date>=ws&&s.date<=toDateStr(we));
  }).length;
  const consistency=Math.round(activeWeeks/12*100);

  // by session type
  const tagMap={};
  sessions.forEach(s=>{const t=s.tag||"Untagged";if(!tagMap[t])tagMap[t]={mins:0,count:0};tagMap[t].mins+=s.duration;tagMap[t].count++;});
  const tagTotal=Object.values(tagMap).reduce((a,b)=>a+b.mins,0)||1;
  const tagRows=Object.entries(tagMap).sort((a,b)=>b[1].mins-a[1].mins);

  // trends — 12 weeks
  const weeks12=weeks12starts.map(start=>({start,h:weekHours(sessions,start)}));
  const maxWeekH=Math.max(...weeks12.map(w=>w.h),goalHours||1);
  const goalWeeksHit=weeks12.filter(w=>goalHours>0&&w.h>=goalHours).length;
  // goal streak — scan from most recent week backwards
  let currentGoalStreak=0;
  for(let i=weeks12.length-1;i>=0;i--){if(goalHours>0&&weeks12[i].h>=goalHours)currentGoalStreak++;else break;}
  let bestGoalStreak=0,gStreak=0;
  for(const w of weeks12){if(goalHours>0&&w.h>=goalHours){gStreak++;bestGoalStreak=Math.max(bestGoalStreak,gStreak);}else gStreak=0;}

  // monthly totals
  const monthMap={};
  sessions.forEach(s=>{const k=s.date.slice(0,7);monthMap[k]=(monthMap[k]||0)+s.duration;});
  const monthRows=Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);
  const maxMonthMins=Math.max(...monthRows.map(r=>r[1]),1);

  // projects all-time
  const projMap={};
  sessions.forEach(s=>{if(!s.project)return;if(!projMap[s.project])projMap[s.project]={mins:0,count:0};projMap[s.project].mins+=s.duration;projMap[s.project].count++;});
  const projRows=Object.entries(projMap).sort((a,b)=>b[1].mins-a[1].mins);
  const maxProjMins=projRows.length?projRows[0][1].mins:1;

  // mood
  const moodDist=[0,0,0,0,0,0];
  const moodProjMap={};
  let moodTotal=0;
  sessions.forEach(s=>{
    if(!s.mood)return;
    moodDist[s.mood]++;moodTotal++;
    if(s.project){if(!moodProjMap[s.project])moodProjMap[s.project]={sum:0,count:0};moodProjMap[s.project].sum+=s.mood;moodProjMap[s.project].count++;}
  });
  const moodSessions=sessions.filter(s=>s.mood);
  const avgMood=moodTotal?moodSessions.reduce((a,s)=>a+s.mood,0)/moodTotal:null;
  const moodByProj=Object.entries(moodProjMap).map(([name,{sum,count}])=>({name,avg:sum/count,count})).filter(p=>p.count>=2).sort((a,b)=>b.avg-a.avg).slice(0,5);

  const TABS=[["overview","Overview"],["sessions","Sessions"],["time","Time"],["trends","Trends"],["projects","Projects"],["mood","Mood"]];

  const SectionLabel=({children})=>(
    <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:10,marginTop:4}}>{children}</div>
  );
  const StatTile=({val,label,sub})=>(
    <div style={{flex:1,background:C.surf2,borderRadius:14,padding:"12px 14px",minWidth:0}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:C.faint,marginBottom:5}}>{label}</div>
      <div style={{fontSize:19,fontWeight:700,color:C.text,letterSpacing:"-0.01em"}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:C.faint,marginTop:2}}>{sub}</div>}
    </div>
  );

  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:19,fontWeight:700,letterSpacing:"-0.01em",color:C.text}}>Analytics</div>
          <button onClick={onClose} style={iconBtn}>{Icon.close()}</button>
        </div>

        {/* Tab bar */}
        <div style={{display:"flex",gap:2,background:C.surf2,borderRadius:10,padding:2,marginBottom:18,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:"0 0 auto",fontSize:11,fontWeight:600,padding:"5px 11px",borderRadius:8,border:"none",cursor:"pointer",
              background:tab===t?C.surf:"transparent",color:tab===t?C.text:C.faint,whiteSpace:"nowrap"}}>{l}</button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────── */}
        {tab==="overview"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <StatTile val={fmtDur(totalMins)} label="Total time"/>
              <StatTile val={totalSess} label="Sessions"/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <StatTile val={fmtDur(avgMins)} label="Avg session"/>
              <StatTile val={longestSess?fmtDur(longestSess.duration):"—"} label="Longest" sub={longestSess?fmtDate(longestSess.date):null}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <StatTile val={`🔥 ${currentStreak}`} label="Streak" sub={`${longestStreak} best`}/>
              <StatTile val={`${consistency}%`} label="Consistency" sub="last 12 wks"/>
            </div>
            <SectionLabel>This week vs last</SectionLabel>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <div style={{flex:1,background:C.surf2,borderRadius:14,padding:"12px 14px"}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:C.faint,marginBottom:5}}>This week</div>
                <div style={{fontSize:19,fontWeight:700,color:C.text}}>{fmtDur(Math.round(thisH*60))}</div>
                {lastH>0&&<div style={{fontSize:11,color:weekDiff>=0?C.green:C.flame,marginTop:2,fontWeight:600}}>{weekDiff>=0?"↑":"↓"} {fmtDur(Math.round(Math.abs(weekDiff)*60))} vs last</div>}
              </div>
              <div style={{flex:1,background:C.surf2,borderRadius:14,padding:"12px 14px"}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:C.faint,marginBottom:5}}>Best day</div>
                <div style={{fontSize:19,fontWeight:700,color:C.text}}>{DAYS_FULL[bestDayIdx]}</div>
                <div style={{fontSize:11,color:C.faint,marginTop:2}}>{fmtDur(dowMins[bestDayIdx])} all time</div>
              </div>
            </div>
            <SectionLabel>Most active time</SectionLabel>
            <div style={{background:C.surf2,borderRadius:14,padding:"13px 16px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:26}}>{bestTOD.emoji}</span>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>{bestTOD.label}</div>
                <div style={{fontSize:11,color:C.faint,marginTop:1}}>{fmtDur(bestTOD.mins)} total · {bestTOD.count} sessions</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Sessions by type ────────────────────────── */}
        {tab==="sessions"&&(
          <div>
            <SectionLabel>By session type</SectionLabel>
            {tagRows.length===0
              ?<div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"12px 0"}}>No sessions yet.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {tagRows.map(([tag,{mins,count}])=>{
                  const pct=mins/tagTotal;const col=TAG_COLOR[tag]||C.muted;
                  return(
                    <div key={tag}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12.5,fontWeight:600,color:C.text}}>{tag}</span>
                        <span style={{fontSize:12,color:C.faint}}>{fmtDur(mins)} · {count} sess · {Math.round(pct*100)}%</span>
                      </div>
                      <div style={{height:6,borderRadius:4,background:C.surf2}}>
                        <div style={{height:"100%",width:`${pct*100}%`,borderRadius:4,background:col,transition:"width .4s ease"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        )}

        {/* ── Time patterns ────────────────────────────── */}
        {tab==="time"&&(
          <div>
            <SectionLabel>Time of day</SectionLabel>
            {todTotal===0
              ?<div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"12px 0"}}>Log sessions to see patterns.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {todAcc.map(slot=>{
                  const pct=todTotal>0?slot.count/todTotal:0;
                  return(
                    <div key={slot.label} style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16,width:22}}>{slot.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:12.5,fontWeight:600,color:C.text}}>{slot.label}</span>
                          <span style={{fontSize:12,color:C.faint}}>{slot.count} sess · {fmtDur(slot.mins)}</span>
                        </div>
                        <div style={{height:6,borderRadius:4,background:C.surf2}}>
                          <div style={{height:"100%",width:`${pct*100}%`,borderRadius:4,background:C.indigo,transition:"width .4s ease"}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
            <SectionLabel>Day of week</SectionLabel>
            <div style={{display:"flex",gap:5,alignItems:"flex-end",height:80}}>
              {DAYS_MON.map((d,i)=>{
                const barH=Math.max(0,dowMins[i]/maxDowMins)*68;
                return(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5,justifyContent:"flex-end",height:80}}>
                    <div title={`${DAYS_FULL[i]}: ${fmtDur(dowMins[i])} · ${dowCount[i]} sess`}
                      style={{width:"100%",height:barH,borderRadius:4,background:i===bestDayIdx?C.green:C.indigo,opacity:0.75,minHeight:dowMins[i]>0?3:0,transition:"height .3s ease"}}/>
                    <div style={{fontSize:10,color:i===bestDayIdx?C.green:C.dim,fontWeight:i===bestDayIdx?700:400}}>{d}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Trends ──────────────────────────────────── */}
        {tab==="trends"&&(
          <div>
            {/* Goal streak stats */}
            {goalHours>0&&(
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                {[[currentGoalStreak,"week streak","🔥"],[bestGoalStreak,"best streak","🏆"],[goalWeeksHit,"/ 12 hit","✓"]].map(([val,label,icon])=>(
                  <div key={label} style={{flex:1,background:C.surf2,borderRadius:14,padding:"12px 10px",textAlign:"center"}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:C.faint,marginBottom:4}}>{icon}</div>
                    <div style={{fontSize:22,fontWeight:700,color:val>0?C.green:C.text}}>{val}</div>
                    <div style={{fontSize:10,color:C.faint,marginTop:2}}>{label}</div>
                  </div>
                ))}
              </div>
            )}
            <SectionLabel>{`Last 12 weeks${goalHours>0?` · goal hit ${goalWeeksHit}/12`:""}`}</SectionLabel>
            <div style={{display:"flex",gap:3,alignItems:"flex-end",height:100,marginBottom:8}}>
              {weeks12.map((w,i)=>{
                const barH=Math.max(0,w.h/maxWeekH)*90;
                const hit=goalHours>0&&w.h>=goalHours;
                return(
                  <div key={i} title={`${w.start}: ${w.h.toFixed(1)}h`}
                    style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:100}}>
                    <div style={{width:"100%",height:barH,borderRadius:3,background:hit?C.green:C.indigo,opacity:hit?0.85:i===11?0.9:0.5,minHeight:w.h>0?3:0,transition:"height .3s ease"}}/>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:goalHours>0?8:20}}>
              <span style={{fontSize:11,color:C.dim}}>12 weeks ago</span>
              <span style={{fontSize:11,color:C.indigo,fontWeight:600}}>Now</span>
            </div>
            {goalHours>0&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:20}}>
              <div style={{width:12,height:3,borderRadius:2,background:C.green,opacity:0.85}}/>
              <span style={{fontSize:11,color:C.faint}}>Green = goal reached ({goalHours}h)</span>
            </div>}
            {/* Week-by-week breakdown */}
            {goalHours>0&&(()=>{
              const weeksWithData=[...weeks12].reverse().filter(w=>w.h>0);
              if(weeksWithData.length===0)return null;
              return(
                <>
                  <SectionLabel>Week by week</SectionLabel>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                    {weeksWithData.map((w,i)=>{
                      const hit=w.h>=goalHours;
                      const pct=Math.min(1,w.h/goalHours);
                      const d=new Date(w.start+"T00:00:00");
                      const dEnd=new Date(d);dEnd.setDate(d.getDate()+6);
                      const fmt=dt=>`${monthNames[dt.getMonth()].slice(0,3)} ${dt.getDate()}`;
                      const label=`${fmt(d)} – ${fmt(dEnd)}`;
                      return(
                        <div key={i}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                            <span style={{fontSize:12,color:C.muted}}>{label}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:12,fontWeight:600,color:hit?C.green:C.text}}>{fmtDur(Math.round(w.h*60))}</span>
                              {hit&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓</span>}
                            </div>
                          </div>
                          <div style={{height:5,borderRadius:3,background:C.surf2}}>
                            <div style={{height:"100%",width:`${pct*100}%`,borderRadius:3,background:hit?C.green:C.indigo,opacity:hit?0.8:0.5,transition:"width .3s ease"}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            <SectionLabel>Monthly totals</SectionLabel>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {monthRows.map(([key,mins])=>{
                const[y,m]=key.split("-");
                return(
                  <div key={key}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12.5,color:C.text}}>{monthNames[parseInt(m)-1]} {y}</span>
                      <span style={{fontSize:12,color:C.faint}}>{fmtDur(mins)}</span>
                    </div>
                    <div style={{height:5,borderRadius:3,background:C.surf2}}>
                      <div style={{height:"100%",width:`${mins/maxMonthMins*100}%`,borderRadius:3,background:C.indigo,opacity:0.7}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Projects ────────────────────────────────── */}
        {tab==="projects"&&(
          <div>
            <SectionLabel>All-time by project</SectionLabel>
            {projRows.length===0
              ?<div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"12px 0"}}>No project sessions yet.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {projRows.map(([name,{mins,count}])=>(
                  <div key={name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12.5,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%"}}>{name}</span>
                      <span style={{fontSize:12,color:C.faint}}>{fmtDur(mins)} · {count} sess</span>
                    </div>
                    <div style={{height:6,borderRadius:4,background:C.surf2}}>
                      <div style={{height:"100%",width:`${mins/maxProjMins*100}%`,borderRadius:4,background:C.indigo,opacity:0.75,transition:"width .4s ease"}}/>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── Mood ────────────────────────────────────── */}
        {tab==="mood"&&(
          <div>
            {moodTotal===0
              ?<div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"24px 0"}}>Log mood with sessions to see patterns.</div>
              :<>
                <div style={{display:"flex",gap:8,marginBottom:20}}>
                  <div style={{flex:1,background:C.surf2,borderRadius:14,padding:"12px 14px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:C.faint,marginBottom:5}}>Avg mood</div>
                    <div style={{fontSize:24}}>{MOOD_EMOJI[Math.round(avgMood)]}</div>
                    <div style={{fontSize:12,color:C.faint,marginTop:2}}>{MOOD_LABEL[Math.round(avgMood)]}</div>
                  </div>
                  <div style={{flex:1,background:C.surf2,borderRadius:14,padding:"12px 14px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:C.faint,marginBottom:5}}>Sessions rated</div>
                    <div style={{fontSize:19,fontWeight:700,color:C.text}}>{moodTotal}</div>
                    <div style={{fontSize:11,color:C.faint,marginTop:2}}>of {totalSess} total</div>
                  </div>
                </div>
                <SectionLabel>Distribution</SectionLabel>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                  {[5,4,3,2,1].map(m=>{
                    const count=moodDist[m];const pct=moodTotal>0?count/moodTotal:0;
                    return(
                      <div key={m} style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:16,width:22}}>{MOOD_EMOJI[m]}</span>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontSize:12,color:C.text}}>{MOOD_LABEL[m]}</span>
                            <span style={{fontSize:12,color:C.faint}}>{count} · {Math.round(pct*100)}%</span>
                          </div>
                          <div style={{height:5,borderRadius:3,background:C.surf2}}>
                            <div style={{height:"100%",width:`${pct*100}%`,borderRadius:3,background:C.indigo,opacity:0.75}}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {moodByProj.length>0&&<>
                  <SectionLabel>Avg mood by project</SectionLabel>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {moodByProj.map(({name,avg,count})=>(
                      <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:12.5,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{name}</span>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>{MOOD_EMOJI[Math.round(avg)]}</span>
                          <span style={{fontSize:12,color:C.faint}}>{avg.toFixed(1)} · {count} sess</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>}
              </>
            }
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── A/B comparison ─── */
// Defined outside ABCompare so React sees a stable component reference across renders.
// If defined inside, every render creates a new component type → select unmounts/remounts
// on each currentTime tick, dropping onChange events on iOS.
function ABSlotSelect({side,value,onChange,files,C}){
  return(
    <div style={{flex:1}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",color:side==="A"?C.indigo:C.green,marginBottom:6,textTransform:"uppercase"}}>{side}</div>
      <select value={value||""} onChange={e=>onChange(e.target.value)}
        style={{width:"100%",background:C.surf2,border:`1px solid ${side==="A"?C.accentBorder:"rgba(52,211,153,0.4)"}`,borderRadius:9,padding:"8px 10px",color:C.text,fontSize:12,fontFamily:"var(--font-sans)",cursor:"pointer"}}>
        <option value="">— pick a file —</option>
        {files.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  );
}

function ABCompare({files,projectName,onClose}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [slotA,setSlotA]=useState(files[0]?.id||null);
  const [slotB,setSlotB]=useState(files[1]?.id||null);
  const [active,setActive]=useState("A");
  const [playing,setPlaying]=useState(false);
  const waveRefA=useRef(null),waveRefB=useRef(null);
  const wsA=useRef(null),wsB=useRef(null);
  const [readyA,setReadyA]=useState(false);
  const [readyB,setReadyB]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const activeRef=useRef("A");
  const fileMap=Object.fromEntries(files.map(f=>[f.id,f]));
  const audioUrl=f=>f.linkedPath?`/api/audio/${encodeURIComponent(projectName)}/stream/${f.id}`:`/api/audio/files/${encodeURIComponent(f.filename)}`;

  const playingRef=useRef(false);
  // One Audio ref per slot — replaced with a fresh element on each file change
  // to avoid WaveSurfer receiving competing loadstart events on a reused element.
  const audioA=useRef(null);
  const audioB=useRef(null);
  // Track whether iOS audio session has been unlocked by a user gesture
  const unlockedRef=useRef(false);

  const initWS=(ref,wsRef,audioRef,side,fileId,setReady)=>{
    if(wsRef.current){wsRef.current.destroy();wsRef.current=null;}
    if(audioRef.current){audioRef.current.pause();audioRef.current.src="";}
    setReady(false);
    const f=fileMap[fileId];if(!f||!ref.current)return;
    // Fresh Audio element — clean state, no leftover src/event listeners
    const audio=new Audio();
    audioRef.current=audio;
    const url=audioUrl(f);
    const ws=WaveSurfer.create({
      container:ref.current,media:audio,
      waveColor:C.dim,progressColor:side==="A"?C.indigo:C.green,
      height:40,barWidth:2,barGap:1,barRadius:2,cursorWidth:1,cursorColor:C.muted,
    });
    wsRef.current=ws;
    ws.load(url);
    ws.on("ready",()=>setReady(true));
    ws.on("timeupdate",t=>{if(side===activeRef.current)setCurrentTime(t);});
    ws.on("finish",()=>{playingRef.current=false;setPlaying(false);setCurrentTime(0);});
  };

  useEffect(()=>{initWS(waveRefA,wsA,audioA,"A",slotA,setReadyA);},[slotA]);// eslint-disable-line
  useEffect(()=>{initWS(waveRefB,wsB,audioB,"B",slotB,setReadyB);},[slotB]);// eslint-disable-line
  useEffect(()=>()=>{
    wsA.current?.destroy();wsB.current?.destroy();
    audioA.current?.pause();audioB.current?.pause();
  },[]);

  // iOS requires audio.play() to be called from a synchronous user gesture.
  // On first play we play+immediately pause both elements to unlock them,
  // then resume the active one. Subsequent toggles can call play() freely.
  const unlockAndPlay=(targetAudio)=>{
    if(unlockedRef.current){targetAudio.play().catch(()=>{});return;}
    const other=targetAudio===audioA.current?audioB.current:audioA.current;
    // Unlock both in the same gesture
    const pa=targetAudio.play().catch(()=>{});
    const pb=other.play().then(()=>other.pause()).catch(()=>{});
    Promise.all([pa,pb]).then(()=>{unlockedRef.current=true;}).catch(()=>{});
  };

  const toggle=()=>{
    if(!readyA||!readyB)return;
    const next=active==="A"?"B":"A";
    const fromAudio=active==="A"?audioA.current:audioB.current;
    const toAudio=active==="A"?audioB.current:audioA.current;
    const t=fromAudio.currentTime??0;
    fromAudio.pause();
    // Seek before play — safe because readyA/B guarantees duration is known
    toAudio.currentTime=Math.min(t,isNaN(toAudio.duration)?t:toAudio.duration);
    activeRef.current=next;
    setActive(next);
    if(playingRef.current)unlockAndPlay(toAudio);
  };

  const handleSlotChange=(side,id)=>{
    if(playing){audioA.current.pause();audioB.current.pause();playingRef.current=false;setPlaying(false);}
    if(side==="A")setSlotA(id); else setSlotB(id);
  };

  const handlePlay=()=>{
    const audio=active==="A"?audioA.current:audioB.current;
    const ready=active==="A"?readyA:readyB;
    if(!audio||!ready)return;
    if(playing){
      audioA.current.pause();audioB.current.pause();
      playingRef.current=false;setPlaying(false);
    }else{
      unlockAndPlay(audio);
      playingRef.current=true;setPlaying(true);
    }
  };

  const fActive=fileMap[active==="A"?slotA:slotB];

  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:17,fontWeight:700,color:C.text}}>A/B Compare</div>
          <button onClick={onClose} style={iconBtn}>{Icon.close()}</button>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <ABSlotSelect side="A" value={slotA} onChange={id=>handleSlotChange("A",id)} files={files} C={C}/>
          <ABSlotSelect side="B" value={slotB} onChange={id=>handleSlotChange("B",id)} files={files} C={C}/>
        </div>
        {/* Waveforms */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",color:C.indigo,marginBottom:4,textTransform:"uppercase",opacity:active==="A"?1:0.35}}>A — {fileMap[slotA]?.name||"—"}</div>
          <div ref={waveRefA} style={{opacity:readyA?(active==="A"?1:0.3):0.12,transition:"opacity .2s"}}/>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",color:C.green,margin:"10px 0 4px",textTransform:"uppercase",opacity:active==="B"?1:0.35}}>B — {fileMap[slotB]?.name||"—"}</div>
          <div ref={waveRefB} style={{opacity:readyB?(active==="B"?1:0.3):0.12,transition:"opacity .2s"}}/>
        </div>
        {/* Controls */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={handlePlay} disabled={!(active==="A"?readyA:readyB)}
            style={{width:36,height:36,borderRadius:10,border:`1px solid ${C.accentBorder}`,background:C.accentAlpha,cursor:"pointer",display:"grid",placeItems:"center",flexShrink:0,padding:0,opacity:(active==="A"?readyA:readyB)?1:0.4}}>
            {playing
              ?<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" rx="1.5" fill={C.indigo}/><rect x="14" y="5" width="4" height="14" rx="1.5" fill={C.indigo}/></svg>
              :<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill={C.indigo}/></svg>
            }
          </button>
          <button onClick={toggle} disabled={!readyA||!readyB}
            style={{padding:"0 16px",height:36,borderRadius:10,border:`1.5px solid ${active==="A"?C.accentBorder:"rgba(52,211,153,0.4)"}`,
              background:active==="A"?C.accentAlpha:"rgba(52,211,153,0.12)",cursor:"pointer",
              fontSize:13,fontWeight:700,color:active==="A"?C.indigo:C.green,fontFamily:"var(--font-sans)",
              opacity:readyA&&readyB?1:0.4,transition:"all .1s"}}>
            {active}
          </button>
          <span className="mono" style={{fontSize:11,color:C.faint}}>{fmtSeconds(currentTime)} / {fmtSeconds(fActive?.duration)}</span>
        </div>
        {(!readyA||!readyB)&&<div style={{fontSize:11.5,color:C.dim,marginTop:10}}>Loading waveforms…</div>}
      </div>
    </div>
  );
}

/* ─── main app ─── */
const PROMPTS=["Make something beautiful today.","Chase the sound in your head.","Press record, see what happens.","One loop can become a song.","Start before you feel ready.","Trust your ears today.","Finish something today.","Show up for the music.","Turn an idea into a take."];

export default function App() {
  const [themeDark,setThemeDark]=useState(()=>localStorage.getItem("music_theme_dark")||"calm");
  const [themeLight,setThemeLight]=useState(()=>localStorage.getItem("music_theme_light")||"paper");
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(()=>{
    const mq=window.matchMedia("(prefers-color-scheme: dark)");
    const handler=e=>setSystemDark(e.matches);
    mq.addEventListener("change",handler);
    return()=>mq.removeEventListener("change",handler);
  },[]);
  const themeKey=systemDark?themeDark:themeLight;
  const C=THEMES[themeKey]||THEMES.calm;

  useEffect(()=>{
    document.body.style.background=C.bg;
    const r=document.documentElement;
    r.style.setProperty("--indigo",C.indigo);
    r.style.setProperty("--indigo-deep",C.deep);
    r.style.setProperty("--surface-2",C.surf2);
    r.style.setProperty("--surface",C.surf);
    r.style.setProperty("--line",C.line);
    r.style.setProperty("--text",C.text);
    r.style.setProperty("--dim",C.dim);
  },[C]);

  const changeThemeDark=key=>{localStorage.setItem("music_theme_dark",key);setThemeDark(key);};
  const changeThemeLight=key=>{localStorage.setItem("music_theme_light",key);setThemeLight(key);};

  const [sessions,setSessions]=useState([]);
  const [projects,setProjects]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [goalHours,setGoalHours]=useState(5);
  const [unlockedMilestones,setUnlockedMilestones]=useState([]);
  const [calMonth,setCalMonth]=useState(()=>{const n=new Date();return{y:n.getFullYear(),m:n.getMonth()};});
  const [newProject,setNewProject]=useState("");
  const [newProjectStart,setNewProjectStart]=useState("");
  const [newProjectEnd,setNewProjectEnd]=useState("");
  const [newProjectDatesOpen,setNewProjectDatesOpen]=useState(false);
  const [newProjectTypeOpen,setNewProjectTypeOpen]=useState(false);
  const addTypeRef=useRef(null);
  const [panelStack,setPanelStack]=useState([]);
  const openProject=(name,tab="open")=>setPanelStack(s=>[...s,{name,tab}]);
  const closeTopPanel=()=>setPanelStack(s=>s.slice(0,-1));
  const currentPanel=panelStack[panelStack.length-1]||null;
  const [sheet,setSheet]=useState(null);
  const [allOpen,setAllOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [reviewOpen,setReviewOpen]=useState(false);
  const [nowPlaying,setNowPlaying]=useState(null);
  const [goalEditOpen,setGoalEditOpen]=useState(false);
  const [showDone,setShowDone]=useState(false);
  const [showReleased,setShowReleased]=useState(false);
  const [showIdea,setShowIdea]=useState(false);
  const [audioFileCounts,setAudioFileCounts]=useState({});
  const [globalAudioFolder,setGlobalAudioFolder]=useState("");
  const [archivedProjects,setArchivedProjects]=useState([]);
  const [toast,setToast]=useState("");
  const toastTimer=useRef(null);
  const toastQueue=useRef([]);

  /* load */
  useEffect(()=>{
    (async()=>{
      try{const r=await storage.get("music_sessions");if(r?.value)setSessions(JSON.parse(r.value));}catch{}
      try{const p=await storage.get("music_projects");if(p?.value){
        const raw=JSON.parse(p.value).map(x=>typeof x==="string"?{name:x,notes:"",status:"active"}:{...x,status:x.status||"active"});
        // Migrate: assign a stored color to any project that doesn't have one
        const usedColors=new Set(raw.filter(x=>x.color).map(x=>x.color));
        let changed=false;
        raw.forEach(x=>{if(!x.color){x.color=pickProjectColor(usedColors);usedColors.add(x.color);changed=true;}});
        setProjects(raw);
        if(changed)await storage.set("music_projects",JSON.stringify(raw));
      }}catch{}
      try{const g=await storage.get("music_goal");if(g?.value)setGoalHours(JSON.parse(g.value));}catch{}
      try{const m=await storage.get("music_milestones");if(m?.value)setUnlockedMilestones(JSON.parse(m.value));}catch{}
      try{const t=await storage.get("music_timer");if(t?.value)setTimer(JSON.parse(t.value));}catch{}
      try{const af=await storage.get("music_audio_files");if(af?.value&&typeof af.value==="object"){setAudioFileCounts(Object.fromEntries(Object.entries(af.value).map(([k,v])=>[k,Array.isArray(v)?v.length:0])));}}catch{}
      try{const gf=await storage.get("music_global_audio_folder");if(gf?.value)setGlobalAudioFolder(gf.value);}catch{}
      try{const ar=await storage.get("music_archived_projects");if(ar?.value)setArchivedProjects(JSON.parse(ar.value));}catch{}
      setLoaded(true);
    })();
  },[]);

  /* background auto-scan all saved project folders + global folder on launch */
  useEffect(()=>{
    if(!loaded)return;
    (async()=>{
      try{
        const[sr,gf]=await Promise.all([
          storage.get("music_scan_folders"),
          storage.get("music_global_audio_folder"),
        ]);
        const folders=sr?.value?JSON.parse(sr.value):{};
        const globalFolder=gf?.value||"";
        // fire per-project scans
        for(const[proj,path]of Object.entries(folders)){
          if(!path)continue;
          fetch(`/api/audio/${encodeURIComponent(proj)}/scan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({folderPath:path})}).catch(()=>{});
        }
        // fire global-folder scans for projects that have no per-project folder
        if(globalFolder){
          for(const p of projects){
            if(folders[p.name])continue; // has its own folder — skip
            fetch(`/api/audio/${encodeURIComponent(p.name)}/scan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({folderPath:globalFolder,nameFilter:p.name})}).catch(()=>{});
          }
        }
      }catch{}
    })();
  },[loaded]);// eslint-disable-line

  /* auto backup — once per day */
  useEffect(()=>{
    if(!loaded)return;
    (async()=>{
      try{
        const r=await storage.get("music_backups");
        const existing=r?.value?JSON.parse(r.value):{backups:[]};
        if(existing.backups[0]?.date===today)return;
        const backups=[{date:today,sessions,projects},...existing.backups.slice(0,6)];
        await storage.set("music_backups",JSON.stringify({backups}));
      }catch{}
    })();
  },[loaded]);

  useEffect(()=>{
    if(!newProjectTypeOpen)return;
    const h=e=>{if(addTypeRef.current&&!addTypeRef.current.contains(e.target))setNewProjectTypeOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[newProjectTypeOpen]);

  /* ── real-time cross-device sync via SSE ── */
  useEffect(()=>{
    if(!loaded)return;
    const es=new EventSource("/api/events");
    es.onmessage=async e=>{
      try{
        const{key}=JSON.parse(e.data);
        if(key==="music_projects"){
          const r=await fetch("/api/data/music_projects").then(x=>x.json());
          if(r?.value!=null)setProjects(JSON.parse(r.value));
        } else if(key==="music_sessions"){
          const r=await fetch("/api/data/music_sessions").then(x=>x.json());
          if(r?.value!=null)setSessions(JSON.parse(r.value));
        } else if(key==="music_goal"){
          const r=await fetch("/api/data/music_goal").then(x=>x.json());
          if(r?.value!=null)setGoalHours(Number(JSON.parse(r.value))||0);
        } else if(key==="music_archived_projects"){
          const r=await fetch("/api/data/music_archived_projects").then(x=>x.json());
          if(r?.value!=null)setArchivedProjects(JSON.parse(r.value));
        }
      }catch{}
    };
    es.onerror=()=>{}; // browser auto-reconnects on error
    return()=>es.close();
  },[loaded]);// eslint-disable-line

  const persistSessions=useCallback(async next=>{try{await storage.set("music_sessions",JSON.stringify(next));}catch{}},[]);

  // Names explicitly deleted this session — excluded from server merge so they don't resurrect
  const deletedNamesRef=useRef(new Set());

  // Merge-before-write: read server state, add any server projects this client doesn't know about
  // (added by another device), except ones we just deleted. Returns the merged array.
  const persistProjects=useCallback(async next=>{
    try{
      const res=await fetch("/api/data/music_projects").then(r=>r.json());
      const serverList=res?.value?JSON.parse(res.value):[];
      const nextNames=new Set(next.map(p=>p.name));
      const merged=[...next];
      for(const sp of serverList){
        if(!nextNames.has(sp.name)&&!deletedNamesRef.current.has(sp.name)){
          merged.push(sp);
        }
      }
      await storage.set("music_projects",JSON.stringify(merged));
      return merged;
    }catch{
      try{await storage.set("music_projects",JSON.stringify(next));}catch{}
      return next;
    }
  },[]);

  const persistGoal=useCallback(async v=>{try{await storage.set("music_goal",JSON.stringify(v));}catch{}},[]);

  const flashNext=()=>{
    if(toastQueue.current.length===0){setToast("");return;}
    const msg=toastQueue.current.shift();
    setToast(msg);
    toastTimer.current=setTimeout(flashNext,2200);
  };
  const flash=msg=>{
    toastQueue.current.push(msg);
    if(!toast)flashNext();
  };

  /* milestones */
  const checkMilestones=useCallback((nextSessions,nextProjects,streak,prevUnlocked)=>{
    const newOnes=[];
    for(const m of MILESTONES){
      if(prevUnlocked.includes(m.id))continue;
      if(m.check(nextSessions,nextProjects,streak)){newOnes.push(m.id);flash(`${m.emoji} ${m.label}`);}
    }
    if(newOnes.length){
      const next=[...prevUnlocked,...newOnes];
      setUnlockedMilestones(next);
      storage.set("music_milestones",JSON.stringify(next)).catch(()=>{});
    }
  },[]);

  /* timer */
  const TIMER_PRESETS=[30,45,60,90];
  const [timer,setTimer]=useState({phase:"idle",target:0,endsAt:0,remaining:0});
  const [customMin,setCustomMin]=useState("");
  const [timerProject,setTimerProject]=useState("");
  const [timerNote,setTimerNote]=useState("");
  const [timerCreatingProj,setTimerCreatingProj]=useState(false);
  const [timerNewProjInput,setTimerNewProjInput]=useState("");
  const [timerProjDropOpen,setTimerProjDropOpen]=useState(false);
  const [timerNoteOpen,setTimerNoteOpen]=useState(false);
  const timerProjRef=useRef(null);
  const [prompt]=useState(()=>PROMPTS[Math.floor(Math.random()*PROMPTS.length)]);
  const [tick,setTick]=useState(0);

  useEffect(()=>{if(!loaded)return;storage.set("music_timer",JSON.stringify(timer)).catch(()=>{});},[timer,loaded]);
  useEffect(()=>{
    const h=e=>setNowPlaying(e.detail);
    audioEventBus.addEventListener("audiohandoff",h);
    return()=>audioEventBus.removeEventListener("audiohandoff",h);
  },[]);
  useEffect(()=>{
    const iv=setInterval(async()=>{
      try{const r=await storage.get("music_timer");if(!r?.value)return;const remote=JSON.parse(r.value);
        setTimer(local=>{if(remote.phase!==local.phase||remote.endsAt!==local.endsAt||remote.remaining!==local.remaining)return remote;return local;});}catch{}
    },3000);return()=>clearInterval(iv);
  },[]);
  useEffect(()=>{if(timer.phase!=="running")return;const iv=setInterval(()=>setTick(t=>t+1),250);return()=>clearInterval(iv);},[timer.phase]);
  useEffect(()=>{
    if(!timerProjDropOpen)return;
    const h=e=>{if(timerProjRef.current&&!timerProjRef.current.contains(e.target)){setTimerProjDropOpen(false);setTimerCreatingProj(false);setTimerNewProjInput("");}};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[timerProjDropOpen]);
  useEffect(()=>{if(timer.phase==="running"&&Date.now()>=timer.endsAt)setTimer(t=>t.phase==="running"?{...t,phase:"done",remaining:0,endsAt:0}:t);},[tick,timer.phase,timer.endsAt]);

  const timerRemaining=timer.phase==="running"?Math.max(0,timer.endsAt-Date.now()):timer.remaining;
  const timerElapsed=Math.max(0,timer.target-timerRemaining);
  const timerProgress=timer.target?Math.min(1,timerElapsed/timer.target):0;
  const timerTargetMin=Math.round(timer.target/60000);
  const timerLogMin=timer.phase==="done"?timerTargetMin:Math.min(480,Math.max(1,Math.floor(timerElapsed/60000)));
  const showTimerUI=timer.phase!=="idle";

  const resetTimerExtras=()=>{setTimerProject("");setTimerNote("");setTimerCreatingProj(false);setTimerNewProjInput("");};
  const openTimerSetup=()=>{setCustomMin("");resetTimerExtras();setTimer({phase:"setup",target:0,endsAt:0,remaining:0});};
  const cancelTimer=()=>{resetTimerExtras();setTimer({phase:"idle",target:0,endsAt:0,remaining:0});};
  const createTimerProject=async()=>{
    const name=timerNewProjInput.trim();if(!name)return;
    if(!projects.find(p=>p.name===name)){const proj={name,notes:"",status:"active"};await saveProjects([...projects,proj]);}
    setTimerProject(name);setTimerCreatingProj(false);setTimerNewProjInput("");
  };
  const startCountdown=mins=>{const ms=Math.min(480,Math.max(1,Math.round(mins)))*60000;setTimer({phase:"running",target:ms,endsAt:Date.now()+ms,remaining:ms});};
  const pauseCountdown=()=>setTimer(t=>({...t,phase:"paused",remaining:Math.max(0,t.endsAt-Date.now()),endsAt:0}));
  const resumeCountdown=()=>setTimer(t=>({...t,phase:"running",endsAt:Date.now()+t.remaining}));
  const logCountdown=()=>{setTimer(t=>({...t,phase:t.phase==="running"?"paused":t.phase,remaining:timerRemaining,endsAt:0}));setSheet({form:{...newForm(),duration:timerLogMin,project:timerProject,note:timerNote},editing:false,id:null,fromTimer:true});};

  /* derived */
  const sessionsByDate=sessions.reduce((acc,s)=>{acc[s.date]=(acc[s.date]||0)+s.duration;return acc;},{});
  const sortedDates=Object.keys(sessionsByDate).sort();

  const {currentStreak,longestStreak}=(()=>{
    if(!sortedDates.length)return{currentStreak:0,longestStreak:0};
    const set=new Set(sortedDates),dayMs=86400000;
    let cur=0,t=keyToUTCms(sortedDates[sortedDates.length-1]);
    while(set.has(dayKeyUTC(t))){cur++;t-=dayMs;}
    let longest=0,streak=0,prev=null;
    for(const d of sortedDates){if(prev&&keyToUTCms(d)-keyToUTCms(prev)===dayMs)streak++;else streak=1;longest=Math.max(longest,streak);prev=d;}
    return{currentStreak:cur,longestStreak:longest};
  })();

  const totalSessions=sessions.length,tMins=totalMin(sessions);
  const avgMins=totalSessions?Math.round(tMins/totalSessions):0;
  const dayCount=Array(7).fill(0);
  sessions.forEach(s=>{dayCount[(parseDate(s.date).getDay()+6)%7]+=s.duration;});
  const bestDay=totalSessions?DAYS_FULL[dayCount.indexOf(Math.max(...dayCount))]:"—";

  const weekStrip=(()=>{
    const t=new Date();t.setHours(0,0,0,0);
    const mon=new Date(t);mon.setDate(t.getDate()-((t.getDay()+6)%7));
    return Array.from({length:7}).map((_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);const ds=toDateStr(d);return{ds,dn:d.getDate(),logged:(sessionsByDate[ds]||0)>0,isToday:ds===today,future:d>t};});
  })();
  const weekLogged=weekStrip.filter(d=>d.logged).length;

  const calCells=(()=>{
    const{y,m}=calMonth;const firstDay=new Date(y,m,1),lastDay=new Date(y,m+1,0);
    const startOffset=(firstDay.getDay()+6)%7,cells=[];
    for(let i=0;i<startOffset;i++)cells.push(null);
    for(let d=1;d<=lastDay.getDate();d++)cells.push(`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    return cells;
  })();

  const todayHasSession=(sessionsByDate[today]||0)>0;
  const projectMap=Object.fromEntries(projects.map(p=>[p.name,p]));
  const projectCounts=sessions.reduce((acc,s)=>{if(s.project)acc[s.project]=(acc[s.project]||0)+1;return acc;},{});

  // Color is stored on each project — stable regardless of add/delete order
  const projectColorMap=Object.fromEntries(projects.map(p=>[p.name,p.color||PROJECT_PALETTE[0]]));
  const recent=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));

  const rawActive=projects.filter(p=>{
    const s=p.status||"active";
    if(s==="released")return false;
    if(s==="idea")return false;
    if(s==="done"){
      // child of a group: stay active until the parent group itself is done/released
      if(p.parentGroup){
        const parent=projectMap[p.parentGroup];
        if(!parent||!["done","released"].includes(parent.status||"active"))return true;
      }
      return false;
    }
    return true;
  });
  const ideaProjects=projects.filter(p=>p.status==="idea"&&!p.parentGroup);
  const lastSessionDateOf=name=>{
    const s=sessions.filter(x=>x.project===name);
    return s.length?s.reduce((best,x)=>x.date>best?x.date:best,""):"";
  };
  // Sort: projects with a start date come first (earliest date = top).
  // Projects without a start date fall to the bottom, ordered by insertion
  // (rawActive preserves creation order, newest first since addProject prepends).
  const activeProjects=[...rawActive].sort((a,b)=>{
    const sa=a.plannedStart,sb=b.plannedStart;
    if(sa&&sb)return sa.localeCompare(sb); // earlier start = higher
    if(sa)return -1;                        // a has date, b doesn't → a first
    if(sb)return 1;                         // b has date, a doesn't → b first
    return rawActive.indexOf(a)-rawActive.indexOf(b); // both undated: keep insertion order
  });
  const doneProjects=projects.filter(p=>{
    if(p.status!=="done")return false;
    if(p.parentGroup){
      const parent=projectMap[p.parentGroup];
      if(!parent||!["done","released"].includes(parent.status||"active"))return false;
    }
    return true;
  });
  const releasedProjects=projects.filter(p=>p.status==="released");
  const groupProjects=activeProjects.filter(p=>GROUP_TYPE_CFG[p.type]);
  const dateSort=(a,b)=>{const sa=a.plannedStart,sb=b.plannedStart;if(sa&&sb)return sa.localeCompare(sb);if(sa)return -1;if(sb)return 1;return 0;};
  const childrenOf=name=>[...activeProjects.filter(p=>p.parentGroup===name)].sort(dateSort);
  // For groups, effective start = earliest of group's own date and any child's date
  const effectiveStart=p=>{
    if(!GROUP_TYPE_CFG[p.type])return p.plannedStart||"";
    const dates=[p.plannedStart,...activeProjects.filter(c=>c.parentGroup===p.name).map(c=>c.plannedStart)].filter(Boolean);
    return dates.length?dates.sort()[0]:"";
  };
  const topLevelActive=[...activeProjects.filter(p=>!p.parentGroup)].sort((a,b)=>{
    const sa=effectiveStart(a),sb=effectiveStart(b);
    if(sa&&sb)return sa.localeCompare(sb);
    if(sa)return -1;if(sb)return 1;return 0;
  });

  /* actions */
  const commitSession=async(form,id,fromTimer)=>{
    let next=id!=null?sessions.map(s=>s.id===id?{...form,id}:s):[{...form,id:Date.now()},...sessions];
    next=next.sort((a,b)=>b.date.localeCompare(a.date));
    setSessions(next);await persistSessions(next);setSheet(null);
    if(fromTimer)cancelTimer();
    flash(id!=null?"Session updated":"Session logged ✓");
    checkMilestones(next,projects,currentStreak,unlockedMilestones);
  };
  const deleteSession=async id=>{const next=sessions.filter(s=>s.id!==id);setSessions(next);await persistSessions(next);setSheet(null);flash("Session deleted");};
  const startEdit=s=>setSheet({form:{date:s.date,duration:s.duration,mood:s.mood,note:s.note||"",project:s.project||"",tag:s.tag||"",hour:s.hour??new Date().getHours()},editing:true,id:s.id});

  // Helper: optimistic set + persist with merge, then reconcile if server had extra projects
  const saveProjects=async next=>{
    setProjects(next);
    const merged=await persistProjects(next);
    if(merged.length!==next.length)setProjects(merged);
  };

  const addProject=async(type="track")=>{
    const name=newProject.trim();if(!name||projects.find(p=>p.name===name))return;
    const usedColors=new Set(projects.map(p=>p.color).filter(Boolean));
    const proj={name,notes:"",status:"active",color:pickProjectColor(usedColors)};
    if(type&&type!=="track")proj.type=type;
    if(newProjectStart)proj.plannedStart=newProjectStart;
    if(newProjectEnd)proj.plannedEnd=newProjectEnd;
    await saveProjects([...projects,proj]);
    setNewProject("");setNewProjectStart("");setNewProjectEnd("");setNewProjectDatesOpen(false);setNewProjectTypeOpen(false);
  };
  const saveTimeline=async(name,plannedStart,plannedEnd)=>{
    await saveProjects(projects.map(p=>p.name===name?{...p,plannedStart,plannedEnd}:p));
  };
  const updateProjectStatus=async(name,status)=>{
    const next=projects.map(p=>p.name===name?{...p,status}:p);
    await saveProjects(next);
    if(status==="released"){flash("🚀 Project released!");checkMilestones(sessions,next,currentStreak,unlockedMilestones);}
    else if(status==="done")flash("✓ Project marked as done");
  };
  const persistArchived=async next=>{try{await storage.set("music_archived_projects",JSON.stringify(next));}catch{}};
  const archiveProject=async name=>{
    const proj=projects.find(p=>p.name===name);
    if(!proj)return;
    deletedNamesRef.current.add(name);
    const nextArchived=[{...proj,archivedAt:new Date().toISOString()},...archivedProjects];
    setArchivedProjects(nextArchived);await persistArchived(nextArchived);
    await saveProjects(projects.filter(p=>p.name!==name));
    flash("Project archived");
  };
  const restoreFromArchive=async name=>{
    const proj=archivedProjects.find(p=>p.name===name);
    if(!proj)return;
    const{archivedAt:_,...restored}=proj;
    const nextArchived=archivedProjects.filter(p=>p.name!==name);
    setArchivedProjects(nextArchived);await persistArchived(nextArchived);
    await saveProjects([...projects,{...restored,status:"active"}]);
    flash("Project restored");
  };
  const deleteArchived=async name=>{
    const next=archivedProjects.filter(p=>p.name!==name);
    setArchivedProjects(next);await persistArchived(next);
  };
  const removeProject=async name=>{
    deletedNamesRef.current.add(name);
    // also mark children as deleted so they don't resurrect
    projects.filter(p=>p.parentGroup===name).forEach(p=>deletedNamesRef.current.add(p.name));
    await saveProjects(projects.filter(p=>p.name!==name).map(p=>p.parentGroup===name?{...p,parentGroup:undefined}:p));
  };
  const updateProjectType=async(name,type)=>{
    await saveProjects(projects.map(p=>p.name===name?{...p,type}:p));
  };
  const createTrackInGroup=async(trackName,groupName)=>{
    if(!trackName||projects.find(p=>p.name===trackName))return;
    const usedColors=new Set(projects.map(p=>p.color).filter(Boolean));
    const proj={name:trackName,notes:"",status:"active",color:pickProjectColor(usedColors),parentGroup:groupName};
    await saveProjects([...projects,proj]);
  };
  const moveToGroup=async(trackName,groupName)=>{
    await saveProjects(projects.map(p=>p.name===trackName?{...p,parentGroup:groupName}:p));
  };
  const removeFromGroup=async trackName=>{
    await saveProjects(projects.map(p=>p.name===trackName?{...p,parentGroup:undefined}:p));
  };
  const saveNotes=async(name,notes)=>{await saveProjects(projects.map(p=>p.name===name?{...p,notes}:p));};

  const saveGoal=async v=>{setGoalHours(v);await persistGoal(v);setGoalEditOpen(false);};
  const saveGlobalFolder=async v=>{setGlobalAudioFolder(v);try{await storage.set("music_global_audio_folder",v);}catch{}};

  const renameProject=async(oldName,newName)=>{
    if(!newName||newName===oldName||projects.find(p=>p.name===newName))return;
    // Update projects list (rename + update children's parentGroup)
    deletedNamesRef.current.add(oldName); // old name is gone; don't let merge resurrect it
    const nextProjects=projects.map(p=>p.name===oldName?{...p,name:newName}:p.parentGroup===oldName?{...p,parentGroup:newName}:p);
    await saveProjects(nextProjects);
    // Update sessions that reference this project
    const nextSessions=sessions.map(s=>s.project===oldName?{...s,project:newName}:s);
    setSessions(nextSessions);await persistSessions(nextSessions);
    // Rename the audio files key server-side
    await fetch("/api/projects/rename",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({oldName,newName})}).catch(()=>{});
    // Update scan folders key
    try{
      const r=await storage.get("music_scan_folders");
      const folders=r?.value?JSON.parse(r.value):{};
      if(folders[oldName]){folders[newName]=folders[oldName];delete folders[oldName];await storage.set("music_scan_folders",JSON.stringify(folders));}
    }catch{}
    // Update audio counts map
    setAudioFileCounts(prev=>{const next={...prev};if(next[oldName]!==undefined){next[newName]=next[oldName];delete next[oldName];}return next;});
    // Keep panel open with new name (replace top of stack)
    setPanelStack(s=>s.length?[...s.slice(0,-1),{name:newName,tab:s[s.length-1]?.tab||"open"}]:s);
  };

  const downloadBackup=async()=>{
    const data={exportDate:new Date().toISOString(),sessions,projects};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download=`studio-log-backup-${today}.json`;a.click();URL.revokeObjectURL(url);
    flash("Backup downloaded");
  };

  if(!loaded)return<ThemeCtx.Provider value={C}><div className="app" style={{background:C.bg}}><div style={{color:C.faint,padding:"40px 4px",fontSize:14}}>Loading…</div></div></ThemeCtx.Provider>;

  const {card,eyebrow,iconBtn}=getStyles(C);

  const TypeDropdown=({name,type,onUpdate})=>{
    const cfg=GROUP_TYPE_CFG[type]||GROUP_TYPE_CFG.album;
    const dot=cfg.dot;
    const [open,setOpen]=useState(false);
    const ref=useRef(null);
    useEffect(()=>{
      if(!open)return;
      const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
      document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
    },[open]);
    return(
      <div ref={ref} style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
        <button onClick={()=>setOpen(v=>!v)} style={{...iconBtn,width:28,height:28,borderRadius:8,fontSize:10,fontWeight:700,color:dot,borderColor:`${dot}55`,background:`${dot}15`}}>
          {cfg.badge}
        </button>
        <SmartDropdown anchorRef={ref} open={open} align="right" minHeight={120}
          style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:5,minWidth:130,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
          {Object.entries(GROUP_TYPE_CFG).map(([t,c])=>{
            const active=t===type;
            return(
              <button key={t} onClick={()=>{onUpdate(name,t);setOpen(false);}} style={{
                display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",
                borderRadius:9,border:"none",background:active?`${c.dot}18`:"transparent",
                cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,
                color:active?c.dot:C.text,textAlign:"left",
              }}>
                <span style={{width:8,height:8,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                {c.label}
                {active&&<svg style={{marginLeft:"auto"}} width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={c.dot} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            );
          })}
        </SmartDropdown>
      </div>
    );
  };

  const StatusDropdown=({name,status,dotOnly})=>{
    const [open,setOpen]=useState(false);
    const ref=useRef(null);
    const cfg=STATUS_CFG[status]||STATUS_CFG.active;
    const dot=cfg.dot||C.indigo;
    useEffect(()=>{
      if(!open)return;
      const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
      document.addEventListener("mousedown",handler);
      return()=>document.removeEventListener("mousedown",handler);
    },[open]);
    return(
      <div ref={ref} style={{position:"relative",flexShrink:0}}>
        {dotOnly?(
          <button onClick={()=>setOpen(o=>!o)} title={cfg.label} style={{
            width:10,height:10,borderRadius:"50%",background:dot,border:"none",
            cursor:"pointer",padding:0,flexShrink:0,marginTop:4,display:"block",
          }}/>
        ):(
        <button onClick={()=>setOpen(o=>!o)} style={{
          fontSize:10.5,fontWeight:700,color:dot,background:`${dot}1a`,
          border:`1.5px solid ${dot}55`,borderRadius:20,padding:"2px 8px",
          cursor:"pointer",whiteSpace:"nowrap",fontFamily:"var(--font-sans)",lineHeight:1.4,
        }}>{cfg.label}</button>
        )}
        <SmartDropdown anchorRef={ref} open={open} align="left" minHeight={260}
          style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:5,minWidth:140,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
          {STATUS_ORDER.map(s=>{
            const sc=STATUS_CFG[s],sd=sc.dot||C.indigo,active=s===status;
            return(
              <button key={s} onClick={()=>{updateProjectStatus(name,s);setOpen(false);}} style={{
                display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",
                borderRadius:9,border:"none",background:active?`${sd}18`:"transparent",
                cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,
                color:active?sd:C.text,textAlign:"left",
              }}>
                <span style={{width:8,height:8,borderRadius:"50%",background:sd,flexShrink:0}}/>
                {sc.label}
                {active&&<svg style={{marginLeft:"auto"}} width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={sd} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            );
          })}
        </SmartDropdown>
      </div>
    );
  };

  const GroupRow=({p})=>{
    const cfg=GROUP_TYPE_CFG[p.type]||GROUP_TYPE_CFG.album;
    const dot=cfg.dot;
    const [collapsed,setCollapsed]=useState(true);
    const [confirmDel,setConfirmDel]=useState(false);
    const children=childrenOf(p.name);
    const isDoneOrReleased=["done","released"].includes(p.status||"active");
    const totalSessions=children.reduce((s,c)=>s+(projectCounts[c.name]||0),0)+(projectCounts[p.name]||0);
    return(
      <div onClick={()=>openProject(p.name)} style={{background:C.surf2,borderRadius:14,overflow:"visible",cursor:"pointer",border:`1px solid ${dot}55`}}>
        {/* Group header */}
        <div style={{padding:"11px 13px 11px 14px",display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();setCollapsed(v=>!v);}} style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"center",color:C.faint,flexShrink:0}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{transform:collapsed?"rotate(-90deg)":"rotate(0deg)",transition:"transform .18s"}}>
              <path d="M6 9l6 6 6-6" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
            <div style={{fontSize:11.5,color:C.dim,marginTop:2}}>
              {children.length} track{children.length!==1?"s":""}{totalSessions>0&&` · ${totalSessions} session${totalSessions!==1?"s":""}`}
            </div>
          </div>
          {/* Status left of type badge */}
          <div onClick={e=>e.stopPropagation()}>
            <StatusDropdown name={p.name} status={p.status||"active"}/>
          </div>
          {/* Type badge — square button with dropdown */}
          <TypeDropdown name={p.name} type={p.type||"album"} onUpdate={updateProjectType}/>
          {confirmDel?(
            <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>removeProject(p.name)} style={{fontSize:11.5,fontWeight:700,color:"#fff",background:C.flame,border:"none",borderRadius:8,padding:"4px 9px",cursor:"pointer",fontFamily:"var(--font-sans)"}}>Delete</button>
              <button onClick={()=>setConfirmDel(false)} style={{fontSize:11.5,fontWeight:600,color:C.dim,background:C.surf2,border:`1px solid ${C.lineS}`,borderRadius:8,padding:"4px 9px",cursor:"pointer",fontFamily:"var(--font-sans)"}}>Cancel</button>
            </div>
          ):isDoneOrReleased?(
            <button onClick={e=>{e.stopPropagation();archiveProject(p.name);}} title="Archive" style={{...iconBtn,width:28,height:28,borderRadius:8,flexShrink:0}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="5" rx="1.5" stroke={C.faint} strokeWidth="1.7"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" stroke={C.faint} strokeWidth="1.7" strokeLinecap="round"/><path d="M10 12h4" stroke={C.faint} strokeWidth="1.7" strokeLinecap="round"/></svg>
            </button>
          ):(
            <button onClick={e=>{e.stopPropagation();setConfirmDel(true);}} style={{...iconBtn,width:28,height:28,borderRadius:8,flexShrink:0}}>{Icon.trash()}</button>
          )}
        </div>
        {/* Children */}
        {!collapsed&&children.length>0&&(
          <div style={{borderTop:`1px solid ${C.line}`,paddingLeft:16,paddingRight:8,paddingBottom:8,display:"flex",flexDirection:"column",gap:6,marginTop:0,paddingTop:8}}>
            {children.map(c=><ProjectRow key={c.name} p={c} insideGroup/>)}
          </div>
        )}
        {!collapsed&&children.length===0&&(
          <div style={{borderTop:`1px solid ${C.line}`,padding:"8px 14px 10px",fontSize:12,color:C.faint,fontStyle:"italic"}}>
            No tracks yet — move a track here from the list below
          </div>
        )}
      </div>
    );
  };

  const ProjectRow=({p,insideGroup=false})=>{
    const isDoneOrReleased=["done","released"].includes(p.status||"active");
    const [moveOpen,setMoveOpen]=useState(false);
    const [confirmDel,setConfirmDel]=useState(false);
    const moveRef=useRef(null);
    useEffect(()=>{
      if(!moveOpen)return;
      const h=e=>{if(moveRef.current&&!moveRef.current.contains(e.target))setMoveOpen(false);};
      document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
    },[moveOpen]);
    const [tlOpen,setTlOpen]=useState(false);
    const [tlS,setTlS]=useState(p.plannedStart||"");
    const [tlE,setTlE]=useState(p.plannedEnd||"");
    const tlDropRef=useRef(null);
    useEffect(()=>{setTlS(p.plannedStart||"");setTlE(p.plannedEnd||"");},[p.plannedStart,p.plannedEnd]);
    useEffect(()=>{
      if(!tlOpen)return;
      const h=e=>{if(tlDropRef.current&&!tlDropRef.current.contains(e.target))setTlOpen(false);};
      document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
    },[tlOpen]);
    const tlColor=(p.plannedStart||p.plannedEnd)?(projectColorMap[p.name]||C.indigo):C.dim;
    const tlLabel=(()=>{
      const fmt=ds=>ds?new Date(ds+"T00:00:00").toLocaleDateString("en",{month:"short",day:"numeric"}):"";
      if(p.plannedStart&&p.plannedEnd&&p.plannedStart!==p.plannedEnd)return`${fmt(p.plannedStart)} → ${fmt(p.plannedEnd)}`;
      if(p.plannedStart&&p.plannedEnd&&p.plannedStart===p.plannedEnd)return fmt(p.plannedStart);
      if(p.plannedStart)return fmt(p.plannedStart);
      if(p.plannedEnd)return`due ${fmt(p.plannedEnd)}`;
      return null;
    })();
    const saveTl=()=>{saveTimeline(p.name,tlS,tlE);setTlOpen(false);};
    const statusCfg=STATUS_CFG[p.status||"active"]||STATUS_CFG.active;
    const statusDot=statusCfg.dot||C.indigo;
    const cnt=projectCounts[p.name]||0;
    const rel=fmtRelativeDate(lastSessionDateOf(p.name));
    const audioCount=audioFileCounts[p.name]||0;
    return(
    <div onClick={()=>openProject(p.name)} style={{background:insideGroup?C.bg:C.surf2,borderRadius:insideGroup?10:14,padding:"11px 13px 11px 14px",cursor:"pointer"}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        {/* Content */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
          <div style={{fontSize:11.5,color:C.dim,marginTop:2,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
            <div ref={tlDropRef} style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setTlOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:2,background:"transparent",border:"none",cursor:"pointer",padding:0,color:tlLabel?tlColor:C.dim,fontWeight:tlLabel?500:400,fontSize:11.5,fontFamily:"var(--font-sans)"}}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><rect x="3" y="4.5" width="18" height="16.5" rx="3" stroke={tlLabel?tlColor:C.dim} strokeWidth="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4" stroke={tlLabel?tlColor:C.dim} strokeWidth="2" strokeLinecap="round"/></svg>
                {tlLabel||"dates"}
              </button>
              <RangePicker open={tlOpen} start={tlS} end={tlE}
                onChange={(s,e)=>{setTlS(s);setTlE(e);if(!s&&!e){saveTimeline(p.name,"","");setTlOpen(false);}else if(s&&e){saveTimeline(p.name,s,e);setTlOpen(false);}}}
                onClose={()=>setTlOpen(false)}/>
            </div>
            <span style={{color:C.dim}}>·</span>
            <span>{cnt?`${cnt} session${cnt>1?"s":""}`:  "no sessions"}</span>
            {audioCount>0&&<><span style={{color:C.dim}}>·</span>
              <button onClick={e=>{e.stopPropagation();openProject(p.name,"versions");}} style={{display:"flex",alignItems:"center",gap:2,background:"transparent",border:"none",cursor:"pointer",padding:0,color:C.green,fontSize:11.5,fontFamily:"var(--font-sans)"}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M2 13h4l2-9 4 18 3-12 2 5 3-2h2" stroke={C.green} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>{audioCount}
              </button>
            </>}
          </div>
        </div>
        {/* Status pill + move + action */}
        <div onClick={e=>e.stopPropagation()}>
          <StatusDropdown name={p.name} status={p.status||"active"}/>
        </div>
        {/* Move to group / remove from group */}
        {(insideGroup||groupProjects.length>0)&&(
          <div ref={moveRef} style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setMoveOpen(v=>!v)} title={insideGroup?"Move / Remove from group":"Move to group"} style={{...iconBtn,width:28,height:28,borderRadius:8,background:moveOpen?C.accentAlpha:"transparent"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 7h5l2-2h11v14H3V7z" stroke={C.muted} strokeWidth="1.7" strokeLinejoin="round"/>
                <path d="M12 11v4M10 13h4" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </button>
            <SmartDropdown anchorRef={moveRef} open={moveOpen} align="right" minHeight={160}
              style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:5,minWidth:160,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
                {insideGroup&&(
                  <button onClick={()=>{removeFromGroup(p.name);setMoveOpen(false);}} style={{
                    display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",
                    borderRadius:9,border:"none",background:"transparent",cursor:"pointer",
                    fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,color:C.dim,textAlign:"left",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7-7M5 12l7 7" stroke={C.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Remove from group
                  </button>
                )}
                {groupProjects.filter(g=>g.name!==p.parentGroup).map(g=>{
                  const gc=GROUP_TYPE_CFG[g.type];const gd=gc?.dot||C.indigo;
                  return(
                    <button key={g.name} onClick={()=>{moveToGroup(p.name,g.name);setMoveOpen(false);}} style={{
                      display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",
                      borderRadius:9,border:"none",background:"transparent",cursor:"pointer",
                      fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,color:C.text,textAlign:"left",
                    }}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:gd,flexShrink:0}}/>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.name}</span>
                      <span style={{marginLeft:"auto",fontSize:10,color:gd,fontWeight:700}}>{gc?.label}</span>
                    </button>
                  );
                })}
            </SmartDropdown>
          </div>
        )}
        {confirmDel?(
          <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>removeProject(p.name)} style={{fontSize:11.5,fontWeight:700,color:"#fff",background:C.flame,border:"none",borderRadius:8,padding:"4px 9px",cursor:"pointer",fontFamily:"var(--font-sans)"}}>Delete</button>
            <button onClick={()=>setConfirmDel(false)} style={{fontSize:11.5,fontWeight:600,color:C.dim,background:C.surf2,border:`1px solid ${C.lineS}`,borderRadius:8,padding:"4px 9px",cursor:"pointer",fontFamily:"var(--font-sans)"}}>Cancel</button>
          </div>
        ):isDoneOrReleased?(
          <button onClick={e=>{e.stopPropagation();archiveProject(p.name);}} title="Archive" style={{...iconBtn,width:28,height:28,borderRadius:8,flexShrink:0}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="5" rx="1.5" stroke={C.faint} strokeWidth="1.7"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" stroke={C.faint} strokeWidth="1.7" strokeLinecap="round"/><path d="M10 12h4" stroke={C.faint} strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        ):(
          <button onClick={e=>{e.stopPropagation();setConfirmDel(true);}} style={{...iconBtn,width:28,height:28,borderRadius:8,flexShrink:0}}>{Icon.trash()}</button>
        )}
      </div>
      {/* Inline timeline editor — full width below the main row */}
    </div>
  );};

  // ── Today section (reused in idle card + timer card) ─────────────────
  const todaySection=(()=>{
    const todayProjects=projects.filter(p=>
      !GROUP_TYPE_CFG[p.type]&&
      !["done","released"].includes(p.status)&&
      p.plannedStart&&p.plannedStart<=today&&(p.plannedEnd||p.plannedStart)>=today
    );
    const liveElapsedMins=showTimerUI?Math.floor(timerElapsed/60000):0;
    const thisWeekMins=weekHours(sessions,getWeekStart(0))*60+liveElapsedMins;
    const remainingMins=Math.max(0,goalHours*60-thisWeekMins);
    const todayIdx=weekStrip.findIndex(d=>d.isToday); // Mon=0…Sun=6
    const futureDays=todayIdx>=0?6-todayIdx:0; // days after today (Fri→2, Sat→1, Sun→0)
    const perDayMins=futureDays>0?remainingMins/futureDays:remainingMins; // Sun: show all remaining
    const remainingH=remainingMins/60;
    const dailyFairShareMins=goalHours*60/7;
    const todayTotalMins=(sessionsByDate[today]||0)+liveElapsedMins;
    const doneForToday=todayTotalMins>=dailyFairShareMins;
    const fmtM=m=>m>=60?`${Math.floor(m/60)}h${Math.round(m%60)?`${Math.round(m%60)}m`:""}`:m>0?`${Math.round(m)}m`:"0m";
    const daysUntil=ds=>{if(!ds)return null;const diff=Math.round((parseDate(ds)-parseDate(today))/(1000*60*60*24));if(diff<0)return null;if(diff===0)return"due today";if(diff===1)return"due tomorrow";return`${diff} days left`;};
    const sortedTodayProjects=[...todayProjects].sort((a,b)=>{const da=a.plannedEnd||a.plannedStart||"9999";const db=b.plannedEnd||b.plannedStart||"9999";return da.localeCompare(db);});
    if(todayProjects.length===0&&remainingH<=0)return null;
    return(
      <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.line}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:700,color:C.muted,letterSpacing:"0.04em",textTransform:"uppercase"}}>What's for today?</span>
          {remainingH>0&&(
            <span style={{fontSize:12,color:C.faint}}>
              {doneForToday
                ?<span style={{color:C.green,fontWeight:600}}>Done for today ✓</span>
                :<><span style={{color:C.indigo,fontWeight:600}}>{fmtM(perDayMins)}</span>{futureDays>0?` per day to reach goal`:" left to reach goal"}</>
              }
            </span>
          )}
        </div>
        {todayProjects.length>0?(
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {sortedTodayProjects.map(p=>{
              const dl=daysUntil(p.plannedEnd);
              const col=projectColorMap[p.name]||C.indigo;
              return(
                <button key={p.name} onClick={()=>openProject(p.name)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"6px 10px",borderRadius:10,cursor:"pointer",textAlign:"left",
                    border:`1px solid ${col}33`,background:`${col}12`,fontFamily:"var(--font-sans)"}}>
                  <span style={{fontSize:12.5,fontWeight:600,color:col,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  {dl&&<span style={{fontSize:11,color:C.faint,flexShrink:0,marginLeft:8}}>{dl}</span>}
                </button>
              );
            })}
          </div>
        ):(
          <div style={{fontSize:12.5,color:C.dim,fontStyle:"italic"}}>No projects scheduled for today.</div>
        )}
      </div>
    );
  })();

  return (
    <ThemeCtx.Provider value={C}>
    <div className="app" style={{background:C.bg}}>

      {panelStack.map((entry,idx)=>{
        const pname=entry.name;const proj=projectMap[pname]||{};
        const isGroup=!!GROUP_TYPE_CFG[proj.type];
        const children=isGroup?projects.filter(p=>p.parentGroup===pname):[];
        const ungrouped=projects.filter(p=>(!p.type||p.type==="track")&&!p.parentGroup&&p.name!==pname);
        return(
          <ProjectPanel key={pname+idx} name={pname} notes={proj.notes||""} onSave={n=>saveNotes(pname,n)}
            plannedStart={proj.plannedStart||""} plannedEnd={proj.plannedEnd||""}
            onSaveTimeline={(s,e)=>saveTimeline(pname,s,e)} sessions={sessions}
            onClose={closeTopPanel} globalAudioFolder={globalAudioFolder}
            onRename={renameProject} initialTab={entry.tab}
            status={proj.status||"active"} onStatusChange={(name,s)=>updateProjectStatus(name,s)}
            type={proj.type} childProjects={children} ungroupedProjects={ungrouped}
            onOpenProject={openProject} onAddToGroup={moveToGroup} onRemoveFromGroup={removeFromGroup} onCreateTrack={createTrackInGroup}
            audioFileCounts={audioFileCounts} projectColorMap={projectColorMap} canGoBack={idx>0}
          />
        );
      })}
      {allOpen&&<AllSessions sessions={recent} projects={projects} projectMap={projectMap} onEdit={s=>startEdit(s)} onDelete={deleteSession} onClose={()=>setAllOpen(false)}/>}
      {sheet&&<LogSheet initial={sheet.form} editing={sheet.editing} projects={projects} onSubmit={form=>commitSession(form,sheet.id,sheet.fromTimer)} onDelete={()=>deleteSession(sheet.id)} onClose={()=>setSheet(null)}/>}
      {settingsOpen&&<SettingsSheet themeDark={themeDark} themeLight={themeLight} onThemeDarkChange={changeThemeDark} onThemeLightChange={changeThemeLight} goalHours={goalHours} onGoalChange={saveGoal} onDownloadBackup={downloadBackup} onClose={()=>setSettingsOpen(false)} globalAudioFolder={globalAudioFolder} onGlobalFolderChange={saveGlobalFolder} archivedProjects={archivedProjects} onRestoreArchived={restoreFromArchive} onDeleteArchived={deleteArchived}/>}
      {goalEditOpen&&<GoalEditSheet goalHours={goalHours} onSave={saveGoal} onClose={()=>setGoalEditOpen(false)}/>}
      {reviewOpen&&<AnalyticsSheet sessions={sessions} goalHours={goalHours} currentStreak={currentStreak} longestStreak={longestStreak} onClose={()=>setReviewOpen(false)}/>}
      <MiniPlayer nowPlaying={nowPlaying} onEnd={()=>setNowPlaying(null)} onClear={()=>setNowPlaying(null)} onOpenProject={openProject}/>
      {toast&&<div className="toast">{toast}</div>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 2px 4px"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icon-transparent.svg" alt="" style={{width:46,height:46,flexShrink:0}} />
            <div style={{fontSize:25,fontWeight:700,letterSpacing:"-0.02em",color:C.text}}>Orbit</div>
          </div>
          <div style={{fontSize:13,color:C.faint,marginTop:4}}>Keep the habit. One session at a time.</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setReviewOpen(true)} title="Analytics" style={iconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="13" width="4" height="9" rx="1.5" fill={C.faint}/><rect x="10" y="7" width="4" height="15" rx="1.5" fill={C.faint}/><rect x="18" y="2" width="4" height="20" rx="1.5" fill={C.faint}/></svg>
          </button>
          <button onClick={()=>setSettingsOpen(true)} style={iconBtn}>{Icon.gear(C.faint)}</button>
          <div style={{display:"flex",alignItems:"center",gap:6,background:C.surf,border:`1px solid ${C.line}`,borderRadius:999,padding:"8px 13px"}}>
            <span style={{fontSize:15}}>🔥</span>
            <span style={{fontSize:15,fontWeight:700,color:C.text}}>{currentStreak}</span>
          </div>
        </div>
      </div>

      <div className="cols">
      <div className="col col-a">

      {/* Today card */}
      <div className="card" style={{...card,padding:22,
        background:showTimerUI?(timer.phase==="done"?C.loggedBg:C.timerBg):todayHasSession?C.loggedBg:C.todayBg,
        border:showTimerUI?(timer.phase==="done"?`1px solid ${C.loggedBorder}`:`1px solid ${C.accentBorder}`):todayHasSession?`1px solid ${C.loggedBorder}`:`1px solid ${C.accentBorder}`}}>
        {timer.phase==="setup"?(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{...eyebrow,color:C.indigo}}>Set a timer</span>
              <button onClick={cancelTimer} style={{fontSize:12.5,fontWeight:600,color:C.faint,background:"transparent",border:"none",cursor:"pointer"}}>Cancel</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,margin:"16px 0 12px"}}>
              {TIMER_PRESETS.map(m=>(
                <button key={m} onClick={()=>startCountdown(m)} style={{padding:"16px 0",borderRadius:13,border:`1px solid ${C.lineS}`,background:C.surf2,color:C.text,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-sans)"}}>
                  {m}<span style={{fontSize:11.5,fontWeight:500,color:C.faint}}>m</span>
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <input type="number" min="1" max="480" value={customMin} placeholder="Custom…" className="mt-text"
                onChange={e=>setCustomMin(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&Number(customMin)>0)startCountdown(Number(customMin));}} style={{flex:1}}/>
              <button onClick={()=>{const v=Number(customMin);if(v>0)startCountdown(v);}} disabled={!(Number(customMin)>0)}
                style={{border:"none",borderRadius:12,color:"#fff",padding:"0 22px",fontSize:15,fontWeight:700,cursor:"pointer",background:C.accentGrad,opacity:Number(customMin)>0?1:0.4,fontFamily:"var(--font-sans)"}}>Start</button>
            </div>
          </>
        ):showTimerUI?(
          <>
            {/* Header: status + icon buttons + discard */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{...eyebrow,color:timer.phase==="done"?C.greenS:timer.phase==="running"?C.indigo:C.muted,display:"flex",alignItems:"center",gap:8}}>
                <span className={timer.phase==="running"?"pulse-dot":""} style={{width:9,height:9,borderRadius:"50%",background:timer.phase==="done"?C.green:timer.phase==="running"?C.indigo:C.dim,boxShadow:timer.phase==="running"?`0 0 10px ${C.indigo}`:"none"}}/>
                {timer.phase==="done"?"Time's up":timer.phase==="running"?"Focusing":"Paused"} · {timerTargetMin}m
              </span>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                {/* Project picker icon */}
                <div ref={timerProjRef} style={{position:"relative"}}>
                  <button onClick={()=>{setTimerProjDropOpen(o=>!o);setTimerCreatingProj(false);setTimerNewProjInput("");}}
                    title={timerProject||"Choose project"}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:8,border:"none",cursor:"pointer",
                      background:timerProject?C.accentAlpha:"transparent",color:timerProject?C.indigo:C.faint,fontFamily:"var(--font-sans)"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                    {timerProject&&<span style={{fontSize:11,fontWeight:600,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{timerProject}</span>}
                  </button>
                  {timerProjDropOpen&&(()=>{
                    const closeDropdown=()=>{setTimerProjDropOpen(false);setTimerCreatingProj(false);setTimerNewProjInput("");};
                    const availProjects=projects.filter(p=>!["done","released","archived"].includes(p.status||"active")&&!GROUP_TYPE_CFG[p.type]);
                    return(
                      <SmartDropdown anchorRef={timerProjRef} open={timerProjDropOpen} align="right" minHeight={220}
                        style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:5,minWidth:180,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}
                        onMouseDown={e=>e.stopPropagation()}>
                        {timerCreatingProj?(
                          <div style={{padding:"6px 8px",display:"flex",gap:6}}>
                            <input value={timerNewProjInput} onChange={e=>setTimerNewProjInput(e.target.value)} placeholder="Project name…" className="mt-text"
                              style={{flex:1,fontSize:12,padding:"5px 8px"}} autoFocus
                              onKeyDown={e=>{if(e.key==="Enter")createTimerProject().then(closeDropdown);if(e.key==="Escape"){setTimerCreatingProj(false);setTimerNewProjInput("");}}}/>
                            <button onClick={()=>createTimerProject().then(closeDropdown)} disabled={!timerNewProjInput.trim()}
                              style={{border:"none",borderRadius:7,color:"#fff",padding:"0 10px",fontSize:13,fontWeight:700,cursor:"pointer",background:C.accentGrad,opacity:timerNewProjInput.trim()?1:0.4}}>✓</button>
                          </div>
                        ):(
                          <>
                            {timerProject&&(
                              <button onClick={()=>{setTimerProject("");closeDropdown();}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 12px",borderRadius:9,border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:12.5,color:C.faint,textAlign:"left"}}>
                                <span style={{width:8,height:8,borderRadius:"50%",background:C.dim,flexShrink:0}}/>No project
                              </button>
                            )}
                            {availProjects.map(p=>{
                              const active=p.name===timerProject;
                              return(
                                <button key={p.name} onClick={()=>{setTimerProject(p.name);closeDropdown();}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 12px",borderRadius:9,border:"none",background:active?C.accentAlpha:"transparent",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:12.5,fontWeight:active?600:400,color:active?C.indigo:C.text,textAlign:"left"}}>
                                  <span style={{width:8,height:8,borderRadius:"50%",background:active?C.indigo:C.dim,flexShrink:0}}/>
                                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                                  {active&&<svg style={{marginLeft:"auto",flexShrink:0}} width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={C.indigo} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </button>
                              );
                            })}
                            <div style={{height:1,background:C.line,margin:"4px 8px"}}/>
                            <button onClick={()=>setTimerCreatingProj(true)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 12px",borderRadius:9,border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:12.5,color:C.muted,textAlign:"left"}}>
                              <span style={{width:8,height:8,borderRadius:"50%",background:C.dim,flexShrink:0}}/>＋ New project
                            </button>
                          </>
                        )}
                      </SmartDropdown>
                    );
                  })()}
                </div>
                {/* Notes toggle icon */}
                <button onClick={()=>setTimerNoteOpen(o=>!o)} title="Session notes"
                  style={{padding:"4px 7px",borderRadius:8,border:"none",cursor:"pointer",
                    background:timerNoteOpen||timerNote?C.accentAlpha:"transparent",color:timerNoteOpen||timerNote?C.indigo:C.faint}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 10h10M4 14h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
                </button>
                <button onClick={cancelTimer} style={{fontSize:12.5,fontWeight:600,color:C.faint,background:"transparent",border:"none",cursor:"pointer",marginLeft:4}}>Discard</button>
              </div>
            </div>
            <div className="mono" style={{fontSize:50,fontWeight:700,letterSpacing:"-0.02em",margin:"10px 0 12px",color:timer.phase==="done"?C.greenS:C.text}}>{fmtClock(timerRemaining)}</div>
            <div style={{height:5,borderRadius:5,background:"rgba(255,255,255,0.08)",overflow:"hidden",marginBottom:14}}>
              <div style={{height:"100%",width:`${timerProgress*100}%`,borderRadius:5,background:timer.phase==="done"?"linear-gradient(90deg,#6ee7b7,#34d399)":C.accentGrad,transition:"width .3s linear"}}/>
            </div>
            {timer.phase==="done"?(
              <button onClick={logCountdown} style={{width:"100%",padding:15,borderRadius:14,border:"none",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:15.5,fontWeight:700,color:"#0b0b10",background:"linear-gradient(135deg,#6ee7b7,#34d399)"}}>✓ Log {timerTargetMin}m session</button>
            ):(
              <div style={{display:"flex",gap:10}}>
                <button onClick={timer.phase==="running"?pauseCountdown:resumeCountdown} style={{flex:1,padding:15,borderRadius:14,cursor:"pointer",border:`1px solid ${C.lineS}`,background:"transparent",color:C.muted,fontFamily:"var(--font-sans)",fontSize:15.5,fontWeight:600}}>{timer.phase==="running"?"⏸ Pause":"▶ Resume"}</button>
                <button onClick={logCountdown} style={{flex:1,padding:15,borderRadius:14,border:"none",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:15.5,fontWeight:700,color:"#fff",background:C.accentGrad,boxShadow:`0 8px 22px -8px ${C.accentGlow}`}}>✓ Log {timerLogMin}m</button>
              </div>
            )}
            {/* Notes — auto-growing, no scroll */}
            {(timerNoteOpen||timerNote)&&(
              <textarea value={timerNote}
                onChange={e=>{setTimerNote(e.target.value);const el=e.target;el.style.height="auto";el.style.height=el.scrollHeight+"px";}}
                ref={el=>{if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px";if(timerNoteOpen&&!timerNote)el.focus();}}}
                placeholder="Notes for this session…"
                style={{width:"100%",marginTop:10,resize:"none",overflow:"hidden",boxSizing:"border-box",
                  background:"transparent",border:"none",borderTop:`1px solid ${C.line}`,borderRadius:0,
                  paddingTop:12,paddingBottom:4,paddingLeft:0,paddingRight:0,
                  fontSize:13,lineHeight:1.6,color:C.text,fontFamily:"var(--font-sans)",
                  outline:"none",caretColor:C.indigo}}/>
            )}
            {todaySection}
          </>
        ):(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{...eyebrow,color:todayHasSession?C.greenS:C.indigo}}>{todayHasSession?"✓ Logged today":`Today · ${fmtDate(today)}`}</span>
              {todayHasSession&&<span style={{fontSize:12.5,color:C.muted}}>{fmtDur(sessionsByDate[today])} total</span>}
            </div>
            <div style={{fontSize:20,fontWeight:600,margin:"12px 0 18px",lineHeight:1.3,color:C.text}}>{todayHasSession?"Nice — today's in the books.":prompt}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setSheet({form:newForm(),editing:false,id:null})} style={{flex:1,padding:15,borderRadius:14,border:"none",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:15.5,fontWeight:700,color:"#fff",background:C.accentGrad,boxShadow:`0 8px 22px -8px ${C.accentGlow}`}}>{todayHasSession?"＋ Log another":"＋ Log a session"}</button>
              <button onClick={openTimerSetup} style={{padding:"15px 18px",borderRadius:14,cursor:"pointer",border:`1px solid ${C.lineS}`,background:"transparent",color:C.muted,fontFamily:"var(--font-sans)",fontSize:15.5,fontWeight:600,display:"flex",alignItems:"center",gap:7}}>▶ Timer</button>
            </div>
            {todaySection}
          </>
        )}
      </div>

      {/* All-time stats */}
      <div className="card" style={{...card,display:"flex",padding:"18px 8px"}}>
        {[[totalSessions,"sessions"],[fmtDur(tMins),"total"],[fmtDur(avgMins),"avg"],[bestDay,"best day"]].map(([v,k],i)=>(
          <div key={k} style={{flex:1,textAlign:"center",borderRight:i<3?`1px solid ${C.line}`:"none"}}>
            <div style={{fontSize:21,fontWeight:700,letterSpacing:"-0.01em",color:C.text}}>{v}</div>
            <div style={{fontSize:11,color:C.faint,marginTop:3}}>{k}</div>
          </div>
        ))}
      </div>

      {/* This week + Weekly goal (merged) */}
      {(()=>{
        const baseWeekH=weekHours(sessions,getWeekStart(0));
        const thisWeekH=baseWeekH+(showTimerUI?Math.floor(timerElapsed/60000)/60:0);
        const pct=goalHours>0?thisWeekH/goalHours:0;
        return (
          <div className="card" style={card}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
              <span style={eyebrow}>Weekly goal</span>
              <button onClick={()=>setGoalEditOpen(true)} style={{fontSize:12,fontWeight:600,color:C.indigo,background:C.accentAlpha,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>
                {goalHours}h / week
              </button>
            </div>
            {/* Ring + day tiles side by side */}
            <div style={{display:"flex",alignItems:"center",gap:20}}>
              <GoalRing pct={pct} label={fmtDur(Math.round(thisWeekH*60))} sub={`of ${goalHours}h`}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:C.muted,marginBottom:14}}>
                  {pct>=1
                    ? <span style={{color:C.green,fontWeight:600}}>✓ Goal reached this week!</span>
                    : `${fmtDur(Math.round(Math.max(0,goalHours-thisWeekH)*60))} to go`}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {weekStrip.map((d,i)=>{
                    const dayMins=sessionsByDate[d.ds]||0;
                    const dayLabel=dayMins>=60?`${Math.floor(dayMins/60)}h${dayMins%60?`${dayMins%60}m`:""}`:dayMins>0?`${dayMins}m`:"";
                    return(
                    <button key={d.ds} onClick={()=>setSheet({form:newForm(d.ds),editing:false,id:null})} style={{flex:1,textAlign:"center",background:"transparent",border:"none",cursor:"pointer",padding:0}}>
                      <div style={{fontSize:10,color:C.dim,marginBottom:5}}>{DAYS_MON[i]}</div>
                      <div style={{aspectRatio:"1",borderRadius:10,display:"grid",placeItems:"center",fontSize:12.5,fontWeight:600,background:d.logged?C.accentGrad:d.isToday?C.accentAlpha:C.surf2,border:d.isToday&&!d.logged?`1.5px solid ${C.indigo}`:"1.5px solid transparent",color:d.logged?"#fff":d.isToday?C.indigo:C.dim,opacity:d.future?0.45:1}}>{d.logged?"✓":d.dn}</div>
                      <div style={{fontSize:9,color:d.logged?C.green:C.faint,marginTop:4,fontWeight:600,minHeight:11}}>{dayLabel}</div>
                    </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Past weeks history strip */}
            {goalHours>0&&(()=>{
              const past8=Array.from({length:8},(_,i)=>{
                const start=getWeekStart(8-i);
                const h=weekHours(sessions,start);
                const hit=h>=goalHours;
                const d=new Date(start+"T00:00:00");
                const label=`${monthNames[d.getMonth()].slice(0,3)} ${d.getDate()}`;
                return{start,h,hit,label};
              });
              const anyData=past8.some(w=>w.h>0);
              if(!anyData)return null;
              return(
                <div style={{marginTop:18,paddingTop:14,borderTop:`1px solid ${C.line}`}}>
                  <div style={{fontSize:10.5,color:C.faint,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:10}}>Past 8 weeks</div>
                  <div style={{display:"flex",gap:4,alignItems:"flex-end"}}>
                    {past8.map((w,i)=>(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}} title={`${w.label}: ${fmtDur(Math.round(w.h*60))}`}>
                        <div style={{width:"100%",height:36,borderRadius:5,background:C.surf2,position:"relative",overflow:"hidden"}}>
                          <div style={{position:"absolute",bottom:0,left:0,right:0,
                            height:`${Math.min(1,w.h/goalHours)*100}%`,
                            background:w.hit?C.green:C.indigo,opacity:w.hit?0.85:0.45,transition:"height .3s ease"}}/>
                        </div>
                        <div style={{width:6,height:6,borderRadius:"50%",background:w.hit?C.green:C.dim,flexShrink:0}}/>
                        <div style={{fontSize:8.5,color:C.dim,whiteSpace:"nowrap"}}>{w.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Calendar */}
      <div className="card" style={card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <span style={eyebrow}>Calendar</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>setCalMonth(({y,m})=>m===0?{y:y-1,m:11}:{y,m:m-1})} style={iconBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <span style={{fontSize:13.5,fontWeight:600,minWidth:82,textAlign:"center",color:C.text}}>{monthNames[calMonth.m]} {calMonth.y}</span>
            <button onClick={()=>setCalMonth(({y,m})=>m===11?{y:y+1,m:0}:{y,m:m+1})} style={iconBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#9a9ab2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
          {DAYS_MON.map((d,i)=><div key={i} style={{fontSize:10.5,color:C.dim,textAlign:"center"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {(()=>{
            // Assign each timed project a fixed lane (consistent vertical position across all days)
            // A project with only a start date is treated as a single-day range
            const timedProjects=projects.filter(p=>p.plannedStart);
            return calCells.map((ds,i)=>{
              if(!ds)return<div key={i}/>;
              const isPast=ds<today,isToday=ds===today,hasSess=!!sessionsByDate[ds],missed=isPast&&!hasSess;
              // Projects that span this day, with their lane index
              const dayTl=timedProjects.map((p,li)=>({p,li})).filter(({p})=>p.plannedStart<=ds&&ds<=(p.plannedEnd||p.plannedStart));
              const hasProject=dayTl.length>0;
              const firstProject=hasProject?dayTl[0].p:null;
              const handleClick=()=>{if(firstProject)openProject(firstProject.name);};
              return(
                <button key={ds} onClick={handleClick} style={{aspectRatio:"1",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:hasProject?"pointer":"default",padding:0,position:"relative",overflow:"hidden",background:"transparent",border:"1.5px solid transparent"}}>
                  {/* Bands behind date */}
                  {dayTl.map(({p,li})=>(
                    <div key={p.name} style={{position:"absolute",left:0,right:0,height:5,bottom:2+li*7,background:projectColorMap[p.name]||C.indigo,opacity:0.75,zIndex:0}}/>
                  ))}
                  <span style={{
                    fontSize:13,fontWeight:isToday||hasSess?700:500,
                    position:"relative",zIndex:1,textAlign:"center",
                    lineHeight:"26px",width:26,height:26,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    color:isToday?"#fff":hasSess?C.green:C.text,
                    background:isToday?C.accentGrad:hasSess?`${C.green}22`:"transparent",
                  }}>{Number(ds.slice(8))}</span>
                </button>
              );
            });
          })()}
        </div>
      </div>

      </div>{/* col-a */}
      <div className="col col-b">

      {/* Projects */}
      <div className="card" style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
          <span style={eyebrow}>Projects</span>
          {activeProjects.length>0&&<span style={{fontSize:12.5,color:C.faint}}>{activeProjects.length} active</span>}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:newProjectDatesOpen?8:activeProjects.length?16:0}}>
          <input type="text" className="mt-text" value={newProject} placeholder="Track or project name…"
            onChange={e=>setNewProject(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addProject()} style={{flex:1}}/>
          <div ref={addTypeRef} style={{position:"relative",display:"flex",borderRadius:12,overflow:"visible",flexShrink:0,opacity:newProject.trim()?1:0.4}}>
            <button onClick={()=>addProject("track")} disabled={!newProject.trim()} style={{border:"none",borderRadius:"12px 0 0 12px",color:"#fff",padding:"0 14px",fontSize:14,fontWeight:600,cursor:"pointer",background:C.accentGrad,whiteSpace:"nowrap",borderRight:`1px solid rgba(255,255,255,0.2)`}}>Add</button>
            <button onClick={()=>setNewProjectTypeOpen(v=>!v)} disabled={!newProject.trim()} title="Add as Album / EP / Single" style={{border:"none",borderRadius:"0 12px 12px 0",color:"#fff",padding:"0 9px",fontSize:14,fontWeight:600,cursor:"pointer",background:C.accentGrad,display:"flex",alignItems:"center"}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <SmartDropdown anchorRef={addTypeRef} open={newProjectTypeOpen} align="right" minHeight={100}
              style={{background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:5,minWidth:148,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
              {Object.entries(GROUP_TYPE_CFG).map(([type,cfg])=>(
                <button key={type} onClick={()=>addProject(type)} style={{
                  display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 12px",
                  borderRadius:9,border:"none",background:"transparent",cursor:"pointer",
                  fontFamily:"var(--font-sans)",fontSize:13,fontWeight:600,color:C.text,textAlign:"left",
                }}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:cfg.dot,flexShrink:0}}/>
                  {cfg.label}
                </button>
              ))}
            </SmartDropdown>
          </div>
        </div>
        {newProjectDatesOpen&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:activeProjects.length?16:0}}>
            <input type="date" value={newProjectStart} onChange={e=>setNewProjectStart(e.target.value)}
              className="mt-text" style={{flex:1,fontSize:12,padding:"6px 10px"}}/>
            <span style={{fontSize:12,color:C.dim}}>→</span>
            <input type="date" value={newProjectEnd} onChange={e=>setNewProjectEnd(e.target.value)}
              className="mt-text" style={{flex:1,fontSize:12,padding:"6px 10px"}}/>
          </div>
        )}
        {topLevelActive.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {topLevelActive.map(p=>GROUP_TYPE_CFG[p.type]
              ?<GroupRow key={p.name} p={p}/>
              :<ProjectRow key={p.name} p={p}/>
            )}
          </div>
        )}
        {/* Ideas / Backlog section */}
        {ideaProjects.length>0&&(
          <div style={{marginTop:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>setShowIdea(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",flex:1,marginBottom:showIdea?10:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{transform:showIdea?"rotate(90deg)":"none",transition:"transform .2s"}}><path d="M9 6l6 6-6 6" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{fontSize:12,fontWeight:600,color:C.faint}}>Ideas ({ideaProjects.length})</span>
              </button>
              {showIdea&&<button title="Pick a random idea to start next"
                onClick={()=>{
                  const picks=ideaProjects.filter(p=>!GROUP_TYPE_CFG[p.type]);
                  if(!picks.length)return;
                  const p=picks[Math.floor(Math.random()*picks.length)];
                  updateProjectStatus(p.name,"active");
                  setShowIdea(false);
                  flash(`🎲 "${p.name}" moved to active`);
                }}
                style={{width:26,height:26,borderRadius:7,border:`1px solid ${C.lineS}`,background:C.surf2,
                  cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                  marginBottom:showIdea?10:0}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="4" stroke={C.faint} strokeWidth="1.7"/>
                  <circle cx="8" cy="8" r="1.5" fill={C.faint}/><circle cx="16" cy="8" r="1.5" fill={C.faint}/>
                  <circle cx="8" cy="16" r="1.5" fill={C.faint}/><circle cx="16" cy="16" r="1.5" fill={C.faint}/>
                  <circle cx="12" cy="12" r="1.5" fill={C.faint}/>
                </svg>
              </button>}
            </div>
            {showIdea&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{ideaProjects.map(p=><ProjectRow key={p.name} p={p}/>)}</div>}
          </div>
        )}

        {/* Done section */}
        {doneProjects.length>0&&(
          <div style={{marginTop:14}}>
            <button onClick={()=>setShowDone(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:showDone?10:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{transform:showDone?"rotate(90deg)":"none",transition:"transform .2s"}}><path d="M9 6l6 6-6 6" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{fontSize:12,fontWeight:600,color:C.faint}}>Done ({doneProjects.length})</span>
            </button>
            {showDone&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{doneProjects.map(p=><ProjectRow key={p.name} p={p}/>)}</div>}
          </div>
        )}

        {/* Released / Archive section */}
        {releasedProjects.length>0&&(
          <div style={{marginTop:14}}>
            <button onClick={()=>setShowReleased(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:showReleased?10:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{transform:showReleased?"rotate(90deg)":"none",transition:"transform .2s"}}><path d="M9 6l6 6-6 6" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{fontSize:12,fontWeight:600,color:C.faint}}>Released / Archive ({releasedProjects.length})</span>
            </button>
            {showReleased&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{releasedProjects.map(p=><ProjectRow key={p.name} p={p}/>)}</div>}
          </div>
        )}
      </div>

      {/* Recent sessions */}
      <div className="card" style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
          <span style={eyebrow}>Recent sessions</span>
          {recent.length>0&&<button onClick={()=>setAllOpen(true)} style={{fontSize:12.5,fontWeight:600,color:C.indigo,background:C.accentAlpha2,border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer"}}>See all {recent.length}</button>}
        </div>
        {recent.length===0
          ?<div style={{fontSize:13.5,color:C.dim,textAlign:"center",padding:"12px 0"}}>No sessions yet.</div>
          :<div style={{display:"flex",flexDirection:"column",gap:9}}>
            {recent.slice(0,10).map(s=>{
              const proj=s.project?projectMap[s.project]:null;
              const tagCol=s.tag?TAG_COLOR[s.tag]:null;
              const todSlot=s.hour!=null?TOD.find(t=>t.test(s.hour)):null;
              const smBtn={...iconBtn,width:28,height:28,borderRadius:8};
              return(
                <div key={s.id} style={{background:C.surf2,border:`1px solid ${C.line}`,borderRadius:14,padding:"11px 14px"}}>
                  {/* Main row: chips + mood + duration */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                    <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:5,minWidth:0}}>
                      {s.project&&<button onClick={()=>setNotesModal(s.project)} style={{fontSize:13,fontWeight:600,color:C.indigo,background:C.accentAlpha2,border:"none",borderRadius:8,padding:"3px 10px",cursor:"pointer"}}>{s.project}{proj?.notes?" 📝":""}</button>}
                      {s.tag&&<span style={{fontSize:12,fontWeight:600,color:tagCol,background:`${tagCol}1e`,borderRadius:6,padding:"3px 9px"}}>{s.tag}</span>}
                      {!s.project&&!s.tag&&<span style={{fontSize:12.5,color:C.dim}}>session</span>}
                    </div>
                    <span style={{fontSize:17,flexShrink:0}}>{MOOD_EMOJI[s.mood]}</span>
                    <span style={{fontSize:14,fontWeight:700,color:C.indigo,flexShrink:0}}>{fmtDur(s.duration)}</span>
                  </div>
                  {/* Meta row: date + tod + note + actions */}
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:4,overflow:"hidden"}}>
                      <span className="mono" style={{fontSize:10.5,color:C.dim,flexShrink:0}}>{s.date}</span>
                      {todSlot&&<span style={{fontSize:11,flexShrink:0}}>{todSlot.emoji}</span>}
                      {s.note&&<span style={{fontSize:12,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {s.note}</span>}
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>startEdit(s)} style={smBtn}>{Icon.pencil()}</button>
                      <button onClick={()=>deleteSession(s.id)} style={smBtn}>{Icon.trash()}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      </div>{/* col-b */}
      </div>{/* cols */}
    </div>
    </ThemeCtx.Provider>
  );
}
