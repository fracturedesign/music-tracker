import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import WaveSurfer from "wavesurfer.js";

/* ─── global audio event bus (one-playing-at-a-time) ─── */
const audioEventBus = new EventTarget();

/* ─── theme system ─── */
const ThemeCtx = createContext(null);
const useTheme = () => useContext(ThemeCtx);

const THEMES = {
  calm:  { name:"Calm Stack",   emoji:"🌌", bg:"#0b0b10", surf:"#131320", surf2:"#1a1a2a", line:"rgba(255,255,255,0.055)", lineS:"rgba(255,255,255,0.1)", text:"#f3f3f8", muted:"#8a8a9e", faint:"#6a6a86", dim:"#55556a", indigo:"#818cf8", deep:"#6366f1", green:"#34d399", greenS:"#6ee7b7", flame:"#fb923c", accentGrad:"linear-gradient(135deg,#818cf8,#6366f1)", accentGlow:"rgba(99,102,241,0.6)", accentAlpha:"rgba(129,140,248,0.16)", accentAlpha2:"rgba(129,140,248,0.12)", accentBorder:"rgba(129,140,248,0.5)", todayBg:"linear-gradient(160deg,#1c1c34,#131326)", timerBg:"linear-gradient(160deg,#241c3a,#15131f)", loggedBg:"linear-gradient(160deg,#16261f,#111a17)", loggedBorder:"rgba(52,211,153,0.35)", heat:["#16162a","#312e81","#4f46e5","#7c8cf8","#a5b4fc"] },
  paper: { name:"Paper",        emoji:"📄", bg:"#f7f7f5", surf:"#ffffff", surf2:"#eeeeeb", line:"rgba(0,0,0,0.07)", lineS:"rgba(0,0,0,0.12)", text:"#16162a", muted:"#6b6b82", faint:"#9090a8", dim:"#b4b4c8", indigo:"#5558e8", deep:"#4f46e5", green:"#059669", greenS:"#10b981", flame:"#ea580c", accentGrad:"linear-gradient(135deg,#6366f1,#4f46e5)", accentGlow:"rgba(99,102,241,0.22)", accentAlpha:"rgba(99,102,241,0.1)", accentAlpha2:"rgba(99,102,241,0.07)", accentBorder:"rgba(99,102,241,0.3)", todayBg:"linear-gradient(160deg,#eef0ff,#f4f4ff)", timerBg:"linear-gradient(160deg,#f0ecff,#ece8ff)", loggedBg:"linear-gradient(160deg,#ecfdf5,#f0fdf6)", loggedBorder:"rgba(5,150,105,0.3)", heat:["#e4e4ee","#c4b5fd","#818cf8","#4f46e5","#312e81"] },
  sand:  { name:"Warm Sand",    emoji:"🏖", bg:"#faf7f0", surf:"#ffffff", surf2:"#f2ede3", line:"rgba(0,0,0,0.07)", lineS:"rgba(0,0,0,0.12)", text:"#1c1608", muted:"#786a52", faint:"#9e9078", dim:"#c0b49a", indigo:"#c2611a", deep:"#b45309", green:"#059669", greenS:"#10b981", flame:"#ea580c", accentGrad:"linear-gradient(135deg,#f59e0b,#d97706)", accentGlow:"rgba(217,119,6,0.22)", accentAlpha:"rgba(217,119,6,0.1)", accentAlpha2:"rgba(217,119,6,0.07)", accentBorder:"rgba(217,119,6,0.35)", todayBg:"linear-gradient(160deg,#fffbeb,#fef3c7)", timerBg:"linear-gradient(160deg,#fff7ed,#feebc8)", loggedBg:"linear-gradient(160deg,#ecfdf5,#f0fdf6)", loggedBorder:"rgba(5,150,105,0.3)", heat:["#e8dfc8","#fcd34d","#f59e0b","#d97706","#92400e"] },
  slate: { name:"Slate",        emoji:"🪨", bg:"#1c1f26", surf:"#252930", surf2:"#2e333c", line:"rgba(255,255,255,0.07)", lineS:"rgba(255,255,255,0.12)", text:"#dde2ec", muted:"#8892a4", faint:"#666e80", dim:"#454d5e", indigo:"#60a5fa", deep:"#3b82f6", green:"#34d399", greenS:"#6ee7b7", flame:"#fb923c", accentGrad:"linear-gradient(135deg,#60a5fa,#3b82f6)", accentGlow:"rgba(59,130,246,0.5)", accentAlpha:"rgba(96,165,250,0.15)", accentAlpha2:"rgba(96,165,250,0.1)", accentBorder:"rgba(96,165,250,0.4)", todayBg:"linear-gradient(160deg,#1a2540,#16213a)", timerBg:"linear-gradient(160deg,#1c2545,#18213e)", loggedBg:"linear-gradient(160deg,#142820,#10201a)", loggedBorder:"rgba(52,211,153,0.3)", heat:["#22262e","#1e3a5c","#1d4f8a","#2563eb","#60a5fa"] },
  dusk:  { name:"Dusk",         emoji:"🌅", bg:"#1c1824", surf:"#252132", surf2:"#2e2a3e", line:"rgba(255,220,255,0.06)", lineS:"rgba(255,220,255,0.1)", text:"#ece8f5", muted:"#9890b0", faint:"#726888", dim:"#504868", indigo:"#c084fc", deep:"#a855f7", green:"#34d399", greenS:"#6ee7b7", flame:"#fb923c", accentGrad:"linear-gradient(135deg,#c084fc,#a855f7)", accentGlow:"rgba(168,85,247,0.5)", accentAlpha:"rgba(192,132,252,0.16)", accentAlpha2:"rgba(192,132,252,0.11)", accentBorder:"rgba(192,132,252,0.4)", todayBg:"linear-gradient(160deg,#2a1e3c,#221830)", timerBg:"linear-gradient(160deg,#321e46,#281840)", loggedBg:"linear-gradient(160deg,#162420,#121e1a)", loggedBorder:"rgba(52,211,153,0.3)", heat:["#201c2c","#3b1a5e","#6b21a8","#9333ea","#c084fc"] },
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
  active:    { label:"Active",     dot:null },   // uses theme accent
  mixing:    { label:"Mixing",     dot:"#60a5fa" },
  mastering: { label:"Mastering",  dot:"#c084fc" },
  done:      { label:"Done",       dot:"#34d399" },
  released:  { label:"Released",   dot:"#fbbf24" },
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

    return()=>{clearTimeout(bufferingTimer.current);ws.destroy();wsRef.current=null;};
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
function VersionsTab({projectName,onCountChange,globalAudioFolder}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [files,setFiles]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [scanning,setScanning]=useState(false);
  const [loading,setLoading]=useState(true);
  const [scanPath,setScanPath]=useState("");
  const [scanMsg,setScanMsg]=useState("");
  const [showScan,setShowScan]=useState(false);
  const [activeFilters,setActiveFilters]=useState({formats:[],versions:[]});
  const allFiltersRef=useRef({});
  const fileInputRef=useRef(null);

  useEffect(()=>{onCountChange?.(files.length);},[files.length]);// eslint-disable-line

  useEffect(()=>{
    (async()=>{
      try{
        const[fr,pr,filt]=await Promise.all([
          fetch(`/api/audio/${encodeURIComponent(projectName)}`).then(r=>r.json()),
          fetch(`/api/data/music_scan_folders`).then(r=>r.json()),
          fetch(`/api/data/music_audio_filters`).then(r=>r.json()),
        ]);
        const loadedFiles=fr.files||[];
        setFiles(loadedFiles);
        const savedPath=pr?.value?(JSON.parse(pr.value)?.[projectName]||""):"";
        if(savedPath){
          setScanPath(savedPath);
          setShowScan(true);
          const sr=await fetch(`/api/audio/${encodeURIComponent(projectName)}/scan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({folderPath:savedPath})});
          if(sr.ok){const sd=await sr.json();if(sd.added>0)setFiles(sd.files||[]);}
        }
        if(filt?.value){
          try{
            const all=JSON.parse(filt.value);
            allFiltersRef.current=all||{};
            const saved=all?.[projectName]||{formats:[],versions:[]};
            setActiveFilters(saved);
          }catch{}
        }
      }catch{}
      setLoading(false);
    })();
  },[projectName]);// eslint-disable-line

  const saveFilters=async filters=>{
    try{
      allFiltersRef.current={...allFiltersRef.current,[projectName]:filters};
      await fetch(`/api/data/music_audio_filters`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value:JSON.stringify(allFiltersRef.current)})});
    }catch{}
  };

  const toggleFilter=(type,value)=>{
    setActiveFilters(prev=>{
      const cur=prev[type]||[];
      const next=cur.includes(value)?cur.filter(v=>v!==value):[...cur,value];
      const updated={...prev,[type]:next};
      saveFilters(updated);
      return updated;
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

  return (
    <div style={{padding:"14px 18px 20px"}}>
      {/* Action row */}
      <input ref={fileInputRef} type="file" accept=".wav,.mp3" onChange={handleUpload} style={{display:"none"}}/>
      <div style={{display:"flex",gap:7,marginBottom:10}}>
        <button onClick={()=>fileInputRef.current?.click()} disabled={uploading}
          style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,
            padding:"10px 0",borderRadius:10,cursor:uploading?"default":"pointer",
            border:`1.5px dashed ${C.lineS}`,background:"transparent",
            color:uploading?C.dim:C.faint,fontSize:12.5,fontWeight:600,fontFamily:"var(--font-sans)"}}>
          {uploading?<><Spinner/>Analyzing…</>:<><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 21V10M7 15l5-5 5 5M3 21h18" stroke={C.faint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Upload file</>}
        </button>
        <button onClick={()=>{setShowScan(s=>!s);setScanMsg("");}}
          style={{...iconBtn,width:"auto",padding:"0 11px",fontSize:12,fontWeight:600,
            color:showScan||hasPerProjectPath?C.indigo:C.faint,gap:5,display:"flex",
            borderColor:showScan||hasPerProjectPath?C.accentBorder:C.lineS,
            background:showScan||hasPerProjectPath?C.accentAlpha:C.surf2}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 7h5M3 12h8M3 17h5M16 5l4 4-8 8-4-1 1-4 7-7z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {hasPerProjectPath?"Folder set":"Scan folder"}
        </button>
      </div>

      {/* Scan panel */}
      {showScan&&(
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
      )}

      {/* Global folder notice — only show if no per-project path is set */}
      {!hasPerProjectPath&&hasGlobalFolder&&!showScan&&(
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"7px 10px",background:C.surf2,border:`1px solid ${C.line}`,borderRadius:8}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={C.faint} strokeWidth="1.7"/><path d="M12 8v4M12 16h.01" stroke={C.faint} strokeWidth="1.7" strokeLinecap="round"/></svg>
          <span style={{fontSize:11,color:C.faint,flex:1}}>Using global folder from Settings</span>
        </div>
      )}

      {/* Filter badges */}
      {!loading&&files.length>0&&(()=>{
        const fmts=[...new Set(files.map(f=>(f.format||"").toUpperCase()))].filter(f=>["WAV","MP3"].includes(f));
        const verLabels=[...new Set(files.map(f=>extractVersion(f.name)).filter(Boolean))];
        const hasFinal=verLabels.includes("final");
        const vTagLabels=verLabels.filter(v=>v!=="final"&&!/^v\d/.test(v)); // master,demo,draft
        const hasVNum=files.some(f=>/\bv\d/i.test(f.name||""));
        const pills=[
          ...fmts.map(f=>({type:"formats",value:f,label:f})),
          ...(hasFinal?[{type:"versions",value:"final",label:"Final"}]:[]),
          ...(hasVNum?[{type:"versions",value:"versioned",label:"Versioned"}]:[]),
          ...vTagLabels.map(v=>({type:"versions",value:v,label:v.charAt(0).toUpperCase()+v.slice(1)})),
        ];
        if(pills.length===0)return null;
        const anyActive=(activeFilters.formats||[]).length>0||(activeFilters.versions||[]).length>0;
        const clearFilters=()=>{
          const cleared={formats:[],versions:[]};
          setActiveFilters(cleared);
          saveFilters(cleared);
        };
        return(
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10,alignItems:"center"}}>
            {pills.map(({type,value,label})=>{
              const on=activeFilters[type]?.includes(value);
              return(
                <button key={type+value} onClick={()=>toggleFilter(type,value)}
                  style={{fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:20,cursor:"pointer",
                    letterSpacing:"0.04em",textTransform:"uppercase",fontFamily:"var(--font-sans)",
                    border:`1px solid ${on?C.accentBorder:C.lineS}`,
                    background:on?C.accentAlpha:"transparent",
                    color:on?C.indigo:C.dim,transition:"all .15s"}}>
                  {label}
                </button>
              );
            })}
            {anyActive&&<button onClick={clearFilters}
              style={{fontSize:10.5,fontWeight:600,padding:"3px 9px",borderRadius:20,cursor:"pointer",
                fontFamily:"var(--font-sans)",border:"none",background:"transparent",color:C.dim}}>
              Clear
            </button>}
          </div>
        );
      })()}

      {/* File list */}
      {loading?(
        <div style={{fontSize:13,color:C.dim,textAlign:"center",padding:"20px 0"}}>Loading…</div>
      ):files.length===0?(
        <div style={{fontSize:13,color:C.dim,textAlign:"center",padding:"20px 0"}}>No audio files yet. Upload a file or scan a folder.</div>
      ):(()=>{
        // Only apply filter values that actually exist in the current file list
        const availFmts=new Set(files.map(f=>(f.format||"").toUpperCase()).filter(f=>["WAV","MP3"].includes(f)));
        const availVers=new Set(files.map(f=>extractVersion(f.name)).filter(Boolean));
        const hasVNum=files.some(f=>/\bv\d/i.test(f.name||""));
        if(hasVNum)availVers.add("versioned");
        const fmtF=(activeFilters.formats||[]).filter(v=>availFmts.has(v));
        const verF=(activeFilters.versions||[]).filter(v=>availVers.has(v));
        const visible=sortAudioFiles(files).filter(f=>{
          if(fmtF.length>0){
            const fmt=(f.format||"").toUpperCase();
            if(fmt&&!fmtF.includes(fmt))return false;
          }
          if(verF.length>0){
            const ver=extractVersion(f.name);
            const matchFinal=verF.includes("final")&&ver==="final";
            const matchVersioned=verF.includes("versioned")&&/\bv\d/i.test(f.name||"");
            const matchLabel=verF.some(v=>v!=="final"&&v!=="versioned"&&ver===v);
            if(!matchFinal&&!matchVersioned&&!matchLabel)return false;
          }
          return true;
        });
        if(visible.length===0)return <div style={{fontSize:13,color:C.dim,textAlign:"center",padding:"20px 0"}}>No files match the selected filters.</div>;
        return visible.map(f=><AudioFileCard key={f.id} file={f} projectName={projectName}
          onDelete={handleDelete} onRename={handleRename} onMarkSeen={handleMarkSeen}/>);
      })()}
    </div>
  );
}

/* ─── project panel (notes + versions) ─── */
function parseLines(text) {
  return (text||"").split("\n").map(line=>{
    if(/^-x /i.test(line))return{type:"check",checked:true,content:line.slice(3)};
    if(/^- /.test(line))return{type:"check",checked:false,content:line.slice(2)};
    return{type:"text",content:line};
  });
}
function serializeLines(lines){return lines.map(l=>l.type==="check"?(l.checked?"-x ":"- ")+l.content:l.content).join("\n");}

function ProjectPanel({name,notes,onSave,onClose,globalAudioFolder,onRename}) {
  const C=useTheme(); const {iconBtn}=getStyles(C);
  const [tab,setTab]=useState("open");
  const [versionsCount,setVersionsCount]=useState(null);
  const [renamingProject,setRenamingProject]=useState(false);
  const [renameVal,setRenameVal]=useState(name);
  useEffect(()=>{
    fetch(`/api/audio/${encodeURIComponent(name)}`).then(r=>r.json())
      .then(d=>setVersionsCount(d.files?.length??0)).catch(()=>{});
  },[name]);
  const commitRename=()=>{
    const trimmed=renameVal.trim();
    if(trimmed&&trimmed!==name)onRename?.(name,trimmed);
    setRenamingProject(false);
  };
  const [text,setText]=useState(notes||"");
  const [lines,setLines]=useState(()=>parseLines(notes));
  const [mode,setMode]=useState("preview");
  const toPreview=()=>{setLines(parseLines(text));setMode("preview");};
  const toEdit=()=>{setText(serializeLines(lines));setMode("edit");};
  const toggle=i=>setLines(prev=>prev.map((l,idx)=>idx===i?{...l,checked:!l.checked}:l));
  const close=()=>{onSave(mode==="edit"?text:serializeLines(lines));onClose();};
  const empty=lines.length===0||(lines.length===1&&lines[0].content==="");
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
            <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
              <button onClick={()=>{setRenameVal(name);setRenamingProject(true);}} style={{...iconBtn,flexShrink:0,width:26,height:26,borderRadius:7}} title="Rename project">{Icon.pencil()}</button>
            </div>
          )}
          {!renamingProject&&<button onClick={close} style={{...iconBtn,flexShrink:0}}>{Icon.close()}</button>}
        </div>

        {/* Tab bar */}
        <div style={{display:"flex",gap:0,padding:"12px 20px 0",borderBottom:`1px solid ${C.line}`}}>
          {[["open","Notes"],["versions",versionsCount!=null?`Versions · ${versionsCount}`:"Versions"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"8px 18px",fontSize:13.5,fontWeight:600,border:"none",cursor:"pointer",
              borderBottom:`2px solid ${tab===t?C.indigo:"transparent"}`,background:"transparent",
              color:tab===t?C.indigo:C.faint,marginBottom:"-1px",fontFamily:"var(--font-sans)",
            }}>{l}</button>
          ))}
        </div>

        {/* Open (notes) tab */}
        {tab==="open"&&(
          <>
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"12px 20px 10px"}}>
              {[["preview","Preview"],["edit","Edit"]].map(([m,label])=>(
                <button key={m} onClick={m==="preview"?toPreview:toEdit}
                  style={{fontSize:12.5,fontWeight:600,padding:"6px 14px",borderRadius:10,border:"none",cursor:"pointer",
                    background:mode===m?C.accentAlpha:"transparent",color:mode===m?C.indigo:C.faint}}>{label}</button>
              ))}
              <span style={{fontSize:11,color:C.dim,marginLeft:6}}>start a line with <span className="mono" style={{color:C.indigo}}>-</span> for a checkbox</span>
            </div>
            <div style={{flex:1,overflowY:"auto",minHeight:200,maxHeight:"50vh",borderTop:`1px solid ${C.line}`}}>
              {mode==="preview"?(
                <div style={{padding:"16px 20px"}}>
                  {empty?<div style={{color:C.dim,fontSize:13.5}}>No notes yet — switch to Edit to add some.</div>
                    :lines.map((l,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
                        {l.type==="check"?(
                          <>
                            <button onClick={()=>toggle(i)} style={{flexShrink:0,marginTop:2,width:18,height:18,borderRadius:5,
                              border:`1.5px solid ${l.checked?C.deep:"#3a3a52"}`,background:l.checked?C.deep:"transparent",
                              cursor:"pointer",display:"grid",placeItems:"center",padding:0}}>
                              {l.checked&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </button>
                            <span style={{fontSize:14,lineHeight:1.5,color:l.checked?C.dim:C.text,textDecoration:l.checked?"line-through":"none"}}>{l.content}</span>
                          </>
                        ):<span className="mono" style={{fontSize:13,lineHeight:1.6,color:C.muted,paddingLeft:28}}>{l.content||" "}</span>}
                      </div>
                    ))}
                </div>
              ):(
                <textarea className="mt" value={text} onChange={e=>setText(e.target.value)}
                  placeholder={"Notes and to-dos…\n\n- Record main melody\n- Mix bass"}
                  style={{minHeight:200,borderRadius:0,border:"none",background:"transparent",fontFamily:"var(--font-mono)",fontSize:13,lineHeight:1.7,padding:"16px 20px",width:"100%",boxSizing:"border-box"}}/>
              )}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",padding:"14px 20px",borderTop:`1px solid ${C.line}`}}>
              <button onClick={close} style={{background:C.accentGrad,border:"none",borderRadius:12,color:"#fff",padding:"11px 22px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Save &amp; close</button>
            </div>
          </>
        )}

        {/* Versions tab */}
        {tab==="versions"&&(
          <div style={{flex:1,overflowY:"auto"}}>
            <VersionsTab projectName={name} onCountChange={setVersionsCount} globalAudioFolder={globalAudioFolder}/>
          </div>
        )}
      </div>
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
            <input type="range" className="mt" min="5" max="480" step="5" value={form.duration} onChange={e=>set({duration:Number(e.target.value)})}/>
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
function SettingsSheet({currentTheme,onThemeChange,goalHours,onGoalChange,onDownloadBackup,onClose,globalAudioFolder,onGlobalFolderChange}) {
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

        {/* Theme */}
        <div style={{fontSize:11.5,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:C.faint,marginBottom:14}}>Theme</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {Object.entries(THEMES).map(([key,T])=>{
            const active=currentTheme===key;
            return(
              <button key={key} onClick={()=>onThemeChange(key)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,cursor:"pointer",textAlign:"left",border:active?`1px solid ${C.accentBorder}`:`1px solid ${C.line}`,background:active?C.accentAlpha:C.surf2}}>
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

/* ─── main app ─── */
const PROMPTS=["Make something beautiful today.","Chase the sound in your head.","Press record, see what happens.","One loop can become a song.","Start before you feel ready.","Trust your ears today.","Finish something today.","Show up for the music.","Turn an idea into a take."];

export default function App() {
  const [themeKey,setThemeKey]=useState(()=>localStorage.getItem("music_theme")||"calm");
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

  const changeTheme=key=>{localStorage.setItem("music_theme",key);setThemeKey(key);};

  const [sessions,setSessions]=useState([]);
  const [projects,setProjects]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [goalHours,setGoalHours]=useState(5);
  const [unlockedMilestones,setUnlockedMilestones]=useState([]);
  const [calMonth,setCalMonth]=useState(()=>{const n=new Date();return{y:n.getFullYear(),m:n.getMonth()};});
  const [newProject,setNewProject]=useState("");
  const [notesModal,setNotesModal]=useState(null);
  const [sheet,setSheet]=useState(null);
  const [allOpen,setAllOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [goalEditOpen,setGoalEditOpen]=useState(false);
  const [showDone,setShowDone]=useState(false);
  const [showReleased,setShowReleased]=useState(false);
  const [audioFileCounts,setAudioFileCounts]=useState({});
  const [globalAudioFolder,setGlobalAudioFolder]=useState("");
  const [toast,setToast]=useState("");
  const toastTimer=useRef(null);
  const toastQueue=useRef([]);

  /* load */
  useEffect(()=>{
    (async()=>{
      try{const r=await storage.get("music_sessions");if(r?.value)setSessions(JSON.parse(r.value));}catch{}
      try{const p=await storage.get("music_projects");if(p?.value){const raw=JSON.parse(p.value);setProjects(raw.map(x=>typeof x==="string"?{name:x,notes:"",status:"active"}:{...x,status:x.status||"active"}));}}catch{}
      try{const g=await storage.get("music_goal");if(g?.value)setGoalHours(JSON.parse(g.value));}catch{}
      try{const m=await storage.get("music_milestones");if(m?.value)setUnlockedMilestones(JSON.parse(m.value));}catch{}
      try{const t=await storage.get("music_timer");if(t?.value)setTimer(JSON.parse(t.value));}catch{}
      try{const af=await storage.get("music_audio_files");if(af?.value&&typeof af.value==="object"){setAudioFileCounts(Object.fromEntries(Object.entries(af.value).map(([k,v])=>[k,Array.isArray(v)?v.length:0])));}}catch{}
      try{const gf=await storage.get("music_global_audio_folder");if(gf?.value)setGlobalAudioFolder(gf.value);}catch{}
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

  const persistSessions=useCallback(async next=>{try{await storage.set("music_sessions",JSON.stringify(next));}catch{}},[]);
  const persistProjects=useCallback(async next=>{try{await storage.set("music_projects",JSON.stringify(next));}catch{}},[]);
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
  const [prompt]=useState(()=>PROMPTS[Math.floor(Math.random()*PROMPTS.length)]);
  const [tick,setTick]=useState(0);

  useEffect(()=>{if(!loaded)return;storage.set("music_timer",JSON.stringify(timer)).catch(()=>{});},[timer,loaded]);
  useEffect(()=>{
    const iv=setInterval(async()=>{
      try{const r=await storage.get("music_timer");if(!r?.value)return;const remote=JSON.parse(r.value);
        setTimer(local=>{if(remote.phase!==local.phase||remote.endsAt!==local.endsAt||remote.remaining!==local.remaining)return remote;return local;});}catch{}
    },3000);return()=>clearInterval(iv);
  },[]);
  useEffect(()=>{if(timer.phase!=="running")return;const iv=setInterval(()=>setTick(t=>t+1),250);return()=>clearInterval(iv);},[timer.phase]);
  useEffect(()=>{if(timer.phase==="running"&&Date.now()>=timer.endsAt)setTimer(t=>t.phase==="running"?{...t,phase:"done",remaining:0,endsAt:0}:t);},[tick,timer.phase,timer.endsAt]);

  const timerRemaining=timer.phase==="running"?Math.max(0,timer.endsAt-Date.now()):timer.remaining;
  const timerElapsed=Math.max(0,timer.target-timerRemaining);
  const timerProgress=timer.target?Math.min(1,timerElapsed/timer.target):0;
  const timerTargetMin=Math.round(timer.target/60000);
  const timerLogMin=Math.min(480,Math.max(5,Math.round(timerElapsed/60000/5)*5));
  const showTimerUI=timer.phase!=="idle";

  const openTimerSetup=()=>{setCustomMin("");setTimer({phase:"setup",target:0,endsAt:0,remaining:0});};
  const cancelTimer=()=>setTimer({phase:"idle",target:0,endsAt:0,remaining:0});
  const startCountdown=mins=>{const ms=Math.min(480,Math.max(1,Math.round(mins)))*60000;setTimer({phase:"running",target:ms,endsAt:Date.now()+ms,remaining:ms});};
  const pauseCountdown=()=>setTimer(t=>({...t,phase:"paused",remaining:Math.max(0,t.endsAt-Date.now()),endsAt:0}));
  const resumeCountdown=()=>setTimer(t=>({...t,phase:"running",endsAt:Date.now()+t.remaining}));
  const logCountdown=()=>{setTimer(t=>({...t,phase:t.phase==="running"?"paused":t.phase,remaining:timerRemaining,endsAt:0}));setSheet({form:{...newForm(),duration:timerLogMin},editing:false,id:null,fromTimer:true});};

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
  const recent=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));

  const activeProjects=projects.filter(p=>!["done","released"].includes(p.status||"active"));
  const doneProjects=projects.filter(p=>p.status==="done");
  const releasedProjects=projects.filter(p=>p.status==="released");

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

  const addProject=async()=>{
    const name=newProject.trim();if(!name||projects.find(p=>p.name===name))return;
    const next=[...projects,{name,notes:"",status:"active"}];
    setProjects(next);await persistProjects(next);setNewProject("");
  };
  const updateProjectStatus=async(name,status)=>{
    const next=projects.map(p=>p.name===name?{...p,status}:p);
    setProjects(next);await persistProjects(next);
    if(status==="released"){flash("🚀 Project released!");checkMilestones(sessions,next,currentStreak,unlockedMilestones);}
    else if(status==="done")flash("✓ Project marked as done");
  };
  const restoreProject=async name=>updateProjectStatus(name,"active");
  const removeProject=async name=>{const next=projects.filter(p=>p.name!==name);setProjects(next);await persistProjects(next);};
  const saveNotes=async(name,notes)=>{const next=projects.map(p=>p.name===name?{...p,notes}:p);setProjects(next);await persistProjects(next);};

  const saveGoal=async v=>{setGoalHours(v);await persistGoal(v);setGoalEditOpen(false);};
  const saveGlobalFolder=async v=>{setGlobalAudioFolder(v);try{await storage.set("music_global_audio_folder",v);}catch{}};

  const renameProject=async(oldName,newName)=>{
    if(!newName||newName===oldName||projects.find(p=>p.name===newName))return;
    // Update projects list
    const nextProjects=projects.map(p=>p.name===oldName?{...p,name:newName}:p);
    setProjects(nextProjects);await persistProjects(nextProjects);
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
    // Keep panel open with new name
    setNotesModal(newName);
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

  const StatusDropdown=({name,status})=>{
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
        <button onClick={()=>setOpen(o=>!o)} style={{
          fontSize:12,fontWeight:700,color:dot,background:`${dot}1a`,
          border:`1.5px solid ${dot}55`,borderRadius:20,padding:"4px 11px",
          cursor:"pointer",whiteSpace:"nowrap",fontFamily:"var(--font-sans)",lineHeight:1.4,
        }}>{cfg.label}</button>
        {open&&(
          <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:30,
            background:C.surf,border:`1px solid ${C.lineS}`,borderRadius:14,padding:5,
            minWidth:140,boxShadow:`0 8px 24px -6px rgba(0,0,0,0.35)`}}>
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
          </div>
        )}
      </div>
    );
  };

  const ProjectRow=({p,showRestore=false})=>(
    <div style={{background:C.surf2,borderRadius:14,padding:"12px 15px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
          <div style={{fontSize:11.5,color:C.faint,marginTop:2,display:"flex",alignItems:"center",gap:8}}>
            <span>{projectCounts[p.name]?`${projectCounts[p.name]} session${projectCounts[p.name]>1?"s":""}`:  "no sessions yet"}</span>
            {(audioFileCounts[p.name]||0)>0&&(
              <span style={{display:"flex",alignItems:"center",gap:3,color:C.dim}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M2 13h4l2-9 4 18 3-12 2 5 3-2h2" stroke={C.dim} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {audioFileCounts[p.name]}
              </span>
            )}
          </div>
        </div>
        {!showRestore&&<StatusDropdown name={p.name} status={p.status||"active"}/>}
        <button onClick={()=>setNotesModal(p.name)} style={{...iconBtn,width:"auto",padding:"0 10px",gap:5,display:"flex"}}>
          {Icon.note(C.indigo)}<span style={{fontSize:11.5,fontWeight:600,color:C.indigo}}>Open</span>
        </button>
        {showRestore
          ?<button onClick={()=>restoreProject(p.name)} style={{fontSize:11.5,fontWeight:600,color:C.indigo,background:C.accentAlpha,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>Restore</button>
          :<button onClick={()=>removeProject(p.name)} style={iconBtn}>{Icon.trash()}</button>
        }
      </div>
    </div>
  );

  return (
    <ThemeCtx.Provider value={C}>
    <div className="app" style={{background:C.bg}}>

      {notesModal&&<ProjectPanel name={notesModal} notes={projectMap[notesModal]?.notes||""} onSave={n=>saveNotes(notesModal,n)} onClose={()=>setNotesModal(null)} globalAudioFolder={globalAudioFolder} onRename={renameProject}/>}
      {allOpen&&<AllSessions sessions={recent} projects={projects} projectMap={projectMap} onEdit={s=>startEdit(s)} onDelete={deleteSession} onClose={()=>setAllOpen(false)}/>}
      {sheet&&<LogSheet initial={sheet.form} editing={sheet.editing} projects={projects} onSubmit={form=>commitSession(form,sheet.id,sheet.fromTimer)} onDelete={()=>deleteSession(sheet.id)} onClose={()=>setSheet(null)}/>}
      {settingsOpen&&<SettingsSheet currentTheme={themeKey} onThemeChange={changeTheme} goalHours={goalHours} onGoalChange={saveGoal} onDownloadBackup={downloadBackup} onClose={()=>setSettingsOpen(false)} globalAudioFolder={globalAudioFolder} onGlobalFolderChange={saveGlobalFolder}/>}
      {goalEditOpen&&<GoalEditSheet goalHours={goalHours} onSave={saveGoal} onClose={()=>setGoalEditOpen(false)}/>}
      {toast&&<div className="toast">{toast}</div>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 2px 4px"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icon-transparent.svg" alt="" style={{width:46,height:46,flexShrink:0}} />
            <div style={{fontSize:25,fontWeight:700,letterSpacing:"-0.02em",color:C.text}}>Orbit</div>
          </div>
          <div style={{fontSize:13,color:C.faint,marginTop:4,paddingLeft:44}}>Keep the habit. One session at a time.</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{...eyebrow,color:timer.phase==="done"?C.greenS:timer.phase==="running"?C.indigo:C.muted,display:"flex",alignItems:"center",gap:8}}>
                <span className={timer.phase==="running"?"pulse-dot":""} style={{width:9,height:9,borderRadius:"50%",background:timer.phase==="done"?C.green:timer.phase==="running"?C.indigo:C.dim,boxShadow:timer.phase==="running"?`0 0 10px ${C.indigo}`:"none"}}/>
                {timer.phase==="done"?"Time's up":timer.phase==="running"?"Focusing":"Paused"} · {timerTargetMin}m
              </span>
              <button onClick={cancelTimer} style={{fontSize:12.5,fontWeight:600,color:C.faint,background:"transparent",border:"none",cursor:"pointer"}}>Discard</button>
            </div>
            <div className="mono" style={{fontSize:50,fontWeight:700,letterSpacing:"-0.02em",margin:"10px 0 12px",color:timer.phase==="done"?C.greenS:C.text}}>{fmtClock(timerRemaining)}</div>
            <div style={{height:5,borderRadius:5,background:"rgba(255,255,255,0.08)",overflow:"hidden",marginBottom:16}}>
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
          </>
        )}
      </div>

      {/* Week strip */}
      <div className="card" style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
          <span style={eyebrow}>This week</span>
          <span style={{fontSize:12.5,color:C.faint}}>{weekLogged} of 7 logged</span>
        </div>
        <div style={{display:"flex",gap:7}}>
          {weekStrip.map((d,i)=>(
            <button key={d.ds} onClick={()=>setSheet({form:newForm(d.ds),editing:false,id:null})} style={{flex:1,textAlign:"center",background:"transparent",border:"none",cursor:"pointer",padding:0}}>
              <div style={{fontSize:11,color:C.dim,marginBottom:7}}>{DAYS_MON[i]}</div>
              <div style={{aspectRatio:"1",borderRadius:12,display:"grid",placeItems:"center",fontSize:14,fontWeight:600,background:d.logged?C.accentGrad:d.isToday?C.accentAlpha:C.surf2,border:d.isToday&&!d.logged?`1.5px solid ${C.indigo}`:"1.5px solid transparent",color:d.logged?"#fff":d.isToday?C.indigo:C.dim,opacity:d.future?0.45:1}}>{d.logged?"✓":d.dn}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="card" style={{...card,display:"flex",padding:"18px 8px"}}>
        {[[totalSessions,"sessions"],[(tMins/60).toFixed(1)+"h","total"],[avgMins+"m","avg"],[bestDay,"best day"]].map(([v,k],i)=>(
          <div key={k} style={{flex:1,textAlign:"center",borderRight:i<3?`1px solid ${C.line}`:"none"}}>
            <div style={{fontSize:21,fontWeight:700,letterSpacing:"-0.01em",color:C.text}}>{v}</div>
            <div style={{fontSize:11,color:C.faint,marginTop:3}}>{k}</div>
          </div>
        ))}
      </div>

      {/* Weekly goal */}
      <WeeklyGoalCard sessions={sessions} goalHours={goalHours} onEditGoal={()=>setGoalEditOpen(true)}/>

      {/* Analytics */}
      <AnalyticsCard sessions={sessions}/>

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
          {calCells.map((ds,i)=>{
            if(!ds)return<div key={i}/>;
            const isPast=ds<today,isToday=ds===today,hasSess=!!sessionsByDate[ds],missed=isPast&&!hasSess;
            return(
              <button key={ds} onClick={()=>setSheet({form:newForm(ds),editing:false,id:null})} style={{aspectRatio:"1",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,cursor:"pointer",padding:0,background:isToday?C.accentAlpha:hasSess?C.accentAlpha2:"transparent",border:isToday?`1.5px solid ${C.indigo}`:"1.5px solid transparent"}}>
                <span style={{fontSize:12.5,color:isToday?C.indigo:hasSess?C.text:C.faint,fontWeight:hasSess?600:400}}>{Number(ds.slice(8))}</span>
                {hasSess?<span style={{width:5,height:5,borderRadius:"50%",background:C.green}}/>:missed?<span style={{width:5,height:5,borderRadius:"50%",background:C.surf2}}/>:<span style={{height:5}}/>}
              </button>
            );
          })}
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
        <div style={{display:"flex",gap:8,marginBottom:activeProjects.length?16:0}}>
          <input type="text" className="mt-text" value={newProject} placeholder="Track or project name…"
            onChange={e=>setNewProject(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()} style={{flex:1}}/>
          <button onClick={addProject} disabled={!newProject.trim()} style={{border:"none",borderRadius:12,color:"#fff",padding:"0 18px",fontSize:14,fontWeight:600,cursor:"pointer",background:C.accentGrad,opacity:newProject.trim()?1:0.4,whiteSpace:"nowrap"}}>Add</button>
        </div>
        {activeProjects.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {activeProjects.map(p=><ProjectRow key={p.name} p={p}/>)}
          </div>
        )}

        {/* Done section */}
        {doneProjects.length>0&&(
          <div style={{marginTop:14}}>
            <button onClick={()=>setShowDone(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:showDone?10:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{transform:showDone?"rotate(90deg)":"none",transition:"transform .2s"}}><path d="M9 6l6 6-6 6" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{fontSize:12,fontWeight:600,color:C.faint}}>Done ({doneProjects.length})</span>
            </button>
            {showDone&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{doneProjects.map(p=><ProjectRow key={p.name} p={p} showRestore/>)}</div>}
          </div>
        )}

        {/* Released / Archive section */}
        {releasedProjects.length>0&&(
          <div style={{marginTop:14}}>
            <button onClick={()=>setShowReleased(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:showReleased?10:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{transform:showReleased?"rotate(90deg)":"none",transition:"transform .2s"}}><path d="M9 6l6 6-6 6" stroke={C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{fontSize:12,fontWeight:600,color:C.faint}}>Released / Archive ({releasedProjects.length})</span>
            </button>
            {showReleased&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{releasedProjects.map(p=><ProjectRow key={p.name} p={p} showRestore/>)}</div>}
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
