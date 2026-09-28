// Unscramble Live - server v2
// Express + Socket.IO + tiktok-live-connector. Modes: LIVE / TEST / OFFLINE. Session + all-time leaderboards.
const path = require('path'), fs = require('fs'), http = require('http');
const express = require('express');
const { Server } = require('socket.io');

// The TikTok library is loaded defensively: if it ever fails to load, TEST and OFFLINE modes still work.
let TT = {}, ttLoadError = '';
try { TT = require('tiktok-live-connector'); } catch (e) { ttLoadError = e.message; }
const LIB_VERSION = (() => {
  try { return require('tiktok-live-connector/package.json').version; } catch {}
  try { return require('./package.json').dependencies['tiktok-live-connector']; } catch {}
  return '?';
})();
const EV = {
  CHAT: TT.WebcastEvent?.CHAT || 'chat',
  ERROR: TT.ControlEvent?.ERROR || 'error',
  CONNECTED: TT.ControlEvent?.CONNECTED || 'connected',
  DISCONNECTED: TT.ControlEvent?.DISCONNECTED || 'disconnected',
  STREAM_END: TT.WebcastEvent?.STREAM_END || 'streamEnd'
};

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '';           // optional: protects every control
const R = (...p) => path.join(__dirname, ...p);
const DATA_DIR = process.env.DATA_DIR || R('data/state'); // settings, live config and all-time leaderboard live here
const F = { settings: path.join(DATA_DIR, 'settings.json'), live: path.join(DATA_DIR, 'live.json'), all: path.join(DATA_DIR, 'leaderboard.json') };

// Sign/Euler key: EULERSTREAM_API_KEY or TIKTOK_SIGN_API_KEY (the first one that is set wins). Never sent to the browser.
const KEY_SRC = (process.env.EULERSTREAM_API_KEY || '').trim() ? 'EULERSTREAM_API_KEY' : (process.env.TIKTOK_SIGN_API_KEY || '').trim() ? 'TIKTOK_SIGN_API_KEY' : '';
const SIGN_KEY = KEY_SRC ? process.env[KEY_SRC].trim() : '';
const redact = s => { s = String(s ?? ''); return SIGN_KEY ? s.split(SIGN_KEY).join('***') : s; };

// ---------- small helpers ----------
const persist = { ok: true, lastError: '' };
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
function writeJson(f, o) {
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(o)); fs.renameSync(f + '.tmp', f); persist.ok = true; }
  catch (e) { persist.ok = false; persist.lastError = e.message; }
}
const LOGMAX = 40, logs = [];
function addLog(m) { m = redact(m); logs.push({ t: Date.now(), m }); if (logs.length > LOGMAX) logs.shift(); console.log('[live] ' + m); }

// ---------- puzzle DB ----------
const dbFile = fs.existsSync(R('data/puzzles.full.json')) ? R('data/puzzles.full.json') : R('data/puzzles.sample.json');
const DB = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
// English word bank. data/words.txt = curated puzzle answers (bundled, 112k verified words).
// data/words.full.txt (built by `npm run words`, also run automatically on deploy when the host has internet) = extra accepted words.
// Puzzles are picked from the curated list; a guess is accepted if it is ANY real word in the merged list that uses the same letters.
const WORDS_CAT = 'ENGLISH WORDS';
const readWords = f => { const out = []; try { for (const w of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const u = w.trim().toUpperCase(); if (/^[A-Z]{3,25}$/.test(u)) out.push(u); } } catch {} return out; };
const POOL = readWords(R('data/words.txt'));
const WORDSET = new Set(POOL);
const FULL_FILE = R('data/words.full.txt');
if (fs.existsSync(FULL_FILE)) for (const w of readWords(FULL_FILE)) WORDSET.add(w);
if (POOL.length) DB[WORDS_CAT] = POOL;
const CATS = Object.keys(DB).filter(c => DB[c].length);
const sortKey = w => [...w].sort().join('');
console.log(`Loaded ${CATS.length} categories from ${path.basename(dbFile)} | word bank: ${POOL.length} puzzle words, ${WORDSET.size} accepted words`);

// ---------- host-adjustable game settings ----------
const DEF = { roundSeconds: +process.env.ROUND_SECONDS || 90, revealSeconds: 10, minLetters: 5, maxLetters: 25,
  allowMulti: true, spaceless: true, hints: true, hintStart: 40, hintEvery: 10, maxHints: 3,
  basePoints: 10, speedBonus: 10, hintPenalty: 2, disabled: [] };
