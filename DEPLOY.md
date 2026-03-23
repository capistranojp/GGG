# Deploying GameGuess to GitHub Pages

## Overview
GitHub Pages hosts only **static files** — your React app deploys fine,
but the Express proxy server (`server.js`) cannot run there. You have two options:

---

## Option A — Deploy with Mock Data only (simplest, no backend needed)
Good for: showcasing the project, no live IGDB needed.

### Steps

1. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Edit `package.json`** — add these two things:
   ```json
   {
     "homepage": "https://capistranojp.github.io/GGG",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d build"
     }
   }
   ```
   Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME` with your actual values.

3. **Deploy:**
   ```bash
   npm run deploy
   ```
   This builds the app and pushes it to a `gh-pages` branch automatically.

4. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Set Source to `Deploy from a branch` → `gh-pages` → `/ (root)`
   - Wait ~2 minutes, then visit your homepage URL

---

## Option B — Deploy with Live IGDB (requires a hosted proxy)
Good for: a fully working game with real IGDB data in production.

### Step 1 — Deploy the proxy to Render (free tier)

1. Create a free account at https://render.com
2. Click **New → Web Service** → connect your GitHub repo
3. Set these fields:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Under **Environment Variables**, add:
   ```
   IGDB_CLIENT_ID      = your_client_id
   IGDB_CLIENT_SECRET  = your_client_secret
   ```
5. Deploy — Render gives you a URL like `https://gameguess-proxy.onrender.com`

### Step 2 — Tell the React app where the proxy lives

Create a file called `.env.production` in your project root:
```
REACT_APP_PROXY_URL=https://gameguess-proxy.onrender.com/api/igdb
```

### Step 3 — Update CORS in server.js

Open `server.js` and update the CORS line to allow your GitHub Pages domain:
```js
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://YOUR_GITHUB_USERNAME.github.io"
  ]
}));
```

### Step 4 — Deploy the React app
Follow the same steps as Option A (steps 1–4 above).

---

## Important Notes

- **Never commit `.env` to Git.** It contains your secrets.
  Make sure `.env` is in your `.gitignore` (Create React App adds it by default).
- The `REACT_APP_` prefix is required — CRA only exposes env vars with that prefix to the browser.
- `.env.production` is safe to commit since it only contains the public proxy URL, not secrets.
- On Render's free tier, the proxy "sleeps" after 15 minutes of inactivity and takes ~30 seconds to wake up on the first request. The app will fall back to mock data during that wake-up time.
