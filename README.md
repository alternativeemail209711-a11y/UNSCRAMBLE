# WORD SHUFFLE 10 - what is new
- **Open to everyone, worldwide.** The two Malaysia-only categories (ASIAN FOOD, ASIA) are gone. They are replaced by **ASIAN FOOD** and **ASIA**, which work for any viewer. Answers that only make sense for Malaysia were removed from the other categories too; Malaysia / Kuala Lumpur / Malay still appear as ordinary entries in worldwide lists (countries, capitals, languages, currencies).
- **Strict one-row rule.** One single word is **always one single row**, however long it is (the letter tiles just get smaller to fit the width). Only a long answer made of **2 or 3 words** (14+ letters in total) may use **two rows**, split between words. Never 3 rows, words are never broken. This applies to the scrambled letters, the revealed answer, the hint line and the winner word. Short multi-word answers such as ICE CREAM stay on one row.
- **Answers are one word, or 2-3 words at most** (the server skips anything longer).
- **Every category has plenty of answers.** All 112 categories hold at least 89 playable answers (5-20 letters, 1-3 words) - the lowest is KNITTING & YARN with 89. The server also refuses to use any built-in category with fewer than 50 answers (your own "My Puzzles" categories are exempt).
- ~2,300 new answers across about 55 categories, plus 2 new categories (ASIAN FOOD, ASIA). `python3 tools/add_categories.py` prints a warning if a category ever drops below 50 playable answers.

# WORD SHUFFLE 9 - what is new
- **62 extra categories (~5,000 answers)** in `data/puzzles.extra.json`, e.g. TOOLS AND EQUIPMENT, HEALTH AND MEDICINE, FESTIVALS AND CELEBRATIONS, KITCHEN AND COOKWARE, FURNITURE AND HOME, GARDENING AND FARMING, INSECTS AND BUGS, REPTILES AND AMPHIBIANS, TREES AND PLANTS, GEMS AND MINERALS, CHEMICAL ELEMENTS, WEATHER AND NATURE, EMOTIONS AND FEELINGS, HOBBIES AND CRAFTS, SPORTS EQUIPMENT, COMPUTERS AND TECHNOLOGY, SOCIAL MEDIA AND INTERNET, CARS AND VEHICLES, AIRPORT AND TRAVEL, ASIAN FOOD, ASIA, FAIRY TALES AND STORIES, FAMOUS INVENTIONS, MONEY AND BANKING and many more. Tick/untick them in 🗂 Categories.
- **Max 2 rows** for long multi-word puzzles (see "Row rule" below).
- Add your own: edit a file in `tools/new_categories/` and run `python3 tools/add_categories.py`, or edit `data/puzzles.extra.json` directly (letters and spaces only).

# WORD SHUFFLE 8 - what is new

## ⏭ Auto next round (⚙️ -> ⏭ Next Round)
Everything about how the game moves from one round to the next. Saved on the server, applied with **Save & Apply**.
| Setting | What it does |
|---|---|
| Start the next round automatically | **Off** = after each round the game waits and shows a big **▶ START NEXT ROUND** button (or press ⏭ on the toolbar). |
| Extra break before every next round | 0-60 s added after the winner window / leaderboard / reveal. The "NEXT ROUND IN N seconds" badge counts it down. |
| Extra round time per letter | Long words get more time (round time + N x letters). |
| Stop after N unsolved rounds in a row | If nobody guesses for N rounds the game stops by itself and waits for you (skipping with ⏭ never counts). |
| Rounds per session + when it is over | e.g. 10 rounds. Then: stop and wait / start a new session (keep scores) / start a new session (reset scores). |
| Final leaderboard | Shows the full leaderboard at the end of a session (0 = skip). |
| Keep the same category for N rounds, category order | Random, or one after another in list order. |
| Full leaderboard every N wins | Show the big leaderboard after every win (1) or only every 3rd win, etc. |
Also here: **▶ Start next round now** and **🔁 New session now** (resets scores + round counter), and the round-end timing sliders (round time, winner window, leaderboard, reveal).

## 🎯 Scoring & fairness (⚙️ -> 🎯 Scoring)
Points per correct answer (1-10) · ⚡ speed bonus (answer within X% of the time) · 🔥 streak bonus for the same viewer winning again and again · 💸 hint penalty (1 point per hint shown, never below 1) · 🧊 wrong-guess cooldown per viewer against spam (correct guesses always count) · 🚫 list of viewers to ignore.
Default = exactly like before: 1 point per win.

