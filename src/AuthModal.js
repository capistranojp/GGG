/**
 * src/AuthModal.js — Username prompt shown on first visit.
 * No password, no email. Just a unique display name.
 */
import { useState } from "react";
import { useUser } from "./UserContext";

export default function AuthModal() {
  const { register, loading } = useUser();
  const [name,  setName]  = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const result = await register(name);
    if (!result.ok) setError(result.error);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:"#0e0e1c", border:"1px solid #2a2a40", borderRadius:20, padding:"32px 28px", maxWidth:380, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🎮</div>
        <h2 style={{ fontSize:22, fontWeight:800, color:"#f0f0fa", marginBottom:6, letterSpacing:"-.5px" }}>Pick a username</h2>
        <p style={{ fontSize:13, color:"#5a5a7a", marginBottom:24, lineHeight:1.6 }}>
          Your scores and streaks will be saved globally.<br />
          No password needed — just a unique name.
        </p>

        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
            placeholder="e.g. capistranojp"
            maxLength={20}
            autoFocus
            style={{ padding:"13px 16px", borderRadius:12, border: error?"1px solid #e07070":"1px solid #2a2a40", background:"#080810", color:"#f0f0fa", fontSize:15, textAlign:"center", letterSpacing:".03em", outline:"none" }}
          />
          {error && <p style={{ fontSize:12, color:"#e07070", margin:0 }}>{error}</p>}
          <p style={{ fontSize:11, color:"#3a3a4a", margin:0 }}>
            Letters, numbers, underscores · 2–20 chars
          </p>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{ padding:"13px", borderRadius:12, background: (loading || !name.trim()) ? "#1a1a28" : "linear-gradient(135deg,#7c6af6,#9b87f8)", color: (loading || !name.trim()) ? "#3a3a5a" : "#fff", border:"none", cursor: (loading || !name.trim()) ? "not-allowed" : "pointer", fontWeight:700, fontSize:15, transition:"all .2s" }}
          >
            {loading ? "Checking…" : "Let's Play →"}
          </button>
        </form>
      </div>
    </div>
  );
}
