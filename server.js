const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const ROUND_SECONDS = +process.env.ROUND_SECONDS || 90;
const REVEAL_SECONDS = 10;
const TEST_MODE = process.env.TEST_MODE === '1';

// ---------- puzzle DB (full DB if generated, else sample) ----------
const full = path.join(__dirname, 'data/puzzles.full.json');
const DB = JSON.parse(fs.readFileSync(fs.existsSync(full) ? full : path.join(__dirname, 'data/puzzles.sample.json'), 'utf8'));
const CATS = Object.keys(DB).filter(c => DB[c].length);
console.log(`Loaded ${CATS.length} categories`);

// ---------- helpers ----------
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Scrambles letters only; spaces stay exactly where they were.
function scramble(answer) {
  const chars = [...answer];
  const pos = [];
  chars.forEach((c, i) => { if (c !== ' ') pos.push(i); });
  const letters = pos.map(i => chars[i]);
  const canDiffer = new Set(letters).size > 1;
  let out = chars;
  for (let t = 0; t < 50; t++) {
    const a = [...letters];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    out = [...chars];
    pos.forEach((p, k) => { out[p] = a[k]; });
    if (!canDiffer || out.join('') !== answer) break;
  }
  return out.join('');
}

const used = {};
let lastCat = null;
function pickPuzzle() {
  let cat;
  do { cat = CATS[Math.floor(Math.random() * CATS.length)]; } while (cat === lastCat && CATS.length > 1);
  lastCat = cat;
  const pool = DB[cat];
  const u = used[cat] || (used[cat] = new Set());
  if (u.size >= pool.length) u.clear();
  let answer;
  do { answer = pool[Math.floor(Math.random() * pool.length)]; } while (u.has(answer));
  u.add(answer);
  return { category: cat, answer: answer.toUpperCase() };
}

// ---------- game state ----------
const scores = new Map(); // user -> wins
let round = 0, current = null, timer = null, deadline = 0;
let state = { phase: 'playing', round: 0, category: '', scrambled: '', answer: null, winner: null, total: ROUND_SECONDS };

const top3 = () => [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([user, wins]) => ({ user, wins }));
const snapshot = () => ({ ...state, remaining: Math.max(0, Math.round((deadline - Date.now()) / 1000)), leaderboard: top3() });

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const broadcast = () => io.emit('state', snapshot());

function startRound() {
  clearTimeout(timer);
  current = pickPuzzle();
  round++;
  deadline = Date.now() + ROUND_SECONDS * 1000;
  state = { phase: 'playing', round, category: current.category, scrambled: scramble(current.answer), answer: null, winner: null, total: ROUND_SECONDS };
  broadcast();
  timer = setTimeout(() => endRound(null), ROUND_SECONDS * 1000);
}

function endRound(winner) {
  if (state.phase !== 'playing') return;
  clearTimeout(timer);
  if (winner) scores.set(winner, (scores.get(winner) || 0) + 1);
  deadline = Date.now() + REVEAL_SECONDS * 1000;
  state = { ...state, phase: 'reveal', answer: current.answer, winner };
  broadcast();
  timer = setTimeout(startRound, REVEAL_SECONDS * 1000);
}

// ---------- chat handling ----------
let feedBuf = [], feedId = 0;
setInterval(() => { if (feedBuf.length) { io.emit('feed', feedBuf); feedBuf = []; } }, 300);

function onGuess(user, text) {
  user = String(user || 'viewer').replace(/^@/, '');
  text = String(text || '').slice(0, 60);
  const g = norm(text);
  if (!g) return;
  const correct = state.phase === 'playing' && g === norm(current.answer);
  feedBuf.push({ id: ++feedId, user, text: correct ? '✅ got it!' : text, ok: correct });
  if (feedBuf.length > 40) feedBuf.shift();
  if (correct) endRound(user);
}

// ---------- TikTok ----------
let retrying = false;
function connectTikTok() {
  const user = (process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
  if (!user) return console.log('TIKTOK_USERNAME not set -> chat disabled (use TEST_MODE=1 and /?test)');
  retrying = false;
  const conn = new TikTokLiveConnection(user, { signApiKey: process.env.TIKTOK_SIGN_API_KEY });
  const retry = why => {
    if (retrying) return;
    retrying = true;
    console.log('TikTok not connected (' + why + '). Retrying in 15s - you must be LIVE first.');
    setTimeout(connectTikTok, 15000);
  };
  conn.on('chat', d => {
    const text = d.comment ?? d.text ?? d.content;
    const u = d.user?.uniqueId ?? d.uniqueId ?? d.user?.nickname ?? d.nickname;
    if (text) onGuess(u, text);
  });
  conn.on('disconnected', () => retry('disconnected'));
  conn.on('error', e => console.error('TikTok error:', e?.message || e));
  conn.connect().then(() => console.log('TikTok connected to @' + user)).catch(e => retry(e?.message || e));
}

// ---------- web ----------
io.on('connection', socket => {
  socket.emit('state', snapshot());
  if (TEST_MODE) socket.on('testGuess', ({ user, text }) => onGuess(user || 'tester', text));
});
const dist = path.join(__dirname, 'client/dist');
app.get('/health', (_, res) => res.send('ok'));
app.use(express.static(dist));
app.use((_, res) => res.sendFile(path.join(dist, 'index.html')));

server.listen(PORT, () => { console.log('Listening on ' + PORT); startRound(); connectTikTok(); });
