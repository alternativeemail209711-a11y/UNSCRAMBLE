# Unscramble Live
One-folder monorepo: Express + Socket.IO + tiktok-live-connector backend, Vite/React 9:16 frontend.

## Deploy (Render.com -> New Web Service -> connect the GitHub repo)
- Build Command: `npm run build`
- Start Command: `npm start`
- Env vars: `TIKTOK_USERNAME` (no @), `TIKTOK_SIGN_API_KEY` (eulerstream.com), optional `ROUND_SECONDS` (default 90)

## Use
1. Open your Render URL in Chrome on the phone.
2. Go LIVE on TikTok with Mobile Gaming (screen share). The server keeps retrying until you are live, then chat is read automatically.
3. Rounds run forever: 90s round (or first correct guess) -> 10s reveal -> next.

## Local test (no TikTok)
`TEST_MODE=1 node server.js` (after `npm run build`) and open `http://localhost:3000/?test=1`.

## Big database
`node generate_db.js` -> creates `data/puzzles.full.json` (auto-loaded). Extend SOURCES or add `data/custom/<CATEGORY>.txt`.
