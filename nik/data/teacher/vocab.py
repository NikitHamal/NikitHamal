"""English <-> romanized Nepali vocabulary, hand-written (v4f: '"river" lai nepali ma k bhanchha?' -> 'river').
Word meaning both ways, in-sentence use, and plurals; 150 pairs, so the skill is lookup + format, not 30 memorised rows."""
import random

PAIRS = [('mountain', 'pahad'), ('snow mountain', 'himal'), ('lake', 'tal'), ('forest', 'jangal'), ('tree', 'rukh'),
 ('flower', 'phool'), ('leaf', 'paat'), ('fruit', 'phal'), ('seed', 'biu'), ('rain', 'pani paryo'), ('cloud', 'badal'), ('sky', 'aakash'),
 ('sun', 'ghaam'), ('moon', 'jun'), ('star', 'tara'), ('wind', 'hawa'), ('fire', 'aago'), ('water', 'pani'), ('earth', 'prithvi'),
 ('stone', 'dhunga'), ('road', 'bato'), ('bridge', 'pul'), ('village', 'gaun'), ('city', 'sahar'), ('country', 'desh'), ('house', 'ghar'),
 ('room', 'kotha'), ('door', 'dhoka'), ('window', 'jhyal'), ('roof', 'chhana'), ('wall', 'bhitta'), ('kitchen', 'bhansa'), ('bed', 'ochhyan'),
 ('chair', 'kursi'), ('table', 'tebul'), ('book', 'kitab'), ('pen', 'kalam'), ('paper', 'kagaj'), ('letter', 'chithi'), ('school', 'vidyalaya'),
 ('teacher', 'shikshak'), ('student', 'bidyarthi'), ('friend', 'sathi'), ('mother', 'aama'), ('father', 'buwa'), ('elder brother', 'dai'),
 ('younger brother', 'bhai'), ('elder sister', 'didi'), ('younger sister', 'bahini'), ('grandmother', 'hajurama'), ('grandfather', 'hajurba'),
 ('child', 'bachcha'), ('boy', 'keta'), ('girl', 'keti'), ('man', 'manchhe'), ('woman', 'mahila'), ('doctor', 'doctor'), ('farmer', 'kisan'),
 ('shop', 'pasal'), ('market', 'bazaar'), ('money', 'paisa'), ('price', 'mol'), ('work', 'kaam'), ('food', 'khana'), ('rice', 'bhat'),
 ('lentils', 'dal'), ('vegetable', 'tarkari'), ('milk', 'dudh'), ('tea', 'chiya'), ('salt', 'nun'), ('sugar', 'chini'), ('egg', 'anda'),
 ('meat', 'masu'), ('fish', 'machha'), ('bread', 'roti'), ('potato', 'aalu'), ('onion', 'pyaj'), ('apple', 'syau'), ('banana', 'kera'),
 ('orange', 'suntala'), ('dog', 'kukur'), ('cat', 'biralo'), ('cow', 'gai'), ('goat', 'bakhra'), ('horse', 'ghoda'), ('bird', 'chara'),
 ('tiger', 'bagh'), ('elephant', 'hatti'), ('monkey', 'bandar'), ('head', 'tauko'), ('hand', 'haat'), ('foot', 'khutta'), ('eye', 'aankha'),
 ('ear', 'kaan'), ('nose', 'naak'), ('mouth', 'mukh'), ('tooth', 'daat'), ('heart', 'mutu'), ('body', 'sharir'), ('day', 'din'),
 ('night', 'raat'), ('morning', 'bihana'), ('evening', 'beluka'), ('week', 'hapta'), ('month', 'mahina'), ('year', 'barsha'), ('today', 'aaja'),
 ('tomorrow', 'bholi'), ('yesterday', 'hijo'), ('time', 'samaya'), ('love', 'maya'), ('happiness', 'khusi'), ('sadness', 'dukha'),
 ('fear', 'dar'), ('anger', 'ris'), ('truth', 'satya'), ('lie', 'jhut'), ('question', 'prashna'), ('answer', 'jawaf'), ('language', 'bhasa'),
 ('word', 'shabda'), ('song', 'geet'), ('dance', 'naach'), ('game', 'khel'), ('festival', 'chad'), ('god', 'bhagwan'), ('temple', 'mandir'),
 ('big', 'thulo'), ('small', 'sano'), ('good', 'ramro'), ('bad', 'naramro'), ('hot', 'tato'), ('cold', 'chiso'), ('new', 'naya'),
 ('old', 'purano'), ('beautiful', 'sundar'), ('easy', 'sajilo'), ('difficult', 'garho'), ('fast', 'chhito'), ('slow', 'dhilo'),
 ('happy', 'khusi'), ('sad', 'dukhi'), ('tired', 'thakeko'), ('hungry', 'bhokaeko'), ('thirsty', 'tirkhaeko'), ('rich', 'dhani'), ('poor', 'garib'),
 ('one', 'ek'), ('two', 'dui'), ('three', 'tin'), ('four', 'char'), ('five', 'pach'), ('ten', 'das'), ('hundred', 'saya'), ('thousand', 'hajar')]

EN_Q = ['"{e}" lai nepali ma k bhanchha?', '"{e}" ko nepali k ho?', '"{e}" nepali ma bhana.', 'what is "{e}" in nepali?', '"{e}" ko arth nepali ma?']
NE_Q = ['"{n}" ko english k ho?', '"{n}" lai english ma k bhanchha?', 'what does "{n}" mean in english?', '"{n}" english ma bhana.']


NE_UNIQUE = [p for p in PAIRS if sum(1 for _, n in PAIRS if n == p[1]) == 1]   # NE->EN only for one-meaning words


def sample(R):
    e, n = R.choice(PAIRS)
    if R.random() < 0.55:
        q = R.choice(EN_Q).format(e=e)
        a = (f'"{e}" in nepali is "{n}".' if q.startswith('what') else R.choice([f'"{e}" lai nepali ma "{n}" bhanchha.', f'nepali ma: "{n}".', f'"{e}" ko nepali "{n}" ho.']))
        return {'cat': 'understand-vocab', 'gold': n, 'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a}]}
    e, n = R.choice(NE_UNIQUE)
    q = R.choice(NE_Q).format(n=n)
    a = (f'"{n}" means "{e}".' if q.startswith('what') else R.choice([f'"{n}" lai english ma "{e}" bhanchha.', f'english ma: "{e}".', f'"{n}" ko english "{e}" ho.']))
    return {'cat': 'understand-vocab', 'gold': e, 'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a}]}
