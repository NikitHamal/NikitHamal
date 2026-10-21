"""NikBench-RW: a real-world, strict benchmark (Claude, 2026-10-21; owner: "harder, stricter, built for the real world").

What real /chat users do, hand-written, never generated:
  money     shopping / bills / change / discounts, 2-3 steps, natural phrasing
  time      clock times, durations, units, weekdays
  read      a message or notice in the prompt, a question about it
  unknown   the answer is NOT in the message -> must say so, must not invent a number
  format    an explicit output constraint ("number matra", "ek shabda ma", "comma le")
  memory    multi-turn chat: a fact, distractor turns, sometimes a correction, then the question
  noisy     typos, chat-speak, English mixing, no punctuation

Strictness:
  * every item is a GROUP of 3 phrasings of the same need; a group passes only if all 3 pass
    (a model that guesses or matches one template cannot pass);
  * numbers: the LAST number in the reply (think block removed) must equal the gold and the reply must not loop;
  * unknown: must contain a don't-know cue and no digit at all;
  * format: the exact constraint is checked (only the number, <= N words, >= 3 comma items, ...);
  * memory: the full chat history is rendered like /chat does (no context.js trimming), reply to the last turn scored.
  * decoding = /chat defaults (maxNew 440, exact-arithmetic calc on), but greedy instead of sampling+vote, for reproducibility.

Held out: vocabulary and situations are written fresh; make_sft2's eval-prompt guard drops any exact prompt,
and tests/test_bench_rw.py checks no prompt appears in the teacher generators' output.

    python nik/bench_rw.py --model nik/web/model/nik-0.1.bin --out rw.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

UNKNOWN_CUES = ('thaha chhaina', 'thaha bhayena', 'bhannubhayeko chhaina', 'bhaneko chhaina', 'lekheko chhaina',
                'ullekh chhaina', 'diyeko chhaina', 'thaha hudaina', 'bhanna sakdina', 'jankari chhaina', 'chhaina')
NUM = re.compile(r'-?\d+(?:[.:]\d+)?')

# kind: num (gold str), text (want any / bad none), unknown, fmt:<rule>
# each group: (cat, kind, gold_or_spec, [variant, variant, variant]); a variant is a str or a list of turns
G = [
    # ---------------- money ----------------
    ('money', 'num', '745', ['ma sanga 1000 rupiya thiyo. 85 rupiya ko darle 3 ota kapi kine. aba kati rupiya baki chha?',
                             '1000 rupiya lagera pasal gaye, 85 rupiya parne 3 ota kapi kine bhane kati paisa firta aauchha?',
                             'bro 3 ota copy, euta ko 85, maile 1000 diye, change kati paunchhu']),
    ('money', 'num', '460', ['chini 110 rupiya kilo chha ra tel 240 rupiya litre. 2 kilo chini ra 1 litre tel kinda jamma kati hunchha?',
                             '2 kg chini (110/kg) ra 1 litre tel (240) ko jamma bill kati?',
                             'pasal ma 2 kilo chini ani 1 litre tel kine, chini kilo ko 110 tel 240 bhaye kati tirnu parchha']),
    ('money', 'num', '460', ['hami 4 jana sathi khana khana gayau, bill 1840 rupiya aayo. barabar bandda ek jana le kati tirne?',
                             '1840 ko bill 4 jana ma barabar baadda euta lai kati parchha?',
                             'khana ko bill 1840 bhayo, 4 jana chau, per head kati?']),
    ('money', 'num', '900', ['1200 rupiya ko jacket ma 25 pratishat chhut chha. aba kati ma paincha?',
                             'jacket ko mol 1200, 25% discount pachhi kati tirne?',
                             '25 percent off on 1200 rupees jacket, final price kati hunchha?']),
    ('money', 'num', '7200', ['meri didi ko talab mahina ko 18000 ho. usle 40 pratishat bachaunchhe. mahina ma kati bachaunchhe?',
                              '18000 talab ko 40% bachat garda kati bachchha?',
                              'monthly salary 18000, 40 percent save garne ho bhane saving kati']),
    ('money', 'num', '450', ['office jana bus bhada 45 rupiya ra farkana pani 45 rupiya lagchha. 5 din ma jamma kati kharcha hunchha?',
                             'jaane 45 farkine 45, hapta ma 5 din office gaye bhane bus ma kati kharcha?',
                             'daily bus fare 45 each way, 5 days ko total kati']),
    ('money', 'num', '180', ['500 rupiya diyera 160 rupiya ko 2 plate momo kine. kati firta aauchha?',
                             'momo plate ko 160, 2 plate khayo, 500 ko note diyo, change kati?',
                             '2 plate momo @160, paid 500, kati baki firta']),
    # ---------------- time / units ----------------
    ('time', 'text', (['10:15', '10.15', 'sawa das'], []), ['bihana 7:30 ma ghar bata niskiye ra pugna 2 ghanta 45 minute lagyo. kati baje pugen?',
                             '7:30 baje hideko, 2 ghanta 45 minute ko yatra, pugne samaya kati?',
                             'left at 7:30 am, journey 2 hr 45 min, kati baje pugchhu']),
    ('time', 'num', '3500', ['3.5 kilometer ma kati meter hunchha?', '3.5 km lai meter ma badal', 'saadhe tin kilometer = kati meter']),
    ('time', 'text', (['sukrabar', 'friday'], ['mangalbar', 'sanibar', 'aaitabar', 'sombar', 'budhabar', 'bihibar']),
     ['aaja mangalbar ho bhane 10 din pachhi kun bar parchha?', 'mangalbar dekhi 10 din pachhi kun din hunchha?',
      'today tuesday, 10 din pachhi kun bar']),
    ('time', 'num', '80', ['1 ghanta 20 minute ma jamma kati minute hunchha?', 'ek ghanta bees minute lai minute ma bhana', '1 hr 20 min = kati min']),
    ('time', 'num', '2.5', ['2500 gram kati kilo hunchha?', '2500 g lai kg ma lekha', '2500 gram = ? kg']),
    ('time', 'num', '12', ['ma hapta ma 3 din gym janchhu. 4 hapta ma kati din gym jaanchhu?',
                           'haptako 3 din gym, 4 hapta ma jamma kati din?', '3 days a week gym, 4 weeks ma total kati din']),
    ('time', 'text', (['4:05', '4.05'], []), ['film 2:15 baje suru bhayo ra 1 ghanta 50 minute lamo chha. kati baje sakinchha?',
                                               '2:15 ma suru bhayeko 1 ghanta 50 minute ko film kati baje sakinchha?',
                                               'movie starts 2:15, length 1h 50m, ends at?']),
    ('time', 'num', '18', ['ma 2008 ma janmeko. 2026 ma mero umer kati hunchha?', '2008 ma janmeko manchhe 2026 ma kati barsha ko hunchha?',
                           'born 2008, age in 2026 kati']),
    # ---------------- read ----------------
    ('read', 'num', '4', ['"didi, bholi ko meeting 3 baje bata sarera 4 baje bhayo. kotha 12 mai ho. - ramesh" meeting kati baje ho?',
                          '"bholi ko meeting 3 baje bata sarera 4 baje bhayo, kotha 12." aba meeting kati baje?',
                          'message: "meeting 3 baje thiyo, aba 4 baje sareko chha, room 12." naya samaya kati baje?']),
    ('read', 'text', (['sanibar'], []), ['suchana: "sukrabar dhara ma pani aaudaina. sanibar bihana 6 baje dekhi pani aauchha." pani kahile aauchha?',
                                          '"sukrabar pani aaudaina, sanibar bihana 6 baje dekhi aauchha." kun bar pani aauchha?',
                                          'notice: sukrabar no water, sanibar 6 baje dekhi pani. pani kun din aaune?']),
    ('read', 'num', '3', ['"sita ka 2 bhai ra 1 bahini chhan." sita ka jamma kati bhai bahini chhan?',
                          '"sita ko 2 bhai ra 1 bahini chhan." sita ka bhai bahini jamma kati jana?',
                          'sita has 2 brothers 1 sister. total siblings kati?']),
    ('read', 'num', '0', ['"prakash le 3 ota syau kinyo, 1 ota sathi lai diyo ra 2 ota aafai khayo." prakash sanga aba kati syau chha?',
                          '"prakash: 3 syau kinyo, 1 diyo, 2 khayo." aba usko ma kati syau baki?',
                          'prakash bought 3 apples, gave 1, ate 2. kati baki?']),
    ('read', 'text', (['7:10', '7.10'], ['6:40', '6.40']), ['"kirtipur jaane bus 6:40 ra 7:10 ma chhutchha." hari 6:50 ma bus stop pugyo. hari kun bus chadhna sakchha?',
                                                            '"bus 6:40 ra 7:10 ma chhutchha." 6:50 ma pugne hari le kati baje ko bus paunchha?',
                                                            'buses at 6:40 and 7:10. hari arrived 6:50. which bus can he take?']),
    ('read', 'text', (['mina'], ['gita', 'rita']), ['"gita rita bhanda aglo chhe. rita mina bhanda aglo chhe." sabai bhanda hocho ko ho?',
                                                     '"gita > rita uchai ma, rita > mina." sabai bhanda hocho ko?',
                                                     'gita taller than rita, rita taller than mina. shortest ko?']),
    ('read', 'num', '320', ['"pasal: chamal 90 rupiya kilo, daal 160 rupiya kilo." 2 kilo daal kati parchha?',
                            '"chamal 90/kg, daal 160/kg." 2 kg daal ko mol kati?',
                            'rate list: rice 90, daal 160 per kg. 2 kg daal kati']),
    ('read', 'text', (['khulchha', 'khulne'], ['khuldaina', 'bida chha']), ['"bholi bida chha tara parsi school khulchha." parsi school khulchha ki khuldaina?',
                                                                           '"bholi bida, parsi school khulchha." parsi ko din school khulne ho?',
                                                                           'tomorrow holiday, day after school opens. parsi school open huncha?']),
    # ---------------- unknown ----------------
    ('unknown', 'unknown', None, ['"anil le euta kitab kinyo." kitab kati rupiya ko thiyo?', '"anil le kitab kinyo." tyo kitab ko mol kati?',
                                  'anil bought a book. price kati thiyo?']),
    ('unknown', 'unknown', None, ['"mero bhai school janchha." mero bhai kati kaksha ma padhchha?', '"bhai school janchha." u kun class ma chha?',
                                  'my brother goes to school. which grade?']),
    ('unknown', 'unknown', None, ['"hijo kathmandu ma pani paryo." kati millimeter pani paryo?', '"hijo pani paryo." kati mm pani paryo?',
                                  'it rained yesterday in ktm. how many mm?']),
    ('unknown', 'unknown', None, ['"rina le bazar bata tarkari lyai." rina le kati kilo tarkari lyai?', '"rina tarkari lyai." kati kilo?',
                                  'rina brought vegetables. how many kg?']),
    ('unknown', 'unknown', None, ['"bus ma dherai manchhe thiye." bus ma kati jana thiye?', '"bus ma bheed thiyo." exact kati jana?',
                                  'bus was crowded. exactly how many people?']),
    ('unknown', 'unknown', None, ['"mero sathi le naya phone kinyo." phone ko mol kati ho?', '"sathi le phone kinyo." kati ma kinyo?',
                                  'friend bought a new phone. kati rupiya?']),
    # ---------------- format ----------------
    ('format', 'fmt:only_number', '56', ['7 x 8 kati? number matra lekha.', '7 guna 8 ko jawaf number matra deu.', 'only the number: 7*8']),
    ('format', 'fmt:only_number', '27', ['12 + 15 ko jawaf matra deu, aru kehi nalekha.', '12 ra 15 jod, number matra.', 'answer with just the number: 12+15']),
    ('format', 'fmt:words<=2', (['kathmandu'],), ['nepal ko rajdhani ek shabda ma bhana.', 'ek shabda ma: nepal ko rajdhani?', 'one word answer: capital of nepal']),
    ('format', 'fmt:list3', None, ['3 ota phal ko naam comma le chhutyayera lekha.', 'tin ota phal ko naam, comma lagayera.', 'list 3 fruits separated by commas']),
    ('format', 'fmt:words<=3', (['hello', 'hi', 'greetings'],), ['"namaste" lai english ma translate gara, ek shabda matra.',
                                                                 'namaste ko english ek shabda ma?', 'translate namaste to english, one word only']),
    ('format', 'fmt:words<=4', (['haina', 'hoina', 'no'],), ['ho ki haina matra bhana: 7 bhanda 10 sano ho?', '10, 7 bhanda sano ho? ho/haina ma jawaf deu.',
                                                             'yes/no only: is 10 smaller than 7?']),
    # ---------------- memory ----------------
    ('memory', 'text', (['suman'], []), [['mero bhai ko naam suman ho.', 'aaja mausam kasto chha?', 'dal bhat kasari pakaune?', 'mero bhai ko naam k thiyo?'],
                                         ['mero bhai suman ho.', 'ek chhoto kavita lekha.', 'mero bhai ko naam yaad chha?'],
                                         ['bhai: suman.', '5 + 9 kati?', 'padhai ma dhyan kasari dine?', 'bhai ko naam bhana ta']]),
    ('memory', 'text', (['pokhara'], []), [['ma pokhara ma kaam garchhu.', '5 + 7 kati?', 'ek kavita lekha.', 'ma kaha kaam garchhu?'],
                                           ['mero office pokhara ma chha.', 'dashain kahile parchha?', 'mero office kun sahar ma chha?'],
                                           ['i work in pokhara.', 'k chha khabar?', 'malai sutna gaaro hunchha, k garne?', 'ma kun sahar ma kaam garchhu?']]),
    ('memory', 'num', '3', [['mero meeting 2 baje chha.', 'haina, 3 baje sarnu paryo.', 'mero meeting kati baje ho?'],
                            ['meeting 2 baje rakheko thiye.', 'sorry galti, 3 baje ho.', 'aba meeting kati baje?'],
                            ['meeting at 2.', 'correction: it is at 3.', 'meeting time kati baje?']]),
    ('memory', 'num', '130', [['mero sanga 300 rupiya chha.', 'maile 120 kharcha gare.', 'feri 50 kharcha gare.', 'aba kati baki chha?'],
                              ['wallet ma 300 chha.', 'chiya ma 120 sakiyo.', 'ani 50 ko recharge gare.', 'kati baki?'],
                              ['i have 300.', 'spent 120.', 'spent 50 more.', 'how much left?']]),
    ('memory', 'num', '63', [['18 x 7 kati?', '27 + 36 kati?'], ['45 x 3 kati hunchha?', '27 ra 36 jod kati?'], ['99 - 12 kati?', 'aba 27 + 36?']]),
    ('memory', 'text', (['bhunte'], []), [['mero kukur ko naam bhunte ho.', 'malai english sikna man chha.', 'mero kukur ko naam k ho?'],
                                          ['hamro kukur bhunte.', 'aaja ko din kasto bityo?', 'kukur ko naam k raichha hamro?'],
                                          ['my dog is bhunte.', 'tell me a joke', 'what is my dog called?']]),
    # ---------------- noisy ----------------
    ('noisy', 'num', '100', ['25 x 4 kati hunxa?', '25 gunaa 4 kati', 'plz 25 times 4']),
    ('noisy', 'num', '150', ['1500 ko 10 percent kati', '1500 ko 10%', '10% of 1500 kati hola']),
    ('noisy', 'num', '63', ['100 baata 37 ghatau', '100-37 = ?', '100 minus 37 kati hola bro']),
    ('noisy', 'num', '12', ['ek dozen ma kati ota hunchha', '1 darjan = ? ota', 'dozen bhaneko kati ho']),
]


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').lower()).strip()


def reply_only(text):
    text = re.sub(r'<\|think\|>.*?(<\|/think\|>|$)', '', text, flags=re.S)
    return text.replace('<|end|>', '').strip()


def looped(t):
    w = t.split()
    return len(w) > 24 and len(set(w)) < len(w) * 0.35


def last_num(t):
    m = NUM.findall(t.replace(',', ''))
    return m[-1] if m else None


def num_eq(a, gold):
    if a is None:
        return False
    try:
        return abs(float(a.replace(':', '.')) - float(gold.replace(':', '.'))) < 1e-9
    except ValueError:
        return a == gold


def score(kind, spec, reply):
    r = norm(reply)
    if not r or looped(r):
        return False
    if kind == 'num':
        return num_eq(last_num(r), spec)
    if kind == 'text':
        want, bad = spec
        return any(w in r for w in want) and not any(b in r for b in bad)
    if kind == 'unknown':
        return any(c in r for c in UNKNOWN_CUES) and not re.search(r'\d', r)
    if kind == 'fmt:only_number':
        return re.sub(r'[\s.!।]', '', r) == spec
    if kind.startswith('fmt:words<='):
        n = int(kind.split('<=')[1])
        words = re.findall(r'[a-z0-9]+', r)
        return 0 < len(words) <= n and any(w in r for w in spec[0])
    if kind == 'fmt:list3':
        items = [x.strip() for x in r.strip(' .').split(',') if x.strip()]
        return len(items) >= 3 and len(r.split()) <= 15
    raise ValueError(kind)


def turns(variant):
    return variant if isinstance(variant, list) else [variant]


def run(model, tok, gen, max_new=440, only=None):
    from prepare import render_chat
    rows = []
    for gi, (cat, kind, spec, variants) in enumerate(G):
        if only is not None and gi not in only:
            continue
        for vi, v in enumerate(variants):
            msgs = []
            for t in turns(v):
                msgs.append({'role': 'user', 'content': t})
                ids, _ = render_chat(tok, msgs)
                out = reply_only(gen(model, ids[:-1] + [6], max_new))
                msgs.append({'role': 'nik', 'content': out})
            rows.append({'group': gi, 'cat': cat, 'kind': kind, 'variant': vi, 'prompt': turns(v)[-1], 'reply': out,
                         'ok': bool(score(kind, spec, out))})
    return rows


def summarize(rows):
    by_g = {}
    for r in rows:
        by_g.setdefault(r['group'], []).append(r)
    cats = {}
    for g, rs in by_g.items():
        c = rs[0]['cat']; d = cats.setdefault(c, [0, 0, 0, 0])
        d[0] += all(x['ok'] for x in rs); d[1] += 1; d[2] += sum(x['ok'] for x in rs); d[3] += len(rs)
    groups = sum(v[0] for v in cats.values()); n = sum(v[1] for v in cats.values())
    items = sum(v[2] for v in cats.values()); m = sum(v[3] for v in cats.values())
    return {'groups': f'{groups}/{n}', 'items': f'{items}/{m}', 'group_pct': round(100 * groups / n, 1),
            'by_cat': {c: f'{v[0]}/{v[1]} groups, {v[2]}/{v[3]} items' for c, v in cats.items()}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--out', default=None)
    ap.add_argument('--shard', default='0/1', help='i/n: run groups i, i+n, ... (merge the JSONs with --merge)')
    ap.add_argument('--merge', nargs='*', default=None)
    a = ap.parse_args()
    if a.merge:
        rows = [r for f in a.merge for r in json.load(open(f))['rows']]
        s = summarize(rows); print(json.dumps(s, indent=1)); print(f"NikBench-RW: {s['groups']} groups ({s['group_pct']}%), {s['items']} items")
        if a.out:
            json.dump({'summary': s, 'rows': rows}, open(a.out, 'w'), indent=1, ensure_ascii=False)
        return
    import torch
    from eval_understand import load_any
    from model import generate_ar
    from tokenizer import Tokenizer
    tok = Tokenizer.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web/model/tokenizer.json'))
    model = load_any(a.model).eval()

    from calc import Calc
    calc = Calc(tok)   # /chat default: "exact arithmetic" on, maxNew 440 (greedy here for reproducibility)

    def gen(m, ids, n):
        with torch.no_grad():
            return tok.decode(generate_ar(m, ids, n, temperature=0.0, calc=calc))
    i, n = map(int, a.shard.split('/'))
    rows = run(model, tok, gen, only={g for g in range(len(G)) if g % n == i})
    s = summarize(rows)
    for r in rows:
        if not r['ok']:
            print(f"[FAIL] {r['cat']:8s} g{r['group']:02d}v{r['variant']} {r['prompt'][:60]!r} -> {r['reply'][:90]!r}")
    print(json.dumps(s, indent=1))
    print(f"NikBench-RW: {s['groups']} groups ({s['group_pct']}%), {s['items']} items")
    if a.out:
        json.dump({'summary': s, 'rows': rows}, open(a.out, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
