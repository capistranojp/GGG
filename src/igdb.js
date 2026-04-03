/**
 * src/igdb.js
 *
 * Architecture change: checkProxy() is NO LONGER used to gate game fetching.
 * fetchGames() and fetchDailyGame() just try to fetch directly and throw on failure.
 * Callers decide whether to fall back to mock — and they log the real error.
 *
 * To add a new category: add one entry to CATEGORIES. That's it.
 */

const PROXY_URL  = process.env.REACT_APP_PROXY_URL || "http://localhost:3001/api/igdb";
const PROXY_BASE = PROXY_URL.replace(/\/api\/igdb$/, "");

// ── Categories ─────────────────────────────────────────────────────────────────
// IGDB genre IDs: 4=Fighting,5=Shooter,8=Platform,9=Puzzle,10=Racing,
//   12=RPG,14=Sports,15=Strategy,31=Adventure
// IGDB theme IDs: 19=Horror,21=Survival,23=Stealth,32=Indie
// IGDB game_modes: 1=Single Player,2=Multiplayer,3=Co-op
export const CATEGORIES = {
  random:       { label: "🎲 Random",       extraWhere: "" },
  indie:        { label: "🕹️ Indie",         extraWhere: "& themes = (32) & rating_count < 2000 & genres != (14)" },
  multiplayer:  { label: "👥 Multiplayer",   extraWhere: "& game_modes = (2)" },
  singleplayer: { label: "🧍 Single Player", extraWhere: "& game_modes = (1)" },
  fighting:     { label: "🥊 Fighting",      extraWhere: "& genres = (4)" },
  shooter:      { label: "🔫 Shooter",       extraWhere: "& genres = (5)" },
  rpg:          { label: "⚔️ RPG",           extraWhere: "& genres = (12)" },
  horror:       { label: "👻 Horror",        extraWhere: "& themes = (19)" },
  sports:       { label: "⚽ Sports",        extraWhere: "& genres = (14)" },
  racing:       { label: "🏎️ Racing",         extraWhere: "& genres = (10)" },
  strategy:     { label: "🧠 Strategy",      extraWhere: "& genres = (15)" },
  platform:     { label: "🏃 Platformer",    extraWhere: "& genres = (8)" },
  adventure:    { label: "🗺️ Adventure",      extraWhere: "& genres = (31)" },
  survival:     { label: "🌲 Survival",      extraWhere: "& themes = (21)" },
  puzzle:       { label: "🧩 Puzzle",        extraWhere: "& genres = (9)" },
};

const FIELDS = [
  "name",
  "cover.url",
  "first_release_date",
  "genres.name",
  "involved_companies.developer",
  "involved_companies.company.name",
  "summary",
  "alternative_names.name",
  "rating_count",
].join(",");

// category = 0 = Main Game (excludes remasters=9, remakes=8, ports=11, etc.)
const BASE_WHERE = "cover != null & category = 0";

// ── Helpers ───────────────────────────────────────────────────────────────────
const toYear     = ts  => ts ? new Date(ts * 1000).getFullYear() : "Unknown";
const toCoverUrl = url => url ? "https:" + url.replace("t_thumb", "t_cover_big") : null;
const toStudio   = (cos = []) => {
  const dev = cos.find(ic => ic.developer);
  return dev?.company?.name ?? cos[0]?.company?.name ?? "Unknown Studio";
};

function redactTitle(text, title) {
  if (!title) return text;
  const variants = [title];
  title.split(/\s+/).forEach(w => {
    const c = w.replace(/[^a-zA-Z0-9]/g, "");
    if (c.length > 3) variants.push(c);
  });
  let r = text;
  variants.forEach(v => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    r = r.replace(new RegExp(esc, "gi"), "this game");
  });
  r = r.replace(/this game\s*:[^,.(]*/gi, "this game");
  r = r.replace(/\(also known as this game[^)]*\)/gi, "").trim();
  r = r.replace(/this game\s*[-–—][^,.()]*/gi, "this game");
  return r.replace(/\s{2,}/g, " ").trim();
}

const toHints = game => {
  const h = [];
  if (game.genres?.length)
    h.push(`This is a ${game.genres.map(g => g.name).join(", ")} game.`);
  if (game.first_release_date)
    h.push(`It was first released in ${toYear(game.first_release_date)}.`);
  const studio = toStudio(game.involved_companies ?? []);
  if (studio && studio !== "Unknown Studio")
    h.push(`It was developed by ${studio}.`);
  if (game.summary) {
    const s = game.summary.split(/[.!?]/)[0].trim();
    if (s.length > 20) h.push(redactTitle(s, game.name) + ".");
  }
  if (!h.length) h.push("No hints available.");
  return h;
};

