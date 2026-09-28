import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { THEMES } from './themes.js';
import './styles.css';

const socket = io();
const TEST = new URLSearchParams(location.search).has('test');
const MEDALS = ['🥇', '🥈', '🥉'];
const FONTS = {
  system: ['System', "system-ui,'Segoe UI',Roboto,sans-serif"], rounded: ['Rounded', "ui-rounded,'Nunito','Trebuchet MS',system-ui,sans-serif"],
  serif: ['Serif', "Georgia,'Times New Roman',serif"], mono: ['Monospace', "ui-monospace,Consolas,Menlo,monospace"],
  display: ['Bold display', "Impact,'Arial Black',sans-serif"], fun: ['Playful', "'Comic Sans MS','Chalkboard SE',cursive"]
};
const RADIUS = { rounded: '18%', square: '6%', circle: '50%' };
const DEFAULTS = { theme: 'aurora', font: 'system', fontScale: 100, tileShape: 'rounded', tileScale: 100, title: 'UNSCRAMBLE LIVE',
  footer: 'Type the correct word(s) in the chat to win!', reduceMotion: false, showTitle: true, showCategory: true, showTimer: true,
  showHint: true, showPopup: true, showLb: true, showFeed: true, showFooter: true, feedLines: 4, lbRows: 3, feedAvatars: true,
  popupSecs: 8, z1: 18, z2: 28, z4: 12, autoHideBar: true, sound: false, volume: 60 };
const tg = (k, l) => ({ k, l, t: 'toggle' });
const rg = (k, l, min, max, step = 1, u = '') => ({ k, l, t: 'range', min, max, step, u });
const FIELDS = {
  look: [
    { k: 'theme', l: 'Theme', t: 'select', o: Object.entries(THEMES).map(([k, x]) => [k, x.icon + ' ' + x.name]) },
    { k: 'font', l: 'Font', t: 'select', o: Object.entries(FONTS).map(([k, x]) => [k, x[0]]) },
    rg('fontScale', 'Text size', 70, 140, 5, '%'),
    { k: 'tileShape', l: 'Tile shape', t: 'select', o: [['rounded', 'Rounded'], ['square', 'Square'], ['circle', 'Circle']] },
    rg('tileScale', 'Max tile size', 60, 100, 5, '%'),
    { k: 'title', l: 'Title text', t: 'text' }, { k: 'footer', l: 'Footer text', t: 'text' },
    tg('reduceMotion', 'Reduce animations')],
  layout: [
    tg('showTitle', 'Show title'), tg('showCategory', 'Show category banner'), tg('showTimer', 'Show timer'), tg('showHint', 'Show hint letters'),
    tg('showPopup', 'Show winner floating window'), tg('showLb', 'Show leaderboard'), tg('showFeed', 'Show guess feed'), tg('showFooter', 'Show footer'),
    rg('lbRows', 'Leaderboard rows', 1, 5), rg('feedLines', 'Feed lines', 1, 8), tg('feedAvatars', 'Profile pictures in feed'),
    rg('popupSecs', 'Winner window duration', 3, 30, 1, 's'),
    rg('z1', 'Header height', 10, 30, 1, '%'), rg('z2', 'Puzzle height', 20, 45, 1, '%'), rg('z4', 'Footer height', 8, 25, 1, '%'),
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

// Largest tile size (px) so every word fits in W x H; words wrap as whole words, and inside a word only if it alone is wider than the board.
function fitTile(lens, W, H) {
  W *= 0.96;
  for (let s = 80; s >= 12; s--) {
    const cell = s * 1.12, gap = s * 0.45, per = Math.max(1, Math.floor(W / cell));
    let lines = 1, x = 0;
    for (const n of lens) {
      const w = n * cell;
      if (w > W) { if (x > 0) lines++; lines += Math.ceil(n / per) - 1; x = W; continue; }
      if (x === 0) x = w; else if (x + gap + w <= W) x += gap + w; else { lines++; x = w; }
    }
    if (lines * cell + (lines - 1) * gap <= H * 0.96) return s;
  }
  return 12;
}

function Avatar({ pic, name, size }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [pic]);
  return pic && !bad
    ? <img className="av" style={{ '--s': size }} src={pic} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />
    : <span className="av ph" style={{ '--s': size }}>{(name || '?')[0].toUpperCase()}</span>;
}

function Board({ text, solved, scale }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 320, h: 200 });
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const words = text.split(' ');
  const t = Math.max(12, Math.round(fitTile(words.map(w => w.length), box.w, box.h) * scale / 100));
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

