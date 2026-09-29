import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { THEMES } from './themes.js';
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
const TFONTS = {   // game-name fonts (Google Fonts, with safe fallbacks)
  lilita: ['Lilita One (bold cute)', "'Lilita One','Baloo 2',Impact,sans-serif"], titan: ['Titan One (chunky)', "'Titan One','Lilita One',Impact,sans-serif"],
  bungee: ['Bungee (arcade)', "'Bungee','Lilita One',Impact,sans-serif"], luckiest: ['Luckiest Guy (comic)', "'Luckiest Guy','Lilita One',Impact,sans-serif"],
  baloo: ['Baloo 2 (round)', "'Baloo 2','Fredoka',sans-serif"], same: ['Same as text font', 'inherit']
};
// Buttons that can appear on the top toolbar (settings ⚙️ is always there so you can never lock yourself out)
const TB = [['mode', '🧪', 'Mode (Test / Live / Solo)'], ['theme', '🎨', 'Theme'], ['pause', '⏸️', 'Pause / Resume'], ['skip', '⏭️', 'Skip round'], ['hint', '💡', 'Hint now'],
  ['time', '⏰', 'Add 15 seconds'], ['cats', '🗂️', 'Categories'], ['answer', '👁️', 'Show / hide correct answer'], ['sound', '🔔', 'Sound on / off'], ['full', '⛶', 'Full screen'], ['resetlb', '🧹', 'Reset leaderboard']];
const TB_DEFAULT = ['mode', 'theme', 'pause', 'skip', 'hint', 'time', 'full'];
const DEFAULTS = { theme: 'cotton', font: 'cute', titleFont: 'lilita', toolbar: TB_DEFAULT, fontScale: 100, tileShape: 'rounded', tileScale: 100, title: 'UNSCRAMBLE',
  footer: 'Type the correct word(s) in the chat to win!', reduceMotion: false, showTitle: true, showCategory: true, showTimer: true,
  showHint: true, showPopup: true, showLb: true, showFeed: true, showFooter: true, feedSecs: 3, lbRows: 5,
  z1: 9, zg: 8, z2: 34, z4: 14, sound: false, volume: 60, playerName: 'Me' };
const MODES = {
  test: ['🧪', 'TEST', 'Test mode', 'Try games & upgrades. TikTok chat is OFF. Use the guess box, ✅ (solve), 💬 (fake chat) and 🤖 (auto-guessing bot).'],
  live: ['🔴', 'LIVE', 'Live mode', 'Go live on TikTok. Reads the TikTok chat. Guess box is hidden.'],
  offline: ['🎮', 'SOLO', 'Offline mode', 'Play by yourself. TikTok chat is OFF. Type your own guesses in the box.']
};
const TT_TEXT = { off: '', nouser: '⚠️ No TikTok username yet - open ⚙️ → 🔴 Live and type it in', connecting: '⏳ Connecting to TikTok…', connected: '✅ Connected to TikTok chat', retrying: '⏳ Not live yet - retrying every 15s' };
// One-time upgrade: older saved layouts (3 leaderboard rows, old zone heights, 'UNSCRAMBLE LIVE') are replaced by the new layout.
const LAYOUT_V = '4', OLD_KEYS = ['z1', 'zg', 'z2', 'z4', 'lbRows', 'feedLines'];
const cleanOld = o => { const c = { ...o }; OLD_KEYS.forEach(k => delete c[k]); if (c.title === 'UNSCRAMBLE LIVE') delete c.title; return c; };
const readSaved = key => {
  let o = {}; try { o = JSON.parse(localStorage.getItem(key) || '{}'); } catch { o = {}; }
  try { if (localStorage.getItem('ul-layout-v') !== LAYOUT_V) o = cleanOld(o); } catch { /* ignore */ }
  return o;
};
const markMigrated = () => { try { if (localStorage.getItem('ul-layout-v') !== LAYOUT_V) { localStorage.setItem('ul-defaults', JSON.stringify(readSaved('ul-defaults'))); localStorage.setItem('ul-settings', JSON.stringify(readSaved('ul-settings'))); localStorage.setItem('ul-layout-v', LAYOUT_V); } } catch { /* ignore */ } };
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
    tg('reduceMotion', 'Reduce animations')],
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
    rg('hintEvery', 'Next hint every', 3, 60, 1, 's'), rg('maxHints', 'Max hints', 0, 10),
    tg('botOn', '🤖 Test bot guesses by itself (Test mode only)'), rg('botEvery', 'Bot guesses every', 1, 30, 1, 's'), rg('botSkill', 'Chance the bot solves a round', 0, 100, 5, '%')]
};