## 🧩 Puzzle style (⚙️ -> 🎮 Game)
Keep the first letter in place · shuffle each word separately · hints revealed random or left-to-right.

## 🔊 Sounds (⚙️ -> 🔊 Sounds)
Master switch + volume, 4 sound styles (chime, arcade, gentle, bell), and separate on/off for: win, new round, time up, last-seconds tick (choose how many seconds). Test buttons included.

## ✍️ Text & Effects (⚙️ -> ✍️ Text & Effects)
Category banner text, round number badge ("ROUND 3/10"), banner colours and size · timer style (bar + number / number / bar), size, bar colour, red warning pulse in the last N seconds · hidden-letter symbol (• _ ? ★ ○ 🧶), hint colour/size · **every message editable** ({user} {s} {n} placeholders): timer, solved, time up, paused, waiting, stopped, session complete, countdown label, start button, final leaderboard heading · footer colour/size · 🎉 confetti when a viewer wins (yarn / party / stars / balloons / hearts / your own emoji, amount) · show/hide @ before names · chat shows only correct guesses · win-streak flame in the winner window (⚙️ -> 🪟 Windows).
👁 **Preview** shows your unsaved changes on the real game screen.

## 🧰 Toolbar
Every new on/off, slider and dropdown can be pinned to the top toolbar too (⚙️ -> 🧰 Toolbar), e.g. pin the 🔁 auto-next switch to turn it off in the middle of a show.

## Where things are saved
Server (`DATA_DIR` / `data/settings.json`): Game, Next Round, Scoring. This device (browser): Look, Layout, Windows, Letter Boxes, Sounds, Text & Effects, Toolbar.

---

# WORD SHUFFLE - Knitting Edition 🧶
Look & feel matches the platform's yarn theme: knitted-fabric background, yarn-ball buttons, stitched borders, multicolour yarn letter boxes, seven knitted-background themes (`knit_...`) plus all 19 original themes with a plain background (`plain: true` in `themes.js`). Theme colours live in `client/src/themes.js`, the stitch/yarn styling is the "KNITTING LAYER" at the end of `client/src/styles.css`. New puzzle category: KNITTING & YARN (`data/puzzles.extra.json`).

# Word Shuffle 🍬
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

## Type your TikTok details on screen (new)
⚙️ -> **🔴 Live** tab: type your **TikTok username** (no @) and paste your **Euler key**, then press **🔴 Save & Connect to TikTok**. The key is never shown again (only its last 4 characters) and is never sent back to the screen. Render's Environment variables (`TIKTOK_USERNAME`, `TIKTOK_SIGN_API_KEY`) still work as a backup; what you type on screen wins. Saved in `data/tiktok.json` (use `DATA_DIR` + a persistent disk to keep it after redeploys). Set `ADMIN_PIN` so nobody else can change it.

## Test bot (new, Test mode only)
The 🤖 button (bottom row in Test mode) starts/stops fake viewers who guess by themselves: mostly wrong guesses and near-misses, and sometimes a correct answer at a random moment. Tune it in ⚙️ -> Game (bottom): *Bot guesses every* (seconds), *Chance the bot solves a round* (%). It only runs in Test mode.

## Scoring
One winner per round: the first correct guess ends the round and earns **1 point** by default (change points, bonuses and penalties in ⚙️ -> 🎯 Scoring). The leaderboard only lists real winners (no empty "waiting" rows).