const RANGE = { roundSeconds: [20, 300], revealSeconds: [3, 30], minLetters: [3, 25], maxLetters: [3, 25], hintStart: [10, 90],
  hintEvery: [3, 60], maxHints: [0, 10], basePoints: [1, 100], speedBonus: [0, 100], hintPenalty: [0, 20] };
let cfg = { ...DEF, ...readJson(fs.existsSync(F.settings) ? F.settings : R('data/settings.json'), {}) };
let saveT;
const flushSettings = () => { clearTimeout(saveT); saveT = null; writeJson(F.settings, cfg); };
function applyPatch(p) {
  for (const [k, v] of Object.entries(p || {})) {
    if (RANGE[k] && typeof v === 'number') cfg[k] = Math.min(RANGE[k][1], Math.max(RANGE[k][0], Math.round(v)));
    else if (['allowMulti', 'spaceless', 'hints'].includes(k)) cfg[k] = !!v;
    else if (k === 'disabled' && Array.isArray(v)) cfg[k] = v.filter(c => CATS.includes(c));
  }
  if (cfg.minLetters > cfg.maxLetters) cfg.maxLetters = cfg.minLetters;
  clearTimeout(saveT); saveT = setTimeout(flushSettings, 1000);
}

// ---------- text helpers ----------
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normStrict = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// Scrambles letters only; spaces stay in their exact original positions.
function scramble(answer) {
  const chars = [...answer], pos = [];
  chars.forEach((c, i) => { if (c !== ' ') pos.push(i); });
  const letters = pos.map(i => chars[i]);
  const canDiffer = new Set(letters).size > 1;
  let out = chars;
  for (let t = 0; t < 50; t++) {
    const a = [...letters];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    out = [...chars]; pos.forEach((p, k) => { out[p] = a[k]; });
    if (!canDiffer || out.join('') !== answer) break;
  }
  return out.join('');
}

const used = {}; let lastCat = null;
function pick() {
  const okAns = a => { const n = a.replace(/ /g, '').length; return n >= cfg.minLetters && n <= cfg.maxLetters && (cfg.allowMulti || !a.includes(' ')); };
  let pools = CATS.filter(c => !cfg.disabled.includes(c)).map(c => [c, DB[c].filter(okAns)]).filter(([, l]) => l.length);
  if (!pools.length) pools = CATS.map(c => [c, DB[c]]);              // filters too strict -> ignore them
  let [cat, list] = pools[Math.floor(Math.random() * pools.length)];
  if (pools.length > 1 && cat === lastCat) [cat, list] = pools.filter(([c]) => c !== lastCat)[Math.floor(Math.random() * (pools.length - 1))];
  lastCat = cat;
  const u = used[cat] || (used[cat] = new Set());
  let fresh = list.filter(a => !u.has(a));
  if (!fresh.length) { u.clear(); fresh = list; }
  const answer = fresh[Math.floor(Math.random() * fresh.length)];
  u.add(answer);
  return { category: cat, answer: answer.toUpperCase() };
}

// ---------- live config (mode + username), remembered across restarts ----------
const USER_RE = /^[a-z0-9._]{2,24}$/;
const cleanName = s => String(s || '').trim().replace(/^@+/, '').toLowerCase();
const MODES = ['live', 'test', 'offline'];
const savedLive = readJson(F.live, null);
const envName = cleanName(process.env.TIKTOK_USERNAME);
const live = {
  mode: MODES.includes(savedLive?.mode) ? savedLive.mode : (process.env.TEST_MODE === '1' ? 'test' : (envName ? 'live' : 'offline')),
  username: USER_RE.test(cleanName(savedLive?.username)) ? cleanName(savedLive.username) : (USER_RE.test(envName) ? envName : ''),
  status: 'off', roomId: null, attempts: 0, nextRetryAt: 0, connectedAt: 0, error: null, warning: '',
  counts: { chat: 0, parsed: 0, dropped: 0 }, lastChatAt: 0, lastChat: null, sim: false
};
const saveLive = () => writeJson(F.live, { mode: live.mode, username: live.username });

