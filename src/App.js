import { useState, useEffect, useRef, useCallback } from "react";
import { fetchGames, checkProxy } from "./igdb";

// ─── Difficulty Config ────────────────────────────────────────────────────────
const DIFF = {
  easy:   { label: "Easy",   emoji: "🟢", blur: 12, step: 4,  grayscale: false, freeHints: 0 },
  medium: { label: "Medium", emoji: "🟡", blur: 22, step: 6,  grayscale: false, freeHints: 0 },
  hard:   { label: "Hard",   emoji: "🔴", blur: 32, step: 9,  grayscale: true,  freeHints: 1 },
};
// Attempts are always game.hints.length + 1 (dynamic), so every hint can be revealed before game over

// ─── Mock Game Data (fallback when IGDB proxy is offline) ─────────────────────
const MOCK_GAMES = [
  {
    id: 1, title: "The Witcher 3: Wild Hunt",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rcb.jpg",
    year: 2015, genre: "RPG", studio: "CD Projekt Red",
    hints: ["An open-world dark fantasy game released in 2015", "You play as a professional monster hunter for hire", "The protagonist is named Geralt of Rivia"],
    aliases: ["witcher 3", "witcher3", "the witcher 3", "witcher"],
  },
  {
    id: 2, title: "God of War",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg",
    year: 2018, genre: "Action-Adventure", studio: "Santa Monica Studio",
    hints: ["Set in the world of Norse mythology", "You journey alongside your young son Atreus", "The protagonist is a Spartan warrior-god named Kratos"],
    aliases: ["god of war 2018", "gow", "god of war ps4"],
  },
  {
    id: 3, title: "Red Dead Redemption 2",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1q1f.jpg",
    year: 2018, genre: "Action-Adventure", studio: "Rockstar Games",
    hints: ["Set in a fictional version of the American Wild West", "You play as an outlaw navigating the decline of the frontier era", "The protagonist is Arthur Morgan of the Van der Linde gang"],
    aliases: ["rdr2", "red dead 2", "red dead redemption2", "rdr"],
  },
  {
    id: 4, title: "Minecraft",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co49x5.jpg",
    year: 2011, genre: "Sandbox", studio: "Mojang Studios",
    hints: ["The entire world is composed of blocks", "Core gameplay revolves around building, mining, and crafting", "One of the best-selling video games ever made"],
    aliases: ["mine craft", "mc"],
  },
  {
    id: 5, title: "Elden Ring",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
    year: 2022, genre: "Action RPG", studio: "FromSoftware",
    hints: ["An open-world soulslike game set in the Lands Between", "The world lore was co-created with George R.R. Martin", "Developed by the creators of Dark Souls"],
    aliases: ["elden ring", "eldenring"],
  },
  {
    id: 6, title: "Hades",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2xt6.jpg",
    year: 2020, genre: "Roguelike", studio: "Supergiant Games",
    hints: ["A narrative-driven dungeon-crawling roguelike", "Based entirely on Greek mythology", "You play as Zagreus, who is trying to escape from his father"],
    aliases: ["hades"],
  },
  {
    id: 7, title: "Cyberpunk 2077",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4hk5.jpg",
    year: 2020, genre: "RPG", studio: "CD Projekt Red",
    hints: ["Set in a sprawling dystopian megacity of the future", "The main hub is a place called Night City", "Keanu Reeves stars as a digital ghost named Johnny Silverhand"],
    aliases: ["cyberpunk", "cp2077", "cyber punk 2077"],
  },
  {
    id: 8, title: "Portal 2",
    cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1x7d.jpg",
    year: 2011, genre: "Puzzle", studio: "Valve",
    hints: ["A first-person puzzle game using a device that creates portals", "The primary antagonist is a sinister AI named GLaDOS", "Made by the studio behind Half-Life"],
    aliases: ["portal 2", "portal2", "portal"],
  },
];

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const norm    = (s)   => s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pop    { 0%,100%{transform:scale(1);} 50%{transform:scale(1.08);} }
  @keyframes shake  { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-6px);} 40%,80%{transform:translateX(6px);} }
  @keyframes pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(124,106,246,0.4);} 50%{box-shadow:0 0 0 8px rgba(124,106,246,0);} }
  @keyframes spin   { to { transform: rotate(360deg); } }
  .fade-in  { animation:fadeIn 0.35s ease both; }
  .pop      { animation:pop 0.4s ease both; }
  .shake    { animation:shake 0.4s ease both; }
  .pulse    { animation:pulse 1.5s ease infinite; }
  .spin     { animation:spin 0.8s linear infinite; }
  .cover-img { transition:filter 0.9s cubic-bezier(.4,0,.2,1); }
  .guess-input:focus { outline:none; border-color:#7c6af6 !important; box-shadow:0 0 0 3px rgba(124,106,246,0.2); }
  .diff-btn:hover   { border-color:#7c6af6 !important; }
  .action-btn:hover { opacity:0.88; transform:translateY(-1px); }
  .action-btn:active{ transform:scale(0.97); }
  .menu-btn:hover   { background:#1a1a2a !important; }
`;

// ─── Status Banner Component ──────────────────────────────────────────────────
function ApiBanner({ status }) {
  if (!status) return null;
  const isLive = status.startsWith("Connected");
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
      borderRadius:8, fontSize:12, marginBottom:16,
      background: isLive ? "rgba(80,200,120,0.08)" : "rgba(220,180,80,0.08)",
      border: `1px solid ${isLive ? "rgba(80,200,120,0.2)" : "rgba(220,180,80,0.2)"}`,
      color: isLive ? "#6fe0a0" : "#e0c870",
    }}>
      <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background: isLive ? "#6fe0a0" : "#e0c870" }}/>
      {status}
    </div>
  );
}

// ─── Loading Screen Component ─────────────────────────────────────────────────
function LoadingScreen({ message }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0a0a12", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <style>{css}</style>
      <div className="spin" style={{ width:32, height:32, border:"3px solid #1e1e30", borderTopColor:"#7c6af6", borderRadius:"50%" }}/>
      <p style={{ color:"#6b6b8a", fontSize:14, margin:0 }}>{message}</p>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]         = useState("start");
  const [diff, setDiff]             = useState("medium");
  const [queue, setQueue]           = useState([]);
  const [idx, setIdx]               = useState(0);
  const [guess, setGuess]           = useState("");
  const [attempts, setAttempts]     = useState(0);
  const [status, setStatus]         = useState("playing"); // playing | won | lost
  const [toast, setToast]           = useState(null);
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [shakeInput, setShakeInput] = useState(false);
  const [cheating, setCheating]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [loadMsg, setLoadMsg]       = useState("");
  const [apiStatus, setApiStatus]   = useState(null); // string shown in banner
  const [usingMock, setUsingMock]   = useState(false);
  const [seenIds, setSeenIds]         = useState(new Set());
  const inputRef      = useRef(null);
  const canvasRef      = useRef(null);
  const guessHistory   = useRef([]);   // past guesses this round
  const historyCursor  = useRef(-1);   // -1 = not browsing history
  const cfg         = DIFF[diff];
  const game        = queue[idx];
  const maxAttempts = game ? game.hints.length + 1 : 4;

  // ── Load games (IGDB with mock fallback) ────────────────────────────────────
  const loadGames = useCallback(async (selectedDiff, currentSeenIds = new Set()) => {
    setLoading(true);
    setLoadMsg("Checking API connection…");

    const proxy = await checkProxy();
    setApiStatus(proxy.message);

    if (proxy.ok) {
      try {
        setLoadMsg("Fetching games from IGDB…");
        const excludeIds = [...currentSeenIds];
        const games = await fetchGames(50, selectedDiff, excludeIds);
        // Track these IDs as seen
        const newSeen = new Set(currentSeenIds);
        games.forEach((g) => newSeen.add(g.id));
        setSeenIds(newSeen);
        setQueue(shuffle(games));
        setUsingMock(false);
        setLoading(false);
        return;
      } catch (err) {
        console.error("IGDB fetch failed:", err.message);
        setApiStatus(`IGDB error: ${err.message}`);
      }
    }

    // Fallback to mock data
    setUsingMock(true);
    setQueue(shuffle(MOCK_GAMES));
    setLoading(false);
  }, []);

  // ── Silent background fetch — replaces the queue every 5 min, no repeats ──
  const backgroundFetch = useCallback(async (selectedDiff, currentSeenIds, currentGame) => {
    if (usingMock) return;
    try {
      const excludeIds = [...currentSeenIds];
      const games = await fetchGames(50, selectedDiff, excludeIds);
      if (!games.length) return;

      // Track new IDs as seen
      const newSeen = new Set(currentSeenIds);
      games.forEach((g) => newSeen.add(g.id));
      setSeenIds(newSeen);

      // Put the current game first so idx=0 still points to it,
      // then fill the rest with the fresh shuffled batch (excluding current)
      const rest = shuffle(games.filter((g) => g.id !== currentGame?.id));
      setQueue(currentGame ? [currentGame, ...rest] : rest);
      setIdx(0);

      console.log(`🎮 Background refresh: queue replaced with ${rest.length} new games`);
    } catch (err) {
      console.warn("Background fetch failed silently:", err.message);
    }
  }, [usingMock]);

  // ── Start game ──────────────────────────────────────────────────────────────
  async function startGame(d) {
    setDiff(d);
    resetRound();
    setScore(0);
    setStreak(0);
    setIdx(0);
    setSeenIds(new Set());
    setScreen("game");
    await loadGames(d, new Set());
  }

  function resetRound() {
    setGuess("");
    setAttempts(0);
    setStatus("playing");
    setToast(null);
    setCheating(false);
    guessHistory.current  = [];
    historyCursor.current = -1;
  }

  function showToast(text, type = "info") {
    setToast({ text, type, key: Date.now() });
    setTimeout(() => setToast(null), 2800);
  }

  function getFilter(attemptsCount, revealed) {
    if (revealed || cheating) return "none";
    const c = DIFF[diff];
    const rawBlur = c.blur - attemptsCount * c.step;
    // Easy mode goes all the way to 0; other modes floor at 5px while still playing
    const minBlur = c.label === "Easy" ? 0 : 5;
    const blurPx  = Math.max(minBlur, rawBlur);
    const gs = c.grayscale && attemptsCount === 0 ? "grayscale(100%) " : "";
    return `${gs}blur(${blurPx}px)`;
  }

  function submitGuess() {
    if (!game || status !== "playing" || !guess.trim()) return;

    // 🔓 Cheat code — reveals the cover without ending the game
    if (guess.trim().toUpperCase() === "REVEAL") {
      setCheating(true);
      setGuess("");
      showToast("🔓 Cover revealed — cheat mode!", "warn");
      return;
    }

    const g       = norm(guess);
    const correct = norm(game.title);
    const aliases = (game.aliases || []).map(norm);

    if (g === correct || aliases.includes(g)) {
      const pts = Math.max(10, 100 - attempts * 10);
      setScore((s) => s + pts);
      const ns = streak + 1;
      setStreak(ns);
      setBestStreak((b) => Math.max(b, ns));
      setStatus("won");
      showToast(
        `🎉 Correct! +${pts} pts${attempts > 0 ? ` (−${attempts * 10} for ${attempts} wrong guess${attempts !== 1 ? "es" : ""})` : ""}`,
        "success"
      );
    } else {
      // Save this wrong guess to history (like command prompt)
      guessHistory.current = [guess.trim(), ...guessHistory.current];
      historyCursor.current = -1;
      const na = attempts + 1;
      setAttempts(na);
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 450);
      if (na >= maxAttempts) {
        setStreak(0);
        setStatus("lost");
        showToast(`💀 The answer was: ${game.title}`, "error");
      } else {
        setGuess("");
        const hintMsg = " — a new hint was revealed";
        showToast(
          `❌ Not quite — ${maxAttempts - na} attempt${maxAttempts - na !== 1 ? "s" : ""} left${hintMsg}`,
          "warn"
        );
      }
    }
  }

  async function nextGame() {
    const ni = idx + 1;
    if (ni >= queue.length) {
      // Refetch a fresh batch, excluding all games seen this session
      await loadGames(diff, seenIds);
      setIdx(0);
    } else {
      setIdx(ni);
    }
    resetRound();
  }

  useEffect(() => {
    if (screen === "game" && inputRef.current && status === "playing") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [screen, idx, status]);

  // Press Enter after round ends to go to next game
  useEffect(() => {
    if (status === "playing") return;
    const handler = (e) => { if (e.key === "Enter") nextGame(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status]);

  // Background refresh every 5 minutes while on the game screen
  useEffect(() => {
    if (screen !== "game") return;
    const FIVE_MINUTES = 5 * 60 * 1000;
    const timer = setInterval(() => {
      backgroundFetch(diff, seenIds, game);
    }, FIVE_MINUTES);
    return () => clearInterval(timer);
  }, [screen, diff, seenIds, backgroundFetch]);

  // Draw game cover onto canvas so the real URL is never in the DOM
  useEffect(() => {
    if (!game?.cover || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const img    = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width  = 210;
      canvas.height = 280;
      ctx.drawImage(img, 0, 0, 210, 280);
    };
    img.onerror = () => {
      // Draw a fallback placeholder if image fails
      ctx.fillStyle = "#161622";
      ctx.fillRect(0, 0, 210, 280);
      ctx.fillStyle = "#3a3a5a";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Cover", 105, 145);
    };
    img.src = game.cover;
  }, [game]);

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen message={loadMsg} />;

  // ── Start Screen ─────────────────────────────────────────────────────────────
  if (screen === "start") return (
    <div style={{ minHeight:"100vh", background:"#0a0a12", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{css}</style>
      <div className="fade-in" style={{ maxWidth:440, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:12, filter:"drop-shadow(0 0 20px rgba(124,106,246,0.6))" }}>🎮</div>
        <h1 style={{ fontSize:32, fontWeight:700, color:"#f0f0fa", margin:"0 0 6px", letterSpacing:"-0.5px" }}>GameGuess</h1>
        <p style={{ color:"#6b6b8a", fontSize:15, margin:"0 0 28px" }}>Identify the game from its blurred cover art</p>

        {apiStatus && <ApiBanner status={apiStatus} />}

        <p style={{ color:"#8888a8", fontSize:12, letterSpacing:"0.08em", marginBottom:10, textTransform:"uppercase" }}>Select difficulty</p>
        <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:28 }}>
          {Object.entries(DIFF).map(([key, val]) => (
            <button key={key} className="diff-btn" onClick={() => setDiff(key)} style={{
              flex:1, padding:"12px 8px", borderRadius:12,
              border: diff === key ? "2px solid #7c6af6" : "1px solid #2a2a40",
              background: diff === key ? "rgba(124,106,246,0.12)" : "#111120",
              color: diff === key ? "#a99ef8" : "#6b6b8a",
              cursor:"pointer", fontSize:13, fontWeight: diff === key ? 600 : 400, transition:"all .2s"
            }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{val.emoji}</div>
              {val.label}
            </button>
          ))}
        </div>

        <div style={{ background:"#111120", border:"1px solid #1e1e2e", borderRadius:14, padding:"16px 20px", marginBottom:28, textAlign:"left", fontSize:13, color:"#6b6b8a", lineHeight:1.9 }}>
          <div style={{ color:"#a0a0c0", fontWeight:600, marginBottom:4 }}>How to play</div>
          A blurred game cover is shown — type your best guess and press Enter.<br />
          Each wrong guess reveals a free hint and reduces the blur.<br />
          {diff === "hard"   && <span style={{ color:"#e06c6c" }}>Hard mode: covers start grayscale — first hint is free, hints+1 attempts.</span>}
          {diff === "easy"   && <span style={{ color:"#6ce0a0" }}>Easy mode: lightly blurred covers, hints+1 attempts.</span>}
          {diff === "medium" && <span style={{ color:"#e0c96c" }}>Medium mode: moderately blurred, hints+1 attempts.</span>}
        </div>

        <button className="action-btn" onClick={() => startGame(diff)} style={{
          width:"100%", padding:"15px", borderRadius:14,
          background:"linear-gradient(135deg,#7c6af6,#9b87f8)", color:"#fff",
          border:"none", fontSize:16, fontWeight:700, cursor:"pointer", letterSpacing:"0.02em",
          boxShadow:"0 4px 20px rgba(124,106,246,0.4)", transition:"all .2s"
        }}>
          Start Game →
        </button>

        {usingMock && (
          <p style={{ fontSize:11, color:"#3a3a5a", marginTop:14 }}>
            Running on mock data · Start <code style={{ color:"#5a5a7a" }}>node server.js</code> and add your IGDB credentials to <code style={{ color:"#5a5a7a" }}>.env</code> for live games
          </p>
        )}
      </div>
    </div>
  );

  if (!game) return <LoadingScreen message="Loading next game…" />;

  const revealed     = status !== "playing";
  const coverFilter  = getFilter(attempts, revealed);

  // ── Game Screen ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#0a0a12", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f0f0fa" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ background:"rgba(14,14,22,0.95)", backdropFilter:"blur(10px)", borderBottom:"1px solid #1a1a28", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>🎮</span>
          <span style={{ fontWeight:700, fontSize:15, color:"#f0f0fa" }}>GameGuess</span>
          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"rgba(124,106,246,0.15)", color:"#a99ef8", fontWeight:600 }}>
            {cfg.emoji} {cfg.label}
          </span>
          {usingMock && (
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(220,180,80,0.1)", color:"#c0a040", fontWeight:600 }}>
              MOCK
            </span>
          )}
        </div>
        <div style={{ display:"flex", gap:20, alignItems:"center" }}>
          {[["SCORE", score], ["STREAK", `${streak} 🔥`], ["BEST", `${bestStreak} ⭐`]].map(([label, val]) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#4a4a6a", letterSpacing:"0.1em", fontWeight:700 }}>{label}</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#c0c0e0" }}>{val}</div>
            </div>
          ))}
          <button className="menu-btn" onClick={() => setScreen("start")} style={{
            fontSize:12, color:"#6b6b8a", background:"none", border:"1px solid #1e1e2e",
            borderRadius:8, padding:"5px 10px", cursor:"pointer", transition:"background .2s"
          }}>← Menu</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth:560, margin:"0 auto", padding:"28px 20px" }}>

        {/* Toast */}
        {toast && (
          <div key={toast.key} className="fade-in" style={{
            padding:"10px 16px", borderRadius:10, marginBottom:20, fontSize:14, fontWeight:500, textAlign:"center",
            background: toast.type === "success" ? "rgba(80,200,120,0.12)" : toast.type === "error" ? "rgba(220,80,80,0.12)" : "rgba(220,180,80,0.1)",
            border: `1px solid ${toast.type === "success" ? "rgba(80,200,120,0.3)" : toast.type === "error" ? "rgba(220,80,80,0.3)" : "rgba(220,180,80,0.25)"}`,
            color: toast.type === "success" ? "#6fe0a0" : toast.type === "error" ? "#e07070" : "#e0c870",
          }}>{toast.text}</div>
        )}

        {/* Cover art */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
          <div style={{ position:"relative", borderRadius:16, overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,0.6)" }}>
            <canvas
              ref={canvasRef}
              className="cover-img"
              width={210}
              height={280}
              style={{ width:210, height:280, display:"block", filter:coverFilter, userSelect:"none", pointerEvents:"none" }}
            />
            {status === "won" && (
              <div className="fade-in" style={{ position:"absolute", inset:0, background:"rgba(80,200,120,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span className="pop" style={{ fontSize:52, filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}>✅</span>
              </div>
            )}
            {status === "lost" && (
              <div className="fade-in" style={{ position:"absolute", inset:0, background:"rgba(220,80,80,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span className="pop" style={{ fontSize:52, filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}>💀</span>
              </div>
            )}
          </div>
        </div>

        {/* Revealed game info */}
        {revealed && (
          <div className="fade-in" style={{ textAlign:"center", marginBottom:22 }}>
            <div style={{ fontSize:22, fontWeight:700, color:"#f0f0fa", marginBottom:4 }}>{game.title}</div>
            <div style={{ fontSize:13, color:"#6b6b8a" }}>{game.year} · {game.genre} · {game.studio}</div>
          </div>
        )}

        {/* Attempt lives */}
        {status === "playing" && (
          <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:18 }}>
            {Array.from({ length: maxAttempts }).map((_, i) => (
              <div key={i} style={{
                width:32, height:8, borderRadius:4, transition:"background .3s",
                background: i < attempts ? "#c0404050" : "#5050e050"
              }}/>
            ))}
          </div>
        )}

        {/* Hints — auto-revealed after each wrong guess */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#4a4a6a", letterSpacing:"0.1em", fontWeight:700 }}>HINTS</div>
            {status === "playing" && (cfg.freeHints + attempts) < game.hints.length && (
              <div style={{ fontSize:11, color:"#4a4a6a" }}>next hint unlocks after a wrong guess</div>
            )}
          </div>
          {game.hints.map((hint, i) => {
            const freeHints = cfg.freeHints ?? 0;
            const unlocked  = i < (freeHints + attempts) || revealed;
            const isNew     = i === (freeHints + attempts) - 1 && status === "playing" && i >= freeHints;
            return (
              <div key={i} className={unlocked ? "fade-in" : ""} style={{
                padding:"12px 16px", borderRadius:12, marginBottom:8,
                border: unlocked ? (isNew ? "1px solid #5a4af6" : "1px solid #2a2a40") : "1px dashed #1a1a28",
                background: unlocked ? (isNew ? "rgba(90,74,246,0.1)" : "#111120") : "transparent",
                fontSize:14, display:"flex", alignItems:"flex-start", gap:12,
                color: unlocked ? "#c0c0e0" : "#3a3a5a", transition:"border-color .4s, background .4s",
              }}>
                <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{unlocked ? "💡" : "🔒"}</span>
                <span style={{ lineHeight:1.5 }}>
                  {unlocked
                    ? <>{hint}{isNew && <span style={{ marginLeft:8, fontSize:11, color:"#7c6af6", fontWeight:600 }}>NEW</span>}</>
                    : `Hint ${i + 1} — unlocks after wrong guess ${i + 1 - (cfg.freeHints ?? 0)}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Guess input */}
        {status === "playing" && (
          <div className={shakeInput ? "shake" : ""} style={{ display:"flex", gap:8 }}>
            <input
              ref={inputRef}
              className="guess-input"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  submitGuess();
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const hist = guessHistory.current;
                  if (hist.length === 0) return;
                  const next = Math.min(historyCursor.current + 1, hist.length - 1);
                  historyCursor.current = next;
                  setGuess(hist[next]);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = historyCursor.current - 1;
                  if (next < 0) {
                    historyCursor.current = -1;
                    setGuess("");
                  } else {
                    historyCursor.current = next;
                    setGuess(guessHistory.current[next]);
                  }
                }
              }}
              placeholder="Type the game title and press Enter…"
              style={{ flex:1, padding:"13px 16px", borderRadius:12, border:"1px solid #2a2a40", background:"#0e0e1c", color:"#f0f0fa", fontSize:15, transition:"border-color .2s, box-shadow .2s" }}
            />
            <button className="action-btn pulse" onClick={submitGuess} style={{
              padding:"13px 20px", borderRadius:12,
              background:"linear-gradient(135deg,#7c6af6,#9b87f8)", color:"#fff",
              border:"none", cursor:"pointer", fontWeight:700, fontSize:14, transition:"all .2s", whiteSpace:"nowrap"
            }}>
              Guess →
            </button>
          </div>
        )}

        {/* Next / Menu */}
        {status !== "playing" && (
          <div className="fade-in" style={{ display:"flex", gap:10, marginTop:4 }}>
            <button className="action-btn" onClick={nextGame} style={{
              flex:1, padding:"14px", borderRadius:12,
              background:"linear-gradient(135deg,#7c6af6,#9b87f8)", color:"#fff",
              border:"none", cursor:"pointer", fontWeight:700, fontSize:15, transition:"all .2s",
              boxShadow:"0 4px 20px rgba(124,106,246,0.35)"
            }}>
              Next game →
            </button>
            <button className="action-btn" onClick={() => setScreen("start")} style={{
              padding:"14px 18px", borderRadius:12, border:"1px solid #2a2a40",
              background:"#0e0e1c", color:"#6b6b8a", cursor:"pointer", fontSize:14, fontWeight:600, transition:"all .2s"
            }}>
              🏠
            </button>
          </div>
        )}

        <div style={{ textAlign:"center", marginTop:24, fontSize:12, color:"#2a2a45" }}>
          Game {(idx % queue.length) + 1} of {queue.length} · {usingMock ? "Mock data" : "Powered by IGDB"}
        </div>
      </div>
    </div>
  );
}
