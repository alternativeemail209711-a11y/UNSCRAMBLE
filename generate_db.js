#!/usr/bin/env node
// Run locally (Node 18+, internet needed):  node generate_db.js
// Output: data/puzzles.full.json  -> commit it, the server auto-loads it.
// Sources: (1) Wikipedia categories below (add more until you have 100+ names),
//          (2) hand-written lists: data/custom/<CATEGORY NAME>.txt, one answer per line.
// Wikipedia category names must exist - open en.wikipedia.org/wiki/Category:<name> to verify. Review output before deploying.
const fs = require('fs'), path = require('path');
const TARGET = 200, MAX = 400, API = 'https://en.wikipedia.org/w/api.php';

// [display category, Wikipedia category, subcategory depth]  (same display name = merged)
const SOURCES = [
  ['MYTHOLOGY', 'Greek_mythological_figures', 1],
  ['MYTHOLOGY', 'Norse_gods', 1],
  ['WORLD CAPITALS', 'Capitals_in_Europe', 0],
  ['WORLD CAPITALS', 'Capitals_in_Asia', 0],
  ['WORLD CAPITALS', 'Capitals_in_Africa', 0],
  ['NOBEL WINNERS', 'Nobel_Peace_Prize_laureates', 0],
  ['NOBEL WINNERS', 'Nobel_Prize_in_Physics_laureates', 0],
  ['ROMAN EMPERORS', 'Roman_emperors', 1],
  ['NATIONAL PARKS', 'National_parks_of_the_United_States', 1],
  ['DOG BREEDS', 'Dog_breeds', 1],
  ['CAT BREEDS', 'Cat_breeds', 0],
  ['CHEMICAL ELEMENTS', 'Chemical_elements', 1],
  ['PROGRAMMING LANGUAGES', 'Programming_languages', 1],
  ['BOARD GAMES', 'Board_games', 1],
  ['CONSTELLATIONS', 'Constellations', 1],
  ['RIVERS', 'Rivers_of_Europe', 1],
  ['RENAISSANCE ARTISTS', 'Renaissance_painters', 1],
  ['CHEESES', 'Cheeses', 1],
  ['FRUITS', 'Edible_fruits', 1],
  ['MUSICAL INSTRUMENTS', 'Musical_instruments', 1]
  // ...add 80+ more lines
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(params) {
  const u = new URL(API);
  Object.entries({ format: 'json', origin: '*', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { 'User-Agent': 'WordShuffleDB/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  await sleep(100);
  return r.json();
}
async function members(cat, type) {
  const out = []; let cont;
  do {
    const j = await api({ action: 'query', list: 'categorymembers', cmtitle: 'Category:' + cat, cmlimit: 500, cmtype: type, ...(cont ? { cmcontinue: cont } : {}) });
    out.push(...(j.query?.categorymembers || []).map(m => m.title));
    cont = j.continue?.cmcontinue;
  } while (cont && out.length < 2000);
  return out;
}
async function collect(cat, depth) {
  let t = await members(cat, 'page');
  if (depth > 0) for (const sc of (await members(cat, 'subcat')).slice(0, 40)) {
    t = t.concat(await collect(sc.replace(/^Category:/, ''), depth - 1));
    if (t.length > 3000) break;
  }
  return t;
}
function clean(t) {
  if (/^(List|Lists|Category|Template|Wikipedia)\b/i.test(t) || /[0-9:]/.test(t)) return null;
  const s = t.replace(/\s*\(.*?\)\s*/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\u2013\u2014]/g, ' ').replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const words = s.split(' '), n = s.replace(/ /g, '').length;
  if (words.length > 4 || n < 5) return null;
  if (words.length === 1 && n > 15) return null;   // single word: 5-15 letters
  if (n > 25) return null;                          // multi word: up to 4 words / 25 letters
  return s;
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

(async () => {
  const db = {};
  const add = (cat, list) => { const set = new Set(db[cat] || []); list.forEach(x => x && set.add(x)); db[cat] = [...set]; };

  const dir = path.join(__dirname, 'data/custom');
  if (fs.existsSync(dir)) fs.readdirSync(dir).filter(f => f.endsWith('.txt')).forEach(f =>
    add(path.basename(f, '.txt').toUpperCase(), fs.readFileSync(path.join(dir, f), 'utf8').split('\n').map(l => clean(l.trim()))));

  for (const [name, wiki, depth] of SOURCES) {
    try {
      const titles = await collect(wiki, depth);
      add(name, titles.map(clean));
      console.log(`${name} <- ${wiki}: ${db[name].length}`);
    } catch (e) { console.warn(`SKIP ${wiki}: ${e.message}`); }
  }
  for (const c of Object.keys(db)) {
    if (/english|common words|random words|dictionary/i.test(c)) { delete db[c]; continue; }   // too wide / vague
    db[c] = shuffle(db[c]).slice(0, MAX);
    if (db[c].length < TARGET) console.warn(`! ${c} has only ${db[c].length} (< ${TARGET}) - add sources or data/custom/${c}.txt`);
    if (db[c].length < 30) delete db[c];
  }
  fs.writeFileSync(path.join(__dirname, 'data/puzzles.full.json'), JSON.stringify(db));
  console.log(`Done: ${Object.keys(db).length} categories -> data/puzzles.full.json`);
})();