// ---------- scores: session + all-time ----------
const session = new Map();                       // this stream session (resets on "new session" or when the mode changes to/from test)
const allTime = new Map();                       // persisted; only LIVE-mode wins count so testing never pollutes it
for (const u of (readJson(F.all, {}).users || [])) if (u?.user) allTime.set(u.user, u);
let dirtyAll = false, allT = null;
const flushAll = () => {
  clearTimeout(allT); allT = null; if (!dirtyAll) return; dirtyAll = false;
  let users = [...allTime.values()];
  if (users.length > 5000) { users = users.sort((a, b) => b.score - a.score).slice(0, 5000); allTime.clear(); users.forEach(u => allTime.set(u.user, u)); }
  writeJson(F.all, { version: 1, users });
};
const scheduleAll = () => { dirtyAll = true; if (!allT) allT = setTimeout(flushAll, 2000); };
const ranked = m => [...m.values()].sort((a, b) => b.score - a.score || b.wins - a.wins || a.user.localeCompare(b.user));
const rankOf = (m, user) => { const i = ranked(m).findIndex(x => x.user === user); return i < 0 ? null : i + 1; };
const top = (m, n = 10) => ranked(m).slice(0, n);
function bump(m, w, pts, word) {
  const u = m.get(w.user) || { user: w.user, pic: '', score: 0, wins: 0, words: [] };
  if (w.pic) u.pic = w.pic;
  u.score += pts; u.wins++; u.words = [...u.words, word].slice(-6);
  m.set(w.user, u); return u;
}
let lastWinner = null, streak = 0;
const newSession = () => { session.clear(); lastWinner = null; streak = 0; };

// ---------- game state ----------
const pics = new Map();      // user -> latest profile picture url
let round = 0, current = null, phaseEnd = 0, paused = false, pausedAt = 0, revealed = new Set();
let state = { phase: 'playing', round: 0, category: '', scrambled: '', answer: null, winner: null, winnerInfo: null, hint: '', total: cfg.roundSeconds };

const snap = () => ({ ...state, paused, mode: live.mode, remaining: Math.max(0, Math.ceil((phaseEnd - (paused ? pausedAt : Date.now())) / 1000)), lbSession: top(session), lbAll: top(allTime) });
const pub = () => ({ cfg, cats: CATS, pinRequired: !!ADMIN_PIN });

const app = express(), server = http.createServer(app), io = new Server(server);
const broadcast = () => io.emit('state', snap());
const mask = () => [...current.answer].map((c, i) => c === ' ' ? ' ' : revealed.has(i) ? c : '_').join('');

function startRound() {
  current = pick(); round++; revealed = new Set();
  phaseEnd = Date.now() + cfg.roundSeconds * 1000;
  state = { phase: 'playing', round, category: current.category, scrambled: scramble(current.answer), answer: null, winner: null, winnerInfo: null, hint: '', total: cfg.roundSeconds };
  broadcast();
}
function endRound(w) {
  if (state.phase !== 'playing') return;
  let info = null;
  if (w) {
    const left = Math.max(0, (phaseEnd - Date.now()) / 1000);
    const pts = Math.max(1, Math.round(cfg.basePoints + cfg.speedBonus * left / state.total - cfg.hintPenalty * revealed.size));
    const prevS = rankOf(session, w.user), su = bump(session, w, pts, current.answer);
    let all = null;
    if (live.mode === 'live') {                       // only real stream wins go into the all-time board
      const prevA = rankOf(allTime, w.user), au = bump(allTime, w, pts, current.answer); scheduleAll();
      all = { rank: rankOf(allTime, w.user), prev: prevA, score: au.score, wins: au.wins };
    }
    streak = lastWinner === w.user ? streak + 1 : 1; lastWinner = w.user;
    info = { user: w.user, pic: su.pic, pts, word: current.answer, streak,
      session: { rank: rankOf(session, w.user), prev: prevS, score: su.score, wins: su.wins }, all };
  } else { lastWinner = null; streak = 0; }
  phaseEnd = Date.now() + cfg.revealSeconds * 1000;
  state = { ...state, phase: 'reveal', answer: current.answer, winner: w ? w.user : null, winnerInfo: info };
  broadcast();
}
setInterval(() => {                                   // one ticker: round end, reveal end, auto-hints
  if (paused) return;
  const now = Date.now();
  if (now >= phaseEnd) return state.phase === 'playing' ? endRound(null) : startRound();
  if (state.phase === 'playing' && cfg.hints) {
    const el = (now - (phaseEnd - state.total * 1000)) / 1000, st = state.total * cfg.hintStart / 100;
    const target = el >= st ? Math.min(cfg.maxHints, 1 + Math.floor((el - st) / cfg.hintEvery)) : 0;
    let changed = false;
    while (revealed.size < target) {
      const c = [...current.answer].map((ch, i) => ch === ' ' || revealed.has(i) ? -1 : i).filter(i => i >= 0);
      if (c.length <= 1) break;
      revealed.add(c[Math.floor(Math.random() * c.length)]); changed = true;
    }
    if (changed) { state.hint = mask(); broadcast(); }
  }
}, 250);

