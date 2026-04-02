/**
 * server.js — IGDB API Proxy
 * Run: node server.js (port 3001)
 */

const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app  = express();
const PORT = process.env.PROXY_PORT || 3001;

// ── CORS — allow localhost dev AND GitHub Pages deployed site ─────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://capistranojp.github.io",
  // Add more origins here if you ever move the site
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── Token cache ───────────────────────────────────────────────────────────────
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
  if (!res.ok) throw new Error(`Twitch token error: ${await res.text()}`);
  const data     = await res.json();
  cachedToken    = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  console.log("✅ New Twitch token acquired");
  return cachedToken;
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasCredentials: !!(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET),
  });
});

// ── IGDB proxy ────────────────────────────────────────────────────────────────
app.post("/api/igdb/:endpoint", async (req, res) => {
  try {
    const token   = await getTwitchToken();
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
      console.error(`IGDB ${req.params.endpoint} error ${igdbRes.status}:`, errText);
      return res.status(igdbRes.status).json({ error: errText });
    }
    res.json(await igdbRes.json());
  } catch (err) {
    console.error("IGDB proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Debug endpoint ────────────────────────────────────────────────────────────
app.get("/api/test", async (req, res) => {
  const r = { clientId: !!process.env.IGDB_CLIENT_ID, clientSecret: !!process.env.IGDB_CLIENT_SECRET };
  try {
    const token = await getTwitchToken();
    r.twitchToken = "OK";
    const igdbRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": process.env.IGDB_CLIENT_ID, "Authorization": `Bearer ${token}`, "Content-Type": "text/plain" },
      body: "fields name; limit 1;",
    });
    r.igdbStatus   = igdbRes.status;
    r.igdbResponse = await igdbRes.text();
    r.igdbOk       = igdbRes.ok;
  } catch (err) { r.error = err.message; }
  res.json(r);
});

app.listen(PORT, () => {
  console.log(`\n🎮 IGDB Proxy running on http://localhost:${PORT}`);
  console.log(`   Client ID set: ${!!process.env.IGDB_CLIENT_ID}`);
  console.log(`   Secret set:    ${!!process.env.IGDB_CLIENT_SECRET}`);
  console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(", ")}\n`);
});
