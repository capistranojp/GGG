/**
 * src/Index.js — Game Library / Index
 * Browse top games by popularity, or search any title.
 * Tap a game card to see full details: synopsis, ratings, platforms, store links.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchIndexGames, searchGames } from "./igdb";

const SPIN = `
  @keyframes spin    { to { transform:rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
`;

// ── Sub-components ────────────────────────────────────────────────────────────

function RatingBar({ score, count, label, color }) {
  if (!score) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: "#5a5a7a" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>
          {score}<span style={{ color: "#3a3a5a", fontWeight: 400 }}>/100</span>
          {count > 0 && <span style={{ color: "#2a2a40", marginLeft: 5 }}>({count.toLocaleString()})</span>}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "#1a1a2a", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, borderRadius: 3,
          transition: "width .7s ease",
          background: `linear-gradient(90deg,${color}77,${color})` }} />
      </div>
    </div>
  );
}

function PlatformChip({ name }) {
  const icon =
    /playstation|ps[1-9]/i.test(name) ? "🎮" :
    /xbox/i.test(name)                ? "🕹️" :
    /nintendo|switch|wii|n64/i.test(name) ? "🃏" :
    /pc|windows|mac|linux/i.test(name)    ? "💻" :
    /ios|iphone|ipad/i.test(name)         ? "📱" :
    /android/i.test(name)                 ? "📱" : "🎮";
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20,
      background: "#161625", border: "1px solid #2a2a3a", color: "#6b6b8a",
      display: "inline-flex", gap: 4, alignItems: "center" }}>
      {icon} {name}
    </span>
  );
}

// ── Detail modal (bottom sheet) ───────────────────────────────────────────────
function GameDetail({ game, onClose }) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = [game.cover, ...(game.screenshots ?? [])].filter(Boolean);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.78)", zIndex: 200,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(5px)" }}>
      <style>{SPIN}</style>
      <div style={{ width: "100%", maxWidth: 560, maxHeight: "93vh", overflowY: "auto",
        background: "#0d0d1c", borderTop: "1px solid #2a2a40",
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        animation: "slideUp .28s ease both" }}>

        {/* Drag handle */}
        <div style={{ textAlign: "center", padding: "10px 0 2px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#2a2a40", display: "inline-block" }} />
        </div>

        {/* Image gallery */}
        <div style={{ position: "relative", height: 228, overflow: "hidden", background: "#080810" }}>
          {images[imgIdx] && (
            <img src={images[imgIdx]} alt={game.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", opacity: .88 }} />
          )}
          <div style={{ position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, transparent 35%, #0d0d1c 100%)" }} />

          {images.length > 1 && (
            <div style={{ position: "absolute", bottom: 10, left: 0, right: 0,
              display: "flex", gap: 5, justifyContent: "center" }}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} style={{
                  width: i === imgIdx ? 22 : 6, height: 6, borderRadius: 3, border: "none",
                  background: i === imgIdx ? "#7c6af6" : "#3a3a5a",
                  cursor: "pointer", transition: "all .2s", padding: 0 }} />
              ))}
            </div>
          )}

          <button onClick={onClose} style={{
            position: "absolute", top: 12, right: 12, width: 30, height: 30,
            borderRadius: "50%", background: "rgba(0,0,0,.65)", border: "1px solid #3a3a5a",
            color: "#c0c0e0", cursor: "pointer", fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ padding: "0 20px 36px" }}>

          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0fa",
              margin: "10px 0 4px", lineHeight: 1.2 }}>{game.title}</h2>
            <div style={{ fontSize: 12, color: "#5a5a7a", display: "flex",
              gap: 10, flexWrap: "wrap" }}>
              {game.year && <span>📅 {game.year}</span>}
              {game.developer && <span>🏢 {game.developer}</span>}
              {game.publisher && game.publisher !== game.developer &&
                <span>📦 {game.publisher}</span>}
            </div>
          </div>

          {/* Ratings */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "#111120",
            borderRadius: 12, border: "1px solid #1e1e2e" }}>
            <RatingBar score={game.rating}       count={game.ratingCount}  label="User Rating"   color="#7c6af6" />
            <RatingBar score={game.criticRating} count={game.criticCount}  label="Critic Rating" color="#f0c030" />
            {!game.rating && !game.criticRating && (
              <p style={{ color: "#3a3a5a", fontSize: 12, margin: 0, textAlign: "center" }}>No ratings available</p>
            )}
          </div>

          {/* Genre + themes */}
          {(game.genre || game.themes?.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {game.genre?.split(" / ").map(g => (
                <span key={g} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  background: "rgba(124,106,246,.12)", color: "#a99ef8",
                  border: "1px solid rgba(124,106,246,.2)" }}>{g}</span>
              ))}
              {game.themes?.slice(0, 4).map(t => (
                <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  background: "rgba(80,200,120,.08)", color: "#6fe0a0",
                  border: "1px solid rgba(80,200,120,.15)" }}>{t}</span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {game.summary && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 700,
                letterSpacing: ".1em", marginBottom: 6 }}>SYNOPSIS</div>
              <p style={{ fontSize: 13, color: "#b0b0d0", lineHeight: 1.75, margin: 0 }}>
                {game.summary}
              </p>
            </div>
          )}

          {/* Platforms */}
          {game.platforms?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 700,
                letterSpacing: ".1em", marginBottom: 8 }}>PLATFORMS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {game.platforms.slice(0, 10).map(p => <PlatformChip key={p} name={p} />)}
                {game.platforms.length > 10 && (
                  <span style={{ fontSize: 10, color: "#3a3a5a", padding: "2px 8px" }}>
                    +{game.platforms.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Store links */}
          <div>
            <div style={{ fontSize: 10, color: "#4a4a6a", fontWeight: 700,
              letterSpacing: ".1em", marginBottom: 8 }}>WHERE TO PLAY / BUY</div>
            {game.stores?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {game.stores.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "11px 14px", borderRadius: 10,
                      background: "#111120", border: "1px solid #2a2a40",
                      textDecoration: "none", color: "#c0c0e0",
                      fontSize: 13, fontWeight: 600, transition: "border-color .2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#5a5a8a"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a40"}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: "#4a4a6a" }}>↗</span>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ padding: "11px 14px", borderRadius: 10,
                background: "#111120", border: "1px solid #1e1e2e",
                fontSize: 12, color: "#3a3a5a", textAlign: "center" }}>
                No store links available for this title
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Game card (list row) ──────────────────────────────────────────────────────
function GameCard({ game, rank, onClick }) {
  const [hovered, setHovered] = useState(false);
  const scoreColor = !game.rating ? null
    : game.rating >= 80 ? "#6fe0a0"
    : game.rating >= 60 ? "#f0c030" : "#e07070";

  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: "100%", display: "flex", gap: 12, alignItems: "flex-start",
        padding: "11px 8px", background: hovered ? "rgba(124,106,246,.04)" : "none",
        border: "none", borderBottom: "1px solid #111120",
        cursor: "pointer", textAlign: "left", transition: "background .15s",
        borderRadius: hovered ? 10 : 0 }}>

      {rank != null && (
        <span style={{ fontSize: 11, minWidth: 26, paddingTop: 3, flexShrink: 0,
          fontWeight: 700, color: rank <= 3 ? ["#f0c030","#c0c0c0","#cd7f32"][rank-1] : "#2a2a3a" }}>
          {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : `${rank}.`}
        </span>
      )}

      <div style={{ width: 50, height: 66, borderRadius: 8, overflow: "hidden",
        flexShrink: 0, background: "#161622" }}>
        {game.cover
          ? <img src={game.cover} alt={game.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 22 }}>🎮</div>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0f8", marginBottom: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {game.title}
        </div>
        <div style={{ fontSize: 11, color: "#4a4a6a", marginBottom: 5,
          display: "flex", gap: 6, flexWrap: "wrap" }}>
          {game.year && <span>{game.year}</span>}
          {game.developer && <><span style={{ color: "#2a2a3a" }}>·</span><span>{game.developer}</span></>}
        </div>
        {game.genre && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {game.genre.split(" / ").slice(0, 3).map(g => (
              <span key={g} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20,
                background: "rgba(124,106,246,.1)", color: "#8878e8" }}>{g}</span>
            ))}
          </div>
        )}
        {game.summary && (
          <p style={{ fontSize: 11, color: "#3a3a5a", margin: "5px 0 0", lineHeight: 1.5,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {game.summary}
          </p>
        )}
      </div>

      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column",
        alignItems: "flex-end", gap: 4, paddingTop: 2 }}>
        {game.rating && (
          <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor,
            background: "rgba(0,0,0,.35)", padding: "2px 7px", borderRadius: 8 }}>
            {game.rating}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#2a2a3a" }}>↗</span>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Index() {
  const [query,       setQuery]       = useState("");
  const [games,       setGames]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching,   setSearching]   = useState(false);
  const [error,       setError]       = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [offset,      setOffset]      = useState(0);
  const [hasMore,     setHasMore]     = useState(true);
  const [isSearch,    setIsSearch]    = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  const loadBrowse = useCallback(async (off = 0, append = false) => {
    off === 0 ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchIndexGames(off);
      setGames(prev => append ? [...prev, ...data] : data);
      setOffset(off);
      setHasMore(data.length === 30);
      setIsSearch(false);
    } catch {
      setError("Could not load games. Check your connection and try again.");
    }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => { loadBrowse(0); }, [loadBrowse]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setIsSearch(false); loadBrowse(0); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      setError(null);
      try {
        const data = await searchGames(query);
        setGames(data); setIsSearch(true); setHasMore(false);
      } catch { setError("Search failed — try again."); }
      setSearching(false);
    }, 450);
    return () => clearTimeout(debounceRef.current);
  }, [query]); // eslint-disable-line

  function clearSearch() { setQuery(""); setSearching(false); inputRef.current?.focus(); }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <style>{SPIN}</style>

      {/* Sticky search bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10,
        background: "#080810", paddingBottom: 10, paddingTop: 2 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%",
            transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none",
            display: "flex", alignItems: "center" }}>
            {searching
              ? <span style={{ display: "inline-block", width: 15, height: 15,
                  border: "2px solid #2a2a40", borderTopColor: "#7c6af6",
                  borderRadius: "50%", animation: "spin .7s linear infinite" }} />
              : "🔍"}
          </span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search any game…"
            style={{ width: "100%", padding: "11px 38px", borderRadius: 12,
              border: "1px solid #2a2a40", background: "#0e0e1c",
              color: "#f0f0fa", fontSize: 14, outline: "none",
              boxSizing: "border-box", transition: "border-color .2s" }}
            onFocus={e => e.target.style.borderColor = "#5a4af6"}
            onBlur={e  => e.target.style.borderColor = "#2a2a40"} />
          {query && (
            <button onClick={clearSearch} style={{ position: "absolute", right: 10,
              top: "50%", transform: "translateY(-50%)", background: "none",
              border: "none", color: "#4a4a6a", cursor: "pointer",
              fontSize: 16, padding: "0 4px" }}>✕</button>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 10, color: "#2a2a40", fontWeight: 700, letterSpacing: ".1em" }}>
            {isSearch ? `SEARCH RESULTS — "${query}"` : "TOP GAMES BY POPULARITY"}
          </span>
          {games.length > 0 && (
            <span style={{ fontSize: 10, color: "#1e1e30" }}>{games.length} shown</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "11px 16px", borderRadius: 10, marginBottom: 12,
          background: "rgba(220,80,80,.08)", border: "1px solid rgba(220,80,80,.2)",
          color: "#e07070", fontSize: 13, textAlign: "center" }}>
          {error}{" "}
          <button onClick={() => loadBrowse(0)} style={{ background: "none", border: "none",
            color: "#e09090", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: 220, gap: 12 }}>
          <div style={{ width: 28, height: 28, border: "3px solid #1e1e30",
            borderTopColor: "#4ec9b0", borderRadius: "50%",
            animation: "spin .8s linear infinite" }} />
          <p style={{ color: "#4a4a6a", fontSize: 13, margin: 0 }}>Loading game library…</p>
        </div>
      )}

      {/* List */}
      {!loading && (
        <>
          {games.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#3a3a5a" }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>🎮</div>
              <p style={{ margin: 0, fontSize: 14 }}>
                {query ? `No games found for "${query}"` : "No games found."}
              </p>
            </div>
          )}
          {games.map((g, i) => (
            <div key={g.id}
              style={{ animation: `fadeUp .3s ease ${Math.min(i, 12) * 0.025}s both` }}>
              <GameCard game={g} rank={isSearch ? null : i + 1}
                onClick={() => setSelected(g)} />
            </div>
          ))}

          {/* Load more */}
          {hasMore && !isSearch && (
            <div style={{ textAlign: "center", padding: "18px 0 8px" }}>
              {loadingMore
                ? <div style={{ display: "inline-flex", alignItems: "center",
                    gap: 8, color: "#4a4a6a", fontSize: 13 }}>
                    <div style={{ width: 16, height: 16, border: "2px solid #2a2a40",
                      borderTopColor: "#4ec9b0", borderRadius: "50%",
                      animation: "spin .7s linear infinite" }} />
                    Loading more…
                  </div>
                : <button onClick={() => loadBrowse(offset + 30, true)}
                    style={{ padding: "10px 26px", borderRadius: 10,
                      border: "1px solid #2a2a40", background: "#0e0e1c",
                      color: "#8888aa", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    Load more games ↓
                  </button>
              }
            </div>
          )}
          {isSearch && games.length > 0 && (
            <p style={{ textAlign: "center", fontSize: 11, color: "#2a2a3a", padding: "10px 0 4px" }}>
              Top {games.length} results ·{" "}
              <button onClick={clearSearch} style={{ background: "none", border: "none",
                color: "#4a4a6a", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
                Clear search
              </button>
            </p>
          )}
        </>
      )}

      {selected && <GameDetail game={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
