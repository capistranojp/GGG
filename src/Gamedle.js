import { useState, useEffect, useCallback } from "react";
import { fetchDailyGame } from "./igdb";
import { startBG } from "./sounds";
import { saveScore, getLeaderboard, getStreak, updateStreak, getStreakLeaderboard, getPersonalBest } from "./supabase";
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

const today = () => new Date().toISOString().slice(0, 10);

// ── Per-user, per-device storage keys ─────────────────────────────────────────
const playedKey   = uid => `ggg_gd_played_${uid}`;     // date string
const progressKey = uid => `ggg_gd_prog_${uid}_${today()}`; // { attempts, mods, modsLocked }

const hasPlayedToday = uid => { try { return localStorage.getItem(playedKey(uid)) === today(); } catch { return false; } };
const markPlayed     = uid => localStorage.setItem(playedKey(uid), today());

function loadProgress(uid) {
  try { return JSON.parse(localStorage.getItem(progressKey(uid))) || {}; } catch { return {}; }
}
function saveProgress(uid, data) {
  try { localStorage.setItem(progressKey(uid), JSON.stringify(data)); } catch {}
}

// ── Scrollable leaderboard ─────────────────────────────────────────────────────
function LBTable({ rows, cols, accent = "#f0c030", myUsername }) {
  const medals = ["🥇","🥈","🥉"];
  const myIdx  = rows.findIndex(r => r.username === myUsername);
  return (
    <div style={{ border:"1px solid #1e1e2e", borderRadius:12, overflow:"hidden" }}>
      <div style={{ maxHeight:220, overflowY:"auto" }}>
        {!rows?.length
          ? <p style={{ color:"#3a3a5a", fontSize:12, textAlign:"center", padding:"14px 0", margin:0 }}>No scores yet — be first!</p>
          : rows.map((r, i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 12px",
              borderBottom: i<rows.length-1?"1px solid #111120":"none",
              background: r.username===myUsername?"rgba(240,192,48,.06)":"transparent", fontSize:12 }}>
              <span style={{ color:i<3?["#f0c030","#c0c0c0","#cd7f32"][i]:"#3a3a5a", minWidth:22, flexShrink:0 }}>{medals[i]||`${i+1}.`}</span>
              <span style={{ flex:1, color: r.username===myUsername?accent:"#c0c0e0", fontWeight:r.username===myUsername?700:400 }}>
                {r.username}{r.username===myUsername?" (you)":""}
              </span>
              {cols.map(({ key, fmt }) => (
                <span key={key} style={{ color:i===0?accent:"#6b6b8a", fontWeight:i===0?700:400, flexShrink:0 }}>
                  {fmt?fmt(r[key]):r[key]}
                </span>
              ))}
            </div>
          ))
        }
      </div>
      {/* Pin user's entry if outside top 10 */}
      {myIdx === -1 && myUsername && (
        <div style={{ borderTop:"1px solid #1e1e2e", padding:"6px 12px", fontSize:11, color:"#4a4a6a", textAlign:"center" }}>
          You are not in the top 10 yet
        </div>
      )}
    </div>
  );
}

