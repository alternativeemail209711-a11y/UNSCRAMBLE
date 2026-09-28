import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { THEMES } from './themes.js';
import './styles.css';

const socket = io();
const TEST = new URLSearchParams(location.search).has('test');
const MEDALS = ['🥇', '🥈', '🥉'];
const FONTS = {
  system: ['System', "system-ui,'Segoe UI',Roboto,sans-serif"], rounded: ['Rounded', "ui-rounded,'Nunito','Trebuchet MS',system-ui,sans-serif"],
  cute: ['Cute (Fredoka)', "'Fredoka','Baloo 2',ui-rounded,'Nunito','Comic Sans MS',sans-serif"], bubbly: ['Bubbly (Baloo)', "'Baloo 2','Fredoka',ui-rounded,sans-serif"],
  serif: ['Serif', "Georgia,'Times New Roman',serif"], mono: ['Monospace', "ui-monospace,Consolas,Menlo,monospace"],
  display: ['Bold display', "Impact,'Arial Black',sans-serif"], fun: ['Playful', "'Comic Sans MS','Chalkboard SE',cursive"]
};
const RADIUS = { rounded: '18%', square: '6%', circle: '50%' };
const DEFAULTS = { theme: 'cotton', font: 'cute', fontScale: 100, tileShape: 'rounded', tileScale: 100, title: 'UNSCRAMBLE LIVE',
  footer: 'Type the correct word(s) in the chat to win!', reduceMotion: false, showTitle: true, showCategory: true, showTimer: true,
  showHint: true, showPopup: true, showLb: true, showFeed: true, showFooter: true, feedLines: 4, lbRows: 3, feedAvatars: true,
  popupSecs: 8, z1: 20, z2: 28, z4: 12, sound: false, volume: 60 };
const loadDefaults = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ul-defaults') || '{}') }; } catch { return DEFAULTS; } };
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
    tg('showPopup', 'Show winner floating window'), tg('showLb', 'Show leaderboard'), tg('showFeed', 'Show guess feed'), tg('showFooter', 'Show footer'),
    rg('lbRows', 'Leaderboard rows', 1, 5), rg('feedLines', 'Feed lines', 1, 8), tg('feedAvatars', 'Profile pictures in feed'),
    rg('popupSecs', 'Winner window duration', 3, 30, 1, 's'),
    rg('z1', 'Header height', 16, 30, 1, '%'), rg('z2', 'Puzzle height', 20, 45, 1, '%'), rg('z4', 'Footer height', 8, 25, 1, '%'),
    tg('sound', 'Sound effects'), rg('volume', 'Volume', 0, 100, 5, '%')],
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

