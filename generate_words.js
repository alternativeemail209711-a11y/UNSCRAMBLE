#!/usr/bin/env node
// Run locally (Node 18+, internet needed):  npm run words
// Merges data/words.txt with a large public English word list -> data/words.full.txt (auto-loaded by the server; commit it).
// The largest open list (dwyl/english-words "words_alpha") has ~370k words; it is NOT hand-curated, so it includes rare/obscure entries.
const fs = require('fs'), path = require('path');
const URLS = ['https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt'];
(async () => {
  const set = new Set(fs.readFileSync(path.join(__dirname, 'data/words.txt'), 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean));
  const base = set.size;
  for (const u of URLS) {
    const r = await fetch(u); if (!r.ok) throw new Error(u + ' -> HTTP ' + r.status);
    for (const w of (await r.text()).split(/\r?\n/)) { const x = w.trim().toLowerCase(); if (/^[a-z]{3,25}$/.test(x) && /[aeiouy]/.test(x)) set.add(x); }
    console.log('merged', u);
  }
  fs.writeFileSync(path.join(__dirname, 'data/words.full.txt'), [...set].sort().join('\n') + '\n');
  console.log(`data/words.full.txt written: ${set.size} words (bundled list had ${base}).`);
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