export default function Gamedle({ onBack }) {
  const { userId, username } = useUser();
  const [game,       setGame]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [mods,       setMods]       = useState({ hard:false, grayscale:false, flipped:false });
  const [modsLocked, setModsLocked] = useState(false);
  const [initAttempts, setInitAttempts] = useState(0);
  const [score,      setScore]      = useState(null);
  const [result,     setResult]     = useState(null);
  const [streak,     setStreak]     = useState({ streak:0, best_streak:0 });
  const [dailyLB,    setDailyLB]    = useState([]);
  const [streakLB,   setStreakLB]   = useState([]);
  const [personalBest, setPersonalBest] = useState(null);
  const [lbTab,      setLbTab]      = useState("daily");
  const [usingMock,  setUsingMock]  = useState(false);
  const alreadyPlayed = hasPlayedToday(userId);
  const [countdown, setCountdown] = useState("");

  // Start BG music (continues from menu — startBG is safe to call again, it's a no-op if already playing)
  useEffect(() => { startBG(); }, []);

  // Tick every second — computes hh:mm:ss until next midnight UTC
  useEffect(() => {
    function calcCountdown() {
      const now    = new Date();
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight - now;
      const h  = String(Math.floor(diff / 3_600_000)).padStart(2, "0");
      const m  = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0");
      const s  = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, "0");
      setCountdown(`${h}:${m}:${s}`);
    }
    calcCountdown();
    const t = setInterval(calcCountdown, 1000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Restore saved progress for today
    const prog = loadProgress(userId);
    if (prog.attempts) setInitAttempts(prog.attempts);
    if (prog.mods)     setMods(prog.mods);
    if (prog.modsLocked) setModsLocked(true);

    // Fetch daily game — try IGDB directly, fall back to mock on any failure
    try {
      const g = await fetchDailyGame();
      setGame(g);
      setUsingMock(false);
    } catch (err) {
      console.warn("[Gamedle] IGDB fetch failed, using mock:", err.message);
      setGame(DAILY_MOCK);
      setUsingMock(true);
    }

    const [sk, dlb, slb, pb] = await Promise.all([
      getStreak(userId),
      getLeaderboard({ mode:"gamedle", date:today(), limit:10 }),
      getStreakLeaderboard(10),
      getPersonalBest(userId, "gamedle"),
    ]);
    setStreak(sk); setDailyLB(dlb); setStreakLB(slb); setPersonalBest(pb);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  function calcScore(att) {
    let base = Math.max(100, 1000 - att * 200);
    if (mods.hard)      base = Math.round(base * 1.5);
    if (mods.grayscale) base = Math.round(base * 1.25);
    if (mods.flipped)   base = Math.round(base * 1.25);
    return base;
  }

  function handleAttemptsChange(n) {
    // Lock modifiers on first wrong guess
    if (n === 1) setModsLocked(true);
    // Save progress per user per day
    saveProgress(userId, { attempts: n, mods, modsLocked: true });
  }

  async function handleWin(att, isCheat) {
    const s = isCheat ? 0 : calcScore(att);
    setScore(s); setResult("won"); markPlayed(userId);
    if (!isCheat) {
      const [newStreak] = await Promise.all([
        updateStreak(userId, username, true),
        saveScore({ userId, username, mode:"gamedle", score:s, difficulty:mods.hard?"hard":"normal" }),
      ]);
      setStreak(newStreak);
      const [dlb, slb, pb] = await Promise.all([
        getLeaderboard({ mode:"gamedle", date:today(), limit:10 }),
        getStreakLeaderboard(10),
        getPersonalBest(userId, "gamedle"),
      ]);
      setDailyLB(dlb); setStreakLB(slb); setPersonalBest(pb);
    } else {
      // Still update streak as a loss since cheat was used
      const newStreak = await updateStreak(userId, username, false);
      setStreak(newStreak);
    }
    // Clear progress since game is done
    try { localStorage.removeItem(progressKey(userId)); } catch {}
  }

  async function handleLose() {
    setResult("lost"); setScore(0); markPlayed(userId);
    const newStreak = await updateStreak(userId, username, false);
    setStreak(newStreak);
    try { localStorage.removeItem(progressKey(userId)); } catch {}
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
        <div style={{ display:"flex", gap:16 }}>
          {[["STREAK",`${streak.streak}🔥`],["BEST",`${streak.best_streak}⭐`]].map(([l,v])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#5a5020", letterSpacing:".1em", fontWeight:700 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#f0c030" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modifiers — locked after first guess */}
      {!alreadyPlayed && !result && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em" }}>MODIFIERS — toggle for bonus points</div>
            {modsLocked && <div style={{ fontSize:10, color:"#5a5020" }}>🔒 locked after first guess</div>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { key:"hard",      icon:"💀", label:"Hard",      desc:"3 hints · 4 attempts", bonus:"+50%" },
              { key:"grayscale", icon:"⬛", label:"Grayscale", desc:"B&W cover",             bonus:"+25%" },
              { key:"flipped",   icon:"🔄", label:"Flipped",   desc:"Mirror image",          bonus:"+25%" },
            ].map(({ key, icon, label, desc, bonus }) => (
              <button key={key}
                disabled={modsLocked}
                onClick={()=>{
                  if (modsLocked) return;
                  const newMods = { ...mods, [key]: !mods[key] };
                  setMods(newMods);
                  saveProgress(userId, { attempts:initAttempts, mods:newMods, modsLocked });
                }}
                style={{ flex:1, padding:"10px 8px", borderRadius:12, border:mods[key]?"2px solid #f0c030":"1px solid #2a2a40",
                  background:mods[key]?"rgba(240,192,48,.1)":"#111120",
                  color:modsLocked?(mods[key]?"#8a7030":"#3a3a4a"):(mods[key]?"#f0c030":"#6b6b8a"),
                  cursor:modsLocked?"not-allowed":"pointer", textAlign:"center", transition:"all .2s", opacity:modsLocked?0.7:1 }}>
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
        <div style={{ padding:"12px 16px", borderRadius:12, marginBottom:14, textAlign:"center",
          background:result==="won"?"rgba(80,200,120,.08)":"rgba(220,80,80,.08)",
          border:`1px solid ${result==="won"?"rgba(80,200,120,.2)":"rgba(220,80,80,.2)"}` }}>
          {result === "won"
            ? <><div style={{ fontSize:10, color:"#4a7040", letterSpacing:".1em" }}>TODAY'S SCORE</div>
                <div style={{ fontSize:28, fontWeight:700, color:"#6fe0a0" }}>{score.toLocaleString()}</div></>
            : <div style={{ fontSize:14, color:"#e07070", fontWeight:600, lineHeight:1.7 }}>
                Come back tomorrow!<br/>
                <span style={{ fontSize:12, color:"#9a5050", fontWeight:400 }}>Next game in <span style={{ fontFamily:"monospace", fontWeight:700 }}>{countdown}</span></span>
              </div>}
          {modBonus.length > 0 && result==="won" && <div style={{ fontSize:11, color:"#4a7040", marginTop:2 }}>{modBonus.join(" · ")} applied</div>}
        </div>
      )}

      {/* Personal best */}
      {personalBest && (
        <div style={{ padding:"8px 14px", borderRadius:10, marginBottom:14, background:"rgba(240,192,48,.04)", border:"1px solid rgba(240,192,48,.1)", fontSize:12, color:"#8a7030", display:"flex", justifyContent:"space-between" }}>
          <span>Your best</span>
          <span style={{ fontWeight:700, color:"#f0c030" }}>{personalBest.score.toLocaleString()} pts</span>
        </div>
      )}

      {/* Game board or lock */}
      {alreadyPlayed && !result
        ? (
          <div style={{ textAlign:"center", padding:"24px 20px", background:"rgba(240,192,48,.04)", border:"1px solid rgba(240,192,48,.12)", borderRadius:16, marginBottom:20 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🔒</div>
            <div style={{ fontSize:14, color:"#8a7030", marginBottom:12 }}>You've already played today!</div>
            <div style={{ fontSize:11, color:"#5a5020", letterSpacing:".1em", fontWeight:700, marginBottom:6 }}>NEXT GAME IN</div>
            <div style={{ fontSize:38, fontWeight:900, color:"#f0c030", letterSpacing:"0.08em", fontVariantNumeric:"tabular-nums", fontFamily:"monospace" }}>{countdown}</div>
            <div style={{ fontSize:11, color:"#4a4020", marginTop:8 }}>New game resets at midnight UTC</div>
          </div>
        )
        : game && (
          <GameBoard
            game={game}
            blurStart={mods.hard?22:14} blurStep={mods.hard?6:4} blurMin={mods.hard?3:0}
            grayscale={mods.grayscale||mods.hard} flipped={mods.flipped}
            freeHints={0} maxAttempts={mods.hard?4:undefined} maxHints={mods.hard?3:undefined}
            initialAttempts={initAttempts}
            onAttemptsChange={handleAttemptsChange}
            onWin={handleWin} onLose={handleLose}
            onReadyForNext={onBack} nextLabel="Back to menu →"
          />
        )
      }

      {/* Leaderboards */}
      <div style={{ marginTop:24 }}>
        <div style={{ display:"flex", gap:4, background:"#0a0a14", borderRadius:10, padding:3, marginBottom:10 }}>
          {[["daily","📅 Today"],["streak","🔥 Streaks"]].map(([t,l])=>(
            <button key={t} onClick={()=>setLbTab(t)} style={{ flex:1, padding:"7px", borderRadius:8, border:"none", background:lbTab===t?"rgba(240,192,48,.15)":"transparent", color:lbTab===t?"#f0c030":"#4a4a6a", cursor:"pointer", fontSize:12, fontWeight:lbTab===t?700:400 }}>{l}</button>
          ))}
        </div>
        {lbTab === "daily"
          ? <LBTable rows={dailyLB} cols={[{ key:"score", fmt:v=>v.toLocaleString()+" pts" }]} myUsername={username} />
          : <LBTable rows={streakLB} cols={[{ key:"streak", fmt:v=>`${v}🔥` },{ key:"best_streak", fmt:v=>`${v}⭐ best` }]} myUsername={username} />
        }
      </div>
    </div>
  );
}
