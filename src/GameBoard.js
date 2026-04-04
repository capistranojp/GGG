/**
 * src/GameBoard.js
 * R3V34L = cheat mode, cover revealed, score NOT recorded
 * 4DM1N  = cover revealed, score STILL recorded, says "Hello Isho"
 */
import { useState, useEffect, useRef } from "react";
import { playWrong, playRight } from "./sounds";
import Confetti from "./Confetti";

const norm = s => s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");

const CSS = `
  @keyframes gbFade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes gbPop   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  @keyframes gbShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  @keyframes gbPulse { 0%,100%{box-shadow:0 0 0 0 rgba(124,106,246,.4)} 50%{box-shadow:0 0 0 8px rgba(124,106,246,0)} }
  .gb-fade  { animation:gbFade .35s ease both }
  .gb-pop   { animation:gbPop  .4s  ease both }
  .gb-shake { animation:gbShake .4s ease both }
  .gb-pulse { animation:gbPulse 1.5s ease infinite }
  .gb-in:focus { outline:none; border-color:#7c6af6!important; box-shadow:0 0 0 3px rgba(124,106,246,.2); }
  .gb-next:hover { opacity:.88; transform:translateY(-1px); }
`;

export default function GameBoard({
  game,
  blurStart       = 14,   // more forgiving default
  blurStep        = 4,
  blurMin         = 0,
  grayscale       = false,
  flipped         = false,
  freeHints       = 0,
  maxAttempts,
  maxHints,
  initialAttempts = 0,    // restore Gamedle progress
  autoAdvance     = false,
  onWin,                  // (attemptsUsed, isCheatMode) => void
  onLose,
  onReadyForNext,
  onAttemptsChange,       // (n) => void — called after each wrong guess for progress saving
  nextLabel       = "Next game →",
}) {
  const [attempts,  setAttempts]  = useState(initialAttempts);
  const [guess,     setGuess]     = useState("");
  const [status,    setStatus]    = useState("playing");
  const [shake,     setShake]     = useState(false);
  const [nextReady, setNextReady] = useState(false);
  const [cheating,  setCheating]  = useState(false); // R3V34L — no record
  const [adminPeek, setAdminPeek] = useState(false); // 4DM1N  — still records
  const [toast,     setToast]     = useState(null);
  const [confetti,  setConfetti]  = useState(false);
  const inputRef  = useRef(null);
  const canvasRef = useRef(null);
  const histRef   = useRef([]);
  const cursorRef = useRef(-1);

  const visibleHints = maxHints ? (game?.hints || []).slice(0, maxHints) : (game?.hints || []);
  const maxAtt = maxAttempts ?? visibleHints.length + 1;

  // Reset on new game (but respect initialAttempts)
  useEffect(() => {
    setAttempts(initialAttempts);
    setGuess(""); setStatus("playing");
    setShake(false); setNextReady(false);
    setCheating(false); setAdminPeek(false); setToast(null); setConfetti(false);
    histRef.current = []; cursorRef.current = -1;
  }, [game?.id]); // eslint-disable-line

  useEffect(() => {
    if (status === "playing") setTimeout(() => inputRef.current?.focus(), 80);
  }, [status, game?.id]);

  useEffect(() => {
    if (!nextReady) return;
    const h = e => { if (e.key === "Enter") onReadyForNext?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nextReady, onReadyForNext]);

  useEffect(() => {
    if (!game?.cover || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const img    = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { canvas.width = 210; canvas.height = 280; ctx.drawImage(img, 0, 0, 210, 280); };
    img.onerror = () => {
      ctx.fillStyle = "#161622"; ctx.fillRect(0, 0, 210, 280);
      ctx.fillStyle = "#3a3a5a"; ctx.font = "14px sans-serif";
      ctx.textAlign = "center"; ctx.fillText("Cover", 105, 145);
    };
    img.src = game.cover;
  }, [game]);

  function showToast(text, type = "info") {
    setToast({ text, type, key: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }

  function getFilter() {
    if (cheating || adminPeek || status !== "playing") return "none";
    const blur = Math.max(blurMin, blurStart - attempts * blurStep);
    const gs   = grayscale && attempts === 0 ? "grayscale(100%) " : "";
    return `${gs}blur(${blur}px)`;
  }

  function endRound(won, attemptsUsed, isCheat) {
    if (autoAdvance) setTimeout(() => onReadyForNext?.(), 1400);
    else             setTimeout(() => setNextReady(true), 1500);
    if (won) onWin?.(attemptsUsed, isCheat);
    else     onLose?.();
  }

  function submitGuess() {
    if (!game || status !== "playing" || !guess.trim()) return;
    const upper = guess.trim().toUpperCase();

    // R3V34L — cheat mode, cover revealed, score NOT recorded
    if (upper === "R3V34L") {
      setCheating(true); setGuess("");
      showToast("🔓 Cover revealed! Your Score will not be recorded.", "warn");
      return;
    }

    // 4DM1N — admin peek, cover revealed, score STILL recorded
    if (upper === "4DM1N") {
      setAdminPeek(true); setGuess("");
      showToast("🔓 Cover revealed! Hello Isho", "warn");
      return;
    }

    const g       = norm(guess);
    const aliases = [norm(game.title), ...(game.aliases || []).map(norm)];
    histRef.current = [guess.trim(), ...histRef.current];
    cursorRef.current = -1;

    if (aliases.includes(g)) {
      setStatus("won");
      showToast("🎉 Correct!", "success");
      playRight();
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3200);
      endRound(true, attempts, cheating); // cheating=true means no record
    } else {
      const na = attempts + 1;
      setAttempts(na); setGuess("");
      setShake(true); setTimeout(() => setShake(false), 450);
      playWrong();
      onAttemptsChange?.(na);
      if (na >= maxAtt) {
        setStatus("lost");
        showToast(`💀 ${game.title}`, "error");
        endRound(false, na, cheating);
      } else {
        const hintsLeft = visibleHints.length - (freeHints + na);
        showToast(`❌ Not quite — ${maxAtt - na} left${hintsLeft > 0 ? " · hint revealed" : ""}`, "warn");
      }
    }
  }

  function handleKey(e) {
    if (e.key === "Enter") { submitGuess(); return; }
    const hist = histRef.current;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!hist.length) return;
      const n = Math.min(cursorRef.current + 1, hist.length - 1);
      cursorRef.current = n; setGuess(hist[n]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = cursorRef.current - 1;
      if (n < 0) { cursorRef.current = -1; setGuess(""); }
      else { cursorRef.current = n; setGuess(hist[n]); }
    }
  }

  if (!game) return null;

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <style>{CSS}</style>
      <Confetti active={confetti} />

      {toast && (
        <div key={toast.key} className="gb-fade" style={{ padding:"10px 16px", borderRadius:10, marginBottom:14, fontSize:13, fontWeight:500, textAlign:"center",
          background: toast.type==="success"?"rgba(80,200,120,.12)":toast.type==="error"?"rgba(220,80,80,.12)":"rgba(220,180,80,.1)",
          border:`1px solid ${toast.type==="success"?"rgba(80,200,120,.3)":toast.type==="error"?"rgba(220,80,80,.3)":"rgba(220,180,80,.25)"}`,
          color: toast.type==="success"?"#6fe0a0":toast.type==="error"?"#e07070":"#e0c870" }}>
          {toast.text}
        </div>
      )}

      {cheating && status === "playing" && (
        <div style={{ textAlign:"center", marginBottom:10, fontSize:11, color:"#c0a040", background:"rgba(220,180,80,.06)", border:"1px solid rgba(220,180,80,.15)", borderRadius:8, padding:"5px 10px" }}>
          ⚠️ Cheat active — score will not be recorded
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"center", marginBottom:18 }}>
        <div style={{ position:"relative", borderRadius:16, overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,.6)" }}>
          <canvas ref={canvasRef} width={210} height={280} style={{ width:210, height:280, display:"block", filter:getFilter(), userSelect:"none", pointerEvents:"none", transform:flipped?"scaleX(-1)":"none", transition:"filter .9s cubic-bezier(.4,0,.2,1)" }}/>
          {status === "won"  && <div className="gb-fade" style={{ position:"absolute", inset:0, background:"rgba(80,200,120,.2)",  display:"flex", alignItems:"center", justifyContent:"center" }}><span className="gb-pop" style={{ fontSize:52 }}>✅</span></div>}
          {status === "lost" && <div className="gb-fade" style={{ position:"absolute", inset:0, background:"rgba(220,80,80,.2)",   display:"flex", alignItems:"center", justifyContent:"center" }}><span className="gb-pop" style={{ fontSize:52 }}>💀</span></div>}
        </div>
      </div>

      {status !== "playing" && (
        <div className="gb-fade" style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:20, fontWeight:700, color:"#f0f0fa", marginBottom:2 }}>{game.title}</div>
          <div style={{ fontSize:12, color:"#6b6b8a" }}>{game.year} · {game.genre} · {game.studio}</div>
        </div>
      )}

      {status === "playing" && (
        <div style={{ display:"flex", gap:5, justifyContent:"center", marginBottom:12 }}>
          {Array.from({ length: maxAtt }).map((_, i) => (
            <div key={i} style={{ width:28, height:6, borderRadius:3, transition:"background .3s", background: i < attempts ? "#c0404055" : "#5050e055" }}/>
          ))}
        </div>
      )}

      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
          <span style={{ fontSize:10, color:"#4a4a6a", fontWeight:700, letterSpacing:".1em" }}>HINTS</span>
          {status === "playing" && (freeHints + attempts) < visibleHints.length && (
            <span style={{ fontSize:10, color:"#4a4a6a" }}>next hint after wrong guess</span>
          )}
        </div>
        {(maxHints ? (game.hints||[]).slice(0,maxHints) : (game.hints||[])).map((hint, i) => {
          const unlocked = i < (freeHints + attempts) || status !== "playing";
          const isNew    = i === (freeHints + attempts) - 1 && status === "playing";
          return (
            <div key={i} className={unlocked?"gb-fade":""} style={{ padding:"10px 14px", borderRadius:10, marginBottom:5,
              border: unlocked?(isNew?"1px solid #5a4af6":"1px solid #2a2a40"):"1px dashed #1a1a28",
              background: unlocked?(isNew?"rgba(90,74,246,.1)":"#111120"):"transparent",
              fontSize:13, display:"flex", gap:9, alignItems:"flex-start", color:unlocked?"#c0c0e0":"#3a3a5a" }}>
              <span style={{ flexShrink:0, marginTop:1 }}>{unlocked ? "💡" : "🔒"}</span>
              <span style={{ lineHeight:1.5 }}>
                {unlocked
                  ? <>{hint}{isNew && <span style={{ marginLeft:6, fontSize:10, color:"#7c6af6", fontWeight:600 }}>NEW</span>}</>
                  : `Hint ${i+1} — unlocks after wrong guess ${i+1-freeHints}`}
              </span>
            </div>
          );
        })}
      </div>

      {status === "playing" && (
        <div className={shake?"gb-shake":""} style={{ display:"flex", gap:8 }}>
          <input ref={inputRef} className="gb-in" value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={handleKey}
            placeholder="Type the game title…"
            style={{ flex:1, padding:"12px 14px", borderRadius:10, border:"1px solid #2a2a40", background:"#0e0e1c", color:"#f0f0fa", fontSize:14, transition:"border-color .2s, box-shadow .2s" }}/>
          <button className="gb-pulse" onClick={submitGuess}
            style={{ padding:"12px 18px", borderRadius:10, background:"linear-gradient(135deg,#7c6af6,#9b87f8)", color:"#fff", border:"none", cursor:"pointer", fontWeight:700, fontSize:13, whiteSpace:"nowrap" }}>
            Guess →
          </button>
        </div>
      )}

      {nextReady && (
        <button className="gb-next gb-fade" onClick={onReadyForNext}
          style={{ width:"100%", padding:"13px", borderRadius:10, background:"linear-gradient(135deg,#7c6af6,#9b87f8)", color:"#fff", border:"none", cursor:"pointer", fontWeight:700, fontSize:14, marginTop:4, transition:"all .2s" }}>
          {nextLabel} <span style={{ fontSize:11, opacity:.65 }}>(or press Enter)</span>
        </button>
      )}
    </div>
  );
}
