import { useState, useEffect } from "react";
import { startKeepalive, stopKeepalive } from "./igdb";
import { UserProvider, useUser } from "./UserContext";
import AuthModal from "./AuthModal";
import Gamedle  from "./Gamedle";
import Infinite from "./Infinite";
import Index    from "./Index";

const CSS = `
  @keyframes spin    { to { transform:rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:#080810; color:#f0f0fa; -webkit-font-smoothing:antialiased; }
  button { font-family:inherit; }
  .mode-card { transition:transform .2s; }
  .mode-card:hover { transform:translateY(-2px); }
  .sign-out:hover { color:#e07070!important; }
`;

function ScreenWrap({ children, onBack, label, accent }) {
  return (
    <div style={{ minHeight:"100vh", background:"#080810", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:"rgba(8,8,16,.97)", backdropFilter:"blur(12px)", borderBottom:"1px solid #151520", padding:"12px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:20 }}>
        <button onClick={onBack} style={{ fontSize:12, color:"#6b6b8a", background:"none", border:"1px solid #1e1e2e", borderRadius:8, padding:"5px 10px", cursor:"pointer" }}>← Back</button>
        <span style={{ fontSize:14, fontWeight:700, color:accent, letterSpacing:".04em" }}>{label}</span>
      </div>
      <div style={{ padding:"28px 20px", maxWidth:560, margin:"0 auto" }}>{children}</div>
    </div>
  );
}

function ModeCard({ icon, title, badge, badgeColor, desc, tags, accent, onClick }) {
  return (
    <button className="mode-card" onClick={onClick} style={{ width:"100%", padding:"22px 20px", borderRadius:18, border:`1px solid ${accent}33`, background:`linear-gradient(135deg,${accent}10,${accent}04)`, cursor:"pointer", textAlign:"left", display:"block" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:24 }}>{icon}</span>
            <span style={{ fontSize:17, fontWeight:800, color:accent, letterSpacing:".02em" }}>{title}</span>
            {badge && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:`${badgeColor}22`, color:badgeColor, fontWeight:700 }}>{badge}</span>}
          </div>
          <p style={{ color:"#6b6b8a", fontSize:13, lineHeight:1.6, marginBottom:tags?10:0 }}>{desc}</p>
          {tags && <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>{tags.map(t=><span key={t} style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:`${accent}14`, color:accent }}>{t}</span>)}</div>}
        </div>
        <span style={{ fontSize:18, color:accent, marginLeft:12, marginTop:2, flexShrink:0 }}>→</span>
      </div>
    </button>
  );
}

function Inner() {
  const { isLoggedIn, username, signOut } = useUser();
  const [screen, setScreen] = useState("home");
  useEffect(() => {
    startKeepalive();
    return () => stopKeepalive();
  }, []);
  if (!isLoggedIn) return <AuthModal />;
  if (screen === "gamedle")  return <ScreenWrap onBack={()=>setScreen("home")} label="🏆 GAMEDLE"   accent="#f0c030"><Gamedle  onBack={()=>setScreen("home")}/></ScreenWrap>;
  if (screen === "infinite") return <ScreenWrap onBack={()=>setScreen("home")} label="♾️ INFINITE"  accent="#9b87f8"><Infinite onBack={()=>setScreen("home")} defaultTab="normal"/></ScreenWrap>;
  if (screen === "speedrun") return <ScreenWrap onBack={()=>setScreen("home")} label="⚡ SPEEDRUN"  accent="#e09070"><Infinite onBack={()=>setScreen("home")} defaultTab="speedrun"/></ScreenWrap>;
  if (screen === "index")    return <ScreenWrap onBack={()=>setScreen("home")} label="📚 GAME INDEX" accent="#4ec9b0"><Index    onBack={()=>setScreen("home")}/></ScreenWrap>;

  return (
    <div style={{ minHeight:"100vh", background:"#080810", fontFamily:"'Segoe UI',system-ui,sans-serif", padding:"0 20px 40px" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth:520, margin:"0 auto", display:"flex", justifyContent:"flex-end", alignItems:"center", paddingTop:16, gap:10 }}>
        <span style={{ fontSize:12, color:"#4a4a6a" }}>👤 {username}</span>
        <button className="sign-out" onClick={signOut} style={{ fontSize:11, color:"#3a3a5a", background:"none", border:"1px solid #1a1a28", borderRadius:8, padding:"4px 10px", cursor:"pointer", transition:"color .2s" }}>Sign out</button>
      </div>
      <div style={{ maxWidth:520, margin:"0 auto", paddingTop:28, paddingBottom:36, textAlign:"center", animation:"fadeUp .5s ease both" }}>
        <div style={{ fontSize:56, marginBottom:12, filter:"drop-shadow(0 0 28px rgba(124,106,246,.5))" }}>🎮</div>
        <h1 style={{ fontSize:38, fontWeight:900, letterSpacing:"-1.5px", color:"#f0f0fa", marginBottom:6 }}>GameGuess</h1>
        <p style={{ color:"#3a3a5a", fontSize:14 }}>Identify games from blurred cover art</p>
      </div>
      <div style={{ maxWidth:520, margin:"0 auto", display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ animation:"fadeUp .5s ease .05s both" }}>
          <ModeCard icon="🏆" title="GAMEDLE" badge="DAILY" badgeColor="#f0c030" accent="#f0c030"
            desc="One game per day — same for every player worldwide. Toggle Hard, Grayscale, or Flipped for bonus points and build your daily streak."
            onClick={()=>setScreen("gamedle")}/>
        </div>
        <div style={{ animation:"fadeUp .5s ease .1s both" }}>
          <ModeCard icon="♾️" title="INFINITE" accent="#9b87f8"
            desc="Endless games with no time pressure. Pick a genre, choose your difficulty, and chase the highest streak."
            tags={["🎲 Random","🥊 Fighting","🔫 Shooter","⚔️ RPG","👻 Horror","🕹️ Indie","+ 9 more"]}
            onClick={()=>setScreen("infinite")}/>
        </div>
        <div style={{ animation:"fadeUp .5s ease .15s both" }}>
          <ModeCard icon="⚡" title="SPEEDRUN" accent="#e09070"
            desc="Race the clock — how many games can you guess in 30s, 1 min, or 5 min? Choose your pool from Top 10 to Top 250."
            tags={["30s","1 min","2 min","5 min","Top 10","Top 50","Top 100","Top 250"]}
            onClick={()=>setScreen("speedrun")}/>
        </div>
        <div style={{ animation:"fadeUp .5s ease .2s both" }}>
          <ModeCard icon="📚" title="GAME INDEX" accent="#4ec9b0"
            desc="Browse the game library — ratings, synopsis, platforms, and where to buy or play. Search any title instantly."
            tags={["🔍 Search","⭐ Ratings","📖 Synopsis","🛒 Buy Links","🎮 Platforms"]}
            onClick={()=>setScreen("index")}/>
        </div>
      </div>
      <p style={{ textAlign:"center", fontSize:11, color:"#1a1a2a", marginTop:28 }}>Powered by IGDB · {new Date().toLocaleDateString()}</p>
    </div>
  );
}

export default function App() {
  return <UserProvider><Inner /></UserProvider>;
}
