"""Builds the extra categories into data/puzzles.extra.json (keeps whatever is already there).
Usage:  python3 tools/add_categories.py   (reads tools/new_categories/*.py, each defines a dict C)"""
import json, re, glob, os, runpy
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'data', 'puzzles.extra.json')
cur = json.load(open(out)) if os.path.exists(out) else {}
DROP = {'SPACE AND ASTRONOMY', 'COLOURS AND PATTERNS', 'BODY AND SENSES', 'FRUIT AND VEGGIE EXTRAS'}
RENAME = {'MARINE LIFE AND PETS': 'PETS AND PET CARE', 'WILD ANIMALS OF ASIA AND AFRICA': 'WILD ANIMALS', 'SEA AND SHIPS': 'BOATS AND SHIPS'}
BAD = {'A FAMOSA', 'HAINANESE KOPITIAM', 'CAT S CRADLE', 'MINT JULEP', 'CORNFLAKES COOKIES', 'ULU KALONG', 'BANANA LEAF RICE', 'SYRUP DRINK', 'ROSE MILK'}
for f in sorted(glob.glob(os.path.join(root, 'tools', 'new_categories', '*.py'))):
    for name, raw in runpy.run_path(f)['C'].items():
        if name in DROP: continue
        name = RENAME.get(name, name)
        seen = list(cur.get(name, []))
        for a in raw.replace('\n', ' ').split(','):
            a = re.sub(r'\s+', ' ', a.upper()).strip()
            if a in BAD or not re.fullmatch(r'[A-Z ]+', a): continue
            if len(a.replace(' ', '')) < 3 or len(a.replace(' ', '')) > 30 or a in seen: continue
            seen.append(a)
        cur[name] = seen
json.dump(cur, open(out, 'w'), indent=0, ensure_ascii=False)
print(len(cur), 'extra categories,', sum(map(len, cur.values())), 'answers')
