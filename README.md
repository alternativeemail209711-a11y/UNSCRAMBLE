# Unscramble Live  (v2)

One-folder monorepo: **Express + Socket.IO + tiktok-live-connector** backend, **Vite/React 9:16** frontend.
Guess the scrambled word in the TikTok chat - first correct comment wins.

## Board layout
The puzzle answer is always drawn on ONE row; multi-word answers get a clear gap between each word (tiles shrink to fit, never wrap).

## What's new in v2
- **Live / Test / Offline modes** - switch any time from the 📡 button (toolbar) -> **📡 Live** tab.
  - 🔴 **Live** reads your TikTok chat.
  - 🧪 **Test** no TikTok needed: type guesses in the box at the bottom (`@bob apple` plays as bob) or start *simulated viewers*.
  - ⚫ **Offline** the game keeps running by itself, chat is ignored.
- **TikTok connection from inside the game** - type your username in the Live tab, press *Save & connect*. It is remembered on the server and reconnects by itself after every restart/redeploy.
  - Chat parsing tolerates payload changes (different field names / wrapped payloads / avatar formats).
  - Automatic **back-off** on failures (5s -> 10s -> 20s -> ... up to 20-180s depending on the problem) and resets after a good connection.
  - Errors are **plain English** ("@you isn't live right now. Start your TikTok LIVE - I'll keep checking...").
  - **Diagnostics** readout (status, room, retries, chat counters, last chat, key found?, library version, recent log) with a *Copy diagnostics* button.
  - `EULERSTREAM_API_KEY` **or** `TIKTOK_SIGN_API_KEY` both work (the key never reaches the browser and is scrubbed from logs).
- **Session + all-time leaderboards** - the on-screen board alternates between 🔥 *This session* and 👑 *All-time* (Layout tab: alternate / session only / all-time only). All-time is saved to disk; only **Live-mode** wins count, so testing never pollutes it. Admin tab: *Start new session*, *Reset all-time*.
- **3-stage win celebration** (Layout tab -> "Show win celebration"):
  1. **SOLVED!** burst - tiles hop, confetti, sound;
  2. **Winner spotlight** - big avatar, name, word, animated `+points`, win-streak badge;
  3. **Rank card** docks in and the winner's leaderboard row glows, showing `▲ rank tonight · 👑 all-time rank`.

## Deploy on Render (Web Service)
1. Push this folder to a GitHub repo (or use the included `render.yaml` Blueprint).
2. **Build Command:** `npm install` (its postinstall builds the React client) - **Start Command:** `npm start` - **Node 20**.
3. Environment variables (all optional):
   | Variable | Purpose |
   |---|---|
   | `EULERSTREAM_API_KEY` / `TIKTOK_SIGN_API_KEY` | sign-service key - strongly recommended for a stable TikTok connection |
   | `ADMIN_PIN` | protects pause / skip / settings / Live tab (enter it in the Live or Admin tab) |
   | `TIKTOK_USERNAME` | first-run default username (the Live tab overrides it) |
   | `ROUND_SECONDS`, `TEST_MODE=1` | first-run defaults |
   | `DATA_DIR` | where settings + all-time leaderboard are saved (default `data/state`) |
4. Open the Render URL on your phone in Chrome, go LIVE with Mobile Gaming, tap the screen to reveal the toolbar.

> **Persistence note:** Render's free plan has an ephemeral disk - saved username / all-time leaderboard are lost on redeploy or after the service sleeps and restarts. Set `TIKTOK_USERNAME` as a fallback, and for a permanent leaderboard attach a Render Disk (paid) and set `DATA_DIR` to its mount path (e.g. `/var/data`). Other hosts with persistent volumes work the same way.

## Use
- Toolbar (tap the screen): 🎨 theme · **📡 live connection** (dot = green connected / amber connecting / red error / blue test / grey off) · ⏸ pause · ⏭ skip · ⛶ full screen · ⚙ settings.
- When not in Live mode a small `🧪 TEST` / `⚫ OFFLINE` chip shows on screen so you never stream in the wrong mode by accident.
- Display settings are saved on the phone; game settings + live config + leaderboards are saved on the server.
- Health checks: `/health` (plain `ok`) and `/api/status` (JSON).

## Local run
```
npm install          # installs server + builds client
npm start            # http://localhost:3000
# client dev with hot reload: npm run dev (server) + npm run dev:client (Vite, proxies sockets)
```

## English word bank (target: 400,000+ accepted words)
- **Puzzles** come from a curated, bundled list of **112,440 verified English words** (`data/words.txt`: common words + inflections, no proper nouns/acronyms) as the toggleable **ENGLISH WORDS** category.
- **Guesses** are checked against a bigger *accepted* list: in that category **any real word that uses the same letters wins**, not only the target.
- On deploy, `postinstall` runs `generate_words.js --soft`. When the host has internet it downloads the public dwyl, SOWPODS/Collins and ENABLE lists plus the US/GB/AU/CA/ZA Hunspell dictionaries (expanded with built-in affix rules), merges them into `data/words.full.txt`, and the server auto-loads it. It never breaks the build if a download fails. Re-run any time with `npm run words`; change the goal with `WORD_TARGET`.
- **Check the real number:** Live tab -> Diagnostics ("Word bank: N accepted English words") or `/api/status` (`words.accepted`, `words.meetsTarget`). The build log also prints `Target 400,000: REACHED / NOT reached`.
- Honest note: the bundled file alone is 112k. The 400k figure depends on the deploy-time downloads succeeding and the merged open lists being large enough; the game reports the true count instead of hiding it.

## Big puzzle database
`node generate_db.js` -> `data/puzzles.full.json` (auto-loaded when present).

## Troubleshooting (Live tab -> Diagnostics)
- *"isn't live right now"* - start the LIVE first; the game keeps checking.
- *"sign service rejected"* / *"blocked"* - set `EULERSTREAM_API_KEY` (or `TIKTOK_SIGN_API_KEY`) and redeploy.
- *Connected but no chat* - post a comment from a second account; check "Chat events" in Diagnostics.
- *"unreadable" chat count rising* - TikTok changed the payload; the game still works, send the copied diagnostics for a fix.
