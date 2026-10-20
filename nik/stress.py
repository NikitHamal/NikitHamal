"""Stress test: 120 varied prompts (12 categories x 10), auto-checked where an answer is checkable.
Hand-written, phrased unlike any generator template; never used for training (keep it that way).

    python nik/stress.py --model nik/web/model/nik-0.1.bin --out stress-live.json
"""
import argparse, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402
from read_scoring import matches as read_matches  # noqa: E402

# (category, prompt or [turns], expected substrings (any-of groups: all groups must match; '|' = alternatives), None = manual)
P = [
 # greetings / smalltalk (manual relevance; auto: no think)
 ('chat', 'oi nik, kasto chha?', None), ('chat', 'namaskar hajur', None), ('chat', 'aaja ta ekdam garmi bhayo yaar', None),
 ('chat', 'ma bholi kathmandu jaadai chhu', ['kathmandu']), ('chat', 'maile aaja chowmein khaye', ['chowmein']),
 ('chat', 'tapai lai k man parchha?', None), ('chat', 'feri bhetaula hai', None), ('chat', 'aaja mero birthday ho!', ['birthday|janmadin|shubhakamana']),
 ('chat', 'malai ekdam bore lagyo', None), ('chat', 'hijo raati nidra lagena', ['nidra|sut']),
 # feelings / advice
 ('advice', 'exam aaudai chha, padhna man lagdaina', None), ('advice', 'mero sathi sanga jhagada bhayo, k garu?', None),
 ('advice', 'paisa kasari bachaune?', None), ('advice', 'coding sikna kaha bata suru garne?', None), ('advice', 'raati chhito sutna kasari sakinchha?', None),
 ('advice', 'ma ekdam eklo mahasus garchhu', None), ('advice', 'job interview ko tayari kasari garne?', None), ('advice', 'mobile kam chalauna k garne?', None),
 ('advice', 'english bolna dar lagchha', None), ('advice', 'aama buwa le bujhnu hunna', None),
 # arithmetic in words
 ('math', '348 + 275 kati?', ['623']), ('math', '1000 bata 457 ghatau', ['543']), ('math', '36 x 24 kati hunchha?', ['864']),
 ('math', '144 lai 12 le bhag gara', ['12']), ('math', '7 ko square kati?', ['49']), ('math', '2500 ko 8% kati?', ['200']),
 ('math', '15 + 27 + 38 jodnus', ['80']), ('math', '9 x 9 x 2?', ['162']), ('math', '1/2 + 1/4 kati?', ['3/4|0.75']), ('math', '5000 - 1234?', ['3766']),
 # word problems
 ('word', 'euta kalam 20 rupiya, 7 ota kalam ko kati?', ['140']), ('word', 'mero sanga 800 thiyo, 350 ko kitab kine. kati baki?', ['450']),
 ('word', '60 km/h ma 3 ghanta gaye kati km?', ['180']), ('word', '24 ota laddu 6 jana lai barabar, ek jana ko kati?', ['4']),
 ('word', 'ram 12 barsha, shyam ram bhanda 5 barsha jetho. shyam kati?', ['17']), ('word', '3 kilo aalu 40 rupiya kilo, 2 kilo pyaj 60 kilo. jamma?', ['240']),
 ('word', 'kaksha ma 40 jana, 15 keti. keta kati?', ['25']), ('word', 'euta shirt 1200, 25% discount. kati tirne?', ['900']),
 ('word', 'bihana 9 baje bata 5 ghanta kaam gare, kati baje sakiyo?', ['2 baje|14']), ('word', 'har din 30 rupiya bachaye 10 din ma kati?', ['300']),
 # reasoning
 ('reason', 'aaja bihibar, bholi parsi kun bar?', ['shanibar|sanibar']), ('reason', 'hari sita bhanda aglo, sita gita bhanda aglo. sabai bhanda hocho ko?', ['gita']),
 ('reason', '2, 4, 8, 16, arko?', ['32']), ('reason', '5, 10, 15, 20, arko k?', ['25']), ('reason', 'sabai chara udna sakchhan? penguin ni?', ['sakdaina|haina']),
 ('reason', 'yadi pani paryo bhane bato bhijchha. bato bhijeko chha. ke pani paryo nai ho?', ['pakka|hunasakchha|jaruri']),
 ('reason', 'euta hapta ma kati din hunchha ra 3 hapta ma?', ['21']), ('reason', 'kun thulo: 0.5 ki 0.45?', ['0.5']),
 ('reason', 'apple, banana, carrot, mango: kun farak?', ['carrot']), ('reason', 'ma sanga 3 bhai chhan, mero bahini ko kati dajubhai?', ['4']),
 # reading
 ('read', '"binod ko pasal butwal ma chha ra usko didi ko pasal pokhara ma." binod ko didi ko pasal kaha?', ['pokhara']),
 ('read', '"kamal le 4 ota kalam ra 3 ota kapi kinyo." kamal le kati kapi kinyo?', ['3']),
 ('read', '"sarita doctor hun, unka shriman pilot." sarita ko shriman k kaam garchhan?', ['pilot']),
 ('read', '"bus 8 baje aauchha bhaneko thiyo tara 9 baje aayo." bus kati dhilo aayo?', ['1 ghanta|ek ghanta']),
 ('read', '"nima lai momo man parchha tara chowmein man pardaina." nima lai chowmein man parchha?', ['haina|pardaina']),
 ('read', '"hamro gaun ma 3 ota dhara chhan, euta bigreko chha." kati dhara chaleko chha?', ['2']),
 ('read', '"rajan sombar dekhi sukrabar office janchha." rajan sanibar office janchha?', ['haina|jaadaina|janna']),
 ('read', '"meena le aaja 5 km hidin, hijo 3 km." dui din ma jamma kati?', ['8']),
 ('read', '"ganesh ko kukur ko naam moti ho." ganesh ko biralo ko naam k ho?', ['chhaina|thaha|bhaneko']),
 ('read', '"ilam ma chiya kheti dherai hunchha." ilam kun kheti ko lagi prasiddha?', ['chiya']),
 # memory multi-turn
 ('memory', ['mero naam prabin ho, ma jhapa bata.', 'ma kun jilla bata hu?'], ['jhapa']),
 ('memory', ['malai cricket man parchha.', 'ani mero bhai lai football.', 'mero bhai lai k man parchha?'], ['football']),
 ('memory', ['ma 2 barsha agadi pokhara sareko.', 'pahila ma dang ma basthe.', 'ma aile kaha baschhu?'], ['pokhara']),
 ('memory', ['mero didi doctor, dai engineer.', 'dai k garchha?'], ['engineer']),
 ('memory', ['mero naam sunita.', 'haina, mero naam sunil ho, galti bhayo.', 'mero naam k ho?'], ['sunil']),
 ('memory', ['ma sanga 2 ota biralo chhan.', 'ani 1 kukur.', 'jamma kati pet?'], ['3']),
 ('memory', ['bholi ma 7 baje uthnu chha.', 'ma kati baje uthnu chha bhaneko?'], ['7']),
 ('memory', ['mero favourite rang rato ho.', 'mero favourite rang k?'], ['rato']),
 ('memory', ['ma bank ma kaam garchhu.', 'ma kaha kaam garchhu?'], ['bank']),
 ('memory', ['mero aama ko naam laxmi ho.', 'mero buwa ko naam k ho?'], ['chhaina|thaha|bhannubhayeko']),
 # translation / language
 ('lang', '"I am going to school" nepali ma?', ['school', 'jadai|janchhu']), ('lang', '"ma pani khanchhu" english ma?', ['eat|drink|water']),
 ('lang', '"book" lai nepali ma k bhanchha?', ['kitab|pustak']), ('lang', '"they are playing" nepali ma', ['kheldai']),
 ('lang', '"usle chithi lekhyo" english?', ['wrote', 'letter']), ('lang', '"ghar" ko english?', ['house|home']),
 ('lang', '"ma thakeko chhu" english ma bhana', ['tired']), ('lang', '"beautiful" lai nepali ma?', ['ramro|sundar|rāmro']),
 ('lang', '"hami bhat khadai chhau" english?', ['eating', 'rice']), ('lang', '"thank you" nepali ma?', ['dhanyabad']),
 # grammar
 ('grammar', '"ma school janchhu" lai negative banau', ['jaadina|jandina|janna|jaanna']), ('grammar', '"pen" ko plural nepali ma?', ['penharu']),
 ('grammar', '"mouse" ko plural?', ['mice']), ('grammar', '"teeth" ko singular?', ['tooth']), ('grammar', 'correct: "she go to school"', ['goes']),
 ('grammar', '"ma khana khadai chhu" lai past ma', ['khaye']), ('grammar', '"keta" ko plural?', ['ketaharu']), ('grammar', '"went" ko present form?', ['go']),
 ('grammar', '"u ramro chha" negative', ['chhaina']), ('grammar', 'correct this: "they is happy"', ['are']),
 # knowledge
 ('know', 'nepal ko rajdhani?', ['kathmandu']), ('know', 'sagarmatha ko uchai?', ['8848']), ('know', 'buddha kaha janmeka?', ['lumbini']),
 ('know', 'nepal ma kati pradesh?', ['7']), ('know', 'dashain kun mahina tira parchha?', ['asoj|ashwin|kartik|october']),
 ('know', 'pani ko formula?', ['h2o']), ('know', 'surya bata prithvi samma prakash aauna kati samaya?', ['8 minet|8 min']),
 ('know', 'nepal ko rashtriya phool?', ['gurans']), ('know', 'pokhara ko prasiddha tal?', ['phewa|fewa']), ('know', 'ek barsha ma kati mahina?', ['12']),
 # persona / honesty
 ('persona', 'timi lai kasle banako?', ['nikit']), ('persona', 'nikit le k k project banaunu bhayo?', ['lami|nebians|astroweb|consica']),
 ('persona', 'timi chatgpt hau?', ['haina|nik']), ('persona', 'timi kati thulo model hau?', ['mb|parameter|sano']),
 ('persona', 'aaja ko news k chha?', ['thaha|sakdina|offline|chhaina']), ('persona', 'mero naam k ho?', ['thaha|bhannubhayeko|chhaina']),
 ('persona', 'timi internet chalauna sakchhau?', ['sakdina|offline|haina']), ('persona', 'bholi pani parchha?', ['thaha|sakdina|bhanna']),
 ('persona', 'timi kun bhasa bolchhau?', ['nepali']), ('persona', 'nikit kaha basnuhunchha?', None),
 # writing
 ('write', 'pokhara ko barema 3 line lekha', ['pokhara']), ('write', 'aama ko lagi euta sano kabita', ['aama']), ('write', 'tihar ko shubhakamana message lekha', ['tihar']),
 ('write', 'school bida ko lagi nibedan lekha', ['bida|chhutti']), ('write', 'euta chhoto kahani: kukur ra biralo', ['kukur', 'biralo']),
 ('write', 'momo ko barema 2 line', ['momo']), ('write', 'sathi lai birthday wish', ['birthday|janmadin']), ('write', 'himal ko barema euta haiku', ['himal']),
 ('write', 'english ma 1 sentence about Nepal', ['nepal']), ('write', 'dashain ko barema chhoto nibandha', ['dashain']),
]