// ---------- chat ----------
let feedBuf = [], feedId = 0;
setInterval(() => { if (feedBuf.length) { io.emit('feed', feedBuf); feedBuf = []; } }, 300);

function onGuess(user, text, pic) {
  if (live.mode === 'offline') return;
  user = String(user || 'viewer').replace(/^@/, '');
  text = String(text || '').slice(0, 60);
  if (!norm(text)) return;
  if (pic) { pics.set(user, pic); if (pics.size > 3000) pics.delete(pics.keys().next().value); }
  const g = norm(text);
  const anagram = current.category === WORDS_CAT && WORDSET.has(g) && sortKey(g) === sortKey(current.answer);   // any real word using the same letters wins
  const ok = state.phase === 'playing' && !paused &&
    (anagram || (cfg.spaceless ? g === norm(current.answer) : normStrict(text) === current.answer));
  feedBuf.push({ id: ++feedId, user, text: ok ? '✅ got it!' : text, ok, pic: pics.get(user) || '' });
  if (feedBuf.length > 40) feedBuf.shift();
  if (ok) endRound({ user, pic: pics.get(user) || '' });
}

// ---------- tolerant chat parsing (survives payload shape changes) ----------
const firstStr = (...v) => { for (const x of v) if (typeof x === 'string' && x.trim()) return x.trim(); for (const x of v) if (typeof x === 'number') return String(x); return ''; };
function picOf(x, depth = 0) {
  if (!x || depth > 4) return '';
  if (typeof x === 'string') return /^https?:/.test(x) ? x : '';
  if (Array.isArray(x)) { for (const i of x) { const r = picOf(i, depth + 1); if (r) return r; } return ''; }
  if (typeof x === 'object') for (const k of ['url', 'urls', 'urlList', 'url_list', 'uri']) { const r = picOf(x[k], depth + 1); if (r) return r; }
  return '';
}
function parseChat(raw) {
  let d = raw;
  if (d && typeof d === 'object' && d.data && typeof d.data === 'object' && !d.comment && !d.user) d = d.data;   // some versions wrap the payload
  if (!d || typeof d !== 'object') return null;
  const u = d.user || d.sender || d.userInfo || d.author || {};
  const text = firstStr(d.comment, d.text, d.content, d.message, d.msg);
  const id = firstStr(u.uniqueId, u.unique_id, d.uniqueId, d.unique_id, u.displayId, u.display_id, u.username, u.nickname, d.nickname, u.userId, d.userId);
  if (!text || !id) return null;
  const pic = picOf(u.profilePicture) || picOf(u.profilePictureUrl) || picOf(d.profilePictureUrl) || picOf(u.avatarThumb) || picOf(u.avatar_thumb)
    || picOf(u.avatarMedium) || picOf(u.avatarLarger) || picOf(u.avatar) || picOf(d.profilePicture);
  return { id, text, pic };
}

// ---------- TikTok connection: plain-English errors + automatic back-off ----------
function errText(e) {
  if (!e) return 'unknown error';
  const parts = [e.name && e.name !== 'Error' ? e.name : '', e.message, e.exception?.message, e.cause?.message, typeof e.info === 'string' ? e.info : '', typeof e === 'string' ? e : ''].filter(x => typeof x === 'string' && x);
  return redact(parts.join(' | ') || String(e)).slice(0, 400);
}
const RETRY = { // min/cap = back-off window in ms (attempt n waits ~ 5s * 2^(n-1), clamped to this window)
  offline: { min: 5e3, cap: 20e3 }, ended: { min: 5e3, cap: 20e3 }, dropped: { min: 5e3, cap: 60e3 }, network: { min: 5e3, cap: 60e3 },
  ratelimit: { min: 60e3, cap: 180e3 }, auth: { min: 60e3, cap: 180e3 }, blocked: { min: 30e3, cap: 120e3 }, unknown: { min: 10e3, cap: 60e3 } };
