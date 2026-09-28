# Unscramble Live 🍬
One-folder monorepo: Express + Socket.IO + tiktok-live-connector backend, Vite/React 9:16 frontend.

## Deploy on Render
Build Command `npm install` (postinstall builds the React client) · Start Command `npm start`
Env vars: `TIKTOK_USERNAME`, `TIKTOK_SIGN_API_KEY`, optional `ADMIN_PIN`, `ROUND_SECONDS`, `TEST_MODE=1`, `DATA_DIR`.
`DATA_DIR` (optional): folder for saved settings. Point it at a Render persistent disk (e.g. `/var/data`) so "Save & Apply" survives redeploys.

## Host toolbar (always visible, top of screen)
🎨 theme · ⏸ pause/resume · ⏭ skip · 🗂 categories · 💡 hint now · ⏰ +15s · 🔔 sound · ⛶ full screen · ⚙️ settings

## Save & Apply (⚙️ settings)
Change anything in Look / Layout / Game / Categories - nothing is applied until you press one of the two buttons at the bottom:
- **💾 Save & Apply** - applies all settings now and starts a fresh round. Settings are remembered.
- **⭐ Save & Apply as Default** - same, and also stores them as your defaults (look on this device, game + categories on the server in `data/defaults.json`).
- ✕ closes the panel and discards unsaved changes. Admin tab: reset to *my saved defaults* or to *factory settings*.

## One-row rule (strict)
Scrambled letters, revealed answers, hint letters, the category banner and the winner word are always shown in ONE row. Tiles are sized from the row width, so long answers get smaller tiles instead of wrapping. Keep "Max letters" around 20 or lower for comfortable reading (default 20, max 25).

## Categories
🗂 opens the category picker: **Random mix** (all ticked categories) or **Specific** (only the ones you pick; pick one to lock it).
New built-in categories live in `data/puzzles.extra.json` (Famous Places & Landmarks, Countries & Capitals, Famous Movies & TV Shows, Miscellaneous, Body Parts, Superheroes). It is merged on top of `puzzles.sample.json` / `puzzles.full.json` automatically - add your own categories or answers there (letters and spaces only).
Categories whose name contains "english", "common words", "random words" or "dictionary" are ignored automatically.

## Notes
- Default look is Cotton Candy + Fredoka font. If your phone kept old settings: ⚙️ → Admin → Reset.
- Test without TikTok: `TEST_MODE=1`, open `/?test=1`. Big DB: `node generate_db.js` -> `data/puzzles.full.json`.
