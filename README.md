# Unscramble Live
One-folder monorepo: Express + Socket.IO + tiktok-live-connector backend, Vite/React 9:16 frontend.

## Deploy on Render
Build Command `npm install` (its postinstall builds the React client) · Start Command `npm start`
Env vars: `TIKTOK_USERNAME`, `TIKTOK_SIGN_API_KEY`, optional `ADMIN_PIN` (protects settings/pause/skip/reset), `ROUND_SECONDS`, `TEST_MODE=1`.

## Use
Open the Render URL in Chrome on the phone, go LIVE with Mobile Gaming, tap the screen to reveal the toolbar (theme, pause, skip, full screen, settings).
Display settings are saved on the phone; game settings are saved on the server.
Test without TikTok: `TEST_MODE=1` and open `/?test=1`.
Big database: `node generate_db.js` -> `data/puzzles.full.json`.
