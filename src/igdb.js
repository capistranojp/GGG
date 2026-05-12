/**
 * src/igdb.js
 *
 * Kept deliberately simple. The previous versions failed because:
 *   1. `category = 0` combined with genre/theme filters shrinks the pool so much
 *      that offsets above ~80 return 0 results.
 *   2. Per-session random offsets could reach 300, way past the end of any
 *      filtered category.
 *
 * Fix: no category filter in BASE_WHERE, offsets 0-24 only (always safe),
 * 5-minute time-slot shared by every user (same games for everyone per slot).
 */

const PROXY_URL  = process.env.REACT_APP_PROXY_URL || "http://localhost:3001/api/igdb";
const PROXY_BASE = PROXY_URL.replace(/\/api\/igdb$/, "");

// ── Categories ────────────────────────────────────────────────────────────────
export const CATEGORIES = {
  random:       { label: "🎲 Random",       filter: "" },
  fighting:     { label: "🥊 Fighting",      filter: "& genres = (4)" },
  shooter:      { label: "🔫 Shooter",       filter: "& genres = (5)" },
  platform:     { label: "🏃 Platformer",    filter: "& genres = (8)" },
  puzzle:       { label: "🧩 Puzzle",        filter: "& genres = (9)" },
  racing:       { label: "🏎️ Racing",        filter: "& genres = (10)" },
  rpg:          { label: "⚔️ RPG",           filter: "& genres = (12)" },
  sports:       { label: "⚽ Sports",        filter: "& genres = (14)" },
  strategy:     { label: "🧠 Strategy",      filter: "& genres = (15)" },
  horror:       { label: "👻 Horror",        filter: "& themes = (19)" },
  survival:     { label: "🌲 Survival",      filter: "& themes = (21)" },
  indie:        { label: "🕹️ Indie",         filter: "& themes = (32)" },
  adventure:    { label: "🗺️ Adventure",     filter: "& genres = (31)" },
  multiplayer:  { label: "👥 Multiplayer",   filter: "& game_modes = (2)" },
  singleplayer: { label: "🧍 Single Player", filter: "& game_modes = (1)" },
};

const FIELDS = "name,cover.url,first_release_date,genres.name,involved_companies.developer,involved_companies.company.name,summary,alternative_names.name,rating_count";

// No category=0 — it over-restricts the pool and causes empty pages.
const BASE_WHERE = "cover != null";

// ── Helpers ───────────────────────────────────────────────────────────────────
const toYear = ts => ts ? new Date(ts * 1000).getFullYear() : "Unknown";

const toCoverUrl = url =>
  url ? "https:" + url.replace("t_thumb", "t_cover_big") : null;

const toStudio = (cos = []) => {
  const dev = cos.find(c => c.developer);
  return dev?.company?.name ?? cos[0]?.company?.name ?? "Unknown Studio";
};

function redactTitle(text, title) {
  if (!title || !text) return text;
  let r = text;
  [title, ...title.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, "")).filter(w => w.length > 3)]
    .forEach(v => {
      r = r.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "this game");
    });
  return r.replace(/\s{2,}/g, " ").trim();
}

function toHints(raw) {
  const h = [];
  if (raw.genres?.length)
    h.push(`This is a ${raw.genres.map(g => g.name).join(", ")} game.`);
  if (raw.first_release_date)
    h.push(`It was first released in ${toYear(raw.first_release_date)}.`);
  const studio = toStudio(raw.involved_companies ?? []);
  if (studio !== "Unknown Studio")
    h.push(`It was developed by ${studio}.`);
  if (raw.summary) {
    const s = raw.summary.split(/[.!?]/)[0].trim();
    if (s.length > 20) h.push(redactTitle(s, raw.name) + ".");
  }
  return h.length ? h : ["No hints available."];
}

