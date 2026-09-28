# Unscramble Live 🍬
One-folder monorepo: Express + Socket.IO + tiktok-live-connector backend, Vite/React 9:16 frontend.

## Deploy on Render
Build Command `npm install` (postinstall builds the React client) · Start Command `npm start`
Env vars: `TIKTOK_USERNAME`, `TIKTOK_SIGN_API_KEY`, optional `ADMIN_PIN`, `ROUND_SECONDS`, `APP_MODE` (`test` | `live` | `offline`), `DATA_DIR`.
(See `.env.example`. The old `TEST_MODE=1` still works and means `APP_MODE=test`.)
`DATA_DIR` (optional): folder for saved settings. Point it at a Render persistent disk (e.g. `/var/data`) so "Save & Apply" survives redeploys.

## Three modes (first toolbar button: 🧪 TEST / 🔴 LIVE / 🎮 SOLO)
| Mode | TikTok chat | Guess box | Use it to |
|---|---|---|---|
| 🧪 **Test** | OFF | yes + ✅ *solve as fake viewer* + 💬 *fake chat* + 🔎 answer peek | check everything before going live or after upgrading the games |
| 🔴 **Live** | ON (needs `TIKTOK_USERNAME`, you must be LIVE) | hidden | stream on TikTok |
| 🎮 **Offline** | OFF | yes - type your own guess (wrong = red shake, right = win) | play by yourself |

- Switching mode **clears the leaderboard** and starts a fresh round, so test/solo scores never leak into a live show.
- The chosen mode is remembered (`data/mode.json`). `APP_MODE`, if set, decides the mode on every server start. With nothing set: `live` if `TIKTOK_USERNAME` exists, otherwise `test`.
- The name used for your own guesses: ⚙️ Look -> "My name (Test / Offline guesses)".
- Guessing from the screen is refused by the server in Live mode, so nobody can cheat through the page.
- Safe workflow: deploy -> stay in Test -> check -> switch to Live just before you start streaming.

## Show / hide the answer
👁️/🙈 toolbar button (or ⚙️ Game -> "Show the answer at the end of each round"). When hidden, the answer never leaves the server: not on the board, not in the winner window, not in the leaderboard's recent words. The scrambled letters stay on screen, and the strip still says who won / "Time's up!". The toolbar switch takes effect from the end of the current round.

## Host toolbar (always visible, top of screen)
🧪🔴🎮 mode · 🎨 theme · ⏸ pause/resume · ⏭ skip · 🗂 categories · 💡 hint now · 👁️ show/hide answer · ⏰ +15s · 🔔 sound · ⛶ full screen · ⚙️ settings

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
- Test without TikTok: use Test or Offline mode (no URL tricks needed). Big DB: `node generate_db.js` -> `data/puzzles.full.json`.
