// T(name, icon, bg1, bg2, panel, text, link, accent1, accent2, bannerText, tile1, tile2, tileText, tileEdge, gold)
const T = (name, icon, bg1, bg2, panel, text, link, a1, a2, bt, t1, t2, tt, te, gold) =>
  ({ name, icon, v: { '--bg1': bg1, '--bg2': bg2, '--panel': panel, '--text': text, '--link': link, '--a1': a1, '--a2': a2, '--bt': bt, '--t1': t1, '--t2': t2, '--tt': tt, '--te': te, '--gold': gold } });
const L = 'rgba(20,30,70,.09)', D = 'rgba(255,255,255,.11)';
export const THEMES = {
  dark:     T('Dark', '🌙', '#0b0f1a', '#1b2340', D, '#f4f6ff', '#7cc4ff', '#6d4aff', '#c026d3', '#fff', '#fff', '#e2e8ff', '#111633', '#6d4aff', '#ffd54a'),
  light:    T('Light', '☀️', '#f7f8fc', '#e4e8f5', L, '#141a33', '#0b57c2', '#3b5bdb', '#7048e8', '#fff', '#fff', '#f1f3ff', '#141a33', '#3b5bdb', '#8a5300'),
  cream:    T('Cream', '🍦', '#fff8e7', '#f6e7c1', 'rgba(90,60,20,.10)', '#3b2a14', '#8a4b08', '#b45309', '#c2410c', '#fff', '#fffdf6', '#fbeccb', '#3b2a14', '#b45309', '#7a4a00'),
  sky:      T('Sky Blue', '☁️', '#e6f4ff', '#b9defc', 'rgba(10,60,110,.10)', '#0b2a4a', '#0a5db5', '#075985', '#0369a1', '#fff', '#fff', '#e8f5ff', '#0b2a4a', '#0369a1', '#7a4a00'),
  meadow:   T('Meadow Green', '🌿', '#e9f8e4', '#bfe8b4', 'rgba(20,80,30,.10)', '#123018', '#116a2b', '#166534', '#15803d', '#fff', '#fff', '#eafbe5', '#123018', '#15803d', '#6f4a00'),
  blossom:  T('Blossom Pink', '🌸', '#fff0f5', '#ffd0e0', 'rgba(120,20,60,.09)', '#4a1130', '#a3134f', '#be185d', '#9d174d', '#fff', '#fff', '#ffeaf2', '#4a1130', '#be185d', '#7a4500'),
  lavender: T('Lavender Violet', '🔮', '#f1ecff', '#d6c8fb', 'rgba(60,30,120,.10)', '#2a1a55', '#5b21b6', '#5b21b6', '#6d28d9', '#fff', '#fff', '#f3edff', '#2a1a55', '#6d28d9', '#7a4500'),
  honey:    T('Honey Gold', '🍯', '#fff4cc', '#ffd970', 'rgba(100,60,0,.11)', '#3a2500', '#8a4b00', '#92400e', '#b45309', '#fff', '#fffbe8', '#ffeeb0', '#3a2500', '#b45309', '#6f3f00'),
  bubblegum:T('Bubblegum', '🎀', '#ffd6f0', '#cdbbff', 'rgba(90,20,100,.11)', '#3b0a4a', '#86198f', '#a21caf', '#7c3aed', '#fff', '#fff', '#ffeefa', '#3b0a4a', '#a21caf', '#6f3f00'),
  candy:    T('Candy Pink', '🍭', '#ffe1ea', '#ffb3cc', 'rgba(130,10,50,.10)', '#5a0b2a', '#b0124f', '#e11d48', '#be123c', '#fff', '#fff', '#fff0f4', '#5a0b2a', '#e11d48', '#6f3f00'),
  aurora:   T('Aurora', '🌌', '#051a2c', '#1c0f3f', D, '#eafff8', '#5eead4', '#5eead4', '#a78bfa', '#051a2c', '#eafff8', '#c8f5ea', '#052a2e', '#2dd4bf', '#fde047'),
  sunset:   T('Sunset', '🌇', '#2a0f3a', '#7a1f3d', 'rgba(255,255,255,.13)', '#fff4ea', '#ffc27a', '#ff8a3d', '#ffd166', '#3a0f1a', '#fff7ec', '#ffe0bf', '#3a0f1a', '#ff8a3d', '#ffd166'),
  ocean:    T('Ocean', '🌊', '#03253f', '#0a5c85', D, '#eaf8ff', '#7fd8ff', '#38bdf8', '#22d3ee', '#03253f', '#f0fbff', '#c9eeff', '#03253f', '#38bdf8', '#ffe066'),
  midnight: T('Midnight (OLED)', '🌃', '#000000', '#0a0a14', 'rgba(255,255,255,.10)', '#ffffff', '#8ab4ff', '#4f46e5', '#2563eb', '#fff', '#f5f5f5', '#dcdcdc', '#000', '#4f46e5', '#ffd21f'),
  neon:     T('Neon Arcade', '🎮', '#0a0014', '#1a0033', D, '#f5f0ff', '#39ffea', '#c000a0', '#7a2bff', '#fff', '#12002b', '#240050', '#39ffea', '#ff2bd6', '#faff3b'),
  coffee:   T('Coffee', '☕', '#2b1b12', '#4a2f20', D, '#fff1e0', '#ffc38a', '#f59e0b', '#fbbf24', '#2b1b12', '#fff1e0', '#f0d7b8', '#2b1b12', '#d97706', '#ffd166')
};