// STRICT ONE-ROW RULE: every letter of every word sits in ONE single row. The tile size is calculated from the row width
// (letters + small gaps inside words + bigger gaps between words), so the row always fits - long answers simply get smaller tiles.
const LETTER_GAP = 0.08, WORD_GAP = 0.5;
function rowTile(lens, W, H) {
  const L = lens.reduce((a, b) => a + b, 0), n = lens.length;
  const units = L + LETTER_GAP * (L - n) + WORD_GAP * (n - 1);
  return Math.max(4, Math.floor(Math.min((W * 0.96) / units, H * 0.78, 90)));
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
const CatBanner = ({ text, on, dep }) => <FitText className={'cat' + (on ? '' : ' hid')} dep={text + '|' + dep}>✨ CATEGORY: {text}</FitText>;

function Field({ f, v, set }) {
  const c = f.t === 'toggle' ? <input type="checkbox" checked={!!v} onChange={e => set(f.k, e.target.checked)} />
    : f.t === 'range' ? <input type="range" min={f.min} max={f.max} step={f.step || 1} value={v} onChange={e => set(f.k, +e.target.value)} />
    : f.t === 'select' ? <select value={v} onChange={e => set(f.k, e.target.value)}>{f.o.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
    : <input type="text" value={v} maxLength={60} onChange={e => set(f.k, e.target.value)} />;
  return <label className={'fld ' + f.t}><span>{f.l}{f.t === 'range' && <b> {v}{f.u}</b>}</span>{c}</label>;
}

export default function App() {
  const [L, setL] = useState(() => { try { return { ...loadDefaults(), ...JSON.parse(localStorage.getItem('ul-settings') || '{}') }; } catch { return loadDefaults(); } });
  const [draft, setDraft] = useState(null), [toast, setToast] = useState(''), [hasDef, setHasDef] = useState(false);   // draft = what the settings panel edits until Save & Apply
  const setLocal = (k, v) => { setL(o => ({ ...o, [k]: v })); setDraft(d => (d ? { ...d, L: { ...d.L, [k]: v } } : d)); };   // toolbar quick actions (theme, sound)
  const setDL = (k, v) => setDraft(d => ({ ...d, L: { ...d.L, [k]: v } }));
  const setDC = (k, v) => setDraft(d => ({ ...d, cfg: { ...d.cfg, [k]: v } }));
  useEffect(() => { try { localStorage.setItem('ul-settings', JSON.stringify(L)); } catch { /* ignore */ } }, [L]);

  const [s, setS] = useState(null), [cfg, setCfg] = useState(null), [cats, setCats] = useState([]), [pinReq, setPinReq] = useState(false);
  const [feed, setFeed] = useState([]), [left, setLeft] = useState(0), [popup, setPopup] = useState(null);
  const [menu, setMenu] = useState(false), [panel, setPanel] = useState(null);
  const [pin, setPin] = useState(() => localStorage.getItem('ul-pin') || ''), [msg, setMsg] = useState('');
  const deadline = useRef(0);

  useEffect(() => {
    socket.on('state', st => { setS(st); deadline.current = Date.now() + st.remaining * 1000; setLeft(st.remaining); });
    socket.on('settings', x => { setCfg(x.cfg); setCats(x.cats); setPinReq(x.pinRequired); setHasDef(!!x.hasDefaults); });
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
  const fullscreen = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };

  if (!s) return <div className="stage" style={theme.v}><p className="wait">Connecting…</p></div>;
  const reveal = s.phase === 'reveal';
  const z1 = L.z1, z4 = L.z4, z2 = Math.min(L.z2, 70 - z1 - z4), z3 = 100 - z1 - z2 - z4;
  const maxRows = Math.max(1, Math.floor((z3 * 1.778 - 14 - 3 - 13) / 10.5));   // slot 14 + gaps 3 + at least 2 feed lines
  const nRows = Math.min(L.lbRows, maxRows);
  const style = { ...theme.v, '--fs': L.fontScale / 100, '--ff': FONTS[L.font][1], '--tr': RADIUS[L.tileShape], gridTemplateRows: `auto minmax(0,${z1}fr) minmax(0,${z2}fr) minmax(0,${z3}fr) minmax(0,${z4}fr)` };
  const hid = on => (on ? '' : ' hid');
  const rows = Array.from({ length: nRows }, (_, i) => s.leaderboard[i] || null);

  return (
    <div className={'stage' + (L.reduceMotion ? ' calm' : '')} style={style}>
      {menu && (
        <div className="menu">
          {Object.entries(THEMES).map(([k, x]) => (
            <button key={k} className={k === L.theme ? 'on' : ''} onClick={() => { setLocal('theme', k); setMenu(false); }}><span>{x.icon}</span>{x.name}</button>
          ))}
        </div>
      )}

      {/* ALWAYS-VISIBLE HOST TOOLBAR */}
      <nav className="bar">
        <button onClick={() => setMenu(m => !m)} title="Theme">{theme.icon}</button>
        <button className={s.paused ? 'hot' : ''} onClick={() => admin('pause')} title={s.paused ? 'Resume' : 'Pause'}>{s.paused ? '▶️' : '⏸️'}</button>
        <button onClick={() => admin('skip')} title="Skip / next round">⏭️</button>
        <button className={cfg?.mode === 'specific' ? 'hot' : ''} onClick={() => (panel === 'cats' ? closePanel() : openPanel('cats'))} title="Categories">🗂️</button>
        <button onClick={() => admin('hint')} title="Give a hint now">💡</button>
        <button onClick={() => admin('time')} title="Add 15 seconds">⏰</button>
        <button className={L.sound ? 'hot' : ''} onClick={() => setLocal('sound', !L.sound)} title="Sound on/off">{L.sound ? '🔔' : '🔕'}</button>
        <button onClick={fullscreen} title="Full screen">⛶</button>
        <button className={panel ? 'hot' : ''} onClick={() => (panel ? closePanel() : openPanel('look'))} title="Settings">⚙️</button>
      </nav>

      {/* ZONE 1 - header + category */}
      <header className="z z1">
        <h1 className={hid(L.showTitle)}>{L.title}</h1>
        <CatBanner text={s.category} on={L.showCategory} dep={L.fontScale + L.font} />
      </header>

      {/* ZONE 2 - puzzle board */}
      <section className="z z2">
        <Board text={reveal ? s.answer : s.scrambled} solved={reveal} scale={L.tileScale} />
        <FitText className={'hint' + hid(L.showHint && !reveal && !!s.hint)} dep={s.hint}>{s.hint ? [...s.hint].map(c => (c === ' ' ? '\u00a0' : c === '_' ? '•' : c)).join(' ') : '\u00a0'}</FitText>
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
              <div className="txt"><b>@{popup.user}</b><FitText as="span" className="wd" dep={popup.word}>{popup.word}</FitText></div>
              <div className="pt">+{popup.pts}</div>
            </div>
          )}
        </div>
        <div className={'lb' + hid(L.showLb)}>
          {rows.map((p, i) => (
            <div className={'lbrow' + (p ? '' : ' empty')} key={i}>
              <span className="rk">{i < 3 ? MEDALS[i] : i + 1}</span>
              {p ? <Avatar pic={p.pic} name={p.user} size="7cqw" /> : <span className="av ph" style={{ '--s': '7cqw' }}>?</span>}
              <div className="who"><b>{p ? '@' + p.user : 'Waiting for winners…'}</b><FitText as="em" dep={p ? p.words.join() : ''}>{p ? p.words.slice(-3).join(' · ') : ''}</FitText></div>
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

      {toast && <div className="toast">{toast}</div>}

      {/* SETTINGS PANEL - edits a draft; nothing changes until Save & Apply */}
      {panel && draft && (() => {
        const dc = draft.cfg, dirty = JSON.stringify(draft) !== JSON.stringify({ L, cfg });
        return (
          <div className="panel">
            <div className="tabs">
              {[['look', '🎨 Look'], ['layout', '📐 Layout'], ['game', '🎮 Game'], ['cats', '🗂 Categories'], ['admin', '🛠 Admin']].map(([k, n]) => (
                <button key={k} className={panel === k ? 'on' : ''} onClick={() => setPanel(k)}>{n}</button>))}
              <button onClick={closePanel} title="Close without saving">✕</button>
            </div>
            {(panel === 'look' || panel === 'layout') && FIELDS[panel].map(f => <Field key={f.k} f={f} v={draft.L[f.k]} set={setDL} />)}
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
            {panel === 'admin' && (
              <>
                {pinReq && <label className="fld text"><span>Admin PIN</span>
                  <input type="password" value={pin} onChange={e => { setPin(e.target.value); localStorage.setItem('ul-pin', e.target.value); }} /></label>}
                <button className="act" onClick={() => admin('pause')}>{s.paused ? '▶️ Resume game' : '⏸️ Pause game'}</button>
                <button className="act" onClick={() => admin('skip')}>⏭️ Skip round</button>
                <button className="act" onClick={() => window.confirm('Reset the leaderboard?') && admin('reset')}>🧹 Reset leaderboard</button>
                <button className="act" onClick={() => resetToDefaults(false)}>↩️ Reset all to my saved defaults</button>
                <button className="act" onClick={() => resetToDefaults(true)}>🏭 Reset all to factory settings</button>
                <p className="note">{hasDef ? 'A saved default exists on the server.' : 'No saved default yet - use “Save & Apply as Default”.'}</p>
              </>
            )}
            <div className="savebar">
              {msg && <p className="err">{msg}</p>}
              {dirty && <p className="note dirty">● Unsaved changes</p>}
              <button className="act go" onClick={() => commit(false)}>💾 Save &amp; Apply</button>
              <button className="act go alt" onClick={() => commit(true)}>⭐ Save &amp; Apply as Default</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
