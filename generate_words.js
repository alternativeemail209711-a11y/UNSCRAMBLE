#!/usr/bin/env node
// Builds data/words.full.txt = bundled words + every public English word list below that can be downloaded.
//   npm run words           -> strict: exits with an error if nothing could be downloaded
//   node generate_words.js --soft   -> used by `postinstall` on deploy: never fails the build, just reports
// Sources that are unreachable are skipped and reported; the final count is printed and shown in the game (Live tab -> Diagnostics).
const fs = require('fs'), path = require('path');
const SOFT = process.argv.includes('--soft');
const SOURCES = [
  ['dwyl words_alpha', 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt', false],
  ['dwyl words (lowercase entries only)', 'https://raw.githubusercontent.com/dwyl/english-words/master/words.txt', true],
  ['SOWPODS / Collins Scrabble', 'https://raw.githubusercontent.com/jesstess/Scrabble/master/sowpods.txt', false],
  ['ENABLE', 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt', false]
];
(async () => {
  const set = new Set(fs.readFileSync(path.join(__dirname, 'data/words.txt'), 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean));
  const base = set.size; let ok = 0;
  for (const [name, url, lowerOnly] of SOURCES) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const before = set.size;
      for (const w of (await r.text()).split(/\r?\n/)) {
        const t = w.trim(); if (lowerOnly && t !== t.toLowerCase()) continue;
        const x = t.toLowerCase(); if (/^[a-z]{3,25}$/.test(x) && /[aeiouy]/.test(x)) set.add(x);
      }
      ok++; console.log(`  + ${name}: +${set.size - before} new words`);
    } catch (e) { console.log(`  - ${name}: skipped (${e.message})`); }
  }
  if (!ok) { console.log('No word list could be downloaded; using the bundled ' + base + ' words.'); process.exit(SOFT ? 0 : 1); }
  fs.writeFileSync(path.join(__dirname, 'data/words.full.txt'), [...set].sort().join('\n') + '\n');
  console.log(`Word bank: ${set.size.toLocaleString()} accepted words (bundled ${base.toLocaleString()}).` + (set.size < 450000 ? ' NOTE: open lists top out below 450,000 strictly valid words.' : ''));
})().catch(e => { console.log('Word bank build failed: ' + e.message); process.exit(SOFT ? 0 : 1); });