def looped(t):
    w = t.split()
    grams = [' '.join(w[i:i + 3]) for i in range(max(0, len(w) - 2))]
    return bool(grams) and max(grams.count(g) for g in set(grams)) >= 4


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--calc', action='store_true', help='verified arithmetic decoding (calc.py)')
    ap.add_argument('--out', default=None)
    ap.add_argument('--max-new', type=int, default=200)
    ap.add_argument('--category', choices=sorted({cat for cat, _, _ in P}), help='run one category without changing its prompts')
    a = ap.parse_args()
    tok = Tokenizer.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web/model/tokenizer.json'))
    from calc import Calc
    calc = Calc(tok) if a.calc else None
    model = load_any(a.model).eval()
    rows, score, scored, by = [], 0, 0, {}
    for cat, prompt, want in P:
        if a.category and cat != a.category:
            continue
        turns = prompt if isinstance(prompt, list) else [prompt]
        msgs, out = [], ''
        for t in turns:                                      # earlier turns are answered by the model itself
            msgs.append({'role': 'user', 'content': t})
            ids, _ = render_chat(tok, msgs)
            with torch.no_grad():
                g = generate_ar(model, ids[:-1] + [6], a.max_new, temperature=0.0, calc=calc)
            out = tok.decode(g)
            th = re.search(r'<\|think\|>(.*?)<\|/think\|>', out, re.S)
            ans = re.sub(r'<\|think\|>.*?(<\|/think\|>|$)', '', out, flags=re.S).replace('<|end|>', '').strip()
            msgs.append({'role': 'nik', 'content': ans, **({'think': th.group(1)} if th else {})})
        low = ans.lower()
        flags = []
        if looped(out): flags.append('loop')
        if cat in ('chat', 'advice', 'write') and '<|think|>' in out: flags.append('think-on-chat')
        if len(ans) < 2: flags.append('empty')
        ok = None
        if want is not None:
            matched = read_matches(ans, want) if cat == 'read' else all(any(alt in low for alt in grp.split('|')) for grp in want)
            ok = matched and not flags
            scored += 1; score += ok
            by.setdefault(cat, [0, 0]); by[cat][0] += ok; by[cat][1] += 1
        rows.append({'cat': cat, 'prompt': turns, 'answer': ans, 'think': th.group(1) if th else '', 'ok': ok, 'flags': flags})
        print(f"[{'PASS' if ok else 'fail' if ok is False else ' -- '}] {cat:8s} {turns[-1][:60]!r} -> {ans[:150]!r} {flags or ''}", flush=True)
    print('by category:', {k: f'{o}/{t}' for k, (o, t) in by.items()})
    print(f'stress: {score}/{scored} auto-checked pass | flags: {sum(bool(r["flags"]) for r in rows)} of {len(rows)}')
    if a.out:
        json.dump({'score': score, 'of': scored, 'by_cat': by, 'rows': rows}, open(a.out, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
