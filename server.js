const path = require('path'), fs = require('fs'), http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const TEST_MODE = process.env.TEST_MODE === '1';
const ADMIN_PIN = process.env.ADMIN_PIN || '';           // optional: protects settings/pause/skip/reset
const R = (...p) => path.join(__dirname, ...p);

// ---------- puzzle DB ----------
const dbFile = fs.existsSync(R('data/puzzles.full.json')) ? R('data/puzzles.full.json') : R('data/puzzles.sample.json');
const DB = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
// 'English words' style catch-all categories are intentionally excluded (too wide / vague)
const BANNED = /english|common words|random words|dictionary/i;
const CATS = Object.keys(DB).filter(c => DB[c].length && !BANNED.test(c));
console.log(`Loaded ${CATS.length} categories from ${path.basename(dbFile)}`);

// ---------- host-adjustable game settings ----------
const DEF = { roundSeconds: +process.env.ROUND_SECONDS || 90, revealSeconds: 10, minLetters: 5, maxLetters: 25,
  allowMulti: true, spaceless: true, hints: true, hintStart: 40, hintEvery: 10, maxHints: 3,
  basePoints: 10, speedBonus: 10, hintPenalty: 2, disabled: [] };
const RANGE = { roundSeconds: [20, 300], revealSeconds: [3, 30], minLetters: [3, 25], maxLetters: [3, 25], hintStart: [10, 90],
  hintEvery: [3, 60], maxHints: [0, 10], basePoints: [1, 100], speedBonus: [0, 100], hintPenalty: [0, 20] };
const SFILE = R('data/settings.json');
let cfg = { ...DEF };
try { cfg = { ...DEF, ...JSON.parse(fs.readFileSync(SFILE, 'utf8')) }; } catch {}
let saveT;
function applyPatch(p) {
  for (const [k, v] of Object.entries(p || {})) {
    if (RANGE[k] && typeof v === 'number') cfg[k] = Math.min(RANGE[k][1], Math.max(RANGE[k][0], Math.round(v)));
    else if (['allowMulti', 'spaceless', 'hints'].includes(k)) cfg[k] = !!v;
    else if (k === 'disabled' && Array.isArray(v)) cfg[k] = v.filter(c => CATS.includes(c));
  }
  if (cfg.minLetters > cfg.maxLetters) cfg.maxLetters = cfg.minLetters;
  clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(SFILE, JSON.stringify(cfg)); } catch {} }, 1000);
}

// ---------- helpers ----------
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

// ---------- game state ----------
const users = new Map();     // user -> {user, pic, score, wins, words[]}
const pics = new Map();      // user -> latest profile picture url
let round = 0, current = null, phaseEnd = 0, paused = false, pausedAt = 0, revealed = new Set();
let state = { phase: 'playing', round: 0, category: '', scrambled: '', answer: null, winner: null, winnerInfo: null, hint: '', total: cfg.roundSeconds };

const top = () => [...users.values()].sort((a, b) => b.score - a.score).slice(0, 10);
const snap = () => ({ ...state, paused, remaining: Math.max(0, Math.ceil((phaseEnd - (paused ? pausedAt : Date.now())) / 1000)), leaderboard: top() });
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
    const u = users.get(w.user) || { user: w.user, pic: '', score: 0, wins: 0, words: [] };
    if (w.pic) u.pic = w.pic;
    u.score += pts; u.wins++; u.words = [...u.words, current.answer].slice(-6);
    users.set(w.user, u);
    info = { user: u.user, pic: u.pic, pts, word: current.answer };
  }
  phaseEnd = Date.now() + cfg.revealSeconds * 1000;
  state = { ...state, phase: 'reveal', answer: current.answer, winner: w ? w.user : null, winnerInfo: info };
  broadcast();
}
function revealOne() {
  const c = [...current.answer].map((ch, i) => ch === ' ' || revealed.has(i) ? -1 : i).filter(i => i >= 0);
  if (c.length <= 1) return false;
  revealed.add(c[Math.floor(Math.random() * c.length)]); return true;
}
setInterval(() => {                                   // one ticker: round end, reveal end, auto-hints
  if (paused) return;
  const now = Date.now();
  if (now >= phaseEnd) return state.phase === 'playing' ? endRound(null) : startRound();
  if (state.phase === 'playing' && cfg.hints) {
    const el = (now - (phaseEnd - state.total * 1000)) / 1000, st = state.total * cfg.hintStart / 100;
    const target = el >= st ? Math.min(cfg.maxHints, 1 + Math.floor((el - st) / cfg.hintEvery)) : 0;
    let changed = false;
    while (revealed.size < target) { if (!revealOne()) break; changed = true; }
    if (changed) { state.hint = mask(); broadcast(); }
  }
}, 250);

