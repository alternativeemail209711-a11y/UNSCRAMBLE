import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { THEMES, DEFAULT_THEME, KNIT_RENAME } from './themes.js';
import './styles.css';

const socket = io();
const MEDALS = ['🥇', '🥈', '🥉'];
const FONTS = {
  system: ['System', "system-ui,'Segoe UI',Roboto,sans-serif"], rounded: ['Rounded', "ui-rounded,'Nunito','Trebuchet MS',system-ui,sans-serif"],
  cute: ['Cute (Fredoka)', "'Fredoka','Baloo 2',ui-rounded,'Nunito','Comic Sans MS',sans-serif"], bubbly: ['Bubbly (Baloo)', "'Baloo 2','Fredoka',ui-rounded,sans-serif"],
  serif: ['Serif', "Georgia,'Times New Roman',serif"], mono: ['Monospace', "ui-monospace,Consolas,Menlo,monospace"],
  display: ['Bold display', "Impact,'Arial Black',sans-serif"], fun: ['Playful', "'Comic Sans MS','Chalkboard SE',cursive"]
};
const RADIUS = { rounded: '32%', square: '8%', circle: '50%' };
const XF = {   // extra Google Fonts (game name + letter boxes)
  poppins: ['Poppins (clean bold)', "'Poppins','Fredoka',sans-serif"], rubik: ['Rubik (soft)', "'Rubik','Fredoka',sans-serif"], nunito: ['Nunito (round)', "'Nunito','Fredoka',sans-serif"],
  montserrat: ['Montserrat (modern)', "'Montserrat','Poppins',sans-serif"], bangers: ['Bangers (comic)', "'Bangers','Lilita One',Impact,sans-serif"], chewy: ['Chewy (cartoon)', "'Chewy','Lilita One',sans-serif"],
  marker: ['Permanent Marker (hand-drawn)', "'Permanent Marker','Comic Sans MS',cursive"], pacifico: ['Pacifico (script)', "'Pacifico',cursive"], pixel: ['Press Start 2P (pixel)', "'Press Start 2P',monospace"],
  orbitron: ['Orbitron (sci-fi)', "'Orbitron',sans-serif"], righteous: ['Righteous (retro)', "'Righteous','Lilita One',sans-serif"], cinzel: ['Cinzel (classic capitals)', "'Cinzel',Georgia,serif"], robomono: ['Roboto Mono (typewriter)', "'Roboto Mono',ui-monospace,monospace"]
};
const TFONTS = {   // game-name fonts (Google Fonts, with safe fallbacks)
  fredoka: ['Fredoka (soft yarn)', "'Fredoka','Baloo 2',ui-rounded,sans-serif"], lilita: ['Lilita One (bold cute)', "'Lilita One','Baloo 2',Impact,sans-serif"], titan: ['Titan One (chunky)', "'Titan One','Lilita One',Impact,sans-serif"],
  bungee: ['Bungee (arcade)', "'Bungee','Lilita One',Impact,sans-serif"], luckiest: ['Luckiest Guy (comic)', "'Luckiest Guy','Lilita One',Impact,sans-serif"],
  baloo: ['Baloo 2 (round)', "'Baloo 2','Fredoka',sans-serif"], ...XF, same: ['Same as text font', 'inherit']
};
const TILEF = { same: ['Same as text font', 'inherit'], ...FONTS, ...Object.fromEntries(Object.entries(TFONTS).filter(([k]) => k !== 'same')) };   // letter-box fonts
// Buttons that can appear on the top toolbar (settings ⚙️ is always there so you can never lock yourself out)
const TB = [['mode', '🧪', 'Mode (Test / Live / Solo)'], ['theme', '🎨', 'Theme'], ['pause', '⏸️', 'Pause / Resume'], ['skip', '⏭️', 'Skip round'], ['hint', '🪡', 'Hint now'],
  ['time', '⏰', 'Add 15 seconds'], ['cats', '🧺', 'Categories'], ['answer', '👁️', 'Show / hide correct answer'], ['sound', '🔔', 'Sound on / off'], ['full', '⛶', 'Full screen'], ['lb', '🏆', 'Show / hide leaderboard now'], ['resetlb', '✂️', 'Reset leaderboard']];
const TB_DEFAULT = ['mode', 'theme', 'pause', 'skip', 'hint', 'lb', 'full'];
// Floating windows: every window has its own settings (g = guess window, w = winner window, l = full leaderboard window).
// X / Y = how far it is moved from its normal place (% of the screen), Sc = size %, W = width %, Op = whole-window opacity, Bg / BgOp = background colour + opacity.
const WDEF = {
  gRows: 1, gW: 100, gSc: 100, gX: 0, gY: 0, gOp: 100, gBg: '', gBgOp: 100, gAv: true, gNm: true, gTx: true,
  wRows: 4, wW: 100, wSc: 100, wX: 0, wY: 0, wOp: 100, wBg: '', wBgOp: 100, wAv: true, wNm: true, wWd: true, wPt: true, wHead: '',
  lTop: 0, lVis: 0, lW: 100, lSc: 100, lX: 0, lY: 0, lOp: 100, lBg: '', lBgOp: 100, lRk: true, lAv: true, lNm: true, lPt: true, lHead: true, lTitle: '🧶 Leaderboard', lDim: true
};
// Puzzle letter boxes (t = tile)
const TDEF = { tYarn: true, tFont: 'same', tWt: '700', tFs: 64, tTxt: '', tBg1: '', tBg2: '', tEdge: '', tOk1: '', tOk2: '', tOp: 100, tBw: 7, tGap: 8, tGloss: false, tShadow: true, tBob: true };
const DEFAULTS = { theme: DEFAULT_THEME, font: 'cute', titleFont: 'fredoka', toolbar: TB_DEFAULT, fontScale: 100, tileShape: 'rounded', tileScale: 100, title: 'WORD SHUFFLE', cTitle: '',
  footer: 'Type the correct word(s) in the chat to win!', reduceMotion: false, showTitle: true, showCategory: true, showTimer: true,
  showHint: true, showPopup: true, showLb: true, showFeed: true, showFooter: true, feedSecs: 3, lbRows: 5,
  z1: 9, zg: 8, z2: 34, z4: 14, sound: false, volume: 60, playerName: 'Me', cBg1: '', cBg2: '', cA1: '', cA2: '', cTxt: '', liveAsk: true, showNext: true, showChat: true, chatW: 50, ...WDEF, ...TDEF };
