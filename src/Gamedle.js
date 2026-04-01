/**
 * src/Gamedle.js — Daily challenge. One game per day, same for all users.
 */
import { useState, useEffect } from "react";
import { fetchDailyGame, checkProxy } from "./igdb";
import GameBoard from "./GameBoard";

const SPIN_CSS = `@keyframes spin { to { transform:rotate(360deg); } }`;

const DAILY_MOCK = {
  id: 9999, title: "Portal 2",
  cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1x7d.jpg",
  year: 2011, genre: "Puzzle", studio: "Valve",
  hints: ["This is a Puzzle game.","It was first released in 2011.","It was developed by Valve.","this game is a first-person co-operative puzzle-platform game."],
  aliases: ["portal 2","portal2","portal"],
};

const STREAK_KEY = "ggg_gamedle_streak";
const PLAYED_KEY = "ggg_gamedle_played";
const SCORE_KEY  = "ggg_gamedle_score";
const today      = () => new Date().toISOString().slice(0, 10);

function loadStreak() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { streak:0, best:0, lastWon:null }; }
  catch { return { streak:0, best:0, lastWon:null }; }
}
function saveStreak(won) {
  const d   = loadStreak();
  const t   = today();
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const ns   = won ? (d.lastWon === yest ? d.streak + 1 : 1) : 0;
  const upd  = { streak: ns, best: Math.max(d.best, ns), lastWon: won ? t : d.lastWon };
  localStorage.setItem(STREAK_KEY, JSON.stringify(upd));
  return upd;
}
function hasPlayedToday() {
  try { return localStorage.getItem(PLAYED_KEY) === today(); } catch { return false; }
}
function markPlayed() { localStorage.setItem(PLAYED_KEY, today()); }
function getTodayScore() {
  try {
    const s = JSON.parse(localStorage.getItem(SCORE_KEY));
    return s?.date === today() ? s : null;
  } catch { return null; }
}
function saveTodayScore(score, won, mods) {
  localStorage.setItem(SCORE_KEY, JSON.stringify({ date: today(), score, won, mods }));
}

