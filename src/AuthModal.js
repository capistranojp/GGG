/**
 * src/AuthModal.js — Register (new) or Login (returning) with password.
 */
import { useState } from "react";
import { useUser } from "./UserContext";

export default function AuthModal() {
  const { register, login, loading } = useUser();
  const [tab,      setTab]     = useState("register");
  const [name,     setName]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm] = useState("");
  const [showPw,   setShowPw]  = useState(false);
  const [error,    setError]   = useState("");

  function switchTab(t) { setTab(t); setName(""); setPassword(""); setConfirm(""); setError(""); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (tab === "register" && password !== confirm) {
      setError("Passwords do not match."); return;
    }
    const result = tab === "register"
      ? await register(name, password)
      : await login(name, password);
    if (!result.ok) setError(result.error);
  }

  const inputStyle = (hasError) => ({
    padding:"12px 16px", borderRadius:10, border: hasError?"1px solid #e07070":"1px solid #2a2a40",
    background:"#080810", color:"#f0f0fa", fontSize:14, width:"100%",
    outline:"none", boxSizing:"border-box",
  });

  const eyeBtn = {
    position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
    background:"none", border:"none", cursor:"pointer", color:"#4a4a6a", fontSize:16, padding:0,
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.9)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:"#0e0e1c", border:"1px solid #2a2a40", borderRadius:20, padding:"32px 28px", maxWidth:400, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:44, marginBottom:10 }}>🎮</div>
        <h2 style={{ fontSize:22, fontWeight:800, color:"#f0f0fa", marginBottom:18, letterSpacing:"-.5px" }}>GameGuess</h2>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, background:"#080810", borderRadius:10, padding:3, marginBottom:20 }}>
          {[["register","Register"],["login","Sign In"]].map(([t,l])=>(
            <button key={t} onClick={()=>switchTab(t)} style={{
              flex:1, padding:"9px", borderRadius:8, border:"none",
              background: tab===t?"linear-gradient(135deg,#7c6af6,#9b87f8)":"transparent",
              color: tab===t?"#fff":"#5a5a7a", cursor:"pointer",
              fontWeight: tab===t?700:400, fontSize:13, transition:"all .2s",
            }}>{l}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:10, textAlign:"left" }}>
          {/* Username */}
          <div>
            <input value={name} onChange={e=>{setName(e.target.value);setError("");}}
              placeholder={tab==="register"?"Username":"Username"}
              maxLength={20} autoFocus autoComplete="username"
              style={inputStyle(!!error && error.toLowerCase().includes("username"))}/>
          </div>

          {/* Password */}
          <div>
            <div style={{ position:"relative" }}>
              <input value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
                type={showPw?"text":"password"}
                placeholder={tab==="register"?"Password":"Password"}
                autoComplete={tab==="register"?"new-password":"current-password"}
                style={{ ...inputStyle(!!error && error.toLowerCase().includes("password")), paddingRight:40 }}/>
              <button type="button" style={eyeBtn} onClick={()=>setShowPw(v=>!v)}>{showPw?"🙈":"👁️"}</button>
            </div>
          </div>

          {/* Confirm password (register only) */}
          {tab === "register" && (
            <div>
              <label style={{ fontSize:11, color:"#4a4a6a", fontWeight:700, letterSpacing:".08em", display:"block", marginBottom:5 }}>CONFIRM PASSWORD</label>
              <div style={{ position:"relative" }}>
                <input value={confirm} onChange={e=>{setConfirm(e.target.value);setError("");}}
                  type={showPw?"text":"password"} placeholder="Repeat Password"
                  autoComplete="new-password"
                  style={{ ...inputStyle(!!error && error.toLowerCase().includes("match")), paddingRight:40 }}/>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p style={{ fontSize:12, color:"#e07070", margin:0, textAlign:"center" }}>⚠️ {error}</p>}

          {/* Hint */}
          <p style={{ fontSize:11, color:"#3a3a4a", margin:0, textAlign:"center" }}>
            {tab === "register"
              ? "Your account is tied to this username + password. Keep your password safe!"
              : "Enter the username and password you registered with."}
          </p>

          <button type="submit" disabled={loading || !name.trim() || !password}
            style={{
              padding:"13px", borderRadius:12, marginTop:4,
              background:(loading||!name.trim()||!password)?"#1a1a28":"linear-gradient(135deg,#7c6af6,#9b87f8)",
              color:(loading||!name.trim()||!password)?"#3a3a5a":"#fff",
              border:"none", cursor:(loading||!name.trim()||!password)?"not-allowed":"pointer",
              fontWeight:700, fontSize:15, transition:"all .2s",
            }}>
            {loading ? "Please wait…" : tab === "register" ? "Create Account →" : "Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}
