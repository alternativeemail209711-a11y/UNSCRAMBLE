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
// data/puzzles.extra.json is ALWAYS merged on top (also when puzzles.full.json exists), so hand-written categories never get lost
const extraFile = R('data/puzzles.extra.json');
if (fs.existsSync(extraFile)) {
  const X = JSON.parse(fs.readFileSync(extraFile, 'utf8'));
  for (const [c, l] of Object.entries(X)) DB[c] = [...new Set([...(DB[c] || []), ...l.map(a => String(a).toUpperCase().replace(/\s+/g, ' ').trim())])];
}
// 'English words' style catch-all categories are intentionally excluded (too wide / vague)
const BANNED = /english|common words|random words|dictionary/i;
let CATS = Object.keys(DB).filter(c => DB[c].length && !BANNED.test(c));
console.log(`Loaded ${CATS.length} categories from ${path.basename(dbFile)}`);

// ---------- host-adjustable game settings ----------
const DEF = { roundSeconds: +process.env.ROUND_SECONDS || 90, revealSeconds: 10, showAnswer: true, showAnswerWin: true, popupSecs: 8, showLbOverlay: true, lbSecs: 10, minLetters: 5, maxLetters: 20,
  allowMulti: true, spaceless: true, hints: true, hintStart: 40, hintEvery: 10, maxHints: 3,
  wordPercent: 15, botOn: false, botEvery: 4, botSkill: 80, disabled: [], mode: 'random', picked: [],
  // --- auto next round ---
  autoNext: true, breakSecs: 0, stopAfterUnsolved: 0, sessionRounds: 0, endAction: 'wait', finalLbSecs: 10, catEvery: 1, catOrder: 'random', lbEvery: 1, secsPerLetter: 0,
  // --- scoring & fairness ---
  pointsPerWin: 1, speedBonusOn: false, speedBonusPct: 30, speedBonusPts: 1, streakBonus: 0, hintPenalty: false, guessCooldown: 0, blocklist: '',
  // --- puzzle style ---
  keepFirst: false, perWord: false, hintMode: 'random' };
const RANGE = { roundSeconds: [20, 300], revealSeconds: [3, 30], popupSecs: [2, 30], lbSecs: [3, 60], minLetters: [3, 25], maxLetters: [3, 25], hintStart: [10, 90],
  hintEvery: [3, 60], maxHints: [0, 10], botEvery: [1, 30], botSkill: [0, 100], wordPercent: [0, 100],
  breakSecs: [0, 60], stopAfterUnsolved: [0, 20], sessionRounds: [0, 500], finalLbSecs: [0, 120], catEvery: [1, 20], lbEvery: [1, 20], secsPerLetter: [0, 10],
  pointsPerWin: [1, 10], speedBonusPct: [10, 90], speedBonusPts: [1, 10], streakBonus: [0, 5], guessCooldown: [0, 30] };