## Guess window
A floating card under the category banner shows **one guess at a time** (the viewer's circular TikTok picture + their guess). It only appears when someone guesses, stays for a few seconds (⚙️ → Layout → "Guess window stays for"), then disappears. It has its own reserved row, so it can never cover the puzzle letters.

## Mini leaderboard
Shows the **top 5** (change in ⚙️ → Layout). Row heights are calculated from the room available, so it can never overlap the footer/chat text below it. Answers are not shown in the leaderboard.

## Winner window -> leaderboard (new)
When a viewer guesses correctly: their exact circular TikTok profile picture and the correct answer pop up in a card centered on screen, for a duration you set in ⚙️ → Game ("Winner window duration"). It's then automatically followed by a full-screen leaderboard of **every player who has gained points** (not just the top few), for a duration you also set ("Full leaderboard duration") — long lists auto-scroll to show everyone. Turn either stage off in ⚙️ → Layout ("Show winner window in the centre" / "Show mini leaderboard"). Nobody solving the round (time runs out) skips straight to the next round using the plain "Reveal time" instead.

## Show / hide the answer
Two independent switches, because "someone guessed it" and "nobody guessed it" are different situations:
- 👁️/🙈 toolbar button (or ⚙️ Game → "Show the answer when a viewer guesses it correctly") — controls the word shown in the guess window, the winner window, and the leaderboard's recent-words list.
- ⚙️ Game → "Show the answer when time runs out" — controls whether the answer is revealed on the puzzle board when nobody solves it in time.
Either way, when a switch is off the answer never leaves the server for that case. The toolbar switch takes effect from the end of the current round.

## Exact TikTok profile pictures
Every avatar (guess window, winner window, leaderboards) loads the viewer's real circular TikTok picture through a small built-in image proxy (`/avatar`), so pictures show reliably instead of being blocked by hotlink/referrer restrictions, and `.heic` pictures TikTok sometimes sends are skipped in favor of a displayable format. If a picture still can't load, that viewer gets a colored circle with their initial instead of a broken image.

## Host toolbar (always visible, top of screen)
Game name **WORD SHUFFLE** (left; "WORD" sits above "SHUFFLE" at 50% of its size, no border) · 🧪🔴🎮 mode · 🎨 theme · ⏸ pause/resume · ⏭ skip · 💡 hint now · ⏰ +15s · ⛶ full screen · ⚙️ settings
(Categories, show/hide answer and sound now live in ⚙️ settings: Categories tab, Game tab, Layout tab.)

## Customize the top toolbar
⚙️ → **🧰 Toolbar**: tick ANY feature to pin it on the top toolbar. Quick actions (mode, theme, pause, skip, hint, +15s, categories, show/hide answer, sound, full screen, reset leaderboard) plus every setting from Look / Layout / Game. On/off settings become one-tap buttons (dimmed when off); sliders, dropdowns and text boxes open a small window when tapped. Game settings changed this way apply straight away on the server; look/layout ones apply on this device. The toolbar **auto-sizes**: with few buttons they get bigger and the game-name badge stretches to fill the rest; with more buttons they shrink to fit one row; with many they wrap into extra rows that fill edge to edge, so there are never gaps or overlaps. ⚙️ is always shown. The game name has its own reserved area and always shrinks to fit inside it, whatever font or theme you pick.

## Save & Apply (⚙️ settings)
Change anything in Look / Layout / Game / Categories - nothing is applied until you press one of the two buttons at the bottom:
- **💾 Save & Apply** - applies all settings now and starts a fresh round. Settings are remembered.
- **⭐ Save & Apply as Default** - same, and also stores them as your defaults (look on this device, game + categories on the server in `data/defaults.json`).
- ✕ closes the panel and discards unsaved changes. Admin tab: reset to *my saved defaults* or to *factory settings*.

## Row rule (updated in 10)
A **single word is always shown on ONE row**. Only a long answer of **2 or 3 words** (14+ letters in total) is split **between words** into **two rows** - never 3 or more, and words are never broken. This applies to the scrambled letters, the revealed answer, the hint line and the winner word. Tiles are sized from the available width/height, so everything always fits. "Max letters" goes up to 30 (default 20).

## Categories
🗂 opens the category picker: **Random mix** (all ticked categories) or **Specific** (only the ones you pick; pick one to lock it).
New built-in categories live in `data/puzzles.extra.json` (Famous Places & Landmarks, Countries & Capitals, Famous Movies & TV Shows, Miscellaneous, Body Parts, Superheroes). It is merged on top of `puzzles.sample.json` / `puzzles.full.json` automatically - add your own categories or answers there (letters and spaces only).
Categories whose name contains "english", "common words", "random words" or "dictionary" are ignored automatically.

## Notes
- Default look is Cotton Candy + Fredoka font. If your phone kept old settings: ⚙️ → Admin → Reset.
- Test without TikTok: use Test or Offline mode (no URL tricks needed). Big DB: `node generate_db.js` -> `data/puzzles.full.json`.

## Layout (default)
Puzzle letters and the timer sit higher on the screen, giving the bottom leaderboard (top 5) and the chat/footer area more room. Every zone is its own grid row, so nothing overlaps. Older saved layout heights are replaced by the new ones automatically on first open.

## Puzzle database & phone fit (update)
- `data/puzzles.full.json` is built offline by `python3 tools/build_puzzles.py` (needs `pip install babel matplotlib`); add more seeds to that script and re-run. The server merges `puzzles.extra.json` on top automatically.
- The 9:16 stage is now sized from the real visible viewport (`client/src/main.jsx`), so phone browser bars, notches, rotation and fullscreen no longer push the toolbar or bottom area off-screen.

## New in this update
- **Word Power**: 26 dictionary categories ("WORDS STARTING WITH B" ...) hold ~50k real words. In Random mix they get a set share of rounds (Game tab -> Word Power share, default 15%) so themed categories still appear often. Set 0% to switch them off.
- **Live login window**: switching to Live opens a centred window for TikTok username + Euler key + Save & Connect (still available in Settings -> Live). Turn it off in Look -> "Show the TikTok login window".
- **More customizing**: 5 colour pickers (backgrounds, accents, text) under Look, the Word Power share, the login-window toggle, and a new **✍️ My Puzzles** tab to create your own categories (saved in `data/custom.json`, use DATA_DIR to persist). All new options can also be pinned to the toolbar.

## Phone-fit fix (root cause)
The stage grid had no explicit column, so the toolbar could widen the whole layout beyond the phone screen. The stage now has a fixed single column (`grid-template-columns:minmax(0,1fr)`) and the toolbar is clipped to it. Verified in a mobile-browser emulator on 320x568, 360x640, 375x667, 390x844, 412x915, tablets and landscape: no element extends past the screen.

## Round countdown, live chat, manual leaderboard
- **Next-round countdown**: after every round ends, the footer shows "NEXT ROUND IN N seconds" (Layout tab -> toggle). It sits in the footer row, so it never covers anything.
- **Leaderboard + live chat side by side** at the bottom (top-N leaderboard on the left, latest chat/guesses on the right). Layout tab: show/hide chat and "Live chat width" (30-65%). They are separate grid columns, so they cannot overlap.
- **Manual leaderboard**: the new 🏆 toolbar button shows the full leaderboard for the "Full leaderboard duration" (Game tab); press again to hide. If you saved a custom toolbar earlier, tick "Show / hide leaderboard now" in Settings -> Toolbar to add it.


## New in this update (Word Shuffle)
- **Game name**: "WORD SHUFFLE" - the first word is shown above the second at exactly 50% of its font size, with no border or badge. It is always clipped to and fitted inside its own area of the toolbar. Change the text in ⚙️ Look -> "Title text" (first word goes on top, the rest below), the font in "Game name font" (13 new fonts added) and the colour in "Game name colour".
- **⚙️ 🪟 Windows tab**: every floating window has its **own** settings - 💬 Guess window, 🏆 Winner window (centre) and 📊 Full leaderboard window (also used by the 🏆 toolbar button):
  - **Time**: guess card stays / winner window stays / full leaderboard stays.
  - **Rows**: guesses shown at once (1-5) / winner layout 1-4 rows / leaderboard players listed + rows visible at once (extra players auto-scroll).
  - **What it shows**: picture, @username, guess text / correct word, points, optional heading text, rank / medal.
  - **Look**: move left-right and up-down, size, width, whole-window opacity, background colour and background opacity (pick a colour to get a solid window; then opacity applies to that colour).
  - **👁 Preview** shows the window on the game screen with your unsaved changes (auto-returns after 12 s or tap "Back to settings"). **↩️ Reset this window** restores only that window.
  - Window times for the winner window and full leaderboard are saved on the server like the other Game settings; everything else is saved on this device.
- **Whole-page theme**: the theme gradient now covers the entire page, including the strips above the toolbar and below the footer on tall phones, in fullscreen, and in landscape (and the phone's status-bar colour). Custom background colours are applied there too.
- **⚙️ 🔤 Letter Boxes tab**: box shape and max size, letter font (30+ fonts), weight and size, letter colour, box colour (top / bottom), border colour and thickness, box opacity, space between boxes, solved-word colours, glossy highlight, drop shadow and bounce animation - with a live preview at the top of the tab.
- Old saved names ("UNSCRAMBLE") are switched to the new name once automatically; all other saved settings are kept.
