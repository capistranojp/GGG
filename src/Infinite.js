import { useState, useEffect, useRef, useCallback } from "react";
import { fetchGames, CATEGORIES } from "./igdb";
import { startBG, startSpeedrunBG, stopSpeedrunBG } from "./sounds";
import { saveScore, getLeaderboard, getPersonalBest } from "./supabase";
import { useUser } from "./UserContext";
import GameBoard from "./GameBoard";

const SPIN_CSS = `@keyframes spin { to { transform:rotate(360deg); } }`;
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

const MOCK_GAMES = [
  { id:1,title:"The Witcher 3: Wild Hunt",cover:"https://images.igdb.com/igdb/image/upload/t_cover_big/co1rcb.jpg",year:2015,genre:"RPG",studio:"CD Projekt Red",hints:["This is a RPG game.","It was first released in 2015.","It was developed by CD Projekt Red.","this game is an action role-playing game."],aliases:["witcher 3","the witcher 3","witcher"] },
  { id:2,title:"God of War",cover:"https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg",year:2018,genre:"Action-Adventure",studio:"Santa Monica Studio",hints:["This is an Action-Adventure game.","It was first released in 2018.","It was developed by Santa Monica Studio.","this game is set in Norse mythology."],aliases:["god of war 2018","gow"] },
  { id:3,title:"Elden Ring",cover:"https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",year:2022,genre:"Action RPG",studio:"FromSoftware",hints:["This is an Action RPG game.","It was first released in 2022.","It was developed by FromSoftware.","this game is set in the Lands Between."],aliases:["elden ring","eldenring"] },
  { id:4,title:"Minecraft",cover:"https://images.igdb.com/igdb/image/upload/t_cover_big/co49x5.jpg",year:2011,genre:"Sandbox",studio:"Mojang Studios",hints:["This is a Sandbox game.","It was first released in 2011.","It was developed by Mojang Studios.","this game is one of the best-selling games ever."],aliases:["mine craft","mc"] },
  { id:5,title:"Hades",cover:"https://images.igdb.com/igdb/image/upload/t_cover_big/co2xt6.jpg",year:2020,genre:"Roguelike",studio:"Supergiant Games",hints:["This is a Roguelike game.","It was first released in 2020.","It was developed by Supergiant Games.","this game is set in the Greek underworld."],aliases:["hades"] },
  { id:6,title:"Portal 2",cover:"https://images.igdb.com/igdb/image/upload/t_cover_big/co1x7d.jpg",year:2011,genre:"Puzzle",studio:"Valve",hints:["This is a Puzzle game.","It was first released in 2011.","It was developed by Valve.","this game is a first-person puzzle-platform game."],aliases:["portal 2","portal2","portal"] },
];

// More forgiving blur — reduced starting blur and min floor
const DIFF_CFG = {
  easy:   { label:"Easy",   emoji:"🟢", blurStart:8,  blurStep:3, blurMin:0, grayscale:false, freeHints:0, scoreMult:0.75, minRatings:100 },
  medium: { label:"Medium", emoji:"🟡", blurStart:14, blurStep:4, blurMin:0, grayscale:false, freeHints:0, scoreMult:1.0,  minRatings:20  },
  hard:   { label:"Hard",   emoji:"🔴", blurStart:22, blurStep:6, blurMin:3, grayscale:true,  freeHints:1, scoreMult:1.5,  minRatings:5   },
};

// Speedrun: score = games * difficulty_multiplier * 100
// Hard games → more points, so hard is always ranked higher for same game count
const SR_DIFF_MULT = { easy: 1, medium: 1.5, hard: 2 };

const SR_POOLS = [
  { label:"Top 10",  value:10,  minRatings:3000, desc:"Very famous" },
  { label:"Top 50",  value:50,  minRatings:800,  desc:"Well-known"  },
  { label:"Top 100", value:100, minRatings:400,  desc:"Popular"     },
  { label:"Top 250", value:250, minRatings:150,  desc:"Niche"       },
];

const SR_TIMES = [
  { label:"30s",   value:30  },
  { label:"1 min", value:60  },
  { label:"2 min", value:120 },
  { label:"5 min", value:300 },
];

