// THEMES = two families, both with the knitting look (yarn-ball buttons, stitched borders, yarn letter boxes):
//   1) KNITTING WOOL themes (knit_...)  -> knitted-fabric background
//   2) ORIGINAL themes (the ones you had before) -> same colours, PLAIN gradient background (plain: true)
// T(name, icon, bg1, bg2, panel, text, link, accent1, accent2, bannerText, tile1, tile2, tileText, tileEdge, gold)
const T = (name, icon, bg1, bg2, panel, text, link, a1, a2, bt, t1, t2, tt, te, gold) =>
  ({ name, icon, v: { '--bg1': bg1, '--bg2': bg2, '--panel': panel, '--text': text, '--link': link, '--a1': a1, '--a2': a2, '--bt': bt, '--t1': t1, '--t2': t2, '--tt': tt, '--te': te, '--gold': gold } });
const INK = '#5B4636';   // warm brown body text used by the wool themes
const L = 'rgba(20,30,70,.09)', D = 'rgba(255,255,255,.11)';
const KNIT = {
  knit_cream:  T('Cream Wool', '🧶', '#FFF3DC', '#EAD09C', 'rgba(255,251,242,.78)', INK, '#A84B26', '#E0724A', '#D9A02E', '#fff', '#FFFBF2', '#F2E4C8', '#6B4423', '#C9A26B', '#A8790F'),
  knit_blue:   T('Sky Blue Wool', '🩵', '#DCF0FA', '#93CBE6', 'rgba(242,250,253,.78)', INK, '#2C7594', '#4FA0C4', '#2C7594', '#fff', '#F2FAFD', '#DCEFF7', '#1E5C7A', '#6FAFCB', '#A8790F'),
  knit_green:  T('Meadow Green Wool', '🌿', '#E4F5DC', '#A2D68C', 'rgba(244,251,240,.78)', INK, '#4B7D3C', '#6FAA5C', '#4B7D3C', '#fff', '#F4FBF0', '#DDEED2', '#2E5B26', '#6FA867', '#A8790F'),
  knit_pink:   T('Blossom Pink Wool', '🌸', '#FCE3EE', '#EE9CC0', 'rgba(255,246,250,.78)', INK, '#A8446F', '#E0699C', '#A8446F', '#fff', '#FFF6FA', '#FADCE7', '#8E2E52', '#D9678D', '#A8790F'),
  knit_violet: T('Lavender Wool', '🔮', '#EEE1FA', '#C199E8', 'rgba(249,244,254,.78)', INK, '#6C459E', '#9C6FD1', '#6C459E', '#fff', '#F9F4FE', '#E9DBF7', '#4E2E78', '#9C6FD1', '#A8790F'),
  knit_honey:  T('Honey Gold Wool', '🍯', '#FDEBBD', '#F2BC48', 'rgba(255,251,239,.78)', INK, '#A8790F', '#E0A934', '#A8790F', '#fff', '#FFFBEF', '#F7E7BE', '#7A5109', '#D9A72E', '#8A5A00'),
  knit_night:  T('Night Wool (dark)', '🌙', '#2B1B12', '#4A2F20', 'rgba(255,241,224,.12)', '#FFF1E0', '#FFC38A', '#E0724A', '#D9A02E', '#fff', '#FFF1E0', '#F0D7B8', '#3A2412', '#E0A934', '#FFD166'),
};
const ORIGINAL = {
  cotton:   T('Cotton Candy', '🍬', '#ffe3f1', '#d9ccff', 'rgba(255,255,255,.55)', '#5a1a55', '#c2187a', '#ff6fb5', '#a78bfa', '#fff', '#ffffff', '#ffd6ec', '#7a1f66', '#ff6fb5', '#f59e0b'),
  peach:    T('Peach Bunny', '🐰', '#fff1e6', '#ffc9b5', 'rgba(255,255,255,.6)', '#6b2a1a', '#c2410c', '#ff8f70', '#ffb347', '#fff', '#ffffff', '#ffe0cf', '#7a2e18', '#ff8f70', '#e08400'),
  mint:     T('Minty Fresh', '🍃', '#e2fff3', '#c3f0ff', 'rgba(255,255,255,.6)', '#124a44', '#0f766e', '#3ed3a8', '#5cc8ff', '#fff', '#ffffff', '#d3fbe9', '#0f5b52', '#3ed3a8', '#d98200'),
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
// original themes get plain: true (no stitched-fabric background, just the smooth colour gradient)
export const THEMES = {
  ...KNIT,
  ...Object.fromEntries(Object.entries(ORIGINAL).map(([k, x]) => [k, { ...x, plain: true }]))
};
export const DEFAULT_THEME = 'knit_cream';
// old saved theme names from the first knitting version -> their new names
export const KNIT_RENAME = { cream: 'knit_cream', blue: 'knit_blue', green: 'knit_green', pink: 'knit_pink', violet: 'knit_violet', honey: 'knit_honey', night: 'knit_night' };