export function transformGame(raw) {
  return {
    id:      raw.id,
    title:   raw.name,
    cover:   toCoverUrl(raw.cover?.url),
    year:    toYear(raw.first_release_date),
    genre:   raw.genres?.map(g => g.name).join(" / ") ?? "Unknown",
    studio:  toStudio(raw.involved_companies),
    hints:   toHints(raw),
    aliases: [raw.name, ...(raw.alternative_names ?? []).map(a => a.name)]
               .map(s => s.toLowerCase()),
  };
}

// ── Low-level fetch ───────────────────────────────────────────────────────────
async function igdbPost(endpoint, query) {
  const res = await fetch(`${PROXY_URL}/${endpoint}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query }),
  });

  if (!res.ok) {
    let msg = `Proxy error ${res.status}`;
    try { const b = await res.json(); msg = b?.error ?? b?.message ?? msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();

  // IGDB occasionally returns auth errors as a 200 with a JSON object, not array.
  if (!Array.isArray(data)) {
    throw new Error(`IGDB: ${data?.message ?? data?.error ?? JSON.stringify(data)}`);
  }

  return data;
}

// ── Time-slot system ──────────────────────────────────────────────────────────
// Every 5 minutes the slot number advances. All users in the same slot get
// the same IGDB offset → same batch of games. Offset is capped at 24 (0-24)
// so we never fall off the end of any filtered category.
const SLOT_MS = 5 * 60 * 1000;

function currentSlot() {
  return Math.floor(Date.now() / SLOT_MS);
}

// Distributes evenly across offsets 0-24 using a prime multiplier.
function slotToOffset(slot) {
  return (slot * 7) % 25;
}

// Module-level cache keyed by "category:minRatings:slot".
// Lives for the page session — one entry per slot per category/difficulty combo.
const _gameCache = new Map();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch games for the current 5-minute slot.
 * All users in the same window share the same query → same results.
 * excludeIds is filtered client-side (never sent to IGDB).
 * If all games in the current slot are seen, spills into the next slot.
 */
export async function fetchGames(
  difficulty   = "medium",
  category     = "random",
  excludeIds   = [],
  minRatingsOverride = null,
) {
  const minRatings = minRatingsOverride ?? { easy: 50, medium: 10, hard: 3 }[difficulty] ?? 10;
  const catFilter  = CATEGORIES[category]?.filter ?? "";
  const baseSlot   = currentSlot();

  for (let i = 0; i < 4; i++) {
    const slot     = baseSlot + i;
    const key      = `${category}:${minRatings}:${slot}`;

    if (!_gameCache.has(key)) {
      const offset = slotToOffset(slot);
      const query  = [
        `fields ${FIELDS}`,
        `where ${BASE_WHERE} & rating_count > ${minRatings}${catFilter}`,
        `sort rating_count desc`,
        `limit 25`,
        `offset ${offset}`,
      ].join("; ") + ";";

      const raw   = await igdbPost("games", query);
      const games = raw.filter(g => g.cover?.url).map(transformGame);

      if (games.length === 0) throw new Error("IGDB returned 0 games — try a different category");
      _gameCache.set(key, games);
    }

    const cached = _gameCache.get(key);
    const unseen = excludeIds.length
      ? cached.filter(g => !excludeIds.includes(g.id))
      : cached;

    if (unseen.length > 0) return unseen;
    // All games in this slot seen — try the next slot's batch.
  }

  // Absolute fallback: return the current slot regardless of seen status.
  return _gameCache.get(`${category}:${minRatings}:${baseSlot}`) ?? [];
}

/**
 * Fetch the daily game — same for every user, changes at midnight UTC.
 * Uses day-of-year mod 25 as the offset (0-24, always safe).
 */
export async function fetchDailyGame() {
  const now        = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear  = Math.floor((now - startOfYear) / 86_400_000) + 1; // 1–366
  const offset     = dayOfYear % 25; // 0–24

  const query = [
    `fields ${FIELDS}`,
    `where ${BASE_WHERE} & rating_count > 500`,
    `sort rating_count desc`,
    `limit 1`,
    `offset ${offset}`,
  ].join("; ") + ";";

  const raw = await igdbPost("games", query);
  if (raw.length === 0) throw new Error("IGDB returned no daily game");
  return transformGame(raw[0]);
}

// ── Index / Library ───────────────────────────────────────────────────────────

// IGDB website category numbers → store display info
const STORE_MAP = {
  1:  { name: "Official Site", icon: "🌐" },
  13: { name: "Steam",         icon: "🖥️"  },
  15: { name: "itch.io",       icon: "🕹️"  },
  16: { name: "Epic Games",    icon: "⚡"  },
  17: { name: "GOG",           icon: "🛒"  },
  10: { name: "App Store",     icon: "📱"  },
  12: { name: "Google Play",   icon: "📱"  },
};

const INDEX_FIELDS = [
  "name",
  "cover.url",
  "first_release_date",
  "genres.name",
  "themes.name",
  "platforms.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "involved_companies.company.name",
  "summary",
  "rating",
  "rating_count",
  "aggregated_rating",
  "aggregated_rating_count",
  "websites.url",
  "websites.category",
  "screenshots.url",
  "alternative_names.name",
].join(",");

function transformGameFull(raw) {
  const base   = transformGame(raw);
  const stores = (raw.websites ?? [])
    .filter(w => STORE_MAP[w.category])
    .map(w => ({ ...STORE_MAP[w.category], url: w.url }))
    .filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i); // de-dupe

  const devCo = (raw.involved_companies ?? []).find(c => c.developer);
  const pubCo = (raw.involved_companies ?? []).find(c => c.publisher);

  return {
    ...base,
    summary:      raw.summary ?? null,
    rating:       raw.rating            ? Math.round(raw.rating)            : null,
    ratingCount:  raw.rating_count      ?? 0,
    criticRating: raw.aggregated_rating ? Math.round(raw.aggregated_rating) : null,
    criticCount:  raw.aggregated_rating_count ?? 0,
    platforms:    (raw.platforms ?? []).map(p => p.name),
    themes:       (raw.themes    ?? []).map(t => t.name),
    developer:    devCo?.company?.name ?? null,
    publisher:    pubCo?.company?.name ?? null,
    screenshots:  (raw.screenshots ?? [])
                    .map(s => "https:" + s.url.replace("t_thumb", "t_screenshot_big"))
                    .slice(0, 4),
    stores,
  };
}

/**
 * Fetch a page of popular games for the Index library.
 * offset 0 = first 30, 30 = next 30, max 90.
 */
export async function fetchIndexGames(offset = 0) {
  const query = [
    `fields ${INDEX_FIELDS}`,
    `where cover != null & rating_count > 100`,
    `sort rating_count desc`,
    `limit 30`,
    `offset ${Math.min(offset, 90)}`,
  ].join("; ") + ";";

  const raw = await igdbPost("games", query);
  return raw.filter(g => g.cover?.url).map(transformGameFull);
}

/**
 * Search games by name using IGDB's full-text search.
 * Returns up to 15 results.
 */
export async function searchGames(query) {
  if (!query.trim()) return [];
  const q = [
    `search "${query.trim().replace(/"/g, "")}"`,
    `fields ${INDEX_FIELDS}`,
    `where cover != null`,
    `limit 15`,
  ].join("; ") + ";";

  const raw = await igdbPost("games", q);
  return raw.filter(g => g.cover?.url).map(transformGameFull);
}

// ── Keepalive — prevents Render free-tier from sleeping ──────────────────────
let _keepaliveTimer = null;

export function startKeepalive() {
  if (_keepaliveTimer) return;
  // Ping every 14 minutes (Render sleeps after 15 min idle on free tier).
  _keepaliveTimer = setInterval(
    () => fetch(`${PROXY_BASE}/api/health`).catch(() => {}),
    14 * 60 * 1000,
  );
  // Also ping immediately on startup to wake Render before the user needs it.
  fetch(`${PROXY_BASE}/api/health`).catch(() => {});
}

export function stopKeepalive() {
  clearInterval(_keepaliveTimer);
  _keepaliveTimer = null;
}
