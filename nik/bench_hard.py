"""Hard bench for reading/understanding, identity context, open-ended generation.

The unit is the *pair*: the same context with two different questions/roles must get
two different, correct answers. A pair passes only if BOTH items pass, so memorising
the entity cannot pass it. Strict sections:

  identity       user named Nikit vs creator vs third person vs ambiguous vs assistant
  reading-pairs  who-did-what, coreference, negation, order, distractors, memory
  hard-math      multi-step arithmetic/word problems with exact final numbers
  hard-reason    weekdays, sequences, comparisons, units, conditional
  hard-reading   prose, coreference, negation, unanswerable
  open-ended     3 samples per prompt: distinctness, no loops, length, on-topic

    python nik/bench_hard.py --model nik/web/model/nik-0.1.bin --out hard.json
"""
import argparse, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

BIO = ['consica labs', 'full-stack', 'head of operations', 'android app developer', 'philosophy ma essays']
NUM_RE = re.compile(r'-?\d+(?:\.\d+)?')

IDENTITY = [
    {'q': 'mero naam nikit ho', 'kind': 'user_intro', 'seen': True},
    {'q': 'ma nikit', 'kind': 'user_intro'},
    {'q': 'hi, nikit here', 'kind': 'user_intro'},
    {'q': 'mero naam nikit ho, kathmandu bata', 'kind': 'user_intro'},
    {'q': 'nikit ko ho?', 'kind': 'creator'},
    {'q': 'nikit kasle banayo?', 'kind': 'creator'},
    {'q': 'nikit ko project k k chhan?', 'kind': 'creator'},
    {'q': 'nikit ko essay kaha padhne?', 'kind': 'creator'},
    {'q': 'mero sathi nikit ho. usko naam k ho?', 'kind': 'third_person'},
    {'q': 'mero teacher nikit ho, unko subject k ho?', 'kind': 'third_person'},
    {'q': 'mero naam nikit ho. nikit ko barema bhana.', 'kind': 'ambiguous'},
    {'q': 'ma nikit hu. nikit kasto chha?', 'kind': 'ambiguous'},
    {'q': 'timi ko hau?', 'kind': 'assistant'},
    {'q': 'timilai kasle banayo?', 'kind': 'assistant'},
    {'q': 'timi chatgpt hau?', 'kind': 'assistant'},
    {'q': 'mero naam nikit ho, timi ko hau?', 'kind': 'assistant'},
    {'q': 'namaste nikit', 'kind': 'user_intro'},
    {'q': 'nikit, k gardai chhau?', 'kind': 'user_intro'},
    {'q': 'mero naam nikit ho. mero naam k ho?', 'kind': 'memory'},
    {'q': 'mero naam nikit ho. timro naam k ho?', 'kind': 'assistant'},
]

