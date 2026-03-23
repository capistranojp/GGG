/**
 * server.js — IGDB API Proxy
 *
 * IGDB requires a Twitch OAuth token and your Client Secret, which must
 * NEVER be exposed in the browser. This Express server sits between your
 * React app and IGDB, handles authentication, and forwards requests.
 *
 * Run alongside your React app:
 *   terminal 1 → node server.js      (this file, port 3001)
 *   terminal 2 → npm start           (React app, port 3000)
 */

const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app  = express();
const PORT = process.env.PROXY_PORT || 3001;

// ── Token cache (Twitch tokens last ~60 days, no need to re-fetch every call) ─
let cachedToken    = null;
let tokenExpiresAt = 0;

async function getTwitchToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.IGDB_CLIENT_ID,
      client_secret: process.env.IGDB_CLIENT_SECRET,
      grant_type:    "client_credentials",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twitch token error: ${err}`);
  }

  const data      = await res.json();
  cachedToken     = data.access_token;
  // Expire 5 minutes early to be safe
  tokenExpiresAt  = Date.now() + (data.expires_in - 300) * 1000;
  console.log("✅ New Twitch token acquired");
  return cachedToken;
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://capistranojp.github.io"
  ]
}));// Only allow your React dev server
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasCredentials: !!(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET) });
});

// ── Generic IGDB proxy ────────────────────────────────────────────────────────
// Usage: POST /api/igdb/:endpoint  with body = raw IGDB query string
// Example: POST /api/igdb/games    body: "fields name,cover.url; limit 10;"
app.post("/api/igdb/:endpoint", async (req, res) => {
  try {
    const token = await getTwitchToken();
    const igdbRes = await fetch(`https://api.igdb.com/v4/${req.params.endpoint}`, {
      method:  "POST",
      headers: {
        "Client-ID":     process.env.IGDB_CLIENT_ID,
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "text/plain",
      },
      body: req.body.query,
    });

    if (!igdbRes.ok) {
      const errText = await igdbRes.text();
      return res.status(igdbRes.status).json({ error: errText });
    }

    const data = await igdbRes.json();
    res.json(data);
  } catch (err) {
    console.error("IGDB proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Debug / test endpoint ─────────────────────────────────────────────────────
// Open http://localhost:3001/api/test in your browser to diagnose credential issues
app.get("/api/test", async (req, res) => {
  const results = { clientId: !!process.env.IGDB_CLIENT_ID, clientSecret: !!process.env.IGDB_CLIENT_SECRET };

  // Step 1: Try getting a Twitch token
  try {
    const token = await getTwitchToken();
    results.twitchToken = "OK";

    // Step 2: Try a minimal IGDB query
    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.IGDB_CLIENT_ID,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: "fields name; limit 1;",
    });
    const igdbBody = await igdbRes.text();
    results.igdbStatus = igdbRes.status;
    results.igdbResponse = igdbBody;
    results.igdbOk = igdbRes.ok;
  } catch (err) {
    results.error = err.message;
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`\n🎮 IGDB Proxy running on http://localhost:${PORT}`);
  console.log(`   Client ID set: ${!!process.env.IGDB_CLIENT_ID}`);
  console.log(`   Secret set:    ${!!process.env.IGDB_CLIENT_SECRET}\n`);
});