// ---------- chat ----------
let feedBuf = [], feedId = 0;
setInterval(() => { if (feedBuf.length) { io.emit('feed', feedBuf); feedBuf = []; } }, 300);

function onGuess(user, text, pic) {
  user = String(user || 'viewer').replace(/^@/, '');
  text = String(text || '').slice(0, 60);
  if (!norm(text)) return;
  if (pic) { pics.set(user, pic); if (pics.size > 3000) pics.delete(pics.keys().next().value); }
  const ok = state.phase === 'playing' && !paused &&
    (cfg.spaceless ? norm(text) === norm(current.answer) : normStrict(text) === current.answer);
  feedBuf.push({ id: ++feedId, user, text: ok ? '✅ got it!' : text, ok, pic: pics.get(user) || '' });
  if (feedBuf.length > 40) feedBuf.shift();
  if (ok) endRound({ user, pic: pics.get(user) || '' });
}

// ---------- TikTok ----------
const picOf = x => Array.isArray(x) ? picOf(x[0]) : (x && typeof x === 'object') ? picOf(x.url ?? x.urls ?? x.urlList) : (typeof x === 'string' && /^https?:/.test(x) ? x : '');
let retrying = false;
function connectTikTok() {
  const name = (process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
  if (!name) return console.log('TIKTOK_USERNAME not set -> chat disabled (use TEST_MODE=1 and /?test=1)');
  retrying = false;
  const conn = new TikTokLiveConnection(name, { signApiKey: process.env.TIKTOK_SIGN_API_KEY });
  const retry = why => { if (retrying) return; retrying = true; console.log(`TikTok not connected (${why}). Retrying in 15s - you must be LIVE first.`); setTimeout(connectTikTok, 15000); };
  conn.on('chat', d => {
    const u = d.user || {};
    const text = d.comment ?? d.text ?? d.content;
    const id = u.uniqueId ?? d.uniqueId ?? u.nickname ?? d.nickname;
    const pic = picOf(u.profilePicture) || picOf(u.profilePictureUrl) || picOf(d.profilePictureUrl) || picOf(u.avatarThumb);
    if (text) onGuess(id, text, pic);
  });
  conn.on('disconnected', () => retry('disconnected'));
  conn.on('error', e => console.error('TikTok error:', e?.message || e));
  conn.connect().then(() => console.log('TikTok connected to @' + name)).catch(e => retry(e?.message || e));
}

// ---------- web + admin ----------
io.on('connection', socket => {
  socket.emit('settings', pub());
  socket.emit('state', snap());
  if (TEST_MODE) socket.on('testGuess', ({ user, text }) => onGuess(user || 'tester', text, ''));
  socket.on('admin', (m, ack) => {
    const done = r => typeof ack === 'function' && ack(r);
    if (ADMIN_PIN && m?.pin !== ADMIN_PIN) return done({ ok: false, error: 'Wrong or missing PIN' });
    switch (m?.a) {
      case 'set': applyPatch(m.patch); io.emit('settings', pub()); break;
      case 'pause': if (!paused) { paused = true; pausedAt = Date.now(); } else { phaseEnd += Date.now() - pausedAt; paused = false; } broadcast(); break;
      case 'skip': state.phase === 'playing' ? endRound(null) : startRound(); break;
      case 'hint': if (state.phase === 'playing' && !paused && revealOne()) { state.hint = mask(); broadcast(); } break;
      case 'time': if (state.phase === 'playing') { phaseEnd += 15000; state.total += 15; broadcast(); } break;
      case 'reset': users.clear(); broadcast(); break;
    }
    done({ ok: true });
  });
});
const dist = R('client/dist');
app.get('/health', (_, res) => res.send('ok'));
app.use(express.static(dist));
app.use((_, res) => res.sendFile(path.join(dist, 'index.html')));
server.listen(PORT, () => { console.log('Listening on ' + PORT); startRound(); connectTikTok(); });