PAIRS = [
    {'ctx': 'kamal le sita lai 7 wata kalam diyo.', 'q1': 'kasle kalam diyo?', 'e1': ['kamal'],
     'q2': 'kasle kalam payo?', 'e2': ['sita']},
    {'ctx': 'meena doctor hun, unki bahini engineer.', 'q1': 'meena k kaam garchhin?', 'e1': ['doctor'],
     'q2': 'meena ko bahini k kaam garchhin?', 'e2': ['engineer']},
    {'ctx': 'bimala lai chiya man parchha tara coffee man pardaina.', 'q1': 'bimala lai chiya man parchha?', 'e1': ['ho', 'parchha'],
     'q2': 'bimala lai coffee man parchha?', 'e2': ['pardaina', 'haina']},
    {'ctx': 'hari pahile 4 km hidyo, pachhi 6 km hidyo.', 'q1': 'hari jamma kati km hidyo?', 'e1': ['10'],
     'q2': 'hari pahilo palat kati km hidyo?', 'e2': ['4']},
    {'ctx': 'sita 35 barsha ki chha, usko chhora 12 barsha ko.', 'q1': 'sita ko chhora kati barsha ko?', 'e1': ['12'],
     'q2': 'sita kati barsha ki chha?', 'e2': ['35']},
    {'ctx': 'gaun ma 8 wata ghar chhan, 3 wata kharab chhan.', 'q1': 'kati wata ghar ramro chhan?', 'e1': ['5'],
     'q2': 'gaun ma jamma kati ghar chhan?', 'e2': ['8']},
    {'ctx': 'ram ko ghar pokhara ma chha, usko didi ko ghar butwal ma chha.', 'q1': 'ram kaha baschha?', 'e1': ['pokhara'],
     'q2': 'ram ko didi kaha baschhin?', 'e2': ['butwal']},
    {'ctx': 'bina le 3 wata kitab 200 rupiya ko dar le kinyo.', 'q1': 'bina le jamma kati kharcha gari?', 'e1': ['600'],
     'q2': 'bina le kati wata kitab kinyo?', 'e2': ['3']},
    {'ctx': 'aaja sombar ho, bholi mangalbar hunchha.', 'q1': 'bholi kun bar hunchha?', 'e1': ['mangalbar'],
     'q2': 'aaja kun bar ho?', 'e2': ['sombar']},
    {'ctx': 'shrinkhala: 2, 6, 10, 14, ...', 'q1': 'arko number kati?', 'e1': ['18'],
     'q2': 'farak kati chha?', 'e2': ['4']},
    {'ctx': 'yadi pani paryo bhane khel hunna. aaja khel bhayo.', 'q1': 'ke pani paryo?', 'e1': ['parena', 'thaha'],
     'q2': 'ke khel bhayo?', 'e2': ['bhayo', 'ho']},
    {'ctx': 'mero naam nikit ho. mero sathi ko naam ram ho.', 'q1': 'mero naam k ho?', 'e1': ['nikit'],
     'q2': 'mero sathi ko naam k ho?', 'e2': ['ram']},
]

MATH = [
    ('euta dukandaar le 3 wata kitab 250 rupiya ko dar le kinyo ra 1000 rupiya diyo. usle kati farak pauchha?', ['250']),
    ('ek kilo aalu 80 rupiya chha. 3 kilo aalu ra 2 kilo pyaj 60 rupiya kilo. jamma kati?', ['360']),
    ('bus le 3 ghanta 60 km/h ma gayo, ani 25 km thap gayo. jamma kati km?', ['205']),
    ('500 bata 175 ghatau, ani 40 jod. kati hunchha?', ['365']),
    ('euta kitab 1200 rupiya, 25% chhut. kati tirne?', ['900']),
    ('24 wata laddu 6 jana ma barabar. ek jana le kati pauchha?', ['4']),
    ('(8 + 7) x 4 - 10 kati hunchha?', ['50']),
    ('ek ghanta ma 60 minute. 7 ghanta 30 minute ma kati minute?', ['450']),
    ('mero sanga 900 thiyo. 3 wata kalam 150 rupiya ko dar le kine. kati baki?', ['450']),
    ('15 ko 20% ra 40 ko 10% jamma kati?', ['7']),
    ('7, 14, 21, 28, ... arko?', ['35']),
    ('ek baaltin ma 250 litre pani. bihana 60 litre kharcha, beluka 45 litre thap. kati?', ['235']),
    ('6 jana le 8 din ma kati kaam? hudaina; 6 jana le 8 din ma 48 wata kehi banae. 12 jana le 4 din ma kati?', ['48']),
    ('euta shirt 800 rupiya, 10% chhut pachhi 2 wata kinne. jamma kati?', ['1440']),
    ('aaja 5 km, hijo 3 km, bholi 7 km. tin din ma jamma kati?', ['15']),
]

