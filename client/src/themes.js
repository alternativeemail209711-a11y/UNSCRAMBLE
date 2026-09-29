// KNITTING THEMES - same six wool colours as the rest of the platform (Cream, Sky Blue, Meadow, Blossom, Lavender, Honey) plus a dark "Night Wool".
// T(name, icon, bg1, bg2, panel, text, link, accent1, accent2, bannerText, tile1, tile2, tileText, tileEdge, gold)
const T = (name, icon, bg1, bg2, panel, text, link, a1, a2, bt, t1, t2, tt, te, gold) =>
  ({ name, icon, v: { '--bg1': bg1, '--bg2': bg2, '--panel': panel, '--text': text, '--link': link, '--a1': a1, '--a2': a2, '--bt': bt, '--t1': t1, '--t2': t2, '--tt': tt, '--te': te, '--gold': gold } });
const INK = '#5B4636';   // warm brown body text - the same in every light theme, so it is always easy to read
export const THEMES = {
  cream:  T('Cream Wool', '🧶', '#FFF3DC', '#EAD09C', 'rgba(255,251,242,.78)', INK, '#A84B26', '#E0724A', '#D9A02E', '#fff', '#FFFBF2', '#F2E4C8', '#6B4423', '#C9A26B', '#A8790F'),
  blue:   T('Sky Blue Wool', '🩵', '#DCF0FA', '#93CBE6', 'rgba(242,250,253,.78)', INK, '#2C7594', '#4FA0C4', '#2C7594', '#fff', '#F2FAFD', '#DCEFF7', '#1E5C7A', '#6FAFCB', '#A8790F'),
  green:  T('Meadow Green Wool', '🌿', '#E4F5DC', '#A2D68C', 'rgba(244,251,240,.78)', INK, '#4B7D3C', '#6FAA5C', '#4B7D3C', '#fff', '#F4FBF0', '#DDEED2', '#2E5B26', '#6FA867', '#A8790F'),
  pink:   T('Blossom Pink Wool', '🌸', '#FCE3EE', '#EE9CC0', 'rgba(255,246,250,.78)', INK, '#A8446F', '#E0699C', '#A8446F', '#fff', '#FFF6FA', '#FADCE7', '#8E2E52', '#D9678D', '#A8790F'),
  violet: T('Lavender Wool', '🔮', '#EEE1FA', '#C199E8', 'rgba(249,244,254,.78)', INK, '#6C459E', '#9C6FD1', '#6C459E', '#fff', '#F9F4FE', '#E9DBF7', '#4E2E78', '#9C6FD1', '#A8790F'),
  honey:  T('Honey Gold Wool', '🍯', '#FDEBBD', '#F2BC48', 'rgba(255,251,239,.78)', INK, '#A8790F', '#E0A934', '#A8790F', '#fff', '#FFFBEF', '#F7E7BE', '#7A5109', '#D9A72E', '#8A5A00'),
  night:  T('Night Wool (dark)', '🌙', '#2B1B12', '#4A2F20', 'rgba(255,241,224,.12)', '#FFF1E0', '#FFC38A', '#E0724A', '#D9A02E', '#fff', '#FFF1E0', '#F0D7B8', '#3A2412', '#E0A934', '#FFD166')
};
export const DEFAULT_THEME = 'cream';