// ── Scrollable leaderboard ─────────────────────────────────────────────────────
function LBTable({ rows, accent = "#7c6af6", valueFmt, myUsername, personalBest, pbLabel }) {
  const medals  = ["🥇","🥈","🥉"];
  const myIdx   = rows.findIndex(r => r.username === myUsername);
  return (
    <div style={{ border:"1px solid #1e1e2e", borderRadius:12, overflow:"hidden" }}>
      <div style={{ maxHeight:220, overflowY:"auto" }}>
        {!rows?.length
          ? <p style={{ color:"#3a3a5a", fontSize:12, textAlign:"center", padding:"14px 0", margin:0 }}>No scores yet — be first!</p>
          : rows.map((r, i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 12px",
              borderBottom:i<rows.length-1?"1px solid #111120":"none",
              background:r.username===myUsername?"rgba(124,106,246,.06)":"transparent", fontSize:12 }}>
              <span style={{ color:i<3?["#f0c030","#c0c0c0","#cd7f32"][i]:"#3a3a5a", minWidth:22, flexShrink:0 }}>{medals[i]||`${i+1}.`}</span>
              <span style={{ flex:1, color:r.username===myUsername?accent:"#c0c0e0", fontWeight:r.username===myUsername?700:400 }}>
                {r.username}{r.username===myUsername?" (you)":""}
              </span>
              <span style={{ color:i===0?accent:"#6b6b8a", fontWeight:i===0?700:400, flexShrink:0 }}>
                {valueFmt?valueFmt(r):r.score.toLocaleString()}
              </span>
            </div>
          ))
        }
      </div>
      {/* User not in top 10 */}
      {myIdx === -1 && myUsername && personalBest && (
        <div style={{ borderTop:"1px solid #1e1e2e", padding:"7px 12px", fontSize:12, display:"flex", justifyContent:"space-between", background:"rgba(124,106,246,.04)" }}>
          <span style={{ color:"#4a4a6a" }}>Your best</span>
          <span style={{ color:accent, fontWeight:600 }}>{pbLabel||personalBest.score.toLocaleString()}</span>
        </div>
      )}
      {myIdx === -1 && myUsername && !personalBest && (
        <div style={{ borderTop:"1px solid #1e1e2e", padding:"6px 12px", fontSize:11, color:"#3a3a5a", textAlign:"center" }}>
          You are not in the top 10 yet
        </div>
      )}
    </div>
  );
}