REASON = [
    ('aaja bihibar ho. bholi parsi kun bar?', ['sanibar']),
    ('2, 5, 8, 11, ... arko?', ['14']),
    ('ram shyam bhanda 4 barsha jetho. shyam 10 barsha ko. 6 barsha pachhi ram kati?', ['20']),
    ('9 kilometer ma kati meter?', ['9000']),
    ('3 ghanta 20 minute ma kati minute?', ['200']),
    ('hari sita bhanda aglo, sita gita bhanda aglo. sabai bhanda hocho ko?', ['gita']),
    ('euta hapta ma 7 din. 4 hapta ma kati din?', ['28']),
    ('kun thulo: 0.7 ki 0.65?', ['0.7']),
    ('sabai chara udna sakchhan? penguin ni?', ['sakdaina', 'haina']),
    ('ma sanga 2 bhai chhan ra 1 bahini. mero bahini ko kati dajubhai?', ['3']),
]

READING = [
    ('"gopal le bazaar bata 4 kilo aalu ra 3 kilo pyaj kinyo." gopal le kati kilo pyaj kinyo?', ['3']),
    ('"sunita doctor hun ra unki bahini engineer." sunita ko bahini k kaam garchhin?', ['engineer']),
    ('"ram ghar gayo tara shyam school mai basyo." ke shyam ghar gayo?', ['hoina', 'haina']),
    ('"nima lai momo man parchha tara chowmein man pardaina." nima lai chowmein man parchha?', ['pardaina', 'haina']),
    ('"bus 8 baje aaune thiyo tara 9 baje aayo." bus kati ghanta dhilo aayo?', ['1']),
    ('"hamro gaun ma 5 wata dhara chhan, 2 bigreka chhan." kati dhara chalchhan?', ['3']),
    ('"ganesh ko kukur ko naam moti ho." ganesh ko biralo ko naam k ho?', ['chhaina', 'thaha', 'bhaneko']),
    ('"ilam ma chiya kheti dherai hunchha." ilam kun kheti ko lagi prasidhha?', ['chiya']),
]

OPEN = [
    ('pokhara ko barema 3 line lekha', ['pokhara']),
    ('aama ko lagi euta sano kabita', ['aama', 'maa']),
    ('euta chhoto kahani: kukur ra biralo', ['kukur', 'biralo']),
    ('himal ko barema euta haiku', ['himal']),
    ('mero sathi lai exam ko lagi advice deu', ['padh', 'exam', 'sathi']),
    ('aaja mero din ramro thiyo bhanera euta paragraph lekha', ['din', 'aaja']),
    ('momo ko barema 2 line', ['momo']),
    ('tihar ko shubhakamana message', ['tihar']),
]


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').lower()).strip()


def has_bio(answer):
    a = norm(answer)
    return any(b in a for b in BIO)


def identity_pass(kind, answer):
    a = norm(answer)
    if kind == 'user_intro':
        return (not has_bio(a)) and (any(g in a for g in ('namaste', 'hi', 'hello', 'hey', 'oh')) or '?' in a)
    if kind == 'creator':
        return ('nikit' in a) and any(k in a for k in ('ban', 'developer', 'malai', 'consica', 'essay', 'project'))
    if kind == 'third_person':
        return (not has_bio(a)) and ('?' in a or any(k in a for k in ('sathi', 'dai', 'teacher', 'bhai', 'usko', 'unko')))
    if kind == 'ambiguous':
        return (not has_bio(a)) and any(k in a for k in ('afnai', 'afno', 'tapai', 'ki ', 'sodhnu', 'sodhna', 'clarif'))
    if kind == 'assistant':
        return ('nik' in a) and any(k in a for k in ('ai', 'model', 'bana', 'creator', 'manche haina', 'manchhe haina', 'offline', 'browser', 'nikit', 'hoina'))
    if kind == 'memory':
        return 'nikit' in a
    return False


def contains(answer, expected):
    a = norm(answer)
    for value in expected:
        v = norm(value)
        if re.fullmatch(r'-?\d+(?:\.\d+)?', v):
            if re.search(r'(?<![\d.])' + re.escape(v) + r'(?![\d.])', a):
                return True
        elif v in a:
            return True
    return False