// ---- TOOLBAR REGISTRY: every toggle / slider / dropdown / text setting can be pinned to the top toolbar as a button.
const ICONS = { font: '🔤', fontScale: '🔠', tileShape: '🔷', tileScale: '🔳', title: '✏️', footer: '📝', playerName: '👤', reduceMotion: '🐢', showTitle: '🏷️', showCategory: '📂',
  showTimer: '⏱️', showHint: '🔎', showFeed: '💬', showPopup: '🏆', showLb: '📊', showFooter: '📄', feedSecs: '⏳', lbRows: '🔢', z1: '📏', zg: '📏', z2: '📏', z4: '📏', volume: '🔊',
  roundSeconds: '⏲️', popupSecs: '🕒', showLbOverlay: '🥇', lbSecs: '🕓', showAnswer: '⌛', revealSeconds: '🕰️', minLetters: '🔽', maxLetters: '🔼', allowMulti: '🔀',
  spaceless: '⎵', hints: '💡', hintStart: '🚦', hintEvery: '🔁', maxHints: '🔟', botOn: '🤖', botEvery: '⏩', botSkill: '🎯', titleFont: '🅰️' };
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
function rowTile(lens, W, H) {
  const L = lens.reduce((a, b) => a + b, 0), n = lens.length;
  const units = L + LETTER_GAP * (L - n) + WORD_GAP * (n - 1);
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

// Full leaderboard (everyone with points). Rows shrink to fit; with a very long list it scrolls slowly during the display time.
function FullBoard({ rows, secs, winner }) {
  const AV = 100, n = rows.length;
  const pitch = n * 10 <= AV ? 10 : Math.max(6.4, AV / n), rh = pitch - 1, total = n * pitch, over = Math.max(0, total - AV);
  return (
    <div className="fb">
      <h2>🏆 Leaderboard</h2>
      <div className="fbwin" style={{ height: Math.min(total, AV) + 'cqw' }}>
        <div className={'fblist' + (over > 0 ? ' scroll' : '')} style={{ '--rh': rh, '--d': over + 'cqw', '--secs': Math.max(2, secs - 1) + 's' }}>
          {rows.map((p, i) => (
            <div className={'fbrow' + (p.user === winner ? ' new' : '')} key={p.user}>
              <span className="rk">{i < 3 ? MEDALS[i] : i + 1}</span>
              <Avatar pic={p.pic} name={p.user} size="calc(var(--rh)*1cqw)" />
              <div className="who"><b>@{p.user}</b></div>
              <span className="pts">{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Board({ text, solved, scale }) {
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
  const t = Math.max(4, Math.floor(rowTile(words.map(w => w.length), box.w, box.h) * scale / 100));   // scale is <= 100, so it can only shrink
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

// GAME NAME BADGE: always fits inside its own reserved box on the toolbar, whatever the font or theme.
// It re-measures after fonts finish loading, when the theme/font/size changes, and when the screen is resized.
function BrandTitle({ text, dep, on }) {
  const box = useRef(null), txt = useRef(null);
  useLayoutEffect(() => {
    const b = box.current, t = txt.current; if (!b || !t) return;
    let dead = false;
    const fit = () => {
      if (dead) return;
      t.style.fontSize = '';
      let px = parseFloat(getComputedStyle(t).fontSize);
      const cs = getComputedStyle(b), room = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      for (let i = 0; i < 6 && room > 0; i++) {   // a few passes, because letter-spacing does not scale with the font size
        const w = t.getBoundingClientRect().width;
        if (w <= room - 0.5) break;
        px = Math.max(5, px * (room / w) * 0.96); t.style.fontSize = px + 'px';
      }
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(b);
    document.fonts?.ready?.then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit);
    const t1 = setTimeout(fit, 600), t2 = setTimeout(fit, 2500);   // safety re-checks for slow phones
    return () => { dead = true; ro.disconnect(); clearTimeout(t1); clearTimeout(t2); document.fonts?.removeEventListener?.('loadingdone', fit); };
  }, [dep, text]);   // eslint-disable-line
  return <div ref={box} className={'brand' + (on ? '' : ' hid')}><span ref={txt}>{text}</span></div>;
}
const CatBanner = ({ text, on, dep }) => <FitText className={'cat' + (on ? '' : ' hid')} dep={text + '|' + dep}>✨ CATEGORY: {text}</FitText>;

function Field({ f, v, set }) {
  const c = f.t === 'toggle' ? <input type="checkbox" checked={!!v} onChange={e => set(f.k, e.target.checked)} />
    : f.t === 'range' ? <input type="range" min={f.min} max={f.max} step={f.step || 1} value={v} onChange={e => set(f.k, +e.target.value)} />
    : f.t === 'select' ? <select value={v} onChange={e => set(f.k, e.target.value)}>{f.o.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
    : <input type="text" value={v} maxLength={60} onChange={e => set(f.k, e.target.value)} />;
  return <label className={'fld ' + f.t}><span>{f.l}{f.t === 'range' && <b> {v}{f.u}</b>}</span>{c}</label>;
}

export default function App() {
  const [L, setL] = useState(() => { const v = { ...loadDefaults(), ...readSaved('ul-settings') }; markMigrated(); return v; });
  const [draft, setDraft] = useState(null), [toast, setToast] = useState(''), [hasDef, setHasDef] = useState(false);   // draft = what the settings panel edits until Save & Apply
  const setLocal = (k, v) => { setL(o => ({ ...o, [k]: v })); setDraft(d => (d ? { ...d, L: { ...d.L, [k]: v } } : d)); };   // toolbar quick actions (theme, sound)
  const setDL = (k, v) => setDraft(d => ({ ...d, L: { ...d.L, [k]: v } }));
  const setDC = (k, v) => setDraft(d => ({ ...d, cfg: { ...d.cfg, [k]: v } }));
  useEffect(() => { try { localStorage.setItem('ul-settings', JSON.stringify(L)); } catch { /* ignore */ } }, [L]);

  const [s, setS] = useState(null), [cfg, setCfg] = useState(null), [cats, setCats] = useState([]), [pinReq, setPinReq] = useState(false);
  const [gw, setGw] = useState(null), [left, setLeft] = useState(0);   // gw = the ONE guess card currently floating (or null)
  const gwT = useRef({ shownAt: 0, hide: 0, swap: 0, secs: 3 });
  const [menu, setMenu] = useState(false), [mmenu, setMmenu] = useState(false), [panel, setPanel] = useState(null), [pop, setPop] = useState(null);
  const [pm, setPm] = useState('test'), [tt, setTt] = useState({ status: 'off', user: '' }), [fb, setFb] = useState('');
  const [ttUser, setTtUser] = useState(''), [ttKey, setTtKey] = useState(''), [ttMsg, setTtMsg] = useState('');
  const gref = useRef(null);
  const [pin, setPin] = useState(() => localStorage.getItem('ul-pin') || ''), [msg, setMsg] = useState('');
  const deadline = useRef(0);

  useEffect(() => {
    socket.on('state', st => { setS(st); deadline.current = Date.now() + st.remaining * 1000; setLeft(st.remaining); });
    socket.on('settings', x => { setCfg(x.cfg); setCats(x.cats); setPinReq(x.pinRequired); setHasDef(!!x.hasDefaults); setPm(x.playMode || 'test'); setTt(x.tt || { status: 'off', user: '' }); });
    const g = gwT.current, MIN_MS = 1200;   // a guess card is shown at least 1.2s before the next one may replace it
    const show = m => {
      g.shownAt = Date.now(); setGw(m);
      clearTimeout(g.hide); g.hide = setTimeout(() => setGw(null), g.secs * 1000);
    };
    socket.on('feedClear', () => { clearTimeout(g.hide); clearTimeout(g.swap); setGw(null); });
    socket.on('feed', items => {
      const m = items[items.length - 1]; if (!m) return;   // busy chat: only the newest guess is shown, never a pile
      const wait = MIN_MS - (Date.now() - g.shownAt);
      clearTimeout(g.swap);
      if (wait <= 0) show(m); else g.swap = setTimeout(() => show(m), wait);
    });
    const iv = setInterval(() => { if (!paused.current) setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))); }, 250);
    return () => { clearInterval(iv); clearTimeout(g.hide); clearTimeout(g.swap); socket.off('state'); socket.off('settings'); socket.off('feed'); socket.off('feedClear'); };
  }, []);
  const paused = useRef(false);
  paused.current = !!s?.paused;
  gwT.current.secs = L.feedSecs || 3;
  useEffect(() => { setTtUser(tt.user || ''); }, [tt.user]);

  useEffect(() => { if (s?.phase === 'reveal' && s.winnerInfo && L.sound) beep(L.volume, [523, 659, 784, 1047]); }, [s?.phase, s?.round]); // eslint-disable-line

  const theme = THEMES[L.theme] || THEMES.cotton;
  useEffect(() => { document.body.style.background = theme.v['--bg1']; }, [theme]);


  const openPanel = tab => {
    setDraft(d => d || { L: { ...L }, cfg: cfg ? { ...cfg, disabled: [...cfg.disabled], picked: [...cfg.picked] } : null });
    setPanel(tab);
  };
  const closePanel = () => { setPanel(null); setDraft(null); };   // closing without saving discards the draft
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
  const saveTikTok = (goLive, clearKey = false) => {   // Live tab: username + Euler key -> server
    socket.emit('admin', { a: 'tiktok', pin, username: ttUser.trim(), apiKey: ttKey, clearKey }, r => {
      if (r && !r.ok) { setTtMsg('❌ ' + r.error + ' (type the Admin PIN in the Admin tab)'); return; }
      setTtKey(''); setTtMsg(clearKey ? '🗑 Key removed' : '✅ Saved');
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
  const setMode = m => { setMmenu(false); admin('mode', { mode: m }); flash(MODES[m][0] + ' ' + MODES[m][2] + ' - fresh round'); };
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
  const style = { ...theme.v, '--fs': L.fontScale / 100, '--ff': FONTS[L.font][1], '--tf': (TFONTS[L.titleFont] || TFONTS.lilita)[1] === 'inherit' ? FONTS[L.font][1] : (TFONTS[L.titleFont] || TFONTS.lilita)[1], '--tr': RADIUS[L.tileShape], '--lh': lh, '--barH': bl.H, gridTemplateRows: `auto minmax(0,${z1}fr) minmax(0,${zg}fr) minmax(0,${z2}fr) minmax(0,${z3}fr) minmax(0,${z4}fr)` };
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
      case 'full': return <button onClick={fullscreen} title="Full screen">⛶</button>;
      case 'resetlb': return <button onClick={() => window.confirm('Reset the leaderboard?') && admin('reset')} title="Reset leaderboard">🧹</button>;
      default: return null;
    }
  };
  const rows = s.leaderboard.slice(0, nRows);   // only real winners - no empty placeholder rows
  const won = reveal && s.winnerInfo;
  const stage = won ? (s.lbSecs > 0 && s.full?.length && left <= s.lbSecs ? 'lb' : 'pop') : null;   // winner window first, full leaderboard for the last lbSecs

  return (
    <div className={'stage' + (L.reduceMotion ? ' calm' : '')} style={style}>
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
          {Object.entries(THEMES).map(([k, x]) => (
            <button key={k} className={k === L.theme ? 'on' : ''} onClick={() => { setLocal('theme', k); setMenu(false); }}><span>{x.icon}</span>{x.name}</button>
          ))}
        </div>
      )}

      {/* ALWAYS-VISIBLE HOST TOOLBAR */}
      {(() => {
        const brand = L.showTitle && <BrandTitle text={L.title} on dep={L.font + L.titleFont + L.fontScale + L.theme + tbIds.length + bl.single} />;
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

      {/* GUESS WINDOW - its own grid row directly under the category, so it can never cover the puzzle letters */}
      <section className="z zg" style={{ '--gh': gh + 'cqw' }}>
        <div className={'gwin' + (L.showFeed && gw ? '' : ' off')}>
          {gw && (
            <div key={gw.id} className={'gmsg' + (gw.ok ? ' ok' : '')}>
              <Avatar pic={gw.pic} name={gw.user} size="var(--gh)" />
              <span className="gtx"><b>@{gw.user}</b> {gw.text}</span>
            </div>
          )}
        </div>
      </section>

      {/* ZONE 2 - puzzle board */}
      <section className="z z2">
        <Board text={reveal && s.answer ? s.answer : s.scrambled} solved={reveal && (!!s.answer || !!s.winner)} scale={L.tileScale} />
        <FitText className={'hint' + hid(L.showHint && !reveal && !!s.hint)} dep={s.hint}>{s.hint ? [...s.hint].map(c => (c === ' ' ? '\u00a0' : c === '_' ? '•' : c)).join(' ') : '\u00a0'}</FitText>
        <div className={'strip' + hid(L.showTimer)}>
          {!reveal && <i className="bar-fill" style={{ width: (left / s.total) * 100 + '%' }} />}
          <span className={reveal ? 'winner' : ''}>
            {s.paused ? '⏸️ Paused' : !reveal ? `⏱ ${left}s` : s.winner ? `🏆 @${s.winner} solved it! · next in ${left}s` : `⌛ Time's up! · next in ${left}s`}
          </span>
        </div>
      </section>

      {/* ZONE 3 - mini leaderboard */}
      <section className="z z3">
        <div className={'lb' + hid(L.showLb)}>
          {rows.map((p, i) => (
            <div className="lbrow" key={p.user}>
              <span className="rk">{i < 3 ? MEDALS[i] : i + 1}</span>
              <Avatar pic={p.pic} name={p.user} size="calc(var(--lh)*.82cqw)" />
              <div className="who"><b>@{p.user}</b></div>
              <span className="pts">{p.score}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ZONE 4 - footer */}
      <footer className="z z4">
        {pm !== 'offline' && <FitText as="p" className={hid(L.showFooter).trim()} dep={L.footer + L.fontScale + L.font}>{L.footer}</FitText>}
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

      {/* CENTRE OVERLAY: winner window (pic + correct answer), then the full leaderboard */}
      {stage === 'pop' && L.showPopup && (
        <div className="ov" key={'p' + s.round}>
          <div className="pop">
            <Avatar pic={s.winnerInfo.pic} name={s.winnerInfo.user} size="30cqw" />
            <b className="pn">@{s.winnerInfo.user}</b>
            <FitText className="wd" dep={s.winnerInfo.word}>{s.winnerInfo.word || '🎉 Correct!'}</FitText>
            <div className="pt">+{s.winnerInfo.pts}</div>
          </div>
        </div>
      )}
      {stage === 'lb' && (
        <div className="ov lbv" key={'l' + s.round}><FullBoard rows={s.full} secs={s.lbSecs} winner={s.winner} /></div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* SETTINGS PANEL - edits a draft; nothing changes until Save & Apply */}
      {panel && draft && (() => {
        const dc = draft.cfg, dirty = JSON.stringify(draft) !== JSON.stringify({ L, cfg });
        return (
          <div className="panel">
            <div className="tabs">
              {[['look', '🎨 Look'], ['layout', '📐 Layout'], ['bar', '🧰 Toolbar'], ['game', '🎮 Game'], ['cats', '🗂 Categories'], ['live', '🔴 Live'], ['admin', '🛠 Admin']].map(([k, n]) => (
                <button key={k} className={panel === k ? 'on' : ''} onClick={() => setPanel(k)}>{n}</button>))}
              <button onClick={closePanel} title="Close without saving">✕</button>
            </div>
            {(panel === 'look' || panel === 'layout') && FIELDS[panel].map(f => <Field key={f.k} f={f} v={draft.L[f.k]} set={setDL} />)}
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