const MODES = {
  test: ['🧪', 'TEST', 'Test mode', 'Try games & upgrades. TikTok chat is OFF. Use the guess box, ✅ (solve), 💬 (fake chat) and 🤖 (auto-guessing bot).'],
  live: ['🔴', 'LIVE', 'Live mode', 'Go live on TikTok. Reads the TikTok chat. Guess box is hidden.'],
  offline: ['🎮', 'SOLO', 'Offline mode', 'Play by yourself. TikTok chat is OFF. Type your own guesses in the box.']
};
const TT_TEXT = { off: '', nouser: '⚠️ No TikTok username yet - open ⚙️ → 🔴 Live and type it in', connecting: '⏳ Connecting to TikTok…', connected: '✅ Connected to TikTok chat', retrying: '⏳ Not live yet - retrying every 15s' };
// One-time upgrade: older saved layouts (3 leaderboard rows, old zone heights, 'UNSCRAMBLE LIVE') are replaced by the new layout.
const LAYOUT_V = '4', OLD_KEYS = ['z1', 'zg', 'z2', 'z4', 'lbRows', 'feedLines'];
const KNIT_KEYS = ['titleFont', 'tOk1', 'tOk2', 'tBg1', 'tBg2', 'tEdge', 'tTxt', 'cBg1', 'cBg2', 'cA1', 'cA2', 'cTxt', 'cTitle', 'lTitle'];   // old colours/fonts are dropped once, so the knitting look shows up
const cleanOld = o => { const c = { ...o }; OLD_KEYS.forEach(k => delete c[k]); if (c.title === 'UNSCRAMBLE LIVE') delete c.title; return c; };
const readSaved = key => {
  let o = {}; try { o = JSON.parse(localStorage.getItem(key) || '{}'); } catch { o = {}; }
  try { if (localStorage.getItem('ul-layout-v') !== LAYOUT_V) o = cleanOld(o); } catch { /* ignore */ }
  try { if (localStorage.getItem('ul-title-v') !== '1' && (o.title === 'UNSCRAMBLE' || o.title === 'UNSCRAMBLE LIVE')) { o = { ...o }; delete o.title; } } catch { /* ignore */ }
  try {
    const kv = localStorage.getItem('ws-knit-v');
    if (!kv) { o = { ...o }; KNIT_KEYS.forEach(k => delete o[k]); }                       // first time: old colours/fonts are dropped so the knitting look shows
    else if (kv === '1' && KNIT_RENAME[o.theme]) o = { ...o, theme: KNIT_RENAME[o.theme] };   // 2nd version: wool themes were renamed knit_...
    if (kv !== '3') { o = { ...o }; delete o.chatW; }                                          // 3rd version: new chat/leaderboard layout uses the new default width
  } catch { /* ignore */ }
  return o;
};
const markMigrated = () => {
  try {
    if (localStorage.getItem('ul-layout-v') !== LAYOUT_V) { localStorage.setItem('ul-defaults', JSON.stringify(readSaved('ul-defaults'))); localStorage.setItem('ul-settings', JSON.stringify(readSaved('ul-settings'))); localStorage.setItem('ul-layout-v', LAYOUT_V); }
    if (localStorage.getItem('ul-title-v') !== '1') { localStorage.setItem('ul-defaults', JSON.stringify(readSaved('ul-defaults'))); localStorage.setItem('ul-settings', JSON.stringify(readSaved('ul-settings'))); localStorage.setItem('ul-title-v', '1'); }
    if (localStorage.getItem('ws-knit-v') !== '3') { localStorage.setItem('ul-defaults', JSON.stringify(readSaved('ul-defaults'))); localStorage.setItem('ul-settings', JSON.stringify(readSaved('ul-settings'))); localStorage.setItem('ws-knit-v', '3'); }
  } catch { /* ignore */ }
};
const loadDefaults = () => ({ ...DEFAULTS, ...readSaved('ul-defaults') });
const tg = (k, l) => ({ k, l, t: 'toggle' });
const rg = (k, l, min, max, step = 1, u = '') => ({ k, l, t: 'range', min, max, step, u });
const FIELDS = {
  look: [
    { k: 'theme', l: 'Theme', t: 'select', o: Object.entries(THEMES).map(([k, x]) => [k, x.icon + ' ' + x.name]) },
    { k: 'font', l: 'Font', t: 'select', o: Object.entries(FONTS).map(([k, x]) => [k, x[0]]) },
    { k: 'titleFont', l: 'Game name font', t: 'select', o: Object.entries(TFONTS).map(([k, x]) => [k, x[0]]) },
    rg('fontScale', 'Text size', 80, 120, 5, '%'),
    { k: 'tileShape', l: 'Tile shape', t: 'select', o: [['rounded', 'Rounded'], ['square', 'Square'], ['circle', 'Circle']] },
    rg('tileScale', 'Max tile size', 60, 100, 5, '%'),
    { k: 'title', l: 'Title text', t: 'text' }, { k: 'footer', l: 'Footer text', t: 'text' },
    { k: 'playerName', l: 'My name (Test / Offline guesses)', t: 'text' },
    tg('reduceMotion', 'Reduce animations'),
    { k: 'cBg1', l: 'Background colour 1 (Reset = theme)', t: 'color' }, { k: 'cBg2', l: 'Background colour 2', t: 'color' }, { k: 'cA1', l: 'Accent colour 1 (banners, buttons)', t: 'color' }, { k: 'cA2', l: 'Accent colour 2', t: 'color' }, { k: 'cTxt', l: 'Text colour', t: 'color' }, { k: 'cTitle', l: 'Game name colour (Reset = theme text colour)', t: 'color' },
    tg('showNext', 'Show "next round in N seconds" countdown after each round'), tg('showChat', 'Show live chat beside the leaderboard'), rg('chatW', 'Live chat width', 30, 65, 1, '%'),
    tg('liveAsk', 'Show the TikTok login window when switching to Live')],
  layout: [
    tg('showTitle', 'Show title'), tg('showCategory', 'Show category banner'), tg('showTimer', 'Show timer'), tg('showHint', 'Show hint letters'),
    tg('showFeed', 'Show guess window (one guess at a time, under the category)'), tg('showPopup', 'Show winner window in the centre'), tg('showLb', 'Show mini leaderboard (bottom)'), tg('showFooter', 'Show footer'),
    rg('feedSecs', 'Guess window stays for', 1, 10, 1, 's'), rg('lbRows', 'Mini leaderboard rows (top)', 1, 8),
    rg('z1', 'Category height', 6, 20, 1, '%'), rg('zg', 'Guess window height', 6, 20, 1, '%'), rg('z2', 'Puzzle height', 20, 50, 1, '%'), rg('z4', 'Footer height', 8, 25, 1, '%'),
    tg('sound', 'Sound effects'), rg('volume', 'Volume', 0, 100, 5, '%')],
  game: [
    rg('roundSeconds', 'Round time', 20, 300, 5, 's'),
    tg('showAnswerWin', '✅ Show the answer when a viewer guesses it correctly'), rg('popupSecs', 'Winner window duration (centre)', 2, 30, 1, 's'),
    tg('showLbOverlay', 'Show full leaderboard after the winner window'), rg('lbSecs', 'Full leaderboard duration', 3, 60, 1, 's'),
    tg('showAnswer', '⌛ Show the answer when time runs out (nobody solved it)'), rg('revealSeconds', 'Reveal time when nobody solved it', 3, 30, 1, 's'),
    rg('minLetters', 'Min letters', 3, 25), rg('maxLetters', 'Max letters', 3, 25), tg('allowMulti', 'Allow multi-word puzzles'),
    tg('spaceless', 'Accept answer without spaces'), tg('hints', 'Auto hints (reveal letters)'), rg('hintStart', 'First hint at', 10, 90, 5, '% of round'),
    rg('hintEvery', 'Next hint every', 3, 60, 1, 's'), rg('maxHints', 'Max hints', 0, 10), rg('wordPercent', 'Word Power (dictionary) share of rounds in Random mix', 0, 100, 5, '%'),
    tg('botOn', '🤖 Test bot guesses by itself (Test mode only)'), rg('botEvery', 'Bot guesses every', 1, 30, 1, 's'), rg('botSkill', 'Chance the bot solves a round', 0, 100, 5, '%')]
};

// ---- FLOATING WINDOWS tab: each window has its own group of settings (src 'cfg' = saved on the server, otherwise this device)
const posF = (p, wmin, wmax) => [
  rg(p + 'X', 'Move left ⟷ right', -50, 50, 1, '%'), rg(p + 'Y', 'Move up ↕ down', -50, 50, 1, '%'), rg(p + 'Sc', 'Size (whole window)', 40, 160, 5, '%'), rg(p + 'W', 'Width', wmin, wmax, 5, '%'),
  rg(p + 'Op', 'Window opacity (everything in it)', 10, 100, 5, '%'), { k: p + 'Bg', l: 'Background colour (Reset = theme)', t: 'color' }, rg(p + 'BgOp', 'Background opacity', 0, 100, 5, '%')];
const WINF = {
  g: { title: '💬 Guess window (under the category)', fields: [
    tg('showFeed', 'Show this window'), rg('feedSecs', 'Each guess stays for', 1, 10, 1, 's'), rg('gRows', 'Rows: guesses shown at once', 1, 5),
    tg('gAv', 'Show profile picture'), tg('gNm', 'Show @username'), tg('gTx', 'Show the guess text'), ...posF('g', 30, 100)] },
  w: { title: '🏆 Winner window (centre)', fields: [
    tg('showPopup', 'Show this window'), { ...rg('popupSecs', 'Stays for', 2, 30, 1, 's'), src: 'cfg' }, rg('wRows', 'Rows (1 = everything on one row … 4 = each item on its own row)', 1, 4),
    tg('wAv', 'Show profile picture'), tg('wNm', 'Show @username'), tg('wWd', 'Show the correct word'), tg('wPt', 'Show the points (+1)'), { k: 'wHead', l: 'Heading text (optional, e.g. 🧶 WINNER!)', t: 'text' }, ...posF('w', 40, 115)] },
  l: { title: '📊 Full leaderboard window', fields: [
    { ...tg('showLbOverlay', 'Show this window after the winner window'), src: 'cfg' }, { ...rg('lbSecs', 'Stays for', 3, 60, 1, 's'), src: 'cfg' },
    rg('lTop', 'Players listed (0 = everyone)', 0, 50), rg('lVis', 'Rows visible at once (0 = auto, extra players scroll)', 0, 15),
    tg('lRk', 'Show rank / medal'), tg('lAv', 'Show profile picture'), tg('lNm', 'Show @username'), tg('lPt', 'Show points'), tg('lHead', 'Show heading'), { k: 'lTitle', l: 'Heading text', t: 'text' }, tg('lDim', 'Dim the game behind it'), ...posF('l', 50, 105)] }
};
const clrF = (k, l) => ({ k, l, t: 'color' });
const TILE_F = [
  { k: 'tileShape', l: 'Box shape', t: 'select', o: [['rounded', 'Rounded'], ['square', 'Square'], ['circle', 'Circle']] }, rg('tileScale', 'Max box size', 60, 100, 5, '%'),
  { k: 'tFont', l: 'Letter font', t: 'select', o: Object.entries(TILEF).map(([k, x]) => [k, x[0]]) },
  { k: 'tWt', l: 'Letter weight', t: 'select', o: [['400', 'Regular'], ['500', 'Medium'], ['700', 'Bold'], ['900', 'Black']] }, rg('tFs', 'Letter size inside the box', 40, 90, 1, '%'),
  clrF('tTxt', 'Letter colour (Reset = theme)'), clrF('tBg1', 'Box colour - top (Reset = theme)'), clrF('tBg2', 'Box colour - bottom (same as top = solid)'), clrF('tEdge', 'Border colour'),
  rg('tOp', 'Box opacity (letters stay solid)', 0, 100, 5, '%'), rg('tBw', 'Border thickness', 0, 15, 1, '%'), rg('tGap', 'Space between boxes', 0, 40, 1, '%'),
  clrF('tOk1', 'Solved colour - top (when the word is revealed)'), clrF('tOk2', 'Solved colour - bottom'),
  tg('tYarn', 'Multicolour yarn boxes (Off = one plain wool colour)'), tg('tShadow', 'Drop shadow'), tg('tBob', 'Bouncing / wobble animation')];