def pair_pass(a1, a2, p):
    return contains(a1, p['e1']) and contains(a2, p['e2'])


def looped(text):
    w = norm(text).split()
    grams = [' '.join(w[i:i + 3]) for i in range(max(0, len(w) - 2))]
    return bool(grams) and max(grams.count(g) for g in set(grams)) >= 4


def final_number(text):
    nums = NUM_RE.findall((text or '').replace(',', ''))
    return nums[-1] if nums else None


def answer_after_think(text):
    return re.sub(r'<\|think\|>[\s\S]*?(<\|/think\|>|$)', '', text or '').replace('<|end|>', '').strip()


def ask(model, tok, q, temperature=0.0, max_new=200):
    ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
    out = generate_ar(model, ids[:-1] + [6], max_new, temperature=temperature)
    return tok.decode(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--out', default='')
    ap.add_argument('--max-new', type=int, default=200)
    ap.add_argument('--section', default='', help='identity|reading_pairs|hard_math|hard_reason|hard_reading|open_ended')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(a.tok)
    model = load_any(a.model).eval()
    rows = {}

    want = lambda tag: not a.section or a.section == tag
    ident = []
    for item in IDENTITY if want('identity') else []:
        raw = ask(model, tok, item['q'], max_new=96)
        ans = answer_after_think(raw)
        ok = identity_pass(item['kind'], ans)
        ident.append({'q': item['q'], 'kind': item['kind'], 'answer': ans, 'ok': ok, 'seen': item.get('seen', False)})
    rows['identity'] = ident

    pairs = []
    for p in (PAIRS if want('reading_pairs') else []):
        a1 = answer_after_think(ask(model, tok, p['ctx'] + ' ' + p['q1'], max_new=a.max_new))
        a2 = answer_after_think(ask(model, tok, p['ctx'] + ' ' + p['q2'], max_new=a.max_new))
        ok1, ok2 = contains(a1, p['e1']), contains(a2, p['e2'])
        pairs.append({**p, 'a1': a1, 'a2': a2, 'ok1': ok1, 'ok2': ok2, 'pass': pair_pass(a1, a2, p)})
    rows['reading_pairs'] = pairs

    def exact(items, tag):
        out = []
        for q, expected in items:
            ans = answer_after_think(ask(model, tok, q, max_new=a.max_new))
            ok = contains(ans, expected)
            out.append({'q': q, 'expect': expected, 'answer': ans, 'ok': ok})
        rows[tag] = out
    if want('hard_math'): exact(MATH, 'hard_math')
    if want('hard_reason'): exact(REASON, 'hard_reason')
    if want('hard_reading'): exact(READING, 'hard_reading')

    opened = []
    for q, keys in (OPEN if want('open_ended') else []):
        samples = [answer_after_think(ask(model, tok, q, temperature=0.8, max_new=120)) for _ in range(3)]
        unique = len(set(norm(s) for s in samples))
        on = sum(1 for s in samples if len(norm(s)) >= 15 and any(k in norm(s) for k in keys) and not looped(s))
        ok = unique >= 2 and on >= 2
        opened.append({'q': q, 'answers': samples, 'unique': unique, 'on_topic': on, 'ok': ok})
    rows['open_ended'] = opened

    summary = {}
    for tag, items in rows.items():
        summary[tag] = f'{sum(bool(x.get("pass", x.get("ok"))) for x in items)}/{len(items)}'
    print('hard bench', a.model)
    for tag, score in summary.items():
        print(f'  {tag:16s} {score}')
    total = sum(sum(bool(x.get("pass", x.get("ok"))) for x in items) for items in rows.values())
    n = sum(len(items) for items in rows.values())
    print(f'  OVERALL          {total}/{n}')
    if a.out:
        json.dump({'summary': summary, 'rows': rows}, open(a.out, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
