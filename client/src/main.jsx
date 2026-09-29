import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Fit the 9:16 stage to the REAL visible area (handles mobile address bars, notches, rotation, fullscreen, keyboard)
const fit = () => {
  const vv = window.visualViewport, d = document.documentElement, r = document.getElementById('root');
  const h = Math.round(vv?.height || window.innerHeight), w = Math.round(vv?.width || window.innerWidth);
  d.style.setProperty('--app-h', h + 'px');
  requestAnimationFrame(() => { d.style.setProperty('--sw', (r.clientWidth || w) + 'px'); d.style.setProperty('--sh', (r.clientHeight || h) + 'px'); });
};
fit();
['resize', 'orientationchange', 'fullscreenchange'].forEach(e => window.addEventListener(e, () => { fit(); setTimeout(fit, 250); }));
window.visualViewport?.addEventListener('resize', fit);
createRoot(document.getElementById('root')).render(<App />);
