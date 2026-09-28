# Unscramble Live 🍬
One-folder monorepo: Express + Socket.IO + tiktok-live-connector backend, Vite/React 9:16 frontend.

## Deploy on Render
Build Command `npm install` (postinstall builds the React client) · Start Command `npm start`
Env vars: `TIKTOK_USERNAME`, `TIKTOK_SIGN_API_KEY`, optional `ADMIN_PIN`, `ROUND_SECONDS`, `TEST_MODE=1`.

## Host toolbar (always visible, top of screen)
🎨 theme · ⏸ pause/resume · ⏭ skip · 💡 hint now · ⏰ +15s · 🔔 sound · ⛶ full screen · ⚙️ settings

## Notes
- Categories whose name contains "english", "common words", "random words" or "dictionary" are ignored automatically.
- Default look is Cotton Candy + Fredoka font. If your phone kept old settings: ⚙️ → Admin → Reset display settings.
- Test without TikTok: `TEST_MODE=1`, open `/?test=1`. Big DB: `node generate_db.js` -> `data/puzzles.full.json`.