const BOOLS = ['allowMulti', 'spaceless', 'hints', 'showAnswer', 'showAnswerWin', 'showLbOverlay', 'botOn', 'autoNext', 'speedBonusOn', 'hintPenalty', 'keepFirst', 'perWord'];
const CHOICES = { mode: ['random', 'specific'], endAction: ['wait', 'continue', 'restart'], catOrder: ['random', 'sequence'], hintMode: ['random', 'ordered'] };
// DATA_DIR (optional env): point it at a persistent disk so saved settings survive redeploys
const DATA_DIR = process.env.DATA_DIR || R('data');
const SFILE = path.join(DATA_DIR, 'settings.json');   // current settings (Save & Apply)
const DFILE = path.join(DATA_DIR, 'defaults.json');   // host's own defaults (Save & Apply as Default)
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const persist = (f, o) => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); } catch (e) { console.warn('Could not save ' + f + ': ' + e.message); } };
let userDef = readJSON(DFILE);
// host's own categories typed on screen (settings -> My Puzzles): data/custom.json, merged into the database live
const CUFILE = path.join(DATA_DIR, 'custom.json'); let custom = readJSON(CUFILE);
const BASE = Object.fromEntries(Object.entries(DB).map(([k, v]) => [k, v]));
function applyCustom() {
  for (const k of Object.keys(DB)) if (!BASE[k]) delete DB[k];
  for (const [k, v] of Object.entries(custom)) DB[k] = [...new Set([...(BASE[k] || []), ...v])];
  CATS = Object.keys(DB).filter(c => DB[c].length && !BANNED.test(c));
}
applyCustom();
let cfg = { ...DEF, ...userDef, ...readJSON(SFILE) };
let blocked = new Set();   // viewers the host ignores (settings -> Scoring & fairness -> Ignore these viewers)
function rebuildBlocked() { blocked = new Set(String(cfg.blocklist || '').split(/[\s,;]+/).map(x => x.replace(/^@/, '').toLowerCase()).filter(Boolean)); }
rebuildBlocked();
let saveT;
function applyPatch(p) {
  for (const [k, v] of Object.entries(p || {})) {
    if (RANGE[k] && typeof v === 'number') cfg[k] = Math.min(RANGE[k][1], Math.max(RANGE[k][0], Math.round(v)));
    else if (BOOLS.includes(k)) cfg[k] = !!v;
    else if ((k === 'disabled' || k === 'picked') && Array.isArray(v)) cfg[k] = v.filter(c => CATS.includes(c));
    else if (CHOICES[k] && CHOICES[k].includes(v)) cfg[k] = v;
    else if (k === 'blocklist' && typeof v === 'string') cfg.blocklist = v.slice(0, 600);
  }
  if (cfg.minLetters > cfg.maxLetters) cfg.maxLetters = cfg.minLetters;
  rebuildBlocked();
  clearTimeout(saveT); saveT = setTimeout(() => persist(SFILE, cfg), 1000);
}

// ---------- TikTok login details (typed on screen: settings -> Live tab; env vars are the fallback) ----------
const TFILE = path.join(DATA_DIR, 'tiktok.json');
let ttSaved = readJSON(TFILE);
const ttCreds = () => ({
  name: String(ttSaved.username || process.env.TIKTOK_USERNAME || '').replace(/^@/, '').trim(),
  key: String(ttSaved.apiKey || process.env.TIKTOK_SIGN_API_KEY || '').trim()
});
const keyHint = k => (k ? '••••' + k.slice(-4) : '');

// ---------- play mode: test | live | offline ----------
//  test    -> TikTok chat OFF. Guess box + ✅ solve / 💬 fake-chat buttons, answer peek. For trying games before going live / after upgrades.
//  live    -> TikTok chat ON. Guess box hidden. For streaming.
//  offline -> TikTok chat OFF. Guess box on screen so the host can play alone.
const MODES = ['test', 'live', 'offline'];
const MFILE = path.join(DATA_DIR, 'mode.json');
let playMode = (() => {
  const env = String(process.env.APP_MODE || '').toLowerCase();
  if (MODES.includes(env)) return env;
  if (TEST_MODE) return 'test';                       // legacy TEST_MODE=1 still works
  const saved = readJSON(MFILE).mode;
  if (MODES.includes(saved)) return saved;
  return ttCreds().name ? 'live' : 'test';
})();
console.log('Play mode: ' + playMode);

// ---------- helpers ----------
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normStrict = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// Scrambles letters only; spaces stay in their exact original positions.
// Optional: perWord (each word is shuffled inside itself) and keepFirst (the first letter of the answer / of each word stays where it is).
function scramble(answer) {
  const chars = [...answer], groups = [];
  if (cfg.perWord) { let cur = []; chars.forEach((c, i) => { if (c === ' ') { if (cur.length) groups.push(cur); cur = []; } else cur.push(i); }); if (cur.length) groups.push(cur); }
  else groups.push(chars.map((c, i) => (c === ' ' ? -1 : i)).filter(i => i >= 0));
  let out = chars;
  for (let t = 0; t < 50; t++) {
    out = [...chars];
    for (const g of groups) {
      const pos = cfg.keepFirst ? g.slice(1) : g, a = pos.map(i => chars[i]);
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      pos.forEach((p, k) => { out[p] = a[k]; });
    }
    if (out.join('') !== answer) break;
  }
  return out.join('');
}

