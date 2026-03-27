/**
 * src/igdb.js — IGDB API Service
 *
 * All IGDB-related fetching and data transformation lives here.
 * The rest of the app only imports from this file — swap the API
 * without touching any game logic.
 */

// In production (GitHub Pages), point to your deployed proxy URL.
// Set REACT_APP_PROXY_URL in a .env.production file or your hosting env vars.
// e.g. REACT_APP_PROXY_URL=https://your-proxy.onrender.com/api/igdb
const PROXY = process.env.REACT_APP_PROXY_URL || "http://localhost:3001/api/igdb";

// Same for the health check base
const PROXY_BASE = process.env.REACT_APP_PROXY_URL
  ? process.env.REACT_APP_PROXY_URL.replace("/api/igdb", "")
  : "http://localhost:3001";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert IGDB's unix timestamp to a 4-digit year */
const toYear = (ts) => ts ? new Date(ts * 1000).getFullYear() : "Unknown";

/** Fix IGDB cover URL: swap size token and ensure https */
const toCoverUrl = (url) =>
  url
    ? "https:" + url.replace("t_thumb", "t_cover_big")
    : null;

/** Pick the first developer company from involved_companies */
const toStudio = (companies = []) => {
  const dev = companies.find((ic) => ic.developer);
  return dev?.company?.name ?? companies[0]?.company?.name ?? "Unknown Studio";
};

/** Build up to 4 hint strings from IGDB fields */
const toHints = (game) => {
  const hints = [];

  // Hint 1 — Genre (least revealing)
  if (game.genres?.length) {
    const genreNames = game.genres.map((g) => g.name).join(", ");
    hints.push(`This is a ${genreNames} game.`);
  }

  // Hint 2 — Release year
  if (game.first_release_date) {
    hints.push(`It was first released in ${toYear(game.first_release_date)}.`);
  }

  // Hint 3 — Developer studio
  const studio = toStudio(game.involved_companies ?? []);
  if (studio && studio !== "Unknown Studio") {
    hints.push(`It was developed by ${studio}.`);
  }

  // Hint 4 — Redacted summary sentence (most revealing, so last)
  if (game.summary) {
    const firstSentence = game.summary.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 20) {
      hints.push(redactTitle(firstSentence, game.name) + ".");
    }
  }

  // Fallback if data is sparse
  if (hints.length === 0) hints.push("No hints available for this game.");

  return hints;
};

/**
 * Replace any occurrence of the game title (or significant words from it)
 * in a hint string with "this game" so the answer isn't given away.
 */
function redactTitle(text, title) {
  if (!title) return text;

  // Build variants to redact: full title + each word over 3 chars
  const variants = [title];
  title.split(/\s+/).forEach((word) => {
    const clean = word.replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length > 3) variants.push(clean);
  });

  let result = text;
  variants.forEach((v) => {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "gi"), "this game");
  });
  return result;
}

/** Build a list of lowercase aliases for flexible answer matching */
const toAliases = (game) => {
  const base = [game.name.toLowerCase()];
  if (game.alternative_names) {
    game.alternative_names.forEach((a) => base.push(a.name.toLowerCase()));
  }
  return base;
};

/**
 * Transform a raw IGDB game object into the shape the game component expects.
 * This is the only place that knows about IGDB's data structure.
 */
export function transformGame(raw) {
  return {
    id:      raw.id,
    title:   raw.name,
    cover:   toCoverUrl(raw.cover?.url),
    year:    toYear(raw.first_release_date),
    genre:   raw.genres?.map((g) => g.name).join(" / ") ?? "Unknown",
    studio:  toStudio(raw.involved_companies),
    hints:   toHints(raw),
    aliases: toAliases(raw),
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch a batch of popular games from IGDB.
 * @param {number} limit  How many games to fetch (max 500 per IGDB rules)
 * @param {string} difficulty  "easy" | "medium" | "hard" — adjusts rating threshold
 */
export async function fetchGames(limit = 50, difficulty = "medium", excludeIds = []) {
  // More popular games on easy (recognisable covers), niche games on hard
  const ratingThresholds = { easy: 100, medium: 20, hard: 5 };
  const minRatings = ratingThresholds[difficulty] ?? 20;

  // Larger random offset for more variety across sessions
  const offset = Math.floor(Math.random() * 300);

  // Exclude already-seen game IDs so we never repeat
  const exclusion = excludeIds.length > 0
    ? ` & id != (${excludeIds.join(",")})` : "";

  const query = `fields name, cover.url, first_release_date, genres.name, involved_companies.developer, involved_companies.company.name, summary, alternative_names.name, rating_count; where cover != null & rating_count > ${minRatings}${exclusion}; sort rating_count desc; limit ${limit}; offset ${offset};`;

  const res = await fetch(`${PROXY}/games`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query }),
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (Array.isArray(errBody) && errBody[0]?.title) {
        errMsg = `${errBody[0].status} ${errBody[0].title}${errBody[0].cause ? ": " + errBody[0].cause : ""}`;
      } else if (errBody?.error) {
        errMsg = errBody.error;
      }
    } catch (_) { errMsg = res.statusText || errMsg; }
    throw new Error(errMsg);
  }

  const raw = await res.json();

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("IGDB returned 0 games — credentials may be invalid or query too strict.");
  }

  // Filter out any games without a cover (double safety)
  return raw.filter((g) => g.cover?.url).map(transformGame);
}

/**
 * Check whether the proxy server is reachable and credentials are set.
 * Returns { ok: boolean, message: string }
 */
export async function checkProxy() {
  try {
    const res  = await fetch(`${PROXY_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (!data.hasCredentials) {
      return { ok: false, message: "Proxy is running but IGDB credentials are missing in .env" };
    }
    return { ok: true, message: "Connected to IGDB" };
  } catch {
    return { ok: false, message: "Proxy server not running — using mock data" };
  }
}