// CSS variables for the letter boxes and for the floating windows
const mixc = (c, p) => (p >= 100 ? c : `color-mix(in srgb, ${c} ${p}%, transparent)`);
const tileVars = l => {
  const o = l.tOp ?? 100, v = {
    '--tb1': mixc(l.tBg1 || 'var(--t1)', o), '--tb2': mixc(l.tBg2 || 'var(--t2)', o), '--tbe': mixc(l.tEdge || 'var(--te)', o), '--tok1': mixc(l.tOk1 || '#C6E8B4', o), '--tok2': mixc(l.tOk2 || '#7DBB68', o),
    '--tbw': (l.tBw ?? 7) / 100, '--tfs': (l.tFs ?? 64) / 100, '--tfw': l.tWt || '700', '--tgap': (l.tGap ?? 8) / 100, '--hl': 'none' };
  if (l.tTxt) v['--ttx'] = l.tTxt;
  const ff = (TILEF[l.tFont] || [])[1]; if (ff && ff !== 'inherit') v['--tff'] = ff;
  v['--tgl'] = 'linear-gradient(#0000,#0000)';   // no shiny highlight on the letter boxes
  return v;
};
const lumOf = c => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return 1; let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join(''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return 0.299 * r + 0.587 * g + 0.114 * b; };
const rowVars = (l, th) => { const dark = lumOf(l.cBg1 || th.v['--bg1']) < 0.4; return dark ? { '--rowbg': 'rgba(0,0,0,.42)', '--rowtx': '#fff' } : { '--rowbg': 'rgba(255,255,255,.94)', '--rowtx': 'var(--text)' }; };   // chat + leaderboard rows: solid, high-contrast cards on every theme
const yarnOn = l => l.tYarn !== false && !l.tBg1 && !l.tBg2;   // multicolour yarn letter boxes (only while no custom box colour is chosen)
const themeVars = l => ({ ...(THEMES[l.theme] || THEMES[DEFAULT_THEME]).v, ...(l.cBg1 && { '--bg1': l.cBg1 }), ...(l.cBg2 && { '--bg2': l.cBg2 }), ...(l.cA1 && { '--a1': l.cA1 }), ...(l.cA2 && { '--a2': l.cA2 }), ...(l.cTxt && { '--text': l.cTxt }) });
const winPos = (l, p) => { const x = l[p + 'X'], y = l[p + 'Y'], sc = l[p + 'Sc'], op = l[p + 'Op']; return { transform: x || y || sc !== 100 ? `translate(${x}cqw, ${y}cqh) scale(${sc / 100})` : 'none', opacity: op / 100 }; };
const winBg = (l, p, d) => { const c = l[p + 'Bg'] || d, o = l[p + 'BgOp']; return o >= 100 ? c : `color-mix(in srgb, ${c} ${o}%, transparent)`; };
const SAMPLE_G = ['sample_fan|is it a planet?|0', 'word_wizard|PLANET|1', 'quick_fox|maybe a star|0', 'lucky_lily|comet?|0', 'top_guesser|moon|0'].map((x, i) => { const [user, text, ok] = x.split('|'); return { id: 'sg' + i, user, text, ok: ok === '1', pic: '' }; });
const SAMPLE_W = { user: 'word_wizard', pic: '', word: 'PLANET', pts: 1 };
const SAMPLE_L = Array.from({ length: 14 }, (_, i) => ({ user: 'player_' + (i + 1), pic: '', score: 15 - i }));
const winKeys = p => Object.keys(WDEF).filter(k => k[0] === p);

// ---- TOOLBAR REGISTRY: every toggle / slider / dropdown / text setting can be pinned to the top toolbar as a button.
const ICONS = { font: '🔤', fontScale: '🔠', tileShape: '🔷', tileScale: '🔳', title: '✏️', footer: '📝', playerName: '👤', reduceMotion: '🐢', showTitle: '🏷️', showCategory: '📂',
  showTimer: '⏱️', showHint: '🔎', showFeed: '💬', showPopup: '🏆', showLb: '📊', showFooter: '📄', feedSecs: '⏳', lbRows: '🔢', z1: '📏', zg: '📏', z2: '📏', z4: '📏', volume: '🔊',
  roundSeconds: '⏲️', popupSecs: '🕒', showLbOverlay: '🥇', lbSecs: '🕓', showAnswer: '⌛', revealSeconds: '🕰️', minLetters: '🔽', maxLetters: '🔼', allowMulti: '🔀',
  spaceless: '⎵', hints: '🪡', hintStart: '🚦', hintEvery: '🔁', maxHints: '🔟', botOn: '🤖', botEvery: '⏩', botSkill: '🎯', titleFont: '🅰️' };
const SKIP = new Set(['theme', 'sound', 'showAnswerWin']);   // these already have their own built-in buttons
const FGROUPS = [['look', '🎨 Look settings'], ['layout', '📐 Layout settings'], ['game', '🎮 Game settings']];
const FITEMS = FGROUPS.flatMap(([g]) => FIELDS[g].filter(f => !SKIP.has(f.k)).map(f => ({ id: 'f:' + f.k, f, src: g === 'game' ? 'cfg' : 'L' })));
const FMAP = Object.fromEntries(FITEMS.map(x => [x.id, x]));
const ALL_IDS = [...TB.map(x => x[0]), ...FITEMS.map(x => x.id)];

let ac;
function beep(vol, notes) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.12;
      o.frequency.value = f; g.gain.value = (vol / 100) * 0.25; o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.18);
    });
  } catch { /* audio not available */ }
}

// STRICT ONE-ROW RULE: every letter of every word sits in ONE single row. The tile size is calculated from the row width
// (letters + small gaps inside words + bigger gaps between words), so the row always fits - long answers simply get smaller tiles.
const LETTER_GAP = 0.08, WORD_GAP = 0.5;
function rowTile(lens, W, H, gap = LETTER_GAP) {
  const L = lens.reduce((a, b) => a + b, 0), n = lens.length;
  const units = L + gap * (L - n) + WORD_GAP * (n - 1);
  return Math.max(4, Math.floor(Math.min((W * 0.96) / units, H * 0.78, 90)));
}

// Exact TikTok profile picture, always a circle. Try the server proxy first, then the direct URL, then a letter bubble.
const proxied = u => '/avatar?u=' + encodeURIComponent(u);
function Avatar({ pic, name, size }) {
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [pic]);
  const st = { '--s': size };
  return !pic || stage > 1
    ? <span className="av ph" style={st}>{[...(name || '?')][0].toUpperCase()}</span>
    : <img className="av" style={st} src={stage === 0 ? proxied(pic) : pic} alt="" referrerPolicy="no-referrer" onError={() => setStage(x => x + 1)} />;
}