const used = {}; let lastCat = null, catStreak = 0;
function pick() {
  const okAns = a => { const n = a.replace(/ /g, '').length; return n >= cfg.minLetters && n <= cfg.maxLetters && (cfg.allowMulti || !a.includes(' ')); };
  const chosen = cfg.mode === 'specific' ? CATS.filter(c => cfg.picked.includes(c)) : [];
  const base = chosen.length ? chosen : CATS.filter(c => !cfg.disabled.includes(c));   // specific = only picked; random = every enabled category
  let pools = base.map(c => [c, DB[c].filter(okAns)]).filter(([, l]) => l.length);
  if (!pools.length) pools = (base.length ? base : CATS).map(c => [c, DB[c]]);       // letter filters too strict -> ignore them
  const isW = c => c.startsWith('WORDS STARTING WITH'), wp = pools.filter(([c]) => isW(c)), tp = pools.filter(([c]) => !isW(c));
  const keep = lastCat && catStreak < cfg.catEvery ? pools.find(([c]) => c === lastCat) : null;   // "keep the same category for N rounds"
  let cat, list;
  if (keep) [cat, list] = keep;
  else {
    if (cfg.catOrder === 'sequence') {   // go through the categories one after another (in the order of the category list)
      const names = pools.map(p => p[0]), at = names.indexOf(lastCat);
      [cat, list] = pools[(at + 1) % pools.length];
    } else {
      if (wp.length && tp.length) pools = Math.random() * 100 < (cfg.wordPercent ?? 15) ? wp : tp;   // Word Power = one share, themed categories keep the rest
      [cat, list] = pools[Math.floor(Math.random() * pools.length)];
      if (pools.length > 1 && cat === lastCat) [cat, list] = pools.filter(([c]) => c !== lastCat)[Math.floor(Math.random() * (pools.length - 1))];
    }
    catStreak = 0;
  }
  catStreak++; lastCat = cat;
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
let botPlan = { solveAt: null, nextChat: 0 };
let round = 0, current = null, phaseEnd = 0, paused = false, pausedAt = 0, revealed = new Set();
// session / streak counters (used by the auto-next-round settings and the scoring bonuses)
let sessionRound = 0, sessionDone = false, unsolvedRun = 0, solvedCount = 0, winStreak = 0, lastWinner = null;
const resetCounters = () => { sessionRound = 0; sessionDone = false; unsolvedRun = 0; solvedCount = 0; winStreak = 0; lastWinner = null; };
let state = { phase: 'playing', round: 0, category: '', scrambled: '', answer: null, winner: null, winnerInfo: null, hint: '', total: cfg.roundSeconds, popupSecs: 0, lbSecs: 0, revealTotal: 0, breakSecs: 0, waiting: '', sround: 0, stotal: 0, sessionOver: false };

const top = () => [...users.values()].sort((a, b) => b.score - a.score || (a.t || 0) - (b.t || 0)).slice(0, 10)
  .map(u => ({ user: u.user, pic: u.pic, score: u.score, wins: u.wins }));   // answers are never sent with the leaderboard
// everybody who gained points (used by the full-screen leaderboard that follows the winner window)
const everyone = () => [...users.values()].filter(u => u.score > 0).sort((a, b) => b.score - a.score || (a.t || 0) - (b.t || 0))
  .map(u => ({ user: u.user, pic: u.pic, score: u.score, wins: u.wins }));
const snap = () => ({ ...state, paused, peek: playMode === 'test' && current ? current.answer : '', remaining: Math.max(0, Math.ceil((phaseEnd - (paused ? pausedAt : Date.now())) / 1000)), leaderboard: top(),
  full: (state.phase === 'reveal' && state.winner) || state.phase === 'final' ? everyone() : [] });
const pub = () => ({ cfg, cats: CATS, custom, pinRequired: !!ADMIN_PIN, hasDefaults: Object.keys(userDef).length > 0,
  playMode, tt: { status: ttStatus, user: ttCreds().name, hasKey: !!ttCreds().key, keyHint: keyHint(ttCreds().key) } });

const app = express(), server = http.createServer(app), io = new Server(server);
const broadcast = () => io.emit('state', snap());
const mask = () => [...current.answer].map((c, i) => c === ' ' ? ' ' : revealed.has(i) ? c : '_').join('');

function startRound() {
  if (state.waiting) unsolvedRun = 0;                 // the host restarted the game after an automatic stop
  if (sessionDone) {                                  // the previous round finished a session -> a new session begins
    sessionDone = false; sessionRound = 0; winStreak = 0; lastWinner = null;
    if (cfg.endAction === 'restart') { users.clear(); solvedCount = 0; feedBuf = []; io.emit('feedClear'); }
  }
  current = pick(); round++; sessionRound++; revealed = new Set();
  const letters = current.answer.replace(/ /g, '').length, total = Math.min(600, Math.max(10, cfg.roundSeconds + cfg.secsPerLetter * letters));   // "extra seconds per letter" makes long words get more time
  planBot(total);
  phaseEnd = Date.now() + total * 1000; if (paused) pausedAt = Date.now();
  state = { phase: 'playing', round, category: current.category, scrambled: scramble(current.answer), answer: null, winner: null, winnerInfo: null, hint: '', total, popupSecs: 0, lbSecs: 0,
    revealTotal: 0, breakSecs: 0, waiting: '', sround: sessionRound, stotal: cfg.sessionRounds, sessionOver: false };
  broadcast();
}
function endRound(w, skipped) {
  if (state.phase !== 'playing') return;
  let info = null;
  if (w) {
    let pts = cfg.pointsPerWin;                       // base points (default 1)
    const elapsed = (Date.now() - (phaseEnd - state.total * 1000)) / 1000;
    if (cfg.speedBonusOn && elapsed <= state.total * cfg.speedBonusPct / 100) pts += cfg.speedBonusPts;   // solved fast -> bonus
    winStreak = lastWinner === w.user ? winStreak + 1 : 1; lastWinner = w.user;
    if (cfg.streakBonus > 0) pts += Math.min(winStreak - 1, 5) * cfg.streakBonus;                       // same viewer wins again and again -> bonus
    if (cfg.hintPenalty) pts = Math.max(1, pts - revealed.size);                                          // every hint costs 1 point (never below 1)
    const u = users.get(w.user) || { user: w.user, pic: '', score: 0, wins: 0, words: [], t: 0 };
    if (w.pic) u.pic = w.pic;
    u.score += pts; u.wins++; u.t = Date.now();
    if (cfg.showAnswerWin) u.words = [...u.words, current.answer].slice(-6);   // hidden answers never leak via the leaderboard
    users.set(w.user, u);
    solvedCount++; unsolvedRun = 0;
    info = { user: u.user, pic: u.pic, pts, streak: winStreak, word: cfg.showAnswerWin ? current.answer : '' };
  } else { lastWinner = null; winStreak = 0; if (!skipped) unsolvedRun++; }
  sessionDone = cfg.sessionRounds > 0 && sessionRound >= cfg.sessionRounds;
  // Solved round: centre winner window (popupSecs) -> full leaderboard (lbSecs, every "lbEvery" wins) -> optional break. Unsolved round: plain reveal time + break.
  const lbSecs = w && cfg.showLbOverlay && solvedCount % cfg.lbEvery === 0 ? cfg.lbSecs : 0;
  const secs = (w ? cfg.popupSecs + lbSecs : cfg.revealSeconds) + cfg.breakSecs;
  phaseEnd = Date.now() + secs * 1000; if (paused) pausedAt = Date.now();
  const showAns = w ? cfg.showAnswerWin : cfg.showAnswer;   // two separate switches: "guessed correctly" vs "time ran out"
  state = { ...state, phase: 'reveal', answer: showAns ? current.answer : null, winner: w ? w.user : null, winnerInfo: info, popupSecs: w ? cfg.popupSecs : 0, lbSecs,
    revealTotal: secs, breakSecs: cfg.breakSecs, waiting: '', sessionOver: sessionDone };
  broadcast();
}
// the last round of a session is over: show the final leaderboard for a while
function startFinale() {
  phaseEnd = Date.now() + cfg.finalLbSecs * 1000; if (paused) pausedAt = Date.now();
  state = { ...state, phase: 'final', popupSecs: 0, lbSecs: cfg.finalLbSecs, revealTotal: cfg.finalLbSecs, breakSecs: 0, waiting: '' };
  broadcast();
}
// the reveal (and finale) is over: start the next round by itself, or wait for the host
function goWaiting(why) { if (state.waiting) return; state.waiting = why; broadcast(); }
function afterReveal() {
  if (sessionDone) return cfg.endAction === 'wait' ? goWaiting('session') : startRound();   // continue / restart = a new session starts by itself
  if (!cfg.autoNext) return goWaiting('manual');
  if (cfg.stopAfterUnsolved > 0 && unsolvedRun >= cfg.stopAfterUnsolved) return goWaiting('idle');   // nobody is playing -> stop by itself
  startRound();
}
function revealOne() {
  const c = [...current.answer].map((ch, i) => ch === ' ' || revealed.has(i) ? -1 : i).filter(i => i >= 0);
  if (c.length <= 1) return false;
  revealed.add(cfg.hintMode === 'ordered' ? c[0] : c[Math.floor(Math.random() * c.length)]); return true;   // ordered = left to right
}
setInterval(() => {                                   // one ticker: round end, reveal end, auto-hints
  if (paused || state.waiting) return;                // waiting = the game stopped by itself and waits for the host (press next)
  const now = Date.now();
  if (now >= phaseEnd) {
    if (state.phase === 'playing') return endRound(null);
    if (state.phase === 'reveal' && sessionDone && cfg.finalLbSecs > 0 && everyone().length) return startFinale();
    return afterReveal();
  }
  if (state.phase === 'playing' && cfg.hints) {
    const el = (now - (phaseEnd - state.total * 1000)) / 1000, st = state.total * cfg.hintStart / 100;
    const target = el >= st ? Math.min(cfg.maxHints, 1 + Math.floor((el - st) / cfg.hintEvery)) : 0;
    let changed = false;
    while (revealed.size < target) { if (!revealOne()) break; changed = true; }
    if (changed) { state.hint = mask(); broadcast(); }
  }
}, 250);

// ---------- test bot (Test mode only): fake viewers that guess by themselves ----------
const BOT_NAMES = ['luna_x', 'mike99', 'sarah.j', 'tiktokfan', 'bella.b', 'jayden_', 'coolcat', 'sam_the_man', 'zoe.zoe', 'dj_max', 'nina_k', 'alex.plays'];
const BOT_WORDS = ['apple', 'hello', 'cat', 'pizza', 'wow', 'maybe', 'nope', 'lol', 'is it food?', 'hmm', 'too hard', 'dog', 'blue', 'idk', 'love', 'omg'];
const rnd = a => a[Math.floor(Math.random() * a.length)];
function planBot(total) {                             // decided once per round: will a bot solve it, and when?
  const solves = Math.random() * 100 < cfg.botSkill;
  botPlan = { solveAt: solves ? total * (0.1 + Math.random() * 0.8) : null, nextChat: Date.now() + 1500 + Math.random() * 2000 };
}
function botWrongGuess() {                            // never equals the real answer
  const ans = current.answer, letters = [...ans.replace(/ /g, '')];
  for (let t = 0; t < 8; t++) {
    let g;
    if (Math.random() < 0.55 && letters.length > 2) {   // near-miss: the real letters, slightly wrong order
      const a = [...letters], i = Math.floor(Math.random() * a.length), j = Math.floor(Math.random() * a.length);
      [a[i], a[j]] = [a[j], a[i]]; g = a.join('').toLowerCase();
    } else g = rnd(BOT_WORDS);
    if (norm(g) !== norm(ans)) return g;
  }
  return 'hmm';
}
setInterval(() => {
  if (playMode !== 'test' || !cfg.botOn || paused || state.phase !== 'playing' || !current) return;
  const now = Date.now(), elapsed = (now - (phaseEnd - state.total * 1000)) / 1000;
  if (botPlan.solveAt !== null && elapsed >= botPlan.solveAt) { botPlan.solveAt = null; onGuess(rnd(BOT_NAMES), current.answer, ''); return; }
  if (now >= botPlan.nextChat) {
    onGuess(rnd(BOT_NAMES), botWrongGuess(), '');
    botPlan.nextChat = now + cfg.botEvery * 1000 * (0.5 + Math.random());
  }
}, 400);

// ---------- chat ----------
let feedBuf = [], feedId = 0;
const lastGuess = new Map();   // viewer -> time of their last wrong guess (guess cooldown)
setInterval(() => { if (feedBuf.length) { io.emit('feed', feedBuf); feedBuf = []; } }, 300);

function onGuess(user, text, pic) {
  user = String(user || 'viewer').replace(/^@/, '');
  text = String(text || '').slice(0, 60);
  if (!norm(text) || blocked.has(user.toLowerCase())) return false;   // ignored viewers (host's block list)
  if (pic) { pics.set(user, pic); if (pics.size > 3000) pics.delete(pics.keys().next().value); }
  const ok = state.phase === 'playing' && !paused &&
    (cfg.spaceless ? norm(text) === norm(current.answer) : normStrict(text) === current.answer);
  if (!ok && cfg.guessCooldown > 0) {                 // anti-spam: wrong guesses are limited to one every N seconds per viewer (a correct guess always counts)
    const now = Date.now(), last = lastGuess.get(user) || 0;
    if (now - last < cfg.guessCooldown * 1000) return false;
    lastGuess.set(user, now); if (lastGuess.size > 3000) lastGuess.delete(lastGuess.keys().next().value);
  }
  feedBuf.push({ id: ++feedId, user, text: ok ? (cfg.showAnswerWin ? '✅ ' + text : '✅ got it!') : text, ok, pic: pics.get(user) || '' });
  if (feedBuf.length > 40) feedBuf.shift();
  if (ok) endRound({ user, pic: pics.get(user) || '' });
  return !!ok;
}

// ---------- TikTok ----------
const allUrls = (x, out = []) => { if (Array.isArray(x)) x.forEach(v => allUrls(v, out)); else if (x && typeof x === 'object') Object.values(x).forEach(v => allUrls(v, out)); else if (typeof x === 'string' && /^https?:/.test(x)) out.push(x); return out; };
const picOf = x => { const l = allUrls(x); return l.find(u => !/\.heic(\?|$)/i.test(u)) || l[0] || ''; };   // .heic does not display in most browsers
let ttConn = null, ttTimer = null, ttStatus = 'off';   // off | nouser | connecting | connected | retrying
const setTT = st => { if (ttStatus !== st) { ttStatus = st; io.emit('settings', pub()); } };
function disconnectTikTok() {
  clearTimeout(ttTimer); ttTimer = null;
  const c = ttConn; ttConn = null;
  if (c) { try { Promise.resolve(c.disconnect()).catch(() => {}); } catch { /* ignore */ } }
  setTT('off');
}
function connectTikTok() {
  if (playMode !== 'live') return;                    // only Live mode listens to TikTok chat
  const { name, key } = ttCreds();
  if (!name) { setTT('nouser'); return console.log('TikTok username not set -> cannot read chat in Live mode'); }
  clearTimeout(ttTimer); ttTimer = null;
  const conn = new TikTokLiveConnection(name, { signApiKey: key || undefined });
  ttConn = conn; setTT('connecting');
  let retried = false;
  const alive = () => conn === ttConn && playMode === 'live';   // false once the host switched mode
  const retry = why => {
    if (!alive() || retried) return; retried = true; setTT('retrying');
    console.log(`TikTok not connected (${why}). Retrying in 15s - you must be LIVE first.`);
    ttTimer = setTimeout(() => { if (conn === ttConn) { ttConn = null; connectTikTok(); } }, 15000);
  };
  conn.on('chat', d => {
    if (!alive()) return;
    const u = d.user || {};
    const text = d.comment ?? d.text ?? d.content;
    const id = u.uniqueId ?? d.uniqueId ?? u.nickname ?? d.nickname;
    const pic = picOf(u.profilePicture) || picOf(u.profilePictureUrl) || picOf(d.profilePictureUrl) || picOf(u.avatarLarger) || picOf(u.avatarMedium) || picOf(u.avatarThumb);
    if (text) onGuess(id, text, pic);
  });
  conn.on('disconnected', () => retry('disconnected'));
  conn.on('error', e => console.error('TikTok error:', e?.message || e));
  conn.connect().then(() => {
    if (!alive()) { try { Promise.resolve(conn.disconnect()).catch(() => {}); } catch { /* ignore */ } return; }
    setTT('connected'); console.log('TikTok connected to @' + name);
  }).catch(e => retry(e?.message || e));
}

function setMode(m) {
  if (!MODES.includes(m) || m === playMode) return;
  playMode = m; persist(MFILE, { mode: m });
  disconnectTikTok();
  users.clear(); feedBuf = []; resetCounters();       // test/offline scores must never leak into a live show
  io.emit('feedClear');
  if (m === 'live') connectTikTok();
  io.emit('settings', pub()); startRound();
  console.log('Play mode -> ' + m);
}
const FAKE_USERS = ['luna_x', 'mike99', 'sarah.j', 'tiktokfan', 'bella.b', 'jayden_'], FAKE_WORDS = ['apple', 'hello', 'cat', 'pizza', 'wow', 'maybe', 'nope', 'lol'];

// ---------- web + admin ----------
io.on('connection', socket => {
  socket.emit('settings', pub());
  socket.emit('state', snap());
  // Guess box (Test + Offline mode only). Live mode = guesses come from TikTok chat only.
  socket.on('guess', (m, ack) => {
    const done = r => typeof ack === 'function' && ack(r);
    if (playMode === 'live') return done({ ok: false, error: 'Guess box is disabled in Live mode' });
    if (ADMIN_PIN && m?.pin !== ADMIN_PIN) return done({ ok: false, error: 'Wrong or missing PIN' });
    done({ ok: true, correct: onGuess(String(m?.user || 'Me').slice(0, 24), m?.text, '') });
  });
  socket.on('admin', (m, ack) => {
    const done = r => typeof ack === 'function' && ack(r);
    if (ADMIN_PIN && m?.pin !== ADMIN_PIN) return done({ ok: false, error: 'Wrong or missing PIN' });
    switch (m?.a) {
      case 'set': applyPatch(m.patch); io.emit('settings', pub()); break;
      case 'apply':   // Save & Apply (+ optionally as default): store, then start a fresh round so everything takes effect now
        applyPatch(m.patch); clearTimeout(saveT); persist(SFILE, cfg);
        if (m.asDefault) { userDef = JSON.parse(JSON.stringify(cfg)); persist(DFILE, userDef); }
        io.emit('settings', pub()); startRound(); break;
      case 'resetDefaults':   // back to the host's saved defaults (or factory defaults)
        if (m.factory) { userDef = {}; try { fs.unlinkSync(DFILE); } catch {} }
        cfg = { ...DEF, ...JSON.parse(JSON.stringify(userDef)) }; rebuildBlocked(); persist(SFILE, cfg);
        io.emit('settings', pub()); startRound(); break;
      case 'custom': {   // create / replace / delete a host category
        const name = String(m.name || '').toUpperCase().replace(/[^A-Z0-9 &]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
        if (!name) return done({ ok: false, error: 'Type a category name' });
        const words = [...new Set(String(m.words || '').split('\n').map(x => x.toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim()).filter(x => x.replace(/ /g, '').length >= 3 && x.length <= 30))].slice(0, 5000);
        if (words.length) custom[name] = words; else delete custom[name];
        persist(CUFILE, custom); applyCustom(); io.emit('settings', pub()); return done({ ok: true, count: words.length });
      }
      case 'showLb': io.emit('mlb', { rows: everyone(), secs: cfg.lbSecs }); break;
      case 'mode': setMode(m.mode); break;
      case 'tiktok': {   // username + Euler key typed on screen (settings -> Live tab)
        const next = { ...ttSaved };
        if (typeof m.username === 'string') next.username = m.username.replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 40);
        if (m.clearKey) next.apiKey = '';
        else if (typeof m.apiKey === 'string' && m.apiKey.trim()) next.apiKey = m.apiKey.trim().slice(0, 300);   // empty box = keep the saved key
        ttSaved = next; persist(TFILE, ttSaved);
        if (playMode === 'live') { disconnectTikTok(); connectTikTok(); }
        io.emit('settings', pub()); break;
      }
      case 'testSolve': if (playMode === 'test' && state.phase === 'playing' && current) onGuess(FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)], current.answer, ''); break;
      case 'testChat': if (playMode === 'test') for (let i = 0; i < 5; i++) onGuess(FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)], FAKE_WORDS[Math.floor(Math.random() * FAKE_WORDS.length)], ''); break;
      case 'pause': if (!paused) { paused = true; pausedAt = Date.now(); } else { phaseEnd += Date.now() - pausedAt; paused = false; } broadcast(); break;
      case 'skip': state.phase === 'playing' ? endRound(null, true) : startRound(); break;   // skipping never counts as an "unsolved" round
      case 'newSession': users.clear(); feedBuf = []; resetCounters(); io.emit('feedClear'); startRound(); break;   // scores + round counter back to zero
      case 'hint': if (state.phase === 'playing' && !paused && revealOne()) { state.hint = mask(); broadcast(); } break;
      case 'time': if (state.phase === 'playing') { phaseEnd += 15000; state.total += 15; broadcast(); } break;
      case 'next': startRound(); break;
      case 'reset': users.clear(); solvedCount = 0; winStreak = 0; lastWinner = null; broadcast(); break;
    }
    done({ ok: true });
  });
});
const dist = R('client/dist');
app.get('/health', (_, res) => res.send('ok'));
// Profile-picture proxy: loads the exact TikTok picture on the server (no hot-link / referrer blocking, cached), only from TikTok CDN hosts.
const avCache = new Map();
const AV_HOST = /(^|\.)(tiktokcdn[\w-]*|tiktok|ibyteimg|byteimg|muscdn|byteoversea|tiktokv)\.(com|net|us)$/i;
app.get('/avatar', async (req, res) => {
  let url; try { url = new URL(String(req.query.u || '')); } catch { return res.status(400).end(); }
  if (url.protocol !== 'https:' || !AV_HOST.test(url.hostname)) return res.status(400).end();
  const key = url.href;
  let hit = avCache.get(key);
  if (!hit) {
    try {
      const r = await fetch(key, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.tiktok.com/' }, signal: AbortSignal.timeout(6000) });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !/^image\/(jpe?g|png|webp|gif|avif)/i.test(type)) return res.status(502).end();
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 1500000) return res.status(502).end();
      hit = { type, buf }; avCache.set(key, hit);
      if (avCache.size > 500) avCache.delete(avCache.keys().next().value);
    } catch { return res.status(502).end(); }
  }
  res.set({ 'Content-Type': hit.type, 'Cache-Control': 'public, max-age=86400' }).send(hit.buf);
});
app.use(express.static(dist));
app.use((_, res) => res.sendFile(path.join(dist, 'index.html')));
server.listen(PORT, () => { console.log('Listening on ' + PORT); startRound(); connectTikTok(); });   // connectTikTok only acts in Live mode
