"""Builds the extra categories into data/puzzles.extra.json (keeps whatever is already there).
Usage:  python3 tools/add_categories.py   (reads tools/new_categories/*.py, each defines a dict C)

WORD SHUFFLE 10 rules (applied every time this script runs):
  * the game is open to viewers worldwide, so there are NO Malaysia-only categories (see DROP_CATS)
    and Malaysia-only answers are removed from the other lists (see PURGE).  Malaysia, Kuala Lumpur
    etc. may still appear as ordinary entries inside worldwide lists (countries, capitals).
  * an answer is ONE word, or 2-3 words at most, letters and spaces only.
  * every category must end with at least MIN_ANSWERS answers that are playable with the default
    5-20 letter setting - the script prints a warning for any category that is below that."""
import json, re, glob, os, runpy
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'data', 'puzzles.extra.json')
cur = json.load(open(out)) if os.path.exists(out) else {}
DROP = {'SPACE AND ASTRONOMY', 'COLOURS AND PATTERNS', 'BODY AND SENSES', 'FRUIT AND VEGGIE EXTRAS'}
DROP_CATS = {'MALAYSIAN FOOD', 'MALAYSIA AND ASIA'}      # Malaysia-only categories (replaced by ASIAN FOOD and ASIA)
RENAME = {'MARINE LIFE AND PETS': 'PETS AND PET CARE', 'WILD ANIMALS OF ASIA AND AFRICA': 'WILD ANIMALS', 'SEA AND SHIPS': 'BOATS AND SHIPS'}
BAD = {'A FAMOSA', 'HAINANESE KOPITIAM', 'CAT S CRADLE', 'MINT JULEP', 'CORNFLAKES COOKIES', 'ULU KALONG', 'BANANA LEAF RICE', 'SYRUP DRINK', 'ROSE MILK'}
# answers that only make sense for Malaysia (removed from every extra category)
PURGE = set("""BATU CAVES|MOUNT KINABALU|LANGKAWI|PUTRAJAYA|HARI RAYA|HARI RAYA AIDILFITRI|DEEPAVALI|THAIPUSAM|MERDEKA DAY|MALAYSIA DAY|WESAK DAY|DUIT RAYA|OPEN HOUSE|ANGPAO|KETUPAT|RENDANG|LEMANG|DURIAN ORCHARD|SHOPEE|LAZADA|GRAB|LINE APP|PROTON|PERODUA|HAWKER CENTRE|MAMAK STALL|KAMPUNG HOUSE|BELACAN|TEH TARIK|TEH O|KOPI O|BANDUNG|ICE KACANG|CENDOL|MALAY|JOGET|ZAPIN|INANG|TARI PIRING|TARI LILIN|MAK YONG|WAYANG KULIT|SILAT|DIKIR BARAT|WAU|SONGKET|TUDUNG|SONGKOK|CONGKAK|GASING|BATU SEREMBAN|CAPSA|DAM HAJI|CATUR|SANG KANCIL|BAWANG MERAH BAWANG PUTIH|MAT JENIN|SI TANGGANG|LEGEND OF MAHSURI|HANG TUAH|PONTIANAK|PENANGGAL|HANTU|TOYOL|ORANG BUNIAN|MALACCA SULTANATE|TUNKU ABDUL RAHMAN|PARAMESWARA|GULA MELAKA CAKE|SARDINE PUFF|TOUCH N GO|SEN|MALAY HOUSE|KINABATANGAN|RAJANG|PAHANG RIVER|KELANTAN RIVER|PERAK RIVER|KINABALU|GUNUNG TAHAN|GUNUNG LEDANG|LAKE CHINI|LAKE KENYIR|MALAYAN TIGER|MALAYAN TAPIR|BINTURONG|KEROPOK|DODOL|WAJIK|JELEBI|KUIH RAYA|KUIH BANGKIT|SEMPRIT|LOVE LETTERS|DANGDUT|KERONCONG|ASLI|GHAZAL|NASYID|QASIDAH|PENANG|MALACCA|KUALA LUMPUR""".split('|'))
KEEP_IN = {'COUNTRIES & CAPITALS': {'KUALA LUMPUR'}}     # worldwide lists keep Malaysia / Kuala Lumpur as ordinary entries
MIN_ANSWERS, MAX_WORDS = 50, 3
for c in DROP_CATS: cur.pop(c, None)
def clean(a): return re.sub(r'\s+', ' ', a.upper()).strip()
def playable(a): n = len(a.replace(' ', '')); return 5 <= n <= 20 and len(a.split()) <= MAX_WORDS
for f in sorted(glob.glob(os.path.join(root, 'tools', 'new_categories', '*.py'))):
    for name, raw in runpy.run_path(f)['C'].items():
        if name in DROP or name in DROP_CATS: continue
        name = RENAME.get(name, name)
        seen = list(cur.get(name, []))
        for a in raw.replace('\n', ' ').split(','):
            a = clean(a)
            if a in BAD or not re.fullmatch(r'[A-Z ]+', a): continue
            if len(a.replace(' ', '')) < 3 or len(a.replace(' ', '')) > 30 or a in seen: continue
            seen.append(a)
        cur[name] = seen
for name in list(cur):   # purge Malaysia-only answers, tidy duplicates
    cur[name] = [a for a in dict.fromkeys(clean(x) for x in cur[name]) if a not in PURGE or a in KEEP_IN.get(name, set())]
json.dump(cur, open(out, 'w'), indent=0, ensure_ascii=False)
print(len(cur), 'extra categories,', sum(map(len, cur.values())), 'answers')
for name, l in sorted(cur.items()):
    n = sum(map(playable, l))
    if n < MIN_ANSWERS: print('  WARNING', name, 'has only', n, 'playable answers (5-20 letters, max 3 words)')