// Full leaderboard (everyone with points). Rows shrink to fit; with a long list (or a fixed number of visible rows) it scrolls slowly during the display time.
// `l` = this window's own settings (players listed, rows visible, what is shown, size/width/colour).
function FullBoard({ rows: all, secs, winner, l }) {
  const rows = l.lTop > 0 ? all.slice(0, l.lTop) : all, n = rows.length, fixed = l.lVis > 0, AV = fixed ? l.lVis * 10 : 100;
  const pitch = fixed ? 10 : n * 10 <= AV ? 10 : Math.max(6.4, AV / n), rh = pitch - 1, total = n * pitch, over = Math.max(0, total - AV);
  return (
    <div className="fb" style={{ width: 92 * l.lW / 100 + 'cqw', background: winBg(l, 'l', 'var(--bg1)') }}>
      {l.lHead && <h2>{l.lTitle}</h2>}
      <div className="fbwin" style={{ height: Math.min(total, AV) + 'cqw' }}>
        <div className={'fblist' + (over > 0 ? ' scroll' : '')} style={{ '--rh': rh, '--d': over + 'cqw', '--secs': Math.max(2, secs - 1) + 's' }}>
          {rows.map((p, i) => (
            <div className={'fbrow' + (p.user === winner ? ' new' : '')} key={p.user}>
              {l.lRk && <span className="rk">{i < 3 ? MEDALS[i] : i + 1}</span>}
              {l.lAv && <Avatar pic={p.pic} name={p.user} size="calc(var(--rh)*1cqw)" />}
              <div className="who">{l.lNm && <b>@{p.user}</b>}</div>
              {l.lPt && <span className="pts">{p.score}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Winner window: picture / name / word / points arranged in the number of rows chosen for this window.
function WinnerCard({ w, l }) {
  const items = [l.wAv && 'av', l.wNm && 'nm', l.wWd && 'wd', l.wPt && 'pt'].filter(Boolean), k = items.length;
  const R = k ? Math.max(1, Math.min(l.wRows || 4, k)) : 0, base = R ? Math.floor(k / R) : 0, extra = R ? k % R : 0, groups = []; let at = 0;
  for (let i = 0; i < R; i++) { const c = base + (i < extra ? 1 : 0); groups.push(items.slice(at, at + c)); at += c; }
  const part = (id, shared) => (id === 'av' ? <Avatar key={id} pic={w.pic} name={w.user} size={shared ? '15cqw' : '30cqw'} />
    : id === 'nm' ? <b key={id} className="pn">@{w.user}</b>
      : id === 'wd' ? <FitText key={id} className="wd" dep={w.word}>{w.word || '🧶 Correct!'}</FitText>
        : <div key={id} className="pt">+{w.pts}</div>);
  return (
    <div className="pop" style={{ width: 82 * l.wW / 100 + 'cqw', background: winBg(l, 'w', 'var(--bg1)') }}>
      {l.wHead && <FitText className="whd" dep={l.wHead}>{l.wHead}</FitText>}
      {groups.map((g, i) => <div className="prow" key={i}>{g.map(id => part(id, g.length > 1))}</div>)}
    </div>
  );
}

function Board({ text, solved, scale, gap }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 320, h: 200 });
  useLayoutEffect(() => {
    const el = ref.current;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const words = text.split(' ').filter(Boolean);
  const t = Math.max(4, Math.floor(rowTile(words.map(w => w.length), box.w, box.h, gap) * scale / 100));   // scale is <= 100, so it can only shrink
  return (
    <div className="board" ref={ref} style={{ '--t': t + 'px' }}>
      <div className="words" key={text}>
        {words.map((w, i) => (
          <div className="word" key={i}>
            {[...w].map((c, j) => <span key={j} className={'tile' + (solved ? ' ok' : '')} style={{ animationDelay: (i * 3 + j) * 25 + 'ms' }}>{c}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

// One-row text: never wraps, never truncated - the font shrinks until the whole text fits the available width
function FitText({ as: Tag = 'div', className, children, dep }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (el.scrollWidth > el.clientWidth + 1) el.style.fontSize = Math.max(6, px * el.clientWidth / el.scrollWidth * 0.97) + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [dep]);   // eslint-disable-line
  return <Tag ref={ref} className={className}>{children}</Tag>;
}

// GAME NAME: two lines - the first word small (exactly 50% of the second word's size) above the big second word. No border, no badge.
// It always stays inside its own reserved area on the toolbar: the size is worked out from the area's width AND height, and re-measured
// after fonts finish loading, when the theme/font/size changes, and when the screen is resized.
function BrandTitle({ text, dep, on, fs }) {
  const box = useRef(null), blk = useRef(null);
  const words = (text || '').trim().split(/\s+/).filter(Boolean), top = words.length > 1 ? words[0] : '', bottom = words.length > 1 ? words.slice(1).join(' ') : words[0] || '';
  useLayoutEffect(() => {
    const b = box.current, t = blk.current; if (!b || !t) return undefined;
    let dead = false;
    const fit = () => {
      if (dead) return;
      const cs = getComputedStyle(b), rw = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), rhh = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (rw <= 0 || rhh <= 0) return;
      let px = (rhh / (top ? 1.65 : 1.1)) * Math.min(1, fs || 1);   // small word = 50% of the big one, so the pair is 1.5 lines tall
      t.style.setProperty('--bf', px + 'px');
      for (let i = 0; i < 8; i++) {   // a few passes: shrink until BOTH the width and the height fit
        const r = t.getBoundingClientRect(), k = Math.min(rw / r.width, rhh / r.height);
        if (!(k < 0.995)) break;
        px = Math.max(4, px * k * 0.98); t.style.setProperty('--bf', px + 'px');
      }
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(b);
    document.fonts?.ready?.then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit);
    const t1 = setTimeout(fit, 600), t2 = setTimeout(fit, 2500);   // safety re-checks for slow phones
    return () => { dead = true; ro.disconnect(); clearTimeout(t1); clearTimeout(t2); document.fonts?.removeEventListener?.('loadingdone', fit); };
  }, [dep, text, top, fs]);   // eslint-disable-line
  return <div ref={box} className={'brand' + (on ? '' : ' hid')}><div ref={blk} className="bi">{top && <span className="l1">{top}</span>}<span className="l2">{bottom}</span></div></div>;
}
const CatBanner = ({ text, on, dep }) => <FitText className={'cat' + (on ? '' : ' hid')} dep={text + '|' + dep}>✨ CATEGORY: {text}</FitText>;

function Field({ f, v, set }) {
  const c = f.t === 'toggle' ? <input type="checkbox" checked={!!v} onChange={e => set(f.k, e.target.checked)} />
    : f.t === 'range' ? <input type="range" min={f.min} max={f.max} step={f.step || 1} value={v} onChange={e => set(f.k, +e.target.value)} />
    : f.t === 'select' ? <select value={v} onChange={e => set(f.k, e.target.value)}>{f.o.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
    : f.t === 'color' ? <span className="clr"><input type="color" value={v || '#ffffff'} onChange={e => set(f.k, e.target.value)} /><button type="button" onClick={() => set(f.k, '')}>Reset</button></span>
    : <input type="text" value={v} maxLength={60} onChange={e => set(f.k, e.target.value)} />;
  return <label className={'fld ' + f.t}><span>{f.l}{f.t === 'range' && <b> {v}{f.u}</b>}</span>{c}</label>;
}

export default function App() {
  const [Lr, setL] = useState(() => { const v = { ...loadDefaults(), ...readSaved('ul-settings') }; markMigrated(); return v; });
  const [draft, setDraft] = useState(null), [toast, setToast] = useState(''), [hasDef, setHasDef] = useState(false);   // draft = what the settings panel edits until Save & Apply
  const [prev, setPrev] = useState(null);   // 'g' | 'w' | 'l' = previewing a floating window with the unsaved draft settings
  const L = prev && draft ? draft.L : Lr;   // while previewing, the whole screen is drawn with the draft settings
  const setLocal = (k, v) => { setL(o => ({ ...o, [k]: v })); setDraft(d => (d ? { ...d, L: { ...d.L, [k]: v } } : d)); };   // toolbar quick actions (theme, sound)
  const setDL = (k, v) => setDraft(d => ({ ...d, L: { ...d.L, [k]: v } }));
  const setDC = (k, v) => setDraft(d => ({ ...d, cfg: { ...d.cfg, [k]: v } }));
  useEffect(() => { try { localStorage.setItem('ul-settings', JSON.stringify(Lr)); } catch { /* ignore */ } }, [Lr]);
  useEffect(() => { if (!prev) return undefined; const t = setTimeout(() => setPrev(null), 12000); return () => clearTimeout(t); }, [prev]);

  const [s, setS] = useState(null), [cfg, setCfg] = useState(null), [cats, setCats] = useState([]), [pinReq, setPinReq] = useState(false);
  const [gws, setGws] = useState([]), [left, setLeft] = useState(0);   // gws = the guess card(s) currently floating in the guess window
  const gwT = useRef({ shownAt: 0, swap: 0, secs: 3, rows: 1, tm: {} });
  const [menu, setMenu] = useState(false), [mmenu, setMmenu] = useState(false), [panel, setPanel] = useState(null), [pop, setPop] = useState(null);
  const [pm, setPm] = useState('test'), [tt, setTt] = useState({ status: 'off', user: '' }), [fb, setFb] = useState('');
  const [ttUser, setTtUser] = useState(''), [ttKey, setTtKey] = useState(''), [ttMsg, setTtMsg] = useState('');
  const [livePop, setLivePop] = useState(false), [chat, setChat] = useState([]), [mlb, setMlb] = useState(null), mlbOn = useRef(false), [custom, setCustom] = useState({}), [mineName, setMineName] = useState(''), [mineText, setMineText] = useState('');
  const gref = useRef(null);
  const [pin, setPin] = useState(() => localStorage.getItem('ul-pin') || ''), [msg, setMsg] = useState('');
  const deadline = useRef(0);

  useEffect(() => {
    socket.on('state', st => { setS(st); deadline.current = Date.now() + st.remaining * 1000; setLeft(st.remaining); });
    socket.on('settings', x => { setCfg(x.cfg); setCats(x.cats); setPinReq(x.pinRequired); setCustom(x.custom || {}); setHasDef(!!x.hasDefaults); setPm(x.playMode || 'test'); setTt(x.tt || { status: 'off', user: '' }); });
    const g = gwT.current, MIN_MS = 1200;   // a guess card is shown at least 1.2s before the next one may replace it
    const clearGw = () => { Object.values(g.tm).forEach(clearTimeout); g.tm = {}; setGws([]); };
    const show = batch => {   // each guess card has its own timer; the window keeps the newest `rows` cards
      g.shownAt = Date.now();
      setGws(list => [...list.filter(x => !batch.some(b => b.id === x.id)), ...batch].slice(-g.rows));
      batch.forEach(b => { clearTimeout(g.tm[b.id]); g.tm[b.id] = setTimeout(() => { setGws(list => list.filter(x => x.id !== b.id)); delete g.tm[b.id]; }, g.secs * 1000); });
    };
    socket.on('feedClear', () => { setChat([]); mlbOn.current = false; setMlb(null); clearTimeout(g.swap); clearGw(); });
    socket.on('mlb', m => {   // host pressed the trophy button: show / hide the full leaderboard
      clearTimeout(g.mt);
      if (mlbOn.current || !m.rows.length) { mlbOn.current = false; setMlb(null); if (!m.rows.length) { setToast('🏆 No points yet'); setTimeout(() => setToast(''), 2000); } return; }
      mlbOn.current = true; setMlb(m); g.mt = setTimeout(() => { mlbOn.current = false; setMlb(null); }, m.secs * 1000);
    });
    socket.on('feed', items => {
      setChat(c => { const ids = new Set(c.map(x => x.id)); return [...c, ...items.filter(x => !ids.has(x.id))].slice(-30); });
      const batch = items.slice(-g.rows); if (!batch.length) return;   // busy chat: only the newest guess(es) are shown, never a pile
      const wait = MIN_MS - (Date.now() - g.shownAt);
      clearTimeout(g.swap);
      if (wait <= 0) show(batch); else g.swap = setTimeout(() => show(batch), wait);
    });
    const iv = setInterval(() => { if (!paused.current) setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))); }, 250);
    return () => { clearInterval(iv); Object.values(g.tm).forEach(clearTimeout); clearTimeout(g.swap); socket.off('state'); socket.off('settings'); socket.off('feed'); socket.off('feedClear'); socket.off('mlb'); clearTimeout(g.mt); };
  }, []);
  const paused = useRef(false);
  paused.current = !!s?.paused;
  gwT.current.secs = Lr.feedSecs || 3;
  gwT.current.rows = Math.max(1, Lr.gRows || 1);
  useEffect(() => { setTtUser(tt.user || ''); }, [tt.user]);

  useEffect(() => { if (s?.phase === 'reveal' && s.winnerInfo && L.sound) beep(L.volume, [523, 659, 784, 1047]); }, [s?.phase, s?.round]); // eslint-disable-line

  const theme = THEMES[L.theme] || THEMES[DEFAULT_THEME];
  // The WHOLE page (also the strips above the toolbar and below the footer, and the phone's status bar) uses the same theme colours as the game.
  useEffect(() => {
    const r = document.documentElement, b1 = L.cBg1 || theme.v['--bg1'], b2 = L.cBg2 || theme.v['--bg2'];
    r.style.setProperty('--bg1', b1); r.style.setProperty('--bg2', b2); document.body.style.background = '';
    r.classList.toggle('plainBg', !!theme.plain);   // original themes = plain colour background (no stitched fabric)
    let m = document.querySelector('meta[name="theme-color"]'); if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = b1;
  }, [theme, L.cBg1, L.cBg2]);


  const openPanel = tab => {
    setDraft(d => d || { L: { ...Lr }, cfg: cfg ? { ...cfg, disabled: [...cfg.disabled], picked: [...cfg.picked] } : null });
    setPanel(tab);
  };
  const closePanel = () => { setPanel(null); setDraft(null); setPrev(null); };   // closing without saving discards the draft
  const admin = (a, extra = {}) => socket.emit('admin', { a, pin, ...extra }, r => {
    if (r && !r.ok) { setMsg(r.error); openPanel('admin'); } else setMsg('');
  });
  const flash = t => { setToast(t); setTimeout(() => setToast(''), 2600); };
  // SAVE & APPLY: look settings apply on this screen, game + category settings go to the server and a new round starts right away.
  // asDefault also remembers everything as the defaults used by "Reset to my defaults" (look on this device, game on the server).
  const commit = asDefault => {
    if (!draft) return;
    setL(draft.L);
    if (asDefault) try { localStorage.setItem('ul-defaults', JSON.stringify(draft.L)); } catch { /* ignore */ }
    if (!draft.cfg) { flash('✅ Look settings saved'); closePanel(); return; }
    socket.emit('admin', { a: 'apply', pin, patch: draft.cfg, asDefault }, r => {
      if (r && !r.ok) { setMsg(r.error); setPanel('admin'); return; }
      setMsg(''); flash(asDefault ? '⭐ Saved & applied as default' : '✅ Saved & applied'); closePanel();
    });
  };
  const resetToDefaults = factory => {
    if (!window.confirm(factory ? 'Reset EVERYTHING to factory settings?' : 'Reset everything to your saved defaults?')) return;
    if (factory) { try { localStorage.removeItem('ul-defaults'); } catch { /* ignore */ } }
    setL(factory ? DEFAULTS : loadDefaults());
    socket.emit('admin', { a: 'resetDefaults', pin, factory }, r => {
      if (r && !r.ok) { setMsg(r.error); setPanel('admin'); return; }
      flash(factory ? '🏭 Factory settings restored' : '↩️ Defaults restored'); closePanel();
    });
  };
  const resetWin = p => setDraft(d => {   // put ONE floating window back to its default settings
    const nl = { ...d.L }; winKeys(p).forEach(k => { nl[k] = DEFAULTS[k]; });
    const extra = { g: ['showFeed', 'feedSecs'], w: ['showPopup'], l: [] }[p]; extra.forEach(k => { nl[k] = DEFAULTS[k]; });
    const cfgReset = { g: {}, w: { popupSecs: 8 }, l: { lbSecs: 10, showLbOverlay: true } }[p];
    return { ...d, L: nl, cfg: d.cfg ? { ...d.cfg, ...cfgReset } : d.cfg };
  });
  const resetTiles = () => setDraft(d => { const nl = { ...d.L, tileShape: DEFAULTS.tileShape, tileScale: DEFAULTS.tileScale }; Object.keys(TDEF).forEach(k => { nl[k] = DEFAULTS[k]; }); return { ...d, L: nl }; });
  const saveTikTok = (goLive, clearKey = false) => {   // Live tab: username + Euler key -> server
    socket.emit('admin', { a: 'tiktok', pin, username: ttUser.trim(), apiKey: ttKey, clearKey }, r => {
      if (r && !r.ok) { setTtMsg('❌ ' + r.error + ' (type the Admin PIN in the Admin tab)'); return; }
      setTtKey(''); if (!clearKey) setLivePop(false); setTtMsg(clearKey ? '🗑 Key removed' : '✅ Saved');
      if (goLive && pm !== 'live') { admin('mode', { mode: 'live' }); flash('🔴 Live mode - connecting to TikTok…'); closePanel(); }
      else setTimeout(() => setTtMsg(''), 2500);
    });
  };
  const toggleBot = () => {
    const v = !cfg?.botOn; setCfg(c => ({ ...c, botOn: v })); setDraft(d => (d?.cfg ? { ...d, cfg: { ...d.cfg, botOn: v } } : d));
    admin('set', { patch: { botOn: v } }); flash(v ? '🤖 Bot is guessing' : '🤖 Bot stopped');
  };
  const flashFb = v => { setFb(v); setTimeout(() => setFb(''), 700); };
  const sendGuess = e => {   // Test + Offline: type your own guess
    e.preventDefault();
    const text = e.target.g.value.trim(); e.target.reset(); gref.current?.focus();
    if (!text) return;
    socket.emit('guess', { user: L.playerName || 'Me', text, pin }, r => {
      if (r && !r.ok) { flash(r.error); if (pinReq) openPanel('admin'); } else flashFb(r?.correct ? 'yes' : 'no');
    });
  };
  const setMode = m => { setMmenu(false); admin('mode', { mode: m }); if (m === 'live' && L.liveAsk !== false) { setTtUser(u => u || tt.user || ''); setLivePop(true); } flash(MODES[m][0] + ' ' + MODES[m][2] + ' - fresh round'); };
  const toggleAnswer = () => {   // quick switch for "show the answer when guessed correctly": takes effect at the end of the current round
    const v = !cfg?.showAnswerWin; setCfg(c => ({ ...c, showAnswerWin: v })); setDraft(d => (d?.cfg ? { ...d, cfg: { ...d.cfg, showAnswerWin: v } } : d));
    admin('set', { patch: { showAnswerWin: v } }); flash(v ? '👁️ Correct answer will be shown' : '🙈 Correct answer will be hidden');
  };
  const fullscreen = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };

  if (!s) return <div className="stage" style={theme.v}><p className="wait">Connecting…</p></div>;
  const reveal = s.phase === 'reveal';
  // AUTO-FIT TOOLBAR: button size is calculated from how many buttons are pinned, so they always fill the space with no gaps and no overlap.
  // Few buttons -> one row (the game-name badge takes the leftover width). Many buttons -> extra rows, each row filled edge to edge.
  const tbList = Array.isArray(L.toolbar) ? L.toolbar : TB_DEFAULT, tbIds = ALL_IDS.filter(k => tbList.includes(k));
  const bl = (() => {
    const Wt = 96, g = 1, Smin = 6.6, Smax = 10.5, Bmin = L.showTitle ? 20 : 0, n = tbIds.length + 1;
    const s1 = (Wt - Bmin - n * g) / n;
    if (s1 >= Smin) return { single: true, s: Math.min(Smax, s1), H: 12, rows: [], sr: [] };
    const m = tbIds.length; let k = 12, nr = 1;
    for (const ms of [6.6, 5.8, 5.2]) { k = Math.floor((Wt + g) / (ms + g)); nr = Math.ceil(m / k); if (nr <= 3) break; }
    const rows = [], sr = []; let at = 0;
    for (let i = 0; i < nr; i++) { const c = Math.floor(m / nr) + (i < m % nr ? 1 : 0); rows.push(tbIds.slice(at, at + c)); at += c; sr.push(Math.min(9, (Wt - (c - 1) * g) / c)); }   // sr = row height; buttons are stretched wide to fill each row edge to edge
    return { single: false, s: 9, H: 1.2 + 9.5 + g + sr.reduce((a, b) => a + b + g, 0) + 1.2 + 0.8, rows, sr };
  })();
  // grid zones (% of the space under the toolbar): header | guess window | puzzle | mini leaderboard | footer
  const z1 = L.z1, z4 = L.z4, zg = L.showFeed ? L.zg : 0, z2 = Math.min(L.z2, 86 - z1 - zg - z4), z3 = 100 - z1 - zg - z2 - z4;
  const CQ = (177.78 - bl.H) / 100;   // stage height under the toolbar in cqw per 1%
  const gwH = zg * CQ - 2, gh = Math.min(11, Math.max(4, gwH - 2.4));   // guess window = exactly ONE line
  // Mini leaderboard: row height is calculated from the room the zone really has, so rows shrink to fit and can never spill into the footer.
  const availLb = z3 * CQ - 2, nRows = Math.max(1, Math.min(L.lbRows, Math.floor(availLb / 5.5)));
  const lh = Math.min(10, availLb / nRows) - 1;
  const style = { ...themeVars(L), ...rowVars(L, theme), ...tileVars(L), ...(L.cTitle && { '--tcol': L.cTitle }), '--fs': L.fontScale / 100, '--ff': FONTS[L.font][1], '--tw': L.titleFont === 'fredoka' ? 700 : 400, '--tf': (TFONTS[L.titleFont] || TFONTS.lilita)[1] === 'inherit' ? FONTS[L.font][1] : (TFONTS[L.titleFont] || TFONTS.lilita)[1], '--tr': RADIUS[L.tileShape], '--lh': lh, '--barH': bl.H, gridTemplateRows: `auto minmax(0,${z1}fr) minmax(0,${zg}fr) minmax(0,${z2}fr) minmax(0,${z3}fr) minmax(0,${z4}fr)` };
  const hid = on => (on ? '' : ' hid');
  const fval = it => (it.src === 'cfg' ? cfg?.[it.f.k] : L[it.f.k]);
  const fset = (it, v) => { if (it.src === 'cfg') { setCfg(c => ({ ...c, [it.f.k]: v })); admin('set', { patch: { [it.f.k]: v } }); } else setLocal(it.f.k, v); };
  const openPop = id => { setMenu(false); setMmenu(false); setPop(p => (p === id ? null : id)); };
  const tbBtn = id => {
    if (FMAP[id]) {
      const it = FMAP[id], v = fval(it), t = it.f.t, ic = ICONS[it.f.k] || '🔘';
      if (t === 'toggle') return <button className={v ? 'hot' : 'off'} disabled={it.src === 'cfg' && !cfg} onClick={() => { fset(it, !v); flash(ic + ' ' + it.f.l + ': ' + (!v ? 'ON' : 'OFF')); }} title={it.f.l + (v ? ' (on)' : ' (off)')}>{ic}</button>;
      return <button className={pop === id ? 'hot' : ''} disabled={it.src === 'cfg' && !cfg} onClick={() => openPop(id)} title={it.f.l}>{ic}</button>;
    }
    switch (id) {
      case 'mode': return <button className={'mode m-' + pm} onClick={() => { setPop(null); setMmenu(m => !m); setMenu(false); }} title="Mode: Test / Live / Offline">{MODES[pm][0]}<small>{MODES[pm][1]}</small></button>;
      case 'theme': return <button onClick={() => { setPop(null); setMenu(m => !m); setMmenu(false); }} title="Theme">{theme.icon}</button>;
      case 'pause': return <button className={s.paused ? 'hot' : ''} onClick={() => admin('pause')} title={s.paused ? 'Resume' : 'Pause'}>{s.paused ? '▶️' : '⏸️'}</button>;
      case 'skip': return <button onClick={() => admin('skip')} title="Skip / next round">⏭️</button>;
      case 'hint': return <button onClick={() => admin('hint')} title="Give a hint now">💡</button>;
      case 'time': return <button onClick={() => admin('time')} title="Add 15 seconds">⏰</button>;
      case 'cats': return <button className={cfg?.mode === 'specific' ? 'hot' : ''} onClick={() => (panel === 'cats' ? closePanel() : openPanel('cats'))} title="Categories">🗂️</button>;
      case 'answer': return <button className={cfg && !cfg.showAnswerWin ? 'hot' : ''} onClick={toggleAnswer} title={cfg?.showAnswerWin ? 'Correct answer is shown when guessed (tap to hide)' : 'Correct answer is hidden when guessed (tap to show)'}>{cfg && !cfg.showAnswerWin ? '🙈' : '👁️'}</button>;
      case 'sound': return <button className={L.sound ? 'hot' : ''} onClick={() => setLocal('sound', !L.sound)} title="Sound on/off">{L.sound ? '🔔' : '🔕'}</button>;
      case 'lb': return <button className={mlb ? 'hot' : ''} onClick={() => admin('showLb')} title="Show / hide the full leaderboard">🏆</button>;
      case 'full': return <button onClick={fullscreen} title="Full screen">⛶</button>;
      case 'resetlb': return <button onClick={() => window.confirm('Reset the leaderboard?') && admin('reset')} title="Reset leaderboard">🧹</button>;
      default: return null;
    }
  };
  const rows = s.leaderboard.slice(0, nRows);   // only real winners - no empty placeholder rows
  const won = reveal && s.winnerInfo;
  const stage = won ? (s.lbSecs > 0 && s.full?.length && left <= s.lbSecs ? 'lb' : 'pop') : null;   // winner window first, full leaderboard for the last lbSecs

  return (
    <div className={'stage' + (L.reduceMotion ? ' calm' : '') + (L.tShadow === false ? ' nosh' : '') + (L.tBob === false ? ' nobob' : '') + (yarnOn(L) ? ' yarnTiles' : '') + (theme.plain ? ' plain' : '')} style={style}>
      {mmenu && (
        <div className="menu wide">
          {Object.entries(MODES).map(([k, x]) => (
            <button key={k} className={k === pm ? 'on' : ''} onClick={() => setMode(k)}><span>{x[0]}</span><div><b>{x[2]}</b><small>{x[3]}</small></div></button>
          ))}
          {pm === 'live' && TT_TEXT[tt.status] && <p className="note">{TT_TEXT[tt.status]}{tt.user && tt.status !== 'nouser' ? ' (@' + tt.user + ')' : ''}</p>}
          <p className="note">Switching mode clears the leaderboard and starts a fresh round.</p>
        </div>
      )}
      {menu && (
        <div className="menu">
          {Object.entries(THEMES).map(([k, x], i, a) => (
            <Fragment key={k}>
              {(i === 0 || !!x.plain !== !!a[i - 1][1].plain) && <p className="mh">{x.plain ? '🎨 Plain background' : '🧶 Knitted background'}</p>}
              <button className={k === L.theme ? 'on' : ''} onClick={() => { setLocal('theme', k); setMenu(false); }}><span>{x.icon}</span>{x.name}</button>
            </Fragment>
          ))}
        </div>
      )}

      {/* ALWAYS-VISIBLE HOST TOOLBAR */}
      {(() => {
        const brand = L.showTitle && <BrandTitle text={L.title} on fs={L.fontScale / 100} dep={L.font + L.titleFont + L.fontScale + L.theme + tbIds.length + bl.single} />;
        const setBtn = <button className={'set' + (panel ? ' hot' : '')} onClick={() => (panel ? closePanel() : openPanel('look'))} title="Settings">⚙️</button>;
        const btns = ids => ids.map(id => <Fragment key={id}>{tbBtn(id)}</Fragment>);
        return bl.single ? (
          <nav className={'bar' + (L.showTitle ? '' : ' nobrand')} style={{ '--bs': bl.s }}>{brand}{btns(tbIds)}{setBtn}</nav>
        ) : (
          <nav className="bar multi">
            <div className="brow" style={{ '--bs': bl.s }}>{brand}{setBtn}</div>
            {bl.rows.map((r, i) => <div className="trow" key={i} style={{ '--bs': bl.sr[i] }}>{btns(r)}</div>)}
          </nav>
        );
      })()}
      {pop && FMAP[pop] && (() => {
        const it = FMAP[pop], v = fval(it);
        return (<div className="menu pp"><Field f={it.f} v={v} set={(k, x) => fset(it, x)} /><button className="act" onClick={() => setPop(null)}>✕ Close</button></div>);
      })()}

      {/* ZONE 1 - header + category */}
      <header className="z z1">
        <CatBanner text={s.category} on={L.showCategory} dep={L.fontScale + L.font} />
      </header>

      {/* GUESS WINDOW - normally sits in its own grid row directly under the category (never covers the puzzle); can be moved / resized in ⚙️ -> Windows */}
      <section className="z zg" style={{ '--gh': gh + 'cqw' }}>
        <div className="gpos" style={winPos(L, 'g')}>
          <div className={'gwin' + ((prev === 'g' || (L.showFeed && gws.length)) ? '' : ' off') + (L.gRows > 1 ? ' multi' : '')} style={{ '--gw': L.gW, background: winBg(L, 'g', 'var(--panel)') }}>
            {(prev === 'g' ? SAMPLE_G : gws).slice(-Math.max(1, L.gRows)).map(m => (
              <div key={m.id} className={'gmsg' + (m.ok ? ' ok' : '')}>
                {L.gAv && <Avatar pic={m.pic} name={m.user} size="var(--gh)" />}
                <span className="gtx">{L.gNm && <b>@{m.user}</b>} {L.gTx && m.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ZONE 2 - puzzle board */}
      <section className="z z2">
        <Board text={reveal && s.answer ? s.answer : s.scrambled} solved={reveal && (!!s.answer || !!s.winner)} scale={L.tileScale} gap={(L.tGap ?? 8) / 100} />
        <FitText className={'hint' + hid(L.showHint && !reveal && !!s.hint)} dep={s.hint}>{s.hint ? [...s.hint].map(c => (c === ' ' ? '\u00a0' : c === '_' ? '•' : c)).join(' ') : '\u00a0'}</FitText>
        <div className={'strip' + hid(L.showTimer)}>
          {!reveal && <i className="bar-fill" style={{ width: (left / s.total) * 100 + '%' }} />}
          <span className={reveal ? 'winner' : ''}>
            {s.paused ? '⏸️ Paused' : !reveal ? `⏱ ${left}s` : s.winner ? `🏆 @${s.winner} solved it! · next in ${left}s` : `⌛ Time's up! · next in ${left}s`}
          </span>
        </div>
      </section>

      {/* ZONE 3 - mini leaderboard */}
      <section className={'z z3' + (L.showChat ? ' split' : '')} style={{ '--lw': 100 - L.chatW + 'fr', '--cw': L.chatW + 'fr' }}>
        <div className={'lb' + hid(L.showLb)}>
          {rows.length === 0 && <div className="chempty">🧶 Winners appear here</div>}
          {rows.map((p, i) => (
            <div className="lbrow" key={p.user}>
              <span className="rk">{i < 3 ? MEDALS[i] : i + 1}</span>
              <Avatar pic={p.pic} name={p.user} size="calc(var(--lh)*.82cqw)" />
              <div className="who"><b>@{p.user}</b></div>
              <span className="pts">{p.score}</span>
            </div>
          ))}
        </div>
        {L.showChat && (
          <div className="chat">
            {chat.length === 0 && <div className="chempty">💬 Live chat</div>}
            {chat.slice(-nRows).map(m => (
              <div className={'chrow' + (m.ok ? ' ok' : '')} key={m.id}>
                <Avatar pic={m.pic} name={m.user} size="calc(var(--lh)*.78cqw)" />
                <div className="cbody"><span className="cn">@{m.user}</span><span className="ctx">{m.ok ? '✅ ' : ''}{m.text}</span></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ZONE 4 - footer */}
      <footer className="z z4">
        {reveal && L.showNext !== false && !s.paused && <div className="nextin" key={left}><small>⏭ NEXT ROUND IN</small><b>{left}</b><small>{left === 1 ? 'second' : 'seconds'}</small></div>}
        {pm !== 'offline' && !(reveal && L.showNext !== false && !s.paused) && <FitText as="p" className={hid(L.showFooter).trim()} dep={L.footer + L.fontScale + L.font}>{L.footer}</FitText>}
        {pm !== 'live' && (
          <form className={'play' + (fb ? ' ' + fb : '')} onSubmit={sendGuess}>
            <input ref={gref} name="g" autoComplete="off" autoCapitalize="none" placeholder={pm === 'offline' ? '✍️ Type your guess…' : '🧪 Type a test guess…'} />
            <button type="submit" title="Send guess">➤</button>
            {pm === 'test' && <button type="button" title="Solve as a fake viewer" onClick={() => admin('testSolve')}>✅</button>}
            {pm === 'test' && <button type="button" title="Send fake chat messages" onClick={() => admin('testChat')}>💬</button>}
            {pm === 'test' && <button type="button" className={cfg?.botOn ? 'hot' : ''} title={cfg?.botOn ? 'Bot is guessing (tap to stop)' : 'Start the auto-guessing bot'} onClick={toggleBot}>🤖</button>}
          </form>
        )}
        {pm === 'test' && s.peek && !reveal && <small className="peek">🔎 Answer: {s.peek}</small>}
      </footer>

      {/* CENTRE OVERLAYS: winner window (pic + correct answer), then the full leaderboard - each has its own position / size / opacity settings */}
      {(prev ? prev === 'w' : stage === 'pop' && L.showPopup) && (
        <div className="ov" key={prev ? 'pw' : 'p' + s.round}>
          <div className="wpos" style={winPos(L, 'w')}><WinnerCard w={prev ? SAMPLE_W : s.winnerInfo} l={L} /></div>
        </div>
      )}
      {prev === 'l' && <div className={'ov lbv' + (L.lDim ? '' : ' nodim')} key="pl"><div className="wpos" style={winPos(L, 'l')}><FullBoard rows={SAMPLE_L} secs={9} winner="player_2" l={L} /></div></div>}
      {!prev && stage === 'lb' && (
        <div className={'ov lbv' + (L.lDim ? '' : ' nodim')} key={'l' + s.round}><div className="wpos" style={winPos(L, 'l')}><FullBoard rows={s.full} secs={s.lbSecs} winner={s.winner} l={L} /></div></div>
      )}

      {!prev && mlb && <div className={'ov lbv' + (L.lDim ? '' : ' nodim')} key="mlb"><div className="wpos" style={winPos(L, 'l')}><FullBoard rows={mlb.rows} secs={mlb.secs} winner={null} l={L} /></div></div>}
      {prev && <button className="prevback" onClick={() => setPrev(null)}>⬅ Back to settings</button>}
      {toast && <div className="toast">{toast}</div>}
      {livePop && pm === 'live' && (
        <div className="livepop" onClick={e => e.target === e.currentTarget && setLivePop(false)}>
          <div className="livecard">
            <h3>🔴 Go LIVE on TikTok</h3>
            <small>{TT_TEXT[tt.status] || ''}</small>
            <label>TikTok username (without @)<input type="text" value={ttUser} placeholder="for example: myname" autoCapitalize="none" autoCorrect="off" onChange={e => setTtUser(e.target.value)} /></label>
            <label>Euler key {tt.hasKey && <b>(saved: {tt.keyHint})</b>}<input type="password" value={ttKey} autoComplete="off" placeholder={tt.hasKey ? 'Saved - leave empty to keep it' : 'Paste your Euler key (if needed)'} onChange={e => setTtKey(e.target.value)} /></label>
            {pinReq && <label>Admin PIN<input type="password" value={pin} onChange={e => { setPin(e.target.value); localStorage.setItem('ul-pin', e.target.value); }} /></label>}
            <button className="go" onClick={() => saveTikTok(true)}>🔴 Save &amp; Connect</button>
            <button onClick={() => setLivePop(false)}>Not now</button>
            {ttMsg && <p className="err">{ttMsg}</p>}
          </div>
        </div>)}

      {/* SETTINGS PANEL - edits a draft; nothing changes until Save & Apply */}
      {panel && draft && (() => {
        const dc = draft.cfg, dirty = JSON.stringify(draft) !== JSON.stringify({ L: Lr, cfg });
        return (
          <div className={'panel' + (prev ? ' away' : '')}>
            <div className="tabs">
              {[['look', '🎨 Look'], ['layout', '📐 Layout'], ['win', '🪟 Windows'], ['tile', '🔤 Letter Boxes'], ['bar', '🧰 Toolbar'], ['game', '🎮 Game'], ['cats', '🗂 Categories'], ['live', '🔴 Live'], ['mine', '✍️ My Puzzles'], ['admin', '🛠 Admin']].map(([k, n]) => (
                <button key={k} className={panel === k ? 'on' : ''} onClick={() => setPanel(k)}>{n}</button>))}
              <button onClick={closePanel} title="Close without saving">✕</button>
            </div>
            {(panel === 'look' || panel === 'layout') && FIELDS[panel].map(f => <Field key={f.k} f={f} v={draft.L[f.k]} set={setDL} />)}
            {panel === 'win' && (
              <>
                <p className="note"><b>Every floating window has its own settings.</b> Move it, resize it, change its opacity, choose what it shows and how many rows it uses. Press 👁 Preview to see the window with your unsaved changes, then press Save &amp; Apply.</p>
                {Object.entries(WINF).map(([p, w]) => (
                  <div key={p} className="wsec">
                    <h3 className="sec">{w.title}</h3>
                    <div className="seg">
                      <button disabled={p === 'g' && !draft.L.showFeed} onClick={() => setPrev(p)}>👁 Preview</button>
                      <button onClick={() => resetWin(p)}>↩️ Reset this window</button>
                    </div>
                    {p === 'g' && !draft.L.showFeed && <p className="note">Turn “Show this window” on to preview it.</p>}
                    {w.fields.map(f => (f.src === 'cfg' ? (dc ? <Field key={f.k} f={f} v={dc[f.k]} set={setDC} /> : null) : <Field key={f.k} f={f} v={draft.L[f.k]} set={setDL} />))}
                  </div>
                ))}
              </>
            )}
            {panel === 'tile' && (
              <>
                <p className="note"><b>Puzzle letter boxes.</b> The preview below shows your unsaved changes (top: puzzle boxes, bottom: solved boxes). Press Save &amp; Apply to use them in the game.</p>
                <div className={'tilepv' + (draft.L.tShadow === false ? ' nosh' : '') + (draft.L.tBob === false ? ' nobob' : '') + (yarnOn(draft.L) ? ' yarnTiles' : '')}
                  style={{ ...themeVars(draft.L), ...tileVars(draft.L), '--ff': FONTS[draft.L.font][1], '--tr': RADIUS[draft.L.tileShape], '--t': '10.5cqw' }}>
                  <div className="word">{[...'SHUFFLE'].map((c, i) => <span key={i} className="tile">{c}</span>)}</div>
                  <div className="word">{[...'WORD'].map((c, i) => <span key={i} className="tile ok">{c}</span>)}</div>
                </div>
                <div className="seg"><button onClick={() => resetTiles()}>↩️ Reset letter boxes to default</button></div>
                {TILE_F.map(f => <Field key={f.k} f={f} v={draft.L[f.k]} set={setDL} />)}
              </>
            )}
            {panel === 'bar' && (() => {
              const cur = Array.isArray(draft.L.toolbar) ? draft.L.toolbar : TB_DEFAULT;
              const put = (id, on) => setDL('toolbar', ALL_IDS.filter(x => (x === id ? on : cur.includes(x))));
              const row = (id, ic, name) => (<label className="fld toggle" key={id}><span>{ic} {name}</span><input type="checkbox" checked={cur.includes(id)} onChange={e => put(id, e.target.checked)} /></label>);
              return (
                <>
                  <p className="note"><b>Pick any features to pin on the top toolbar.</b> ✔ = shown as a button. Switches (on/off) become one-tap buttons; sliders, dropdowns and text boxes open a small window when tapped. The toolbar scrolls sideways if you pin many. ⚙️ Settings is always shown. Then press Save &amp; Apply below.</p>
                  <p className="note dirty">{cur.filter(x => ALL_IDS.includes(x)).length} button(s) selected</p>
                  <div className="seg">
                    <button onClick={() => setDL('toolbar', [...TB_DEFAULT])}>↩️ Default</button>
                    <button onClick={() => setDL('toolbar', [])}>⬜ Clear all</button>
                  </div>
                  <h3 className="sec">⭐ Quick actions</h3>
                  {TB.map(([k, ic, name]) => row(k, ic, name))}
                  {FGROUPS.map(([g, gl]) => (
                    <div key={g}><h3 className="sec">{gl}</h3>
                      {FITEMS.filter(x => FIELDS[g].includes(x.f)).map(x => row(x.id, ICONS[x.f.k] || '🔘', x.f.l))}
                    </div>))}
                </>
              );
            })()}
            {panel === 'game' && (dc ? FIELDS.game.map(f => <Field key={f.k} f={f} v={dc[f.k]} set={setDC} />) : <p>Loading…</p>)}
            {panel === 'game' && <p className="note">Press Save &amp; Apply below: the new game settings start with a fresh round.</p>}
            {panel === 'cats' && dc && (() => {
              const spec = dc.mode === 'specific', list = spec ? dc.picked : cats.filter(c => !dc.disabled.includes(c));
              const toggle = (c, on) => spec ? setDC('picked', on ? [...dc.picked, c] : dc.picked.filter(x => x !== c))
                : setDC('disabled', on ? dc.disabled.filter(x => x !== c) : [...dc.disabled, c]);
              return (
                <>
                  <div className="seg">
                    <button className={!spec ? 'on' : ''} onClick={() => setDC('mode', 'random')}>🎲 Random mix</button>
                    <button className={spec ? 'on' : ''} onClick={() => setDC('mode', 'specific')}>🎯 Specific</button>
                  </div>
                  <p className="note">{spec ? (dc.picked.length ? `Only these ${dc.picked.length} categor${dc.picked.length > 1 ? 'ies' : 'y'} will appear${dc.picked.length === 1 ? ' (locked to one)' : ''}.` : 'Nothing picked yet - tick one or more below (falls back to random until then).')
                    : `Random from ${list.length} of ${cats.length} categories. Untick to leave one out.`}</p>
                  <div className="seg">
                    <button onClick={() => (spec ? setDC('picked', [...cats]) : setDC('disabled', []))}>✅ All</button>
                    <button onClick={() => (spec ? setDC('picked', []) : setDC('disabled', [...cats]))}>⬜ None</button>
                  </div>
                  {cats.map(c => (
                    <label className="fld toggle" key={c}><span>{c}</span>
                      <input type="checkbox" checked={list.includes(c)} onChange={e => toggle(c, e.target.checked)} /></label>))}
                </>
              );
            })()}
            {panel === 'live' && (
              <>
                <p className="note"><b>Your TikTok details for Live mode.</b> Type them here, press the red button, and the game connects to your TikTok LIVE chat.</p>
                <label className="fld text"><span>1️⃣ TikTok username (without @)</span>
                  <input type="text" value={ttUser} placeholder="for example: myname" autoCapitalize="none" autoCorrect="off" onChange={e => setTtUser(e.target.value)} /></label>
                <label className="fld text"><span>2️⃣ Euler key {tt.hasKey && <b>(saved: {tt.keyHint})</b>}</span>
                  <input type="password" value={ttKey} autoComplete="off" placeholder={tt.hasKey ? 'Saved - leave empty to keep it' : 'Paste your Euler key here'} onChange={e => setTtKey(e.target.value)} /></label>
                {pinReq && <label className="fld text"><span>Admin PIN</span>
                  <input type="password" value={pin} onChange={e => { setPin(e.target.value); localStorage.setItem('ul-pin', e.target.value); }} /></label>}
                <button className="act go" onClick={() => saveTikTok(true)}>🔴 Save &amp; Connect to TikTok</button>
                <button className="act" onClick={() => saveTikTok(false)}>💾 Save only</button>
                {tt.hasKey && <button className="act" onClick={() => window.confirm('Remove the saved Euler key?') && saveTikTok(false, true)}>🗑 Remove saved key</button>}
                {ttMsg && <p className="err">{ttMsg}</p>}
                <p className="note">Status: {pm === 'live' ? (TT_TEXT[tt.status] || '…') : 'not in Live mode yet'}{pm === 'live' && tt.user && tt.status !== 'nouser' ? ' (@' + tt.user + ')' : ''}</p>
                <p className="note">⚠️ You must already be LIVE on TikTok, otherwise it keeps retrying every 15 seconds.</p>
                {!pinReq && <p className="note">🔒 Tip: add an ADMIN_PIN in Render (Environment tab) so nobody else can change these.</p>}
              </>
            )}
            {panel === 'mine' && (
              <>
                <p className="note"><b>Your own puzzles.</b> Type a category name and one answer per line (letters and spaces). Saved on the server straight away; an existing name is replaced. Leave the answers empty and save to delete a category.</p>
                <label className="fld text"><span>Category name</span><input type="text" value={mineName} maxLength={30} onChange={e => setMineName(e.target.value)} /></label>
                <label className="fld text"><span>Answers (one per line)</span><textarea rows={8} value={mineText} onChange={e => setMineText(e.target.value)} /></label>
                <button className="act go" onClick={() => socket.emit('admin', { a: 'custom', pin, name: mineName, words: mineText }, r => setTtMsg(r && r.ok ? 'Saved ' + r.count + ' answers' : 'Error: ' + (r && r.error)))}>💾 Save my category</button>
                {Object.entries(custom).map(([n, l]) => <div key={n} className="fld"><span>{n} ({l.length})</span><span><button className="act" onClick={() => { setMineName(n); setMineText(l.join('\n')); }}>Edit</button></span></div>)}
                {ttMsg && <p className="err">{ttMsg}</p>}
              </>
            )}
            {panel === 'admin' && (
              <>
                {pinReq && <label className="fld text"><span>Admin PIN</span>
                  <input type="password" value={pin} onChange={e => { setPin(e.target.value); localStorage.setItem('ul-pin', e.target.value); }} /></label>}
                <p className="note">Mode: <b>{MODES[pm][0]} {MODES[pm][2]}</b> (change it with the first toolbar button)</p>
                <button className="act" onClick={() => admin('pause')}>{s.paused ? '▶️ Resume game' : '⏸️ Pause game'}</button>
                <button className="act" onClick={() => admin('skip')}>⏭️ Skip round</button>
                <button className="act" onClick={() => window.confirm('Reset the leaderboard?') && admin('reset')}>🧹 Reset leaderboard</button>
                <button className="act" onClick={() => resetToDefaults(false)}>↩️ Reset all to my saved defaults</button>
                <button className="act" onClick={() => resetToDefaults(true)}>🏭 Reset all to factory settings</button>
                <p className="note">{hasDef ? 'A saved default exists on the server.' : 'No saved default yet - use “Save & Apply as Default”.'}</p>
              </>
            )}
            {panel !== 'live' && <div className="savebar">
              {msg && <p className="err">{msg}</p>}
              {dirty && <p className="note dirty">● Unsaved changes</p>}
              <button className="act go" onClick={() => commit(false)}>💾 Save &amp; Apply</button>
              <button className="act go alt" onClick={() => commit(true)}>⭐ Save &amp; Apply as Default</button>
            </div>}
          </div>
        );
      })()}
    </div>
  );
}