function Field({ f, v, set }) {
  const c = f.t === 'toggle' ? <input type="checkbox" checked={!!v} onChange={e => set(f.k, e.target.checked)} />
    : f.t === 'range' ? <input type="range" min={f.min} max={f.max} step={f.step || 1} value={v} onChange={e => set(f.k, +e.target.value)} />
    : f.t === 'select' ? <select value={v} onChange={e => set(f.k, e.target.value)}>{f.o.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
    : <input type="text" value={v} maxLength={60} onChange={e => set(f.k, e.target.value)} />;
  return <label className={'fld ' + f.t}><span>{f.l}{f.t === 'range' && <b> {v}{f.u}</b>}</span>{c}</label>;
}

export default function App() {
  const [L, setL] = useState(() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ul-settings') || '{}') }; } catch { return DEFAULTS; } });
  const setLocal = (k, v) => setL(o => ({ ...o, [k]: v }));
  useEffect(() => { try { localStorage.setItem('ul-settings', JSON.stringify(L)); } catch { /* ignore */ } }, [L]);

  const [s, setS] = useState(null), [cfg, setCfg] = useState(null), [cats, setCats] = useState([]), [pinReq, setPinReq] = useState(false);
  const [feed, setFeed] = useState([]), [left, setLeft] = useState(0), [popup, setPopup] = useState(null);
  const [menu, setMenu] = useState(false), [panel, setPanel] = useState(null), [bar, setBar] = useState(true);
  const [pin, setPin] = useState(() => localStorage.getItem('ul-pin') || ''), [msg, setMsg] = useState('');
  const deadline = useRef(0), barT = useRef(null);

  useEffect(() => {
    socket.on('state', st => { setS(st); deadline.current = Date.now() + st.remaining * 1000; setLeft(st.remaining); });
    socket.on('settings', x => { setCfg(x.cfg); setCats(x.cats); setPinReq(x.pinRequired); });
    socket.on('feed', items => setFeed(f => [...f, ...items].slice(-30)));
    const iv = setInterval(() => { if (!paused.current) setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))); }, 250);
    return () => { clearInterval(iv); socket.off('state'); socket.off('settings'); socket.off('feed'); };
  }, []);
  const paused = useRef(false);
  paused.current = !!s?.paused;

  useEffect(() => {
    if (s?.phase === 'reveal' && s.winnerInfo) {
      setPopup(s.winnerInfo);
      if (L.sound) beep(L.volume, [523, 659, 784, 1047]);
      const t = setTimeout(() => setPopup(null), L.popupSecs * 1000);
      return () => clearTimeout(t);
    }
    setPopup(null);
  }, [s?.phase, s?.round]); // eslint-disable-line

  const theme = THEMES[L.theme] || THEMES.aurora;
  useEffect(() => { document.body.style.background = theme.v['--bg1']; }, [theme]);

  const poke = () => { setBar(true); clearTimeout(barT.current); barT.current = setTimeout(() => setBar(false), 4000); };
  useEffect(() => { poke(); return () => clearTimeout(barT.current); }, []);

  const admin = (a, extra = {}) => socket.emit('admin', { a, pin, ...extra }, r => {
    if (r && !r.ok) { setMsg(r.error); setPanel('admin'); } else setMsg('');
  });
  const sset = (k, v) => { setCfg(c => ({ ...c, [k]: v })); admin('set', { patch: { [k]: v } }); };
  const fullscreen = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };

  if (!s) return <div className="stage" style={theme.v}><p className="wait">Connecting…</p></div>;
  const reveal = s.phase === 'reveal';
  const z1 = L.z1, z4 = L.z4, z2 = Math.min(L.z2, 85 - z1 - z4);
  const style = { ...theme.v, '--fs': L.fontScale / 100, '--ff': FONTS[L.font][1], '--tr': RADIUS[L.tileShape], gridTemplateRows: `${z1}% ${z2}% ${100 - z1 - z2 - z4}% ${z4}%` };
  const hid = on => (on ? '' : ' hid');
  const rows = Array.from({ length: L.lbRows }, (_, i) => s.leaderboard[i] || null);
  const barOn = !L.autoHideBar || bar || menu || panel;

  return (
    <div className={'stage' + (L.reduceMotion ? ' calm' : '')} style={style} onPointerDown={poke}>
      {/* TOOLBAR */}
      <div className={'bar' + (barOn ? '' : ' off')}>
        <button onClick={() => setMenu(m => !m)} aria-label="Theme">{theme.icon}</button>
        <button onClick={() => admin('pause')} aria-label="Pause">{s.paused ? '▶️' : '⏸️'}</button>
        <button onClick={() => admin('skip')} aria-label="Skip">⏭️</button>
        <button onClick={fullscreen} aria-label="Full screen">⛶</button>
        <button onClick={() => setPanel(p => (p ? null : 'look'))} aria-label="Settings">⚙️</button>
      </div>
      {menu && (
        <div className="menu">
          {Object.entries(THEMES).map(([k, x]) => (
            <button key={k} className={k === L.theme ? 'on' : ''} onClick={() => { setLocal('theme', k); setMenu(false); }}><span>{x.icon}</span>{x.name}</button>
          ))}
        </div>
      )}

      {/* ZONE 1 - header + category */}
      <header className="z z1">
        <h1 className={hid(L.showTitle)}>{L.title}</h1>
        <div className={'cat' + hid(L.showCategory)}>💡 CATEGORY: {s.category}</div>
      </header>

      {/* ZONE 2 - puzzle board */}
      <section className="z z2">
        <Board text={reveal ? s.answer : s.scrambled} solved={reveal} scale={L.tileScale} />
        <div className={'hint' + hid(L.showHint && !reveal && !!s.hint)}>{s.hint ? [...s.hint].map(c => (c === ' ' ? '\u00a0' : c === '_' ? '•' : c)).join(' ') : '\u00a0'}</div>
        <div className={'strip' + hid(L.showTimer)}>
          {!reveal && <i className="bar-fill" style={{ width: (left / s.total) * 100 + '%' }} />}
          <span className={reveal ? 'winner' : ''}>
            {s.paused ? '⏸️ Paused' : !reveal ? `⏱ ${left}s` : s.winner ? `🏆 @${s.winner} solved it! · next in ${left}s` : `⌛ Time's up! · next in ${left}s`}
          </span>
        </div>
      </section>

      {/* ZONE 3 - floating winner window (reserved slot), leaderboard, feed */}
      <section className="z z3">
        <div className="slot">
          {L.showPopup && popup && (
            <div className="pop" key={s.round}>
              <Avatar pic={popup.pic} name={popup.user} size="11cqw" />
              <div className="txt"><b>@{popup.user}</b><span className="wd">{popup.word}</span></div>
              <div className="pt">+{popup.pts}</div>
            </div>
          )}
        </div>
        <div className={'lb' + hid(L.showLb)}>
          {rows.map((p, i) => (
            <div className={'lbrow' + (p ? '' : ' empty')} key={i}>
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
        {TEST && (
          <form className="test" onSubmit={e => { e.preventDefault(); socket.emit('testGuess', { user: 'tester', text: e.target.g.value }); e.target.reset(); }}>
            <input name="g" placeholder="test guess" autoComplete="off" />
          </form>
        )}
      </footer>

      {/* SETTINGS PANEL */}
      {panel && (
        <div className="panel">
          <div className="tabs">
            {[['look', '🎨 Look'], ['layout', '📐 Layout'], ['game', '🎮 Game'], ['cats', '🗂 Categories'], ['admin', '🛠 Admin']].map(([k, n]) => (
              <button key={k} className={panel === k ? 'on' : ''} onClick={() => setPanel(k)}>{n}</button>))}
            <button onClick={() => setPanel(null)}>✕</button>
          </div>
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
              {pinReq && <label className="fld text"><span>Admin PIN</span>
                <input type="password" value={pin} onChange={e => { setPin(e.target.value); localStorage.setItem('ul-pin', e.target.value); }} /></label>}
              {msg && <p className="err">{msg}</p>}
              <button className="act" onClick={() => admin('pause')}>{s.paused ? '▶️ Resume game' : '⏸️ Pause game'}</button>
              <button className="act" onClick={() => admin('skip')}>⏭️ Skip round</button>
              <button className="act" onClick={() => window.confirm('Reset the leaderboard?') && admin('reset')}>🧹 Reset leaderboard</button>
              <button className="act" onClick={() => window.confirm('Reset all display settings?') && setL(DEFAULTS)}>♻️ Reset display settings</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