function classify(err, forced) {
  const name = String(err?.name || err?.constructor?.name || ''), txt = errText(err).toLowerCase();
  const code = forced || (
    /InvalidUniqueId/i.test(name) || /invalid (tiktok )?(user ?name|unique ?id)/.test(txt) ? 'baduser'
    : /\b(401|403)\b|unauthor|forbidden|api ?key|invalid key/.test(txt) ? 'auth'
    : /429|rate.?limit|too many/.test(txt) ? 'ratelimit'
    : /UserOffline/i.test(name) || /offline|not live|isn'?t live|not currently live|live has ended|no longer live|room ?id/.test(txt) ? 'offline'
    : /captcha|verif|blocked|age.?restrict/.test(txt) ? 'blocked'
    : /enotfound|econnrefused|econnreset|etimedout|eai_again|network|timed? ?out|fetch failed|socket hang up/.test(txt) ? 'network'
    : 'unknown');
  const u = '@' + live.username, keyHint = SIGN_KEY ? '' : ' No sign key is set - add EULERSTREAM_API_KEY (or TIKTOK_SIGN_API_KEY) in your host\'s environment variables.';
  const msg = {
    baduser: `"${live.username}" doesn't look like a valid TikTok username. Use letters, numbers, dots and underscores only.`,
    offline: `${u} isn't live right now. Start your TikTok LIVE - I'll keep checking and connect automatically.`,
    ended: `The LIVE ended. I'll reconnect automatically if you go live again.`,
    dropped: `The connection to TikTok dropped. Reconnecting automatically.`,
    network: `Couldn't reach TikTok or the sign service (network problem). Retrying automatically.`,
    ratelimit: `TikTok or the sign service says there were too many requests. Backing off for a while before trying again.`,
    auth: (SIGN_KEY ? `The sign service rejected the request - check that your ${KEY_SRC} is correct and active.` : `TikTok refused the request.`) + keyHint,
    blocked: `TikTok asked for a verification check and blocked the connection. Waiting longer before retrying.` + keyHint,
    unknown: `Something unexpected went wrong while connecting to TikTok. Retrying automatically - see Diagnostics for the technical detail.` + keyHint
  }[code];
  return { code, msg, retry: code !== 'baduser', ...(RETRY[code] || {}) };
}

let conn = null, connId = 0, retryTimer = null;
function dropConn() {
  clearTimeout(retryTimer); retryTimer = null;
  if (!conn) return;
  const c = conn; conn = null;
  try { c.removeAllListeners?.(); c.on?.('error', () => {}); } catch {}   // an 'error' event with no listener would crash the process
  try { const p = c.disconnect?.(); p?.catch?.(() => {}); } catch {}
}
function stopLive() { connId++; dropConn(); live.nextRetryAt = 0; live.connectedAt = 0; live.roomId = null; }

