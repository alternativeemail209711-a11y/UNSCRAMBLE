import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { THEMES } from './themes.js';
import './styles.css';

const socket = io();
const CONFETTI = ['#ffd54a', '#ff5d8f', '#5eead4', '#7cc4ff', '#a78bfa', '#ff8a3d'];
const MEDALS = ['🥇', '🥈', '🥉'];
const FONTS = {
  system: ['System', "system-ui,'Segoe UI',Roboto,sans-serif"], rounded: ['Rounded', "ui-rounded,'Nunito','Trebuchet MS',system-ui,sans-serif"],
  serif: ['Serif', "Georgia,'Times New Roman',serif"], mono: ['Monospace', "ui-monospace,Consolas,Menlo,monospace"],
  display: ['Bold display', "Impact,'Arial Black',sans-serif"], fun: ['Playful', "'Comic Sans MS','Chalkboard SE',cursive"]
};
const RADIUS = { rounded: '18%', square: '6%', circle: '50%' };
const DEFAULTS = { theme: 'aurora', font: 'system', fontScale: 100, tileShape: 'rounded', tileScale: 100, title: 'UNSCRAMBLE LIVE',
  footer: 'Type the correct word(s) in the chat to win!', reduceMotion: false, showTitle: true, showCategory: true, showTimer: true,
  showHint: true, showPopup: true, showLb: true, lbMode: 'auto', showFeed: true, showFooter: true, feedLines: 4, lbRows: 3, feedAvatars: true,
  popupSecs: 9, z1: 20, z2: 28, z4: 12, autoHideBar: true, sound: false, volume: 60 };
const tg = (k, l) => ({ k, l, t: 'toggle' });
const rg = (k, l, min, max, step = 1, u = '') => ({ k, l, t: 'range', min, max, step, u });
const FIELDS = {
  look: [
    { k: 'theme', l: 'Theme', t: 'select', o: Object.entries(THEMES).map(([k, x]) => [k, x.icon + ' ' + x.name]) },
    { k: 'font', l: 'Font', t: 'select', o: Object.entries(FONTS).map(([k, x]) => [k, x[0]]) },
    rg('fontScale', 'Text size', 80, 120, 5, '%'),
    { k: 'tileShape', l: 'Tile shape', t: 'select', o: [['rounded', 'Rounded'], ['square', 'Square'], ['circle', 'Circle']] },
    rg('tileScale', 'Max tile size', 60, 100, 5, '%'),
    { k: 'title', l: 'Title text', t: 'text' }, { k: 'footer', l: 'Footer text', t: 'text' },
    tg('reduceMotion', 'Reduce animations')],
  layout: [
    tg('showTitle', 'Show title'), tg('showCategory', 'Show category banner'), tg('showTimer', 'Show timer'), tg('showHint', 'Show hint letters'),
    tg('showPopup', 'Show win celebration (3 stages)'), tg('showLb', 'Show leaderboard'), tg('showFeed', 'Show guess feed'), tg('showFooter', 'Show footer'),
    { k: 'lbMode', l: 'Leaderboard shows', t: 'select', o: [['auto', 'Alternate: session / all-time'], ['session', 'This session only'], ['alltime', 'All-time only']] },
    rg('lbRows', 'Leaderboard rows', 1, 5), rg('feedLines', 'Feed lines', 1, 8), tg('feedAvatars', 'Profile pictures in feed'),
    rg('popupSecs', 'Celebration length', 6, 30, 1, 's'),
    rg('z1', 'Header height', 16, 30, 1, '%'), rg('z2', 'Puzzle height', 20, 45, 1, '%'), rg('z4', 'Footer height', 8, 25, 1, '%'),
    tg('autoHideBar', 'Auto-hide toolbar'), tg('sound', 'Sound effects'), rg('volume', 'Volume', 0, 100, 5, '%')],
  game: [
    rg('roundSeconds', 'Round time', 20, 300, 5, 's'), rg('revealSeconds', 'Reveal time', 3, 30, 1, 's'),
    rg('minLetters', 'Min letters', 3, 25), rg('maxLetters', 'Max letters', 3, 25), tg('allowMulti', 'Allow multi-word puzzles'),
    tg('spaceless', 'Accept answer without spaces'), tg('hints', 'Auto hints (reveal letters)'), rg('hintStart', 'First hint at', 10, 90, 5, '% of round'),
    rg('hintEvery', 'Next hint every', 3, 60, 1, 's'), rg('maxHints', 'Max hints', 0, 10),
    rg('basePoints', 'Base points', 1, 100), rg('speedBonus', 'Speed bonus (max)', 0, 100), rg('hintPenalty', 'Penalty per hint', 0, 20)]
};

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

