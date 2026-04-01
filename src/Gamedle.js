import { useState, useEffect } from "react";
import { fetchDailyGame, checkProxy } from "./igdb";
import { saveScore, getLeaderboard, getStreak, updateStreak, getStreakLeaderboard } from "./supabase";
import { useUser } from "./UserContext";
import GameBoard from "./GameBoard";

const SPIN_CSS = `@keyframes spin { to { transform:rotate(360deg); } }`;

const DAILY_MOCK = {
  id:9999, title:"Portal 2",
  cover:"https://images.igdb.com/igdb/image/upload/t_cover_big/co1x7d.jpg",
  year:2011, genre:"Puzzle", studio:"Valve",
  hints:["This is a Puzzle game.","It was first released in 2011.","It was developed by Valve.","this game is a first-person co-operative puzzle-platform game."],
  aliases:["portal 2","portal2","portal"],
};

const PLAYED_KEY = "ggg_gamedle_played";
const today = () => new Date().toISOString().slice(0, 10);
const hasPlayedToday = () => { try { return localStorage.getItem(PLAYED_KEY) === today(); } catch { return false; } };
const markPlayed = () => localStorage.setItem(PLAYED_KEY, today());

// ── Leaderboard table ──────────────────────────────────────────────────────────
function LBTable({ rows, cols, accent = "#f0c030" }) {
  if (!rows?.length) return <p style={{ color:"#3a3a5a", fontSize:12, textAlign:"center", padding:"10px 0" }}>No scores yet — be first!</p>;
  const medals = ["🥇","🥈","🥉"];
  return (
    <div style={{ background:"#0a0a14", borderRadius:10, overflow:"hidden" }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderBottom: i<rows.length-1?"1px solid #111120":"none", fontSize:12 }}>
          <span style={{ color: i<3?["#f0c030","#c0c0c0","#cd7f32"][i]:"#4a4a6a", minWidth:28 }}>{medals[i]||`${i+1}.`}</span>
          <span style={{ flex:1, color:"#c0c0e0", fontWeight: i===0?700:400 }}>{r.username}</span>
          {cols.map(({ key, label, fmt }) => (
            <span key={key} style={{ color: i===0?accent:"#6b6b8a", fontWeight: i===0?700:400, marginLeft:12, textAlign:"right" }}>
              {fmt ? fmt(r[key]) : r[key]}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Gamedle({ onBack }) {
  const { userId, username } = useUser();
  const [game,       setGame]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [mods,       setMods]       = useState({ hard:false, grayscale:false, flipped:false });
  const [score,      setScore]      = useState(null);
  const [result,     setResult]     = useState(null);
  const [streak,     setStreak]     = useState({ streak:0, best_streak:0 });
  const [dailyLB,    setDailyLB]    = useState([]);
  const [streakLB,   setStreakLB]   = useState([]);
  const [lbTab,      setLbTab]      = useState("daily");
  const [usingMock,  setUsingMock]  = useState(false);
  const alreadyPlayed = hasPlayedToday();

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Load game
      const proxy = await checkProxy();
      try {
        if (proxy.ok) setGame(await fetchDailyGame());
        else { setGame(DAILY_MOCK); setUsingMock(true); }
      } catch { setGame(DAILY_MOCK); setUsingMock(true); }
      // Load streak + leaderboards in parallel
      const [sk, dlb, slb] = await Promise.all([
        getStreak(userId),
        getLeaderboard({ mode:"gamedle", date:today(), limit:10 }),
        getStreakLeaderboard(10),
      ]);
      setStreak(sk);
      setDailyLB(dlb);
      setStreakLB(slb);
      setLoading(false);
    })();
  }, [userId]);

  function calcScore(att) {
    let base = Math.max(100, 1000 - att * 200);
    if (mods.hard)      base = Math.round(base * 1.5);
    if (mods.grayscale) base = Math.round(base * 1.25);
    if (mods.flipped)   base = Math.round(base * 1.25);
    return base;
  }

  async function handleWin(att) {
    const s = calcScore(att);
    setScore(s); setResult("won"); markPlayed();
    const [newStreak] = await Promise.all([
      updateStreak(userId, username, true),
      saveScore({ userId, username, mode:"gamedle", score:s, difficulty: mods.hard?"hard":"normal" }),
    ]);
    setStreak(newStreak);
    // Refresh leaderboards
    const [dlb, slb] = await Promise.all([
      getLeaderboard({ mode:"gamedle", date:today(), limit:10 }),
      getStreakLeaderboard(10),
    ]);
    setDailyLB(dlb); setStreakLB(slb);
  }

  async function handleLose() {
    setResult("lost"); setScore(0); markPlayed();
    const newStreak = await updateStreak(userId, username, false);
    setStreak(newStreak);
  }

  const modBonus = [mods.hard&&"+50%", mods.grayscale&&"+25%", mods.flipped&&"+25%"].filter(Boolean);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:300, gap:12 }}>
      <style>{SPIN_CSS}</style>
      <div style={{ width:28, height:28, border:"3px solid #1e1e30", borderTopColor:"#f0c030", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
      <p style={{ color:"#6b6b8a", fontSize:13, margin:0 }}>Loading today's game…</p>
    </div>
  );

  return (
    <div style={{ maxWidth:520, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, padding:"14px 16px", background:"rgba(240,192,48,.06)", borderRadius:14, border:"1px solid rgba(240,192,48,.15)" }}>
        <div>
          <div style={{ fontSize:10, color:"#8a7030", letterSpacing:".1em" }}>{today()}{usingMock?" · MOCK":""}</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#f0c030", letterSpacing:"-0.5px" }}>GAMEDLE</div>
          <div style={{ fontSize:11, color:"#8a7030" }}>One game · same for everyone</div>
        </div>
        <div style={{ display:"flex", gap:20 }}>
          {[["STREAK",`${streak.streak}🔥`],["BEST",`${streak.best_streak}⭐`]].map(([l,v])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#5a5020", letterSpacing:".1em", fontWeight:700 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#f0c030" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modifiers */}
      {!alreadyPlayed && !result && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em", marginBottom:8 }}>MODIFIERS — toggle for bonus points</div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { key:"hard",      icon:"💀", label:"Hard",      desc:"3 hints · 4 attempts", bonus:"+50%" },
              { key:"grayscale", icon:"⬛", label:"Grayscale", desc:"B&W cover",             bonus:"+25%" },
              { key:"flipped",   icon:"🔄", label:"Flipped",   desc:"Mirror image",          bonus:"+25%" },
            ].map(({ key, icon, label, desc, bonus }) => (
              <button key={key} onClick={()=>setMods(m=>({...m,[key]:!m[key]}))} style={{ flex:1, padding:"10px 8px", borderRadius:12, border:mods[key]?"2px solid #f0c030":"1px solid #2a2a40", background:mods[key]?"rgba(240,192,48,.1)":"#111120", color:mods[key]?"#f0c030":"#6b6b8a", cursor:"pointer", textAlign:"center", transition:"all .2s" }}>
                <div style={{ fontSize:16, marginBottom:2 }}>{icon}</div>
                <div style={{ fontSize:11, fontWeight:700 }}>{label}</div>
                <div style={{ fontSize:10, opacity:.7 }}>{desc}</div>
                <div style={{ fontSize:10, color:mods[key]?"#f0c030":"#4a4a6a", fontWeight:600, marginTop:2 }}>{bonus}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Score banner */}
      {score !== null && (
        <div style={{ padding:"12px 16px", borderRadius:12, background:result==="won"?"rgba(80,200,120,.08)":"rgba(220,80,80,.08)", border:`1px solid ${result==="won"?"rgba(80,200,120,.2)":"rgba(220,80,80,.2)"}`, marginBottom:14, textAlign:"center" }}>
          {result === "won"
            ? <><div style={{ fontSize:10, color:"#4a7040", letterSpacing:".1em" }}>TODAY'S SCORE</div><div style={{ fontSize:28, fontWeight:700, color:"#6fe0a0" }}>{score.toLocaleString()}</div></>
            : <div style={{ fontSize:14, color:"#e07070", fontWeight:600 }}>Come back tomorrow!</div>}
          {modBonus.length > 0 && result==="won" && <div style={{ fontSize:11, color:"#4a7040", marginTop:2 }}>{modBonus.join(" · ")} applied</div>}
        </div>
      )}

      {/* Game board or lock */}
      {alreadyPlayed && !result
        ? <div style={{ textAlign:"center", padding:"28px 0", color:"#3a3a5a", fontSize:14 }}>🔒 Come back tomorrow for a new game!</div>
        : game && (
          <GameBoard
            game={game}
            blurStart={mods.hard?32:22} blurStep={mods.hard?9:6} blurMin={5}
            grayscale={mods.grayscale||mods.hard} flipped={mods.flipped}
            freeHints={0} maxAttempts={mods.hard?4:undefined} maxHints={mods.hard?3:undefined}
            onWin={handleWin} onLose={handleLose}
            onReadyForNext={onBack} nextLabel="Back to menu →"
          />
        )
      }

      {/* Leaderboards */}
      <div style={{ marginTop:24 }}>
        <div style={{ display:"flex", gap:4, background:"#0a0a14", borderRadius:10, padding:3, marginBottom:12 }}>
          {[["daily","📅 Today"],["streak","🔥 Streaks"]].map(([t,l])=>(
            <button key={t} onClick={()=>setLbTab(t)} style={{ flex:1, padding:"7px", borderRadius:8, border:"none", background:lbTab===t?"rgba(240,192,48,.15)":"transparent", color:lbTab===t?"#f0c030":"#4a4a6a", cursor:"pointer", fontSize:12, fontWeight:lbTab===t?700:400, transition:"all .2s" }}>{l}</button>
          ))}
        </div>
        {lbTab === "daily"
          ? <LBTable rows={dailyLB} cols={[{ key:"score", fmt:v=>v.toLocaleString()+"pts" }]} />
          : <LBTable rows={streakLB} cols={[{ key:"streak", fmt:v=>`${v}🔥` },{ key:"best_streak", fmt:v=>`${v}⭐` }]} />
        }
      </div>
    </div>
  );
}
