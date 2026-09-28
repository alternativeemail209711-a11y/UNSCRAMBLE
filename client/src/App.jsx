import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './styles.css';

const socket = io();
const TEST = new URLSearchParams(location.search).has('test');
const MEDALS = ['🥇', '🥈', '🥉'];

// Largest tile size (px) at which all words fit in W x H. Whole words wrap to new lines;
// a word wraps internally only if it alone is wider than the board.
function fitTile(lens, W, H) {
  W *= 0.96;
  for (let s = 80; s >= 14; s--) {
    const cell = s * 1.12, gap = s * 0.45, per = Math.max(1, Math.floor(W / cell));
    let lines = 1, x = 0;
    for (const n of lens) {
      const w = n * cell;
      if (w > W) { if (x > 0) lines++; lines += Math.ceil(n / per) - 1; x = W; continue; }
      if (x === 0) x = w;
      else if (x + gap + w <= W) x += gap + w;
      else { lines++; x = w; }
    }
    if (lines * cell + (lines - 1) * gap <= H * 0.96) return s;
  }
  return 14;
}

function Board({ text, solved }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 320, h: 200 });
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const words = text.split(' ');
  const t = fitTile(words.map(w => w.length), box.w, box.h);
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

export default function App() {
  const [s, setS] = useState(null);
  const [feed, setFeed] = useState([]);
  const [left, setLeft] = useState(0);
  const deadline = useRef(0);

  useEffect(() => {
    socket.on('state', st => { setS(st); deadline.current = Date.now() + st.remaining * 1000; setLeft(st.remaining); });
    socket.on('feed', items => setFeed(f => [...f, ...items].slice(-30)));
    const iv = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 250);
    return () => { clearInterval(iv); socket.off('state'); socket.off('feed'); };
  }, []);

  if (!s) return <div className="stage"><p className="wait">Connecting…</p></div>;
  const reveal = s.phase === 'reveal';

  return (
    <div className="stage">
      {/* ZONE 1 - header + category (20%) */}
      <header className="z z1">
        <h1>UNSCRAMBLE LIVE</h1>
        <div className="cat">💡 CATEGORY: {s.category}</div>
      </header>

      {/* ZONE 2 - puzzle board (30%) */}
      <section className="z z2">
        <Board text={reveal ? s.answer : s.scrambled} solved={reveal} />
        <div className="strip">
          {!reveal && <i className="bar" style={{ width: (left / s.total) * 100 + '%' }} />}
          <span className={reveal ? 'winner' : ''}>
            {!reveal ? `⏱ ${left}s` : s.winner ? `🏆 @${s.winner} solved it! · next in ${left}s` : `⌛ Time's up! · next in ${left}s`}
          </span>
        </div>
      </section>

      {/* ZONE 3 - leaderboard + live feed (35%) */}
      <section className="z z3">
        <div className="lb">
          {[0, 1, 2].map(i => {
            const p = s.leaderboard[i];
            return <div key={i}>{MEDALS[i]} {p ? `@${p.user} · ${p.wins}` : '—'}</div>;
          })}
        </div>
        <div className="feed">
          {feed.slice(-9).map(m => <div key={m.id} className={'msg' + (m.ok ? ' ok' : '')}><b>@{m.user}</b> {m.text}</div>)}
        </div>
      </section>

      {/* ZONE 4 - footer (15%) */}
      <footer className="z z4">
        <p>Type the correct word(s) in the chat to win!</p>
        {TEST && (
          <form className="test" onSubmit={e => { e.preventDefault(); socket.emit('testGuess', { user: 'tester', text: e.target.g.value }); e.target.reset(); }}>
            <input name="g" placeholder="test guess" autoComplete="off" />
          </form>
        )}
      </footer>
    </div>
  );
}