// ONE ROW ONLY: largest tile size (px) so every word sits on a single line, with a clear gap between words.
// Row width = letters*s + in-word gaps (.12s) + word gaps (.9s). Height limit keeps tiles inside the board.
const WORD_GAP = 0.9, TILE_GAP = 0.12;
function fitTile(lens, W, H) {
  const L = lens.reduce((a, n) => a + n, 0), nw = lens.length;
  const units = L + TILE_GAP * (L - nw) + WORD_GAP * (nw - 1);
  return Math.max(8, Math.min(80, Math.floor((W * 0.98) / units), Math.floor(H * 0.96)));
}

function Avatar({ pic, name, size }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [pic]);
  return pic && !bad
    ? <img className="av" style={{ '--s': size }} src={pic} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />
    : <span className="av ph" style={{ '--s': size }}>{(name || '?')[0].toUpperCase()}</span>;
}

function Board({ text, solved, scale, wave }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 320, h: 200 });
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const words = text.split(' ').filter(Boolean);
  const t = Math.max(8, Math.round(fitTile(words.map(w => w.length), box.w, box.h) * scale / 100));
  return (
    <div className={'board' + (wave ? ' wave' : '')} ref={ref} style={{ '--t': t + 'px' }}>
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

function Field({ f, v, set }) {
  const c = f.t === 'toggle' ? <input type="checkbox" checked={!!v} onChange={e => set(f.k, e.target.checked)} />
    : f.t === 'range' ? <input type="range" min={f.min} max={f.max} step={f.step || 1} value={v} onChange={e => set(f.k, +e.target.value)} />
    : f.t === 'select' ? <select value={v} onChange={e => set(f.k, e.target.value)}>{f.o.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
    : <input type="text" value={v} maxLength={60} onChange={e => set(f.k, e.target.value)} />;
  return <label className={'fld ' + f.t}><span>{f.l}{f.t === 'range' && <b> {v}{f.u}</b>}</span>{c}</label>;
}

function CountUp({ to, ms = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now(); let raf;
    const step = t => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}

const rankLine = w => {
  const m = w.session, mv = m.prev == null ? '🆕' : m.prev > m.rank ? `▲${m.prev - m.rank}` : m.prev === m.rank ? '＝' : '';
  return `${mv} #${m.rank} tonight` + (w.all ? ` · 👑 #${w.all.rank} all-time` : ' · 🧪 test');
};

const fmtDur = ms => { const s = Math.round(ms / 1000); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm'; };
function diagText(d, age) {
  const ago = ms => (ms == null ? 'never' : fmtDur(ms + age) + ' ago');
  const L = [
    `Mode: ${d.mode.toUpperCase()}   Status: ${d.status}`,
    `Username: ${d.username ? '@' + d.username : '(none)'}${d.roomId ? '   Room: ' + d.roomId : ''}`,
    d.status === 'connected' ? `Connected for: ${fmtDur(d.connectedForMs + age)}` : d.status === 'waiting' ? `Next retry in: ${Math.max(0, Math.ceil((d.retryInMs - age) / 1000))}s (attempt ${d.attempts})` : `Retry attempts: ${d.attempts}`,
    `Sign key: ${d.key.set ? 'found in ' + d.key.source + ' (hidden)' : 'NOT SET (EULERSTREAM_API_KEY / TIKTOK_SIGN_API_KEY)'}`,
    `TikTok library: ${d.lib.version} ${d.lib.loaded ? '(loaded)' : '(NOT LOADED: ' + d.lib.loadError + ')'}`,
    `Word bank: ${d.words.toLocaleString()} accepted English words`,
    `Node ${d.node} | server up ${fmtDur(d.uptimeSec * 1000 + age)}`,
    `Chat events: ${d.counts.chat} received, ${d.counts.parsed} read, ${d.counts.dropped} unreadable`,
    `Last chat: ${ago(d.lastChatAgoMs)}${d.lastChat ? ` - @${d.lastChat.user}: ${d.lastChat.text}` : ''}`,
    `All-time players saved: ${d.allTimePlayers} | Storage: ${d.storage.ok ? 'OK' : 'PROBLEM: ' + d.storage.error} (${d.storage.dir})`
  ];
  if (d.error) L.push(`Last error [${d.error.code}]: ${d.error.message}` + (d.error.raw ? `\n  detail: ${d.error.raw}` : ''));
  if (d.warning) L.push(`Library warning: ${d.warning}`);
  L.push('', 'Recent activity:', ...(d.log.length ? d.log.map(x => `  ${fmtDur(x.agoMs + age)} ago  ${x.m}`) : ['  (nothing yet)']));
  return L.join('\n');
}

function PinField({ pinReq, pin, setPin }) {
  return pinReq ? <label className="fld text"><span>Admin PIN</span>
    <input type="password" value={pin} onChange={e => { setPin(e.target.value); localStorage.setItem('ul-pin', e.target.value); }} /></label> : null;
}

const MODE_INFO = { live: ['🔴', 'Live', 'Reads your TikTok chat'], test: ['🧪', 'Test', 'Type guesses yourself'], offline: ['⚫', 'Offline', 'Game runs, chat ignored'] };
function LivePanel({ live, send, msg, pinReq, pin, setPin }) {
  const [name, setName] = useState(''), touched = useRef(false), [tick, setTick] = useState(0), [copied, setCopied] = useState(false);
  useEffect(() => { if (!touched.current && live) setName(live.username || ''); }, [live?.username]); // eslint-disable-line
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(i); }, []);
  if (!live) return <p>Loading…</p>;
  const age = Date.now() - live._at, cls = live.status === 'connected' ? 'ok' : ['waiting', 'connecting'].includes(live.status) ? 'warn' : live.status === 'error' ? 'bad' : '';
  const retry = live.status === 'waiting' ? Math.max(0, Math.ceil((live.retryInMs - age) / 1000)) : 0;
  const text = diagText(live, age);
  return (
    <>
      <PinField pinReq={pinReq} pin={pin} setPin={setPin} />
      <div className="modes">
        {Object.entries(MODE_INFO).map(([k, [i, n, d]]) => (
          <button key={k} className={live.mode === k ? 'on' : ''} onClick={() => send({ mode: k })}><span className="big">{i}</span><br />{n}<small>{d}</small></button>))}
      </div>
      <div className={'st ' + cls}>
        {live.mode === 'live' && <div className="stt">{{ connected: '🟢 Connected', connecting: '🟡 Connecting…', waiting: `🟡 Retrying in ${retry}s`, error: '🔴 Not connected', idle: '⚪ Waiting for a username' }[live.status]}</div>}
        {live.message}
        {live.mode === 'live' && live.status === 'waiting' && live.attempts > 1 && <small className="dim"> (attempt {live.attempts}, waiting a little longer each time)</small>}
      </div>
      {msg && <p className="err">{msg}</p>}
      <label className="fld text"><span>TikTok username</span>
        <div className="row">
          <input type="text" placeholder="@yourname" value={name} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            onChange={e => { touched.current = true; setName(e.target.value); }} onKeyDown={e => e.key === 'Enter' && send({ username: name, mode: 'live' })} />
          <button className="act go" onClick={() => send({ username: name, mode: 'live' })}>Save &amp; connect</button>
        </div>
      </label>
      <p className="note">Saved on the server - the game reconnects to this account by itself after a restart or redeploy.</p>
      {live.mode === 'live' && live.status !== 'connected' && live.username && <button className="act" onClick={() => send({}, 'liveRetry')}>🔄 Try again now</button>}
      {live.mode === 'test' && <button className="act" onClick={() => send({ on: !live.sim }, 'sim')}>{live.sim ? '⏹ Stop simulated viewers' : '🤖 Start simulated viewers'}</button>}
      {!live.key.set && live.mode === 'live' && <p className="note warnnote">⚠️ No sign key found. Add <b>EULERSTREAM_API_KEY</b> (or <b>TIKTOK_SIGN_API_KEY</b>) to your host's environment variables if the connection keeps failing.</p>}
      <details className="diagbox" open>
        <summary>🩺 Diagnostics</summary>
        <pre className="diag" data-t={tick}>{text}</pre>
        <button className="act" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>{copied ? '✅ Copied' : '📋 Copy diagnostics'}</button>
      </details>
    </>
  );
}

export default function App() {
  const [L, setL] = useState(() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ul-settings') || '{}') }; } catch { return DEFAULTS; } });
  const setLocal = (k, v) => setL(o => ({ ...o, [k]: v }));
  useEffect(() => { try { localStorage.setItem('ul-settings', JSON.stringify(L)); } catch { /* ignore */ } }, [L]);

  const [s, setS] = useState(null), [cfg, setCfg] = useState(null), [cats, setCats] = useState([]), [pinReq, setPinReq] = useState(false);
  const [feed, setFeed] = useState([]), [left, setLeft] = useState(0), [stage, setStage] = useState(0), [live, setLive] = useState(null), [lbView, setLbView] = useState('session');
  const [menu, setMenu] = useState(false), [panel, setPanel] = useState(null), [bar, setBar] = useState(true);
  const [pin, setPin] = useState(() => localStorage.getItem('ul-pin') || ''), [msg, setMsg] = useState('');
  const deadline = useRef(0), barT = useRef(null), paused = useRef(false);

  useEffect(() => {
    socket.on('state', st => { setS(st); deadline.current = Date.now() + st.remaining * 1000; setLeft(st.remaining); });
    socket.on('settings', x => { setCfg(x.cfg); setCats(x.cats); setPinReq(x.pinRequired); });
    socket.on('feed', items => setFeed(f => [...f, ...items].slice(-30)));
    socket.on('live', x => setLive({ ...x, _at: Date.now() }));
    const iv = setInterval(() => { if (!paused.current) setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))); }, 250);
    return () => { clearInterval(iv); ['state', 'settings', 'feed', 'live'].forEach(e => socket.off(e)); };
  }, []);
  paused.current = !!s?.paused;

  // 3-stage win celebration: 1 = SOLVED burst, 2 = winner spotlight, 3 = docked rank card + leaderboard highlight
  const winner = s?.phase === 'reveal' ? s.winnerInfo : null;
  useEffect(() => {
    if (!winner) { setStage(0); return; }
    const notes = [null, [523, 659, 784], [784, 988, 1175, 1568], [1047, 1319]];
    const go = n => { setStage(n); if (L.sound) beep(L.volume, notes[n]); };
    go(1);
    const t = [setTimeout(() => go(2), 1400), setTimeout(() => go(3), 4400), setTimeout(() => setStage(0), Math.max(L.popupSecs, 6) * 1000)];
    return () => t.forEach(clearTimeout);
  }, [s?.phase, s?.round]); // eslint-disable-line
  const cel = L.showPopup ? stage : 0;
  const confetti = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: Math.random() * 100, dx: (Math.random() - .5) * 30, w: 1.1 + Math.random() * 1.4, dl: Math.random() * .7, du: 2 + Math.random() * 1.6, r: Math.floor(Math.random() * 360), c: CONFETTI[i % CONFETTI.length] })), [s?.round]);

  // leaderboard view: alternate session / all-time when set to auto (pinned to session while the celebration shows rank changes)
  useEffect(() => {
    if (L.lbMode !== 'auto') return;
    const iv = setInterval(() => setLbView(v => (v === 'session' ? 'alltime' : 'session')), 8000);
    return () => clearInterval(iv);
  }, [L.lbMode]);

  const theme = THEMES[L.theme] || THEMES.aurora;
  useEffect(() => { document.body.style.background = theme.v['--bg1']; }, [theme]);

  const poke = () => { setBar(true); clearTimeout(barT.current); barT.current = setTimeout(() => setBar(false), 4000); };
  useEffect(() => { poke(); return () => clearTimeout(barT.current); }, []);

  const admin = (a, extra = {}) => socket.emit('admin', { a, pin, ...extra }, r => {
    if (r && !r.ok) { setMsg(r.error); setPanel(p => (p === 'live' ? p : 'admin')); } else setMsg('');
  });
  const sset = (k, v) => { setCfg(c => ({ ...c, [k]: v })); admin('set', { patch: { [k]: v } }); };
  const sendLive = (patch, action = 'live') => admin(action, patch);
  const fullscreen = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };

  if (!s) return <div className="stage" style={theme.v}><p className="wait">Connecting…</p></div>;
  const reveal = s.phase === 'reveal';
  const mode = live?.mode || s.mode;
  const view = L.lbMode === 'auto' ? (cel === 3 ? 'session' : lbView) : L.lbMode;
  const board = view === 'alltime' ? s.lbAll : s.lbSession;
  const z1 = L.z1, z4 = L.z4, z2 = Math.min(L.z2, 70 - z1 - z4), z3 = 100 - z1 - z2 - z4;
  const maxRows = Math.max(1, Math.floor((z3 * 1.778 - 14 - 4.5 - 4.5 - 13) / 10.5));   // slot 14 + label 4.5 + gaps + at least 2 feed lines
  const nRows = Math.min(L.lbRows, maxRows);
  const style = { ...theme.v, '--fs': L.fontScale / 100, '--ff': FONTS[L.font][1], '--tr': RADIUS[L.tileShape], gridTemplateRows: `minmax(0,${z1}fr) minmax(0,${z2}fr) minmax(0,${z3}fr) minmax(0,${z4}fr)` };
  const hid = on => (on ? '' : ' hid');
  const rows = Array.from({ length: nRows }, (_, i) => board[i] || null);
  const barOn = !L.autoHideBar || bar || menu || panel;
  const dot = mode === 'test' ? 'test' : mode === 'offline' ? 'off' : { connected: 'ok', connecting: 'warn', waiting: 'warn', error: 'bad' }[live?.status] || 'off';

  return (
    <div className={'stage' + (L.reduceMotion ? ' calm' : '')} style={style} onPointerDown={poke}>
      {mode !== 'live' && <div className="chip">{mode === 'test' ? '🧪 TEST' : '⚫ OFFLINE'}</div>}
      {menu && (
        <div className="menu">
          {Object.entries(THEMES).map(([k, x]) => (
            <button key={k} className={k === L.theme ? 'on' : ''} onClick={() => { setLocal('theme', k); setMenu(false); }}><span>{x.icon}</span>{x.name}</button>
          ))}
        </div>
      )}

      {/* ZONE 1 - header + category */}
      <header className="z z1">
      <div className={'bar' + (barOn ? '' : ' off')}>
        <button onClick={() => setMenu(m => !m)} aria-label="Theme">{theme.icon}</button>
        <button onClick={() => setPanel(p => (p === 'live' ? null : 'live'))} aria-label="Live connection">📡<i className={'dot ' + dot} /></button>
        <button onClick={() => admin('pause')} aria-label="Pause">{s.paused ? '▶️' : '⏸️'}</button>
        <button onClick={() => admin('skip')} aria-label="Skip">⏭️</button>
        <button onClick={fullscreen} aria-label="Full screen">⛶</button>
        <button onClick={() => setPanel(p => (p && p !== 'live' ? null : 'look'))} aria-label="Settings">⚙️</button>
      </div>
        <h1 className={hid(L.showTitle)}>{L.title}</h1>
        <div className={'cat' + hid(L.showCategory)} style={s.category.length > 20 ? { fontSize: 'calc(4.2cqw*var(--fs))' } : undefined}>💡 CATEGORY: {s.category}</div>
      </header>

      {/* ZONE 2 - puzzle board */}
      <section className="z z2">
        <Board text={reveal ? s.answer : s.scrambled} solved={reveal} scale={L.tileScale} wave={cel === 1} />
        <div className={'hint' + hid(L.showHint && !reveal && !!s.hint)} style={{ fontSize: `calc(${Math.min(4.2, 88 / Math.max(1, (s.hint || '').length * 1.9))}cqw*var(--fs))` }}>{s.hint ? [...s.hint].map(c => (c === ' ' ? '\u00a0\u00a0\u00a0' : c === '_' ? '•' : c)).join(' ') : '\u00a0'}</div>
        <div className={'strip' + hid(L.showTimer)}>
          {!reveal && <i className="bar-fill" style={{ width: (left / s.total) * 100 + '%' }} />}
          <span className={reveal ? 'winner' : ''}>
            {s.paused ? '⏸️ Paused' : !reveal ? `⏱ ${left}s` : s.winner ? `🏆 @${s.winner} solved it! · next in ${left}s` : `⌛ Time's up! · next in ${left}s`}
          </span>
        </div>
        {cel === 1 && <div className="cel1"><span>🎉 SOLVED! 🎉</span></div>}
      </section>

      {/* ZONE 3 - docked rank card (celebration stage 3), leaderboard, feed */}
      <section className="z z3">
        <div className="slot">
          {cel === 3 && winner && (
            <div className="pop" key={s.round}>
              <Avatar pic={winner.pic} name={winner.user} size="11cqw" />
              <div className="txt"><b>@{winner.user}{winner.streak > 1 ? ` 🔥${winner.streak}` : ''}</b><span className="wd">{rankLine(winner)}</span></div>
              <div className="pt">+{winner.pts}</div>
            </div>
          )}
        </div>
        <div className={'lb' + hid(L.showLb)}>
          <div className="lbh">{view === 'alltime' ? '👑 ALL-TIME' : '🔥 THIS SESSION'}</div>
          {rows.map((p, i) => (
            <div className={'lbrow' + (p ? '' : ' empty') + (p && cel === 3 && winner && p.user === winner.user ? ' hl' : '')} key={i}>
              <span className="rk">{i < 3 ? MEDALS[i] : i + 1}</span>
              {p ? <Avatar pic={p.pic} name={p.user} size="7cqw" /> : <span className="av ph" style={{ '--s': '7cqw' }}>?</span>}
              <div className="who"><b>{p ? '@' + p.user : 'Waiting for winners…'}</b><em>{p ? p.words.slice(-3).join(' · ') : ''}</em></div>
              <span className="pts">{p ? p.score : ''}</span>
            </div>
          ))}
        </div>
        <div className={'feed' + hid(L.showFeed)}>
          {feed.slice(-L.feedLines).map(m => (
            <div key={m.id} className={'msg' + (m.ok ? ' ok' : '')}>
              {L.feedAvatars && <Avatar pic={m.pic} name={m.user} size="5cqw" />}<span><b>@{m.user}</b> {m.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ZONE 4 - footer */}
      <footer className="z z4">
        <p className={hid(L.showFooter)}>{L.footer}</p>
        {mode === 'test' && (
          <form className="test" onSubmit={e => { e.preventDefault(); socket.emit('testGuess', { user: 'tester', text: e.target.g.value, pin }); e.target.reset(); }}>
            <input name="g" placeholder="test guess (or @name guess)" autoComplete="off" />
          </form>
        )}
      </footer>

      {/* CELEBRATION stages 1-2 overlays */}
      {(cel === 1 || cel === 2) && !L.reduceMotion && (
        <div className="conf">{confetti.map((p, i) => <i key={i} style={{ '--x': p.x + '%', '--dx': p.dx + 'cqw', '--w': p.w, '--dl': p.dl + 's', '--du': p.du + 's', '--r': p.r + 'deg', '--c': p.c }} />)}</div>
      )}
      {cel === 2 && winner && (
        <div className="spot" key={'sp' + s.round}>
          <div className="crown">👑</div>
          <Avatar pic={winner.pic} name={winner.user} size="26cqw" />
          <div className="who1">@{winner.user}</div>
          <div className="wordbig" style={{ fontSize: `calc(${Math.min(5, 70 / Math.max(1, winner.word.length * 1.25))}cqw*var(--fs))` }}>{winner.word}</div>
          <div className="big">+<CountUp to={winner.pts} /></div>
          {winner.streak > 1 && <div className="streak">🔥 {winner.streak} wins in a row!</div>}
        </div>
      )}

      {/* SETTINGS PANEL */}
      {panel && (
        <div className="panel">
          <div className="tabs">
            {[['live', '📡 Live'], ['look', '🎨 Look'], ['layout', '📐 Layout'], ['game', '🎮 Game'], ['cats', '🗂 Categories'], ['admin', '🛠 Admin']].map(([k, n]) => (
              <button key={k} className={panel === k ? 'on' : ''} onClick={() => setPanel(k)}>{n}</button>))}
            <button onClick={() => setPanel(null)}>✕</button>
          </div>
          {panel === 'live' && <LivePanel live={live} send={sendLive} msg={msg} pinReq={pinReq} pin={pin} setPin={setPin} />}
          {(panel === 'look' || panel === 'layout') && FIELDS[panel].map(f => <Field key={f.k} f={f} v={L[f.k]} set={setLocal} />)}
          {panel === 'game' && (cfg ? FIELDS.game.map(f => <Field key={f.k} f={f} v={cfg[f.k]} set={sset} />) : <p>Loading…</p>)}
          {panel === 'game' && <p className="note">Game settings apply from the next round.</p>}
          {panel === 'cats' && cfg && (
            <>
              <button className="act" onClick={() => sset('disabled', [])}>Enable all ({cats.length})</button>
              {cats.map(c => (
                <label className="fld toggle" key={c}><span>{c}</span>
                  <input type="checkbox" checked={!cfg.disabled.includes(c)} onChange={e => sset('disabled', e.target.checked ? cfg.disabled.filter(x => x !== c) : [...cfg.disabled, c])} />
                </label>))}
            </>
          )}
          {panel === 'admin' && (
            <>
              <PinField pinReq={pinReq} pin={pin} setPin={setPin} />
              {msg && <p className="err">{msg}</p>}
              <button className="act" onClick={() => admin('pause')}>{s.paused ? '▶️ Resume game' : '⏸️ Pause game'}</button>
              <button className="act" onClick={() => admin('skip')}>⏭️ Skip round</button>
              <button className="act" onClick={() => window.confirm('Start a new session? (clears the session leaderboard; all-time is kept)') && admin('newSession')}>🆕 Start new session</button>
              <button className="act" onClick={() => window.confirm('Erase the ALL-TIME leaderboard for everyone? This cannot be undone.') && admin('resetAll')}>🧹 Reset all-time leaderboard</button>
              <button className="act" onClick={() => window.confirm('Reset all display settings?') && setL(DEFAULTS)}>♻️ Reset display settings</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