const toAliases = game => {
  const base = [game.name.toLowerCase()];
  (game.alternative_names || []).forEach(a => base.push(a.name.toLowerCase()));
  return base;
};

export function transformGame(raw) {
  return {
    id:      raw.id,
    title:   raw.name,
    cover:   toCoverUrl(raw.cover?.url),
    year:    toYear(raw.first_release_date),
    genre:   raw.genres?.map(g => g.name).join(" / ") ?? "Unknown",
    studio:  toStudio(raw.involved_companies),
    hints:   toHints(raw),
    aliases: toAliases(raw),
  };
}

// ── Core fetch — THROWS on any failure, caller decides what to do ─────────────
async function igdbPost(endpoint, query) {
  const res = await fetch(`${PROXY_URL}/${endpoint}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query }),
  });

  if (!res.ok) {
    let msg = `Proxy HTTP ${res.status}`;
    try {
      const b = await res.json();
      if (Array.isArray(b) && b[0]?.title) msg = `IGDB ${b[0].status}: ${b[0].title}`;
      else if (b?.error) msg = b.error;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();
  return data;
}

// ── Session offset — different game pool per browser session ──────────────────
function getSessionOffset() {
  let seed = sessionStorage.getItem("ggg_seed");
  if (!seed) {
    seed = String(Math.floor(Math.random() * 200));
    sessionStorage.setItem("ggg_seed", seed);
  }
  return parseInt(seed, 10);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a batch of games from IGDB.
 * THROWS on failure — callers should catch and fall back to mock if needed.
 */
export async function fetchGames(
  limit = 50,
  difficulty = "medium",
  excludeIds = [],
  category = "random",
  minRatingsOverride = null
) {
  const thresholds = { easy: 100, medium: 20, hard: 5 };
  const minRatings = minRatingsOverride ?? thresholds[difficulty] ?? 20;
  const offset     = (Math.floor(Math.random() * 100) + getSessionOffset()) % 300;
  const exclusion  = excludeIds.length ? ` & id != (${excludeIds.join(",")})` : "";
  const catFilter  = CATEGORIES[category]?.extraWhere ?? "";

  const query = [
    `fields ${FIELDS}`,
    `where ${BASE_WHERE} & rating_count > ${minRatings}${exclusion}${catFilter}`,
    `sort rating_count desc`,
    `limit ${limit}`,
    `offset ${offset}`,
  ].join("; ") + ";";

  const raw = await igdbPost("games", query);

  if (!Array.isArray(raw) || raw.length === 0)
    throw new Error("IGDB returned 0 games for this query");

  const games = raw.filter(g => g.cover?.url).map(transformGame);
  if (games.length === 0)
    throw new Error("All returned games had no cover");

  return games;
}

/**
 * Fetch the daily game from IGDB.
 * THROWS on failure — caller falls back to mock.
 */
export async function fetchDailyGame() {
  const today  = new Date().toISOString().slice(0, 10);
  const offset = parseInt(today.replace(/-/g, "").slice(-6), 10) % 250;

  const query = [
    `fields ${FIELDS}`,
    `where ${BASE_WHERE} & rating_count > 300`,
    `sort rating_count desc`,
    `limit 1`,
    `offset ${offset}`,
  ].join("; ") + ";";

  const raw = await igdbPost("games", query);

  if (!Array.isArray(raw) || raw.length === 0)
    throw new Error("IGDB returned no daily game");

  return transformGame(raw[0]);
}

/**
 * Check proxy status — used ONLY for the status indicator in the UI.
 * NOT used to gate game fetching.
 */
export async function checkProxy() {
  try {
    const res  = await fetch(`${PROXY_BASE}/api/health`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { ok: false, message: `Proxy HTTP ${res.status}` };
    const data = await res.json();
    if (!data.hasCredentials)
      return { ok: false, message: "Proxy missing IGDB credentials" };
    return { ok: true, message: "Connected to IGDB" };
  } catch (err) {
    return { ok: false, message: `Proxy unreachable: ${err.message}` };
  }
}

/**
 * Warm up the Render free-tier server immediately on app load.
 * Fire-and-forget — does not block anything.
 */
export function warmupProxy() {
  fetch(`${PROXY_BASE}/api/health`).catch(() => {});
}

// ── Keepalive ─────────────────────────────────────────────────────────────────
let _keepaliveTimer = null;

export function startKeepalive() {
  if (_keepaliveTimer) return;
  _keepaliveTimer = setInterval(() => {
    fetch(`${PROXY_BASE}/api/health`).catch(() => {});
  }, 30_000);
}

export function stopKeepalive() {
  clearInterval(_keepaliveTimer);
  _keepaliveTimer = null;
}
