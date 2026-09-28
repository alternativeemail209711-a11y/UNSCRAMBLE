#!/usr/bin/env node
// Builds data/words.full.txt = bundled words + every public English word source below that can be downloaded.
//   npm run words                    -> strict: exits with an error if nothing could be downloaded
//   node generate_words.js --soft    -> used by `postinstall` on deploy: never fails the build, just reports
// Unreachable sources are skipped and reported. The final count is printed and shown in the game (Live tab -> Diagnostics).
const fs = require('fs'), path = require('path');
const TARGET = +process.env.WORD_TARGET || 400000;

const LISTS = [   // [name, url, keep only entries that are already lower-case (drops proper nouns)]
  ['dwyl words_alpha', 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt', false],
  ['dwyl words', 'https://raw.githubusercontent.com/dwyl/english-words/master/words.txt', true],
  ['SOWPODS / Collins Scrabble', 'https://raw.githubusercontent.com/jesstess/Scrabble/master/sowpods.txt', false],
  ['ENABLE', 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt', false]
];
const HUNSPELL = ['en', 'en-GB', 'en-AU', 'en-CA', 'en-ZA'].map(c => [`Hunspell ${c}`, `https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/${c}/index`]);

const good = x => /^[a-z]{3,25}$/.test(x) && /[aeiouy]/.test(x);

// Minimal hunspell "unmunch": expands a .dic + .aff pair into word forms (prefixes, suffixes, cross-products). Base entries starting with a capital are skipped (proper nouns).
function unmunch(dic, aff) {
  if (/^FLAG\s+(long|num)/m.test(aff)) return new Set();                 // exotic flag formats: not supported, skip safely
  const lines = aff.split(/\r?\n/), rules = {};
  for (let i = 0; i < lines.length; i++) {
    const p = lines[i].trim().split(/\s+/);
    if ((p[0] === 'PFX' || p[0] === 'SFX') && p.length >= 4 && /^\d+$/.test(p[3])) {
      const n = +p[3], list = [];
      for (let j = 1; j <= n && lines[i + j]; j++) {
        const q = lines[i + j].trim().split(/\s+/); if (q.length < 4) continue;
        let re; try { re = new RegExp(p[0] === 'PFX' ? '^' + (q[4] || '.') : (q[4] || '.') + '$'); } catch { continue; }
        list.push({ strip: q[2] === '0' ? '' : q[2], add: q[3].split('/')[0].replace(/^0$/, ''), re });
      }
      rules[p[1]] = { pfx: p[0] === 'PFX', cross: p[2] === 'Y', list }; i += n;
    }
  }
  const apply = (w, f) => {
    const r = rules[f], out = [];
    for (const { strip, add, re } of r.list) {
      if (!re.test(w)) continue;
      if (r.pfx) { if (strip && !w.startsWith(strip)) continue; out.push(add + w.slice(strip.length)); }
      else { if (strip && !w.endsWith(strip)) continue; out.push(w.slice(0, w.length - strip.length) + add); }
    }
    return out;
  };
  const out = new Set();
  for (const line of dic.split(/\r?\n/).slice(1)) {
    const [w, fl = ''] = line.split('\t')[0].split('/');
    if (!w || w[0] !== w[0].toLowerCase() || w[0] === w[0].toUpperCase()) continue;
    out.add(w);
    const fs_ = [...fl].filter(f => rules[f] && !rules[f].pfx), fp = [...fl].filter(f => rules[f] && rules[f].pfx);
    for (const f of fs_) apply(w, f).forEach(x => out.add(x));
    for (const f of fp) {
      apply(w, f).forEach(x => out.add(x));
      if (rules[f].cross) for (const s of fs_) if (rules[s].cross) for (const sw of apply(w, s)) apply(sw, f).forEach(x => out.add(x));
    }
  }
  return out;
}
module.exports = { unmunch };

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
async function main() {
  const SOFT = process.argv.includes('--soft');
  const set = new Set(fs.readFileSync(path.join(__dirname, 'data/words.txt'), 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean));
  const base = set.size; let ok = 0;
  const add = (name, words) => { const b = set.size; for (const w of words) if (good(w)) set.add(w); ok++; console.log(`  + ${name}: +${(set.size - b).toLocaleString()} new words`); };
  for (const [name, url, lowerOnly] of LISTS) {
    try { add(name, (await get(url)).split(/\r?\n/).map(t => t.trim()).filter(t => !lowerOnly || t === t.toLowerCase()).map(t => t.toLowerCase())); }
    catch (e) { console.log(`  - ${name}: skipped (${e.message})`); }
  }
  for (const [name, url] of HUNSPELL) {
    try { add(name, unmunch(await get(url + '.dic'), await get(url + '.aff'))); }
    catch (e) { console.log(`  - ${name}: skipped (${e.message})`); }
  }
  if (!ok) { console.log(`No word list could be downloaded; using the bundled ${base.toLocaleString()} words.`); process.exit(SOFT ? 0 : 1); }
  fs.writeFileSync(path.join(__dirname, 'data/words.full.txt'), [...set].sort().join('\n') + '\n');
  console.log(`Word bank: ${set.size.toLocaleString()} accepted words (bundled ${base.toLocaleString()}). Target ${TARGET.toLocaleString()}: ${set.size >= TARGET ? 'REACHED' : 'NOT reached - open word lists are smaller than this'}`);
}
if (require.main === module) main().catch(e => { console.log('Word bank build failed: ' + e.message); process.exit(process.argv.includes('--soft') ? 0 : 1); });