export default function Infinite({ onBack, defaultTab = "normal" }) {
  const { userId, username } = useUser();
  const [tab,       setTab]       = useState(defaultTab);
  const [diff,      setDiff]      = useState("medium");
  const [category,  setCategory]  = useState("random");
  const [srTime,    setSrTime]    = useState(60);
  const [srPool,    setSrPool]    = useState(50);
  const [phase,     setPhase]     = useState("setup");
  const [queue,     setQueue]     = useState([]);
  const [idx,       setIdx]       = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [score,     setScore]     = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [best,      setBest]      = useState(0);
  const [seenIds,   setSeenIds]   = useState(new Set());
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [srCorrect, setSrCorrect] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [personalBest, setPersonalBest] = useState(null);
  const timerRef     = useRef(null);
  const srCorrectRef = useRef(0);
  const cfg  = DIFF_CFG[diff];
  const game = queue[idx];

  const loadLeaderboard = useCallback(async () => {
    const params = tab === "speedrun"
      ? { mode:"speedrun", timeLimit:srTime }
      : { mode:"infinite", difficulty:diff };
    const [lb, pb] = await Promise.all([
      getLeaderboard({ ...params, limit:10 }),
      getPersonalBest(userId, tab==="speedrun"?"speedrun":"infinite", tab==="speedrun"?{ timeLimit:srTime }:{ difficulty:diff }),
    ]);
    setLeaderboard(lb); setPersonalBest(pb);
  }, [tab, diff, srTime, userId]);

  useEffect(() => { if (phase === "setup") loadLeaderboard(); }, [phase, loadLeaderboard]);

  const loadGames = useCallback(async (d, cat, seen, minRat) => {
    setLoading(true);
    try {
      const games = await fetchGames(30, d, [...seen], cat, minRat ?? null);
      const ns = new Set(seen);
      games.forEach(g => ns.add(g.id));
      setSeenIds(ns);
      setQueue(prev => phase === "setup" ? shuffle(games) : [...prev.slice(0, idx + 1), ...shuffle(games)]);
      setUsingMock(false);
      setLoading(false);
    } catch (err) {
      console.warn("[Infinite] IGDB fetch failed, using mock:", err.message);
      setUsingMock(true);
      setQueue(shuffle(MOCK_GAMES));
      setLoading(false);
    }
  }, [phase, idx]);

  // Start BG on mount (safe no-op if already playing from menu)
  useEffect(() => { startBG(); }, []);

  function startGame() {
    const seen = new Set();
    setScore(0); setStreak(0); setBest(0); setIdx(0); setSeenIds(seen); setPhase("playing");
    if (tab === "speedrun") {
      setSrCorrect(0); srCorrectRef.current = 0; setTimeLeft(srTime);
      startSpeedrunBG(); // ramp up tempo
    } else {
      startBG(); // ensure normal tempo
    }
    const poolCfg = SR_POOLS.find(p => p.value === srPool);
    loadGames(diff, category, seen, tab === "speedrun" ? poolCfg?.minRatings : null);
  }

  // Speedrun countdown
  useEffect(() => {
    if (tab !== "speedrun" || phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          stopSpeedrunBG(); // reset tempo to normal
          const final = srCorrectRef.current;
          const mult  = SR_DIFF_MULT[diff] ?? 1;
          const finalScore = Math.round(final * mult * 100);
          setPhase("done");
          saveScore({ userId, username, mode:"speedrun", score:finalScore, difficulty:diff, gamesCorrect:final, timeLimit:srTime });
          loadLeaderboard();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, tab]); // eslint-disable-line

  // Background refresh every 5 min
  useEffect(() => {
    if (phase !== "playing" || tab !== "normal" || usingMock) return;
    let lastSlot = Math.floor(Date.now() / (3 * 60 * 1000));
    const t = setInterval(() => {
      const slot = Math.floor(Date.now() / (3 * 60 * 1000));
      if (slot === lastSlot) return;
      lastSlot = slot;
      // New time-slot started — silently pre-warm the cache for the new batch.
      // The queue is NOT replaced mid-game; new games appear when the user
      // exhausts the current batch and handleNext calls loadGames.
      fetchGames(30, diff, [], category).catch(() => {});
    }, 30_000); // poll every 30 s
    return () => clearInterval(t);
  }, [phase, tab, usingMock, diff, category]); // eslint-disable-line

  function calcScore(att) {
    const base = Math.max(100, 1000 - att * 150);
    const sm = streak >= 10 ? 3 : streak >= 5 ? 2 : streak >= 3 ? 1.5 : 1;
    return Math.round(base * cfg.scoreMult * sm);
  }

  function handleWin(att, isCheat) {
    if (isCheat) return; // don't record cheat games
    const pts = calcScore(att);
    setScore(s => s + pts);
    const ns = streak + 1; setStreak(ns); setBest(b => Math.max(b, ns));
    if (tab === "speedrun") { setSrCorrect(c => c + 1); srCorrectRef.current += 1; }
  }

  function handleLose() { setStreak(0); }

  async function handleEndSession() {
    stopSpeedrunBG(); // always safe — resets ramp and tempo if in speedrun
    if (tab === "normal" && score > 0) {
      await saveScore({ userId, username, mode:"infinite", score, difficulty:diff, category, gamesCorrect:idx+1 });
      await loadLeaderboard();
    }
    onBack();
  }

  function handleNext() {
    const ni = idx + 1;
    if (ni >= queue.length) loadGames(diff, category, seenIds, null);
    else setIdx(ni);
  }

  // ── Setup ─────────────────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div style={{ maxWidth:520, margin:"0 auto" }}>
      <div style={{ display:"flex", gap:4, background:"#0e0e1c", borderRadius:12, padding:4, marginBottom:20 }}>
        {[["normal","♾️ Infinite"],["speedrun","⚡ Speedrun"]].map(([m,l])=>(
          <button key={m} onClick={()=>setTab(m)} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:tab===m?"linear-gradient(135deg,#7c6af6,#9b87f8)":"transparent", color:tab===m?"#fff":"#6b6b8a", cursor:"pointer", fontWeight:tab===m?700:400, fontSize:13 }}>{l}</button>
        ))}
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em", marginBottom:8 }}>DIFFICULTY</div>
        <div style={{ display:"flex", gap:8 }}>
          {Object.entries(DIFF_CFG).map(([k,v])=>(
            <button key={k} onClick={()=>setDiff(k)} style={{ flex:1, padding:"10px 8px", borderRadius:10, border:diff===k?"2px solid #7c6af6":"1px solid #2a2a40", background:diff===k?"rgba(124,106,246,.12)":"#111120", color:diff===k?"#a99ef8":"#6b6b8a", cursor:"pointer", fontSize:12, fontWeight:diff===k?700:400, textAlign:"center" }}>
              <div>{v.emoji}</div><div style={{ marginTop:2 }}>{v.label}</div>
            </button>
          ))}
        </div>
      </div>

      {tab === "normal" && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em", marginBottom:8 }}>CATEGORY</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {Object.entries(CATEGORIES).map(([k,v])=>(
              <button key={k} onClick={()=>setCategory(k)} style={{ padding:"5px 11px", borderRadius:20, border:category===k?"1.5px solid #7c6af6":"1px solid #2a2a40", background:category===k?"rgba(124,106,246,.12)":"#111120", color:category===k?"#a99ef8":"#5a5a7a", cursor:"pointer", fontSize:12, fontWeight:category===k?600:400 }}>{v.label}</button>
            ))}
          </div>
        </div>
      )}

      {tab === "speedrun" && (
        <>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em", marginBottom:8 }}>TIME LIMIT</div>
            <div style={{ display:"flex", gap:8 }}>
              {SR_TIMES.map(t=>(
                <button key={t.value} onClick={()=>setSrTime(t.value)} style={{ flex:1, padding:"10px 6px", borderRadius:10, border:srTime===t.value?"2px solid #e07030":"1px solid #2a2a40", background:srTime===t.value?"rgba(224,112,48,.12)":"#111120", color:srTime===t.value?"#e09070":"#6b6b8a", cursor:"pointer", fontSize:13, fontWeight:srTime===t.value?700:400 }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em", marginBottom:8 }}>GAME POOL</div>
            <div style={{ display:"flex", gap:8 }}>
              {SR_POOLS.map(p=>(
                <button key={p.value} onClick={()=>setSrPool(p.value)} style={{ flex:1, padding:"10px 6px", borderRadius:10, border:srPool===p.value?"2px solid #e07030":"1px solid #2a2a40", background:srPool===p.value?"rgba(224,112,48,.12)":"#111120", color:srPool===p.value?"#e09070":"#6b6b8a", cursor:"pointer", fontSize:11, fontWeight:srPool===p.value?700:400, textAlign:"center" }}>
                  <div>{p.label}</div><div style={{ fontSize:9, opacity:.6, marginTop:1 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:10, padding:"8px 12px", borderRadius:8, background:"rgba(224,112,48,.06)", border:"1px solid rgba(224,112,48,.15)", fontSize:11, color:"#8a5030" }}>
            ⚡ Hard difficulty = 2× points · Medium = 1.5× · Easy = 1×
          </div>
        </>
      )}

      <LBTable
        rows={leaderboard} myUsername={username} personalBest={personalBest}
        accent={tab==="speedrun"?"#e09070":"#9b87f8"}
        valueFmt={tab==="speedrun"
          ? r=>`${r.games_correct} games (${r.difficulty})`
          : r=>r.score.toLocaleString()+" pts"}
        pbLabel={personalBest
          ? tab==="speedrun"
            ? `${personalBest.games_correct} games (${personalBest.difficulty})`
            : personalBest.score.toLocaleString()+" pts"
          : null}
      />

      <button onClick={startGame} style={{ width:"100%", padding:"14px", borderRadius:12, background:tab==="speedrun"?"linear-gradient(135deg,#e07030,#f09050)":"linear-gradient(135deg,#7c6af6,#9b87f8)", color:"#fff", border:"none", cursor:"pointer", fontWeight:700, fontSize:15, marginTop:16 }}>
        {tab === "speedrun" ? `⚡ Start ${srTime}s Speedrun →` : "♾️ Start Infinite →"}
      </button>
    </div>
  );

  // ── Speedrun done ─────────────────────────────────────────────────────────────
  if (phase === "done" && tab === "speedrun") {
    const finalScore = Math.round(srCorrect * (SR_DIFF_MULT[diff]??1) * 100);
    return (
      <div style={{ maxWidth:520, margin:"0 auto", textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:8 }}>⏱️</div>
        <h2 style={{ fontSize:26, fontWeight:800, color:"#f0f0fa", marginBottom:4 }}>Time's up!</h2>
        <p style={{ color:"#6b6b8a", fontSize:14, marginBottom:6 }}>
          You got <strong style={{ color:"#e09070" }}>{srCorrect}</strong> game{srCorrect!==1?"s":""} correct in {srTime}s
        </p>
        <p style={{ color:"#5a5a7a", fontSize:12, marginBottom:16 }}>
          {cfg.label} difficulty · {SR_DIFF_MULT[diff]}× multiplier
        </p>
        <div style={{ fontSize:36, fontWeight:800, color:"#e09070", marginBottom:20 }}>{finalScore.toLocaleString()} pts</div>
        <LBTable rows={leaderboard} myUsername={username} personalBest={personalBest} accent="#e09070"
          valueFmt={r=>`${r.games_correct} games (${r.difficulty})`}
          pbLabel={personalBest?`${personalBest.games_correct} games (${personalBest.difficulty})`:null}
        />
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button onClick={()=>setPhase("setup")} style={{ flex:1, padding:"12px", borderRadius:10, border:"1px solid #2a2a40", background:"#0e0e1c", color:"#8b8baa", cursor:"pointer", fontWeight:600 }}>⚙️ Settings</button>
          <button onClick={startGame} style={{ flex:1, padding:"12px", borderRadius:10, background:"linear-gradient(135deg,#e07030,#f09050)", color:"#fff", border:"none", cursor:"pointer", fontWeight:700 }}>Try Again ⚡</button>
        </div>
        <button onClick={onBack} style={{ width:"100%", padding:"10px", borderRadius:10, border:"none", background:"none", color:"#3a3a5a", cursor:"pointer", marginTop:8, fontSize:12 }}>← Back to menu</button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading || !game) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300, flexDirection:"column", gap:12 }}>
      <style>{SPIN_CSS}</style>
      <div style={{ width:28, height:28, border:"3px solid #1e1e30", borderTopColor:"#7c6af6", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
      <p style={{ color:"#6b6b8a", fontSize:13, margin:0 }}>Loading games…</p>
    </div>
  );

  // ── Playing ───────────────────────────────────────────────────────────────────
  const isLowTime = tab === "speedrun" && phase === "playing" && timeLeft <= 10 && timeLeft > 0;
  return (
    <div style={{ maxWidth:520, margin:"0 auto", position:"relative" }}>
      <style>{`
        @keyframes redFlash {
          0%,100% { opacity:0; }
          50%      { opacity:1; }
        }
      `}</style>
      {/* Red flash overlay — only during speedrun countdown ≤ 10 s */}
      {isLowTime && (
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:40,
          background:"rgba(220,50,50,.18)",
          animation:`redFlash ${timeLeft <= 5 ? ".4s" : ".8s"} ease-in-out infinite` }}/>
      )}
      <div style={{ display:"flex", gap:14, alignItems:"center", justifyContent:"space-between", marginBottom:14, background:"#0a0a18", borderRadius:12, padding:"10px 14px" }}>
        <div style={{ display:"flex", gap:14 }}>
          {[["SCORE",score.toLocaleString()],["STREAK",`${streak}🔥`],["BEST",`${best}⭐`],
            streak>=10?["MULT","3x⚡"]:streak>=5?["MULT","2x⚡"]:streak>=3?["MULT","1.5x⚡"]:null
          ].filter(Boolean).map(([l,v])=>(
            <div key={l}>
              <div style={{ fontSize:9, color:"#3a3a5a", fontWeight:700, letterSpacing:".1em" }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:700, color:"#c0c0e0" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {tab === "speedrun" && (
            <div style={{ fontSize:20, fontWeight:800, color:timeLeft<=10?"#e07070":"#f0f0fa", minWidth:52 }}>⏱ {timeLeft}s</div>
          )}
          <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:"rgba(124,106,246,.12)", color:"#a99ef8", fontWeight:600 }}>{cfg.emoji} {cfg.label}</span>
          {usingMock && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:"rgba(220,180,80,.1)", color:"#c0a040", fontWeight:600 }}>MOCK</span>}
        </div>
      </div>

      <GameBoard
        game={game}
        blurStart={cfg.blurStart} blurStep={cfg.blurStep} blurMin={cfg.blurMin}
        grayscale={cfg.grayscale} freeHints={cfg.freeHints}
        autoAdvance={tab==="speedrun"} onWin={handleWin} onLose={handleLose} onReadyForNext={handleNext}
      />

      {tab === "normal" && (
        <div style={{ textAlign:"center", marginTop:16 }}>
          <div style={{ fontSize:11, color:"#2a2a40", marginBottom:6 }}>
            Game {(idx%Math.max(queue.length,1))+1} of {queue.length} · {CATEGORIES[category]?.label??"Random"} · {usingMock?"Mock":"IGDB"}
          </div>
          <button onClick={handleEndSession} style={{ fontSize:12, color:"#4a4a6a", background:"none", border:"1px solid #1a1a28", borderRadius:8, padding:"5px 12px", cursor:"pointer" }}>
            🏁 End Session & Save Score
          </button>
        </div>
      )}
    </div>
  );
}
