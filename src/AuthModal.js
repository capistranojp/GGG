/**
 * src/AuthModal.js — Register (new) or Login (returning) tabs.
 */
import { useState } from "react";
import { useUser } from "./UserContext";

export default function AuthModal() {
  const { register, login, loading } = useUser();
  const [tab,   setTab]  = useState("register"); // "register" | "login"
  const [name,  setName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const result = tab === "register" ? await register(name) : await login(name);
    if (!result.ok) setError(result.error);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:"#0e0e1c", border:"1px solid #2a2a40", borderRadius:20, padding:"32px 28px", maxWidth:380, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🎮</div>
        <h2 style={{ fontSize:22, fontWeight:800, color:"#f0f0fa", marginBottom:20, letterSpacing:"-.5px" }}>GameGuess</h2>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, background:"#080810", borderRadius:10, padding:3, marginBottom:22 }}>
          {[["register","New Player"],["login","Returning Player"]].map(([t,l])=>(
            <button key={t} onClick={()=>{ setTab(t); setName(""); setError(""); }}
              style={{ flex:1, padding:"9px", borderRadius:8, border:"none", background:tab===t?"linear-gradient(135deg,#7c6af6,#9b87f8)":"transparent", color:tab===t?"#fff":"#5a5a7a", cursor:"pointer", fontWeight:tab===t?700:400, fontSize:12, transition:"all .2s" }}>
              {l}
            </button>
          ))}
        </div>

        <p style={{ fontSize:12, color:"#4a4a6a", marginBottom:18, lineHeight:1.6 }}>
          {tab === "register"
            ? "Pick a unique username. Your scores and streaks will be saved globally."
            : "Enter your username to restore your account and scores."}
        </p>

        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <input
            value={name}
            onChange={e=>{ setName(e.target.value); setError(""); }}
            placeholder={tab === "register" ? "e.g. capistranojp" : "Your username"}
            maxLength={20} autoFocus
            style={{ padding:"13px 16px", borderRadius:12, border:error?"1px solid #e07070":"1px solid #2a2a40", background:"#080810", color:"#f0f0fa", fontSize:15, textAlign:"center", outline:"none" }}
          />
          {error && <p style={{ fontSize:12, color:"#e07070", margin:0 }}>{error}</p>}
          {tab === "register" && <p style={{ fontSize:11, color:"#3a3a4a", margin:0 }}>Letters, numbers, underscores · 2–20 chars</p>}
          {tab === "login"    && <p style={{ fontSize:11, color:"#3a3a4a", margin:0 }}>⚠️ Anyone with your username can sign in — keep it private!</p>}
          <button type="submit" disabled={loading || !name.trim()}
            style={{ padding:"13px", borderRadius:12, background:(loading||!name.trim())?"#1a1a28":"linear-gradient(135deg,#7c6af6,#9b87f8)", color:(loading||!name.trim())?"#3a3a5a":"#fff", border:"none", cursor:(loading||!name.trim())?"not-allowed":"pointer", fontWeight:700, fontSize:15, transition:"all .2s" }}>
            {loading ? "Checking…" : tab === "register" ? "Create Account →" : "Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}