export default function Gamedle({ onBack }) {
  const [game,       setGame]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [mods,       setMods]       = useState({ hard:false, grayscale:false, flipped:false });
  const [score,      setScore]      = useState(null);
  const [result,     setResult]     = useState(null); // null | "won" | "lost"
  const [streak,     setStreak]     = useState(loadStreak());
  const [usingMock,  setUsingMock]  = useState(false);
  const alreadyPlayed = hasPlayedToday();
  const todayScore    = getTodayScore();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const proxy = await checkProxy();
      try {
        if (proxy.ok) { setGame(await fetchDailyGame()); }
        else          { setGame(DAILY_MOCK); setUsingMock(true); }
      } catch { setGame(DAILY_MOCK); setUsingMock(true); }
      setLoading(false);
    })();
  }, []);

  function calcScore(att) {
    let base = Math.max(100, 1000 - att * 200);
    if (mods.hard)      base = Math.round(base * 1.5);
    if (mods.grayscale) base = Math.round(base * 1.25);
    if (mods.flipped)   base = Math.round(base * 1.25);
    return base;
  }

  function handleWin(att) {
    const s = calcScore(att);
    setScore(s); setResult("won");
    setStreak(saveStreak(true));
    saveTodayScore(s, true, mods);
    markPlayed();
  }

  function handleLose() {
    setResult("lost"); setScore(0);
    setStreak(saveStreak(false));
    saveTodayScore(0, false, mods);
    markPlayed();
  }

  const modBonus = [mods.hard && "+50%", mods.grayscale && "+25%", mods.flipped && "+25%"].filter(Boolean);

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
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, padding:"14px 16px", background:"rgba(240,192,48,.06)", borderRadius:14, border:"1px solid rgba(240,192,48,.15)" }}>
        <div>
          <div style={{ fontSize:10, color:"#8a7030", letterSpacing:".1em" }}>{today()}{usingMock ? " · MOCK" : ""}</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#f0c030", letterSpacing:"-0.5px" }}>GAMEDLE</div>
          <div style={{ fontSize:11, color:"#8a7030" }}>One game · same for everyone</div>
        </div>
        <div style={{ display:"flex", gap:20 }}>
          {[["STREAK", `${streak.streak} 🔥`], ["BEST", `${streak.best} ⭐`]].map(([l, v]) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#5a5020", letterSpacing:".1em", fontWeight:700 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#f0c030" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modifiers */}
      {!alreadyPlayed && !result && (
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em", marginBottom:8 }}>MODIFIERS — toggle for bonus points</div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { key:"hard",      icon:"💀", label:"Hard",      desc:"3 hints · 4 attempts",   bonus:"+50%" },
              { key:"grayscale", icon:"⬛", label:"Grayscale", desc:"B&W cover",              bonus:"+25%" },
              { key:"flipped",   icon:"🔄", label:"Flipped",   desc:"Mirror image",           bonus:"+25%" },
            ].map(({ key, icon, label, desc, bonus }) => (
              <button key={key} onClick={() => setMods(m => ({ ...m, [key]: !m[key] }))} style={{ flex:1, padding:"10px 8px", borderRadius:12, border: mods[key]?"2px solid #f0c030":"1px solid #2a2a40", background: mods[key]?"rgba(240,192,48,.1)":"#111120", color: mods[key]?"#f0c030":"#6b6b8a", cursor:"pointer", textAlign:"center", transition:"all .2s" }}>
                <div style={{ fontSize:16, marginBottom:2 }}>{icon}</div>
                <div style={{ fontSize:11, fontWeight:700 }}>{label}</div>
                <div style={{ fontSize:10, opacity:.7 }}>{desc}</div>
                <div style={{ fontSize:10, color: mods[key]?"#f0c030":"#4a4a6a", fontWeight:600, marginTop:2 }}>{bonus}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Already played banner */}
      {alreadyPlayed && !result && todayScore && (
        <div style={{ padding:"14px 16px", borderRadius:12, background:"rgba(240,192,48,.08)", border:"1px solid rgba(240,192,48,.2)", marginBottom:18, textAlign:"center" }}>
          <div style={{ fontSize:14, color:"#f0c030", fontWeight:600, marginBottom:4 }}>
            {todayScore.won ? "✅ You won today!" : "💀 Better luck tomorrow!"}
          </div>
          {todayScore.won && <div style={{ fontSize:22, fontWeight:700, color:"#f0c030" }}>{todayScore.score.toLocaleString()} pts</div>}
          <div style={{ fontSize:12, color:"#8a7030", marginTop:4 }}>Come back tomorrow for a new game 🗓️</div>
        </div>
      )}

      {/* Score banner */}
      {score !== null && (
        <div style={{ padding:"12px 16px", borderRadius:12, background: result==="won"?"rgba(80,200,120,.08)":"rgba(220,80,80,.08)", border:`1px solid ${result==="won"?"rgba(80,200,120,.2)":"rgba(220,80,80,.2)"}`, marginBottom:16, textAlign:"center" }}>
          {result === "won"
            ? <><div style={{ fontSize:11, color:"#4a7040", letterSpacing:".1em" }}>TODAY'S SCORE</div><div style={{ fontSize:28, fontWeight:700, color:"#6fe0a0" }}>{score.toLocaleString()}</div></>
            : <div style={{ fontSize:14, color:"#e07070", fontWeight:600 }}>No points today — come back tomorrow!</div>}
          {modBonus.length > 0 && result === "won" && (
            <div style={{ fontSize:11, color:"#4a7040", marginTop:2 }}>{modBonus.join(" · ")} bonus applied</div>
          )}
        </div>
      )}

      {/* Game locked if already played today and no active session */}
      {alreadyPlayed && !result ? (
        <div style={{ textAlign:"center", padding:"28px 0", color:"#3a3a5a", fontSize:14 }}>
          🔒 Come back tomorrow for a new game!
        </div>
      ) : game && (
        <GameBoard
          game={game}
          blurStart    = {mods.hard ? 32 : 22}
          blurStep     = {mods.hard ? 9  : 6}
          blurMin      = {5}
          grayscale    = {mods.grayscale || mods.hard}
          flipped      = {mods.flipped}
          freeHints    = {0}
          maxAttempts  = {mods.hard ? 4 : undefined}
          maxHints     = {mods.hard ? 3 : undefined}
          onWin        = {handleWin}
          onLose       = {handleLose}
          onReadyForNext = {onBack}
          nextLabel    = "Back to menu →"
        />
      )}
    </div>
  );
}