function startLive() {
  stopLive();
  live.error = null; live.warning = '';
  if (live.mode !== 'live') { live.status = 'off'; return emitLive(); }
  if (!live.username) { live.status = 'idle'; return emitLive(); }
  if (!TT.TikTokLiveConnection) { live.status = 'error'; live.error = { code: 'library', message: 'The TikTok library could not be loaded. Run npm install again.', raw: redact(ttLoadError), at: Date.now() }; addLog('Library missing: ' + ttLoadError); return emitLive(); }
  const id = ++connId, alive = () => id === connId;
  live.status = 'connecting'; addLog(`Connecting to @${live.username}...`); emitLive();
  let c;
  try { c = new TT.TikTokLiveConnection(live.username, { signApiKey: SIGN_KEY || undefined, processInitialData: false }); }
  catch (e) { return failed(id, e); }
  conn = c;
  const up = state_ => { if (!alive() || live.status === 'connected') return; live.status = 'connected'; live.roomId = state_?.roomId ?? live.roomId; live.connectedAt = Date.now(); live.error = null; addLog(`Connected to @${live.username}` + (live.roomId ? ` (room ${live.roomId})` : '')); emitLive(); };
  c.on(EV.CHAT, d => { if (alive()) onChat(d); });
  c.on(EV.CONNECTED, s => up(s));
  c.on(EV.DISCONNECTED, () => failed(id, null, 'dropped'));
  c.on(EV.STREAM_END, () => failed(id, null, 'ended'));
  c.on(EV.ERROR, e => { if (alive()) { live.warning = errText(e); addLog('Library warning: ' + live.warning); emitLive(); } });
  Promise.resolve().then(() => c.connect()).then(s => up(s)).catch(e => failed(id, e));
}
function failed(id, err, forced) {
  if (id !== connId) return;                          // stale event from an old connection
  connId++;                                           // ignore any further events from this connection
  const wasUp = live.status === 'connected' && Date.now() - live.connectedAt > 30000;
  dropConn(); live.connectedAt = 0; live.roomId = null;
  const info = classify(err, forced);
  live.error = { code: info.code, message: info.msg, raw: err ? errText(err) : '', at: Date.now() };
  addLog(`${info.code}: ${info.msg}` + (live.error.raw ? ` [${live.error.raw}]` : ''));
  if (!info.retry || live.mode !== 'live') { live.status = 'error'; live.nextRetryAt = 0; return emitLive(); }
  if (wasUp) live.attempts = 0;
  live.attempts++;
  const base = Math.min(info.cap, 5000 * 2 ** (live.attempts - 1));
  const delay = Math.round(Math.max(info.min, base) * (0.9 + Math.random() * 0.2));
  live.status = 'waiting'; live.nextRetryAt = Date.now() + delay;
  addLog(`Retry #${live.attempts} in ${Math.round(delay / 1000)}s`);
  retryTimer = setTimeout(startLive, delay);
  emitLive();
}
function onChat(raw) {
  live.counts.chat++;
  const p = parseChat(raw);
  if (!p) {
    live.counts.dropped++;
    if (live.counts.dropped <= 3) addLog('Could not read a chat message (unexpected format). Fields: ' + Object.keys(raw && typeof raw === 'object' ? raw : {}).slice(0, 12).join(', '));
    return emitLive();
  }
  live.counts.parsed++; live.lastChatAt = Date.now(); live.lastChat = { user: p.id, text: p.text.slice(0, 60) };
  if (live.mode === 'live') onGuess(p.id, p.text, p.pic);
  emitLive();
}

// ---------- test-mode simulated viewers ----------
const SIM_USERS = ['maya', 'leo', 'sana', 'ravi', 'zoe', 'omar', 'lin', 'kai'], SIM_WRONG = ['is it cat?', 'idk', 'hello', 'lol', 'no idea', 'this one?', 'apple', 'wow'];
let simT = null;
function setSim(on) {
  clearInterval(simT); simT = null; live.sim = !!on && live.mode === 'test';
  if (live.sim) simT = setInterval(() => {
    if (live.mode !== 'test' || state.phase !== 'playing' || paused || !current) return;
    const el = state.total - (phaseEnd - Date.now()) / 1000, u = SIM_USERS[Math.floor(Math.random() * SIM_USERS.length)];
    onGuess(u, el > 8 && Math.random() < 0.15 ? current.answer : SIM_WRONG[Math.floor(Math.random() * SIM_WRONG.length)], '');
  }, 2500);
  emitLive();
}

// ---------- live snapshot for the UI (Live tab + diagnostics) ----------
function statusMessage() {
  const u = '@' + live.username;
  if (live.mode === 'test') return 'Test mode - nothing is connected to TikTok. Type guesses in the box at the bottom of the screen (use "@name guess" to play as someone else) or switch on simulated viewers.';
  if (live.mode === 'offline') return 'Offline - the game runs by itself and ignores all chat.';
  if (live.status === 'idle') return 'Type your TikTok username below and press Save & connect.';
  if (live.status === 'connecting') return `Connecting to ${u}...`;
  if (live.status === 'connected') {
    const quiet = Date.now() - live.connectedAt > 60000 && live.counts.chat === 0;
    return `Connected to ${u}.` + (quiet ? ' No chat has arrived yet - post a comment from another account to check it works.' : ' Chat guesses are live!');
  }
  return live.error?.message || 'Not connected.';
}
const liveSnap = () => ({
  mode: live.mode, username: live.username, status: live.status, message: statusMessage(), roomId: live.roomId,
  attempts: live.attempts, retryInMs: live.nextRetryAt ? Math.max(0, live.nextRetryAt - Date.now()) : 0,
  connectedForMs: live.connectedAt ? Date.now() - live.connectedAt : 0, error: live.error, warning: live.warning,
  counts: live.counts, lastChatAgoMs: live.lastChatAt ? Date.now() - live.lastChatAt : null, lastChat: live.lastChat,
  key: { set: !!SIGN_KEY, source: KEY_SRC }, lib: { version: LIB_VERSION, loaded: !!TT.TikTokLiveConnection, loadError: redact(ttLoadError) },
  words: WORDSET.size, node: process.versions.node, uptimeSec: Math.round(process.uptime()), sim: live.sim, storage: { dir: DATA_DIR, ok: persist.ok, error: persist.lastError },
  allTimePlayers: allTime.size, log: logs.slice(-15).map(l => ({ agoMs: Date.now() - l.t, m: l.m }))
});
let liveT = null;
function emitLive() { if (liveT) return; liveT = setTimeout(() => { liveT = null; io.emit('live', liveSnap()); }, 250); }
setInterval(() => { if (io.engine.clientsCount) emitLive(); }, 3000);

function setLive({ mode, username }) {
  if (username !== undefined) {
    const n = cleanName(username);
    if (n && !USER_RE.test(n)) return `"${n}" doesn't look like a valid TikTok username. Use letters, numbers, dots and underscores only (2-24 characters).`;
    live.username = n;
  }
  if (mode !== undefined) {
    if (!MODES.includes(mode)) return 'Unknown mode.';
    if (mode !== live.mode && (mode === 'test' || live.mode === 'test')) newSession();   // test scores never leak into a real stream
    live.mode = mode;
  }
  if (live.mode !== 'test') setSim(false);
  live.attempts = 0; live.counts = { chat: 0, parsed: 0, dropped: 0 }; live.lastChat = null; live.lastChatAt = 0;
  saveLive(); startLive(); broadcast();
  return '';
}

// ---------- web + admin ----------
io.on('connection', socket => {
  socket.emit('settings', pub());
  socket.emit('state', snap());
  socket.emit('live', liveSnap());
  socket.on('testGuess', ({ user, text, pin } = {}) => {
    if (live.mode !== 'test' || (ADMIN_PIN && pin !== ADMIN_PIN)) return;
    text = String(text || '').trim();
    const m = text.match(/^@([\w.]{1,24})\s+(.+)$/);           // "@bob answer" plays as bob
    m ? onGuess(m[1], m[2], '') : onGuess(user || 'tester', text, '');
  });
  socket.on('admin', (m, ack) => {
    const done = r => typeof ack === 'function' && ack(r);
    if (ADMIN_PIN && m?.pin !== ADMIN_PIN) return done({ ok: false, error: 'Wrong or missing PIN' });
    switch (m?.a) {
      case 'set': applyPatch(m.patch); io.emit('settings', pub()); break;
      case 'pause': if (!paused) { paused = true; pausedAt = Date.now(); } else { phaseEnd += Date.now() - pausedAt; paused = false; } broadcast(); break;
      case 'skip': state.phase === 'playing' ? endRound(null) : startRound(); break;
      case 'reset': case 'newSession': newSession(); broadcast(); break;
      case 'resetAll': allTime.clear(); dirtyAll = true; flushAll(); broadcast(); emitLive(); break;
      case 'live': { const err = setLive(m); if (err) return done({ ok: false, error: err }); break; }
      case 'liveRetry': live.attempts = 0; startLive(); break;
      case 'sim': setSim(!!m.on); break;
    }
    done({ ok: true });
  });
});

const dist = R('client/dist');
app.get('/health', (_, res) => res.send('ok'));
app.get('/api/status', (_, res) => res.json({ ok: true, mode: live.mode, status: live.status, phase: state.phase, round, players: { session: session.size, allTime: allTime.size }, words: { puzzle: POOL.length, accepted: WORDSET.size, target: 400000, meetsTarget: WORDSET.size >= 400000 } }));
app.use(express.static(dist));
app.use((_, res) => res.sendFile(path.join(dist, 'index.html')));

// keep the stream alive if the TikTok library throws somewhere unexpected
process.on('unhandledRejection', e => addLog('Unhandled promise rejection: ' + errText(e)));
process.on('uncaughtException', e => addLog('Uncaught error: ' + errText(e)));
const bye = () => { flushAll(); flushSettings(); process.exit(0); };
process.on('SIGTERM', bye); process.on('SIGINT', bye);

server.listen(PORT, () => {
  console.log('Listening on ' + PORT + ` | mode=${live.mode} | data dir=${DATA_DIR} | sign key=${KEY_SRC || 'none'}`);
  startRound(); startLive();
});
