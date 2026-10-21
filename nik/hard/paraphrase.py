"""Nik-Hard part 1: paraphrase consistency. Each item is ONE problem asked 5 different ways (hand-written, never used for
training). An item passes only if all 5 phrasings get the exact answer; the per-phrasing accuracy is also reported, so a
model that recites a template for one wording and fails the others is exposed.

    python nik/hard/paraphrase.py --model nik/web/model/nik-0.1.bin --out hard-para.json
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

# (family, [5 phrasings], gold) -- gold is a number (exact last number in the answer) or a word (must appear, alone-ish)
ITEMS = [
 ('math-sub', ['mero sanga 640 rupiya thiyo, 275 kharcha gare. kati bachyo?', 'malai 640 rupiya thiyo. 275 kharcha bhayo, aba kati chha?',
               '640 bata 275 ghataunda kati?', 'pocket ma 640 thiyo, 275 ko saman kine. baki kati?', 'How much is left if I had 640 rupees and spent 275?'], 365),
 ('math-mul', ['euta kopi 35 rupiya ko. 6 ota kopi ko kati?', '6 wata kopi kinda, ek ko 35, jamma kati?', '35 lai 6 le gunda kati?',
               'kopi ko mol 35 chha. 6 ota chahiyo bhane kati tirnu parchha?', 'One notebook costs 35. What do 6 cost?'], 210),
 ('math-2step', ['ma sanga 500 chha. 3 ota kalam kine, ek ko 40. kati baki?', '3 kalam (40 ko dar ma) kinepachhi 500 bata kati bachchha?',
                 '500 rupiya lagera 40 ko 3 ota kalam kine, baki paisa kati?', 'kalam 40 rupiya ko, 3 ota liye. 500 tire. kati firta aaucha?',
                 'I had 500 and bought 3 pens at 40 each. How much is left?'], 380),
 ('math-div', ['72 ota syau 8 jana bich barabar bandda ek jana le kati paunchha?', '8 jana lai 72 syau barabar bhag lagaunda kati kati?',
               '72 lai 8 le bhag gara', 'ek tokari ma 72 syau chha, 8 jana sathi. sabai le barabar line bhaye kati?', 'Share 72 apples equally among 8 people. How many each?'], 9),
 ('math-time', ['bus 9 baje chhutyo ra 4 ghanta lagyo. kati baje pugyo?', '9 baje hidera 4 ghanta yatra gare, pugda kati baje?',
                'yatra 4 ghanta ko, suru 9 baje. antya kati baje?', 'bihana 9 baje bata 4 ghanta pachhi kati baje hunchha?', 'A bus leaves at 9 and takes 4 hours. When does it arrive?'], 1),
 ('math-percent', ['400 ko 15 percent kati?', '400 rupiya ko 15% kati hunchha?', '15% of 400?', '400 ma 15 pratishat bhaneko kati?', 'What is 15 percent of 400?'], 60),
 ('read-who', ['"anil le mobile kinyo ra sunil le cycle." cycle kasle kinyo?', 'yo padha: "anil le mobile kinyo ra sunil le cycle." cycle kinne ko ho?',
               '"anil le mobile kinyo ra sunil le cycle." cycle kinne manchhe ko naam?', 'anil le mobile kinyo ra sunil le cycle. ani cycle chai kasle?',
               '"Anil bought a phone and Sunil bought a cycle." Who bought the cycle?'], 'sunil'),
 ('read-where', ['"maya butwal ma padhchhe tara usko ghar ilam ma chha." maya ko ghar kaha?', 'maya butwal ma padhchhe, ghar chai ilam. maya ko ghar kun thau?',
                 '"maya butwal ma padhchhe tara usko ghar ilam ma chha." ghar kata?', 'yo kura: maya ko padhai butwal, ghar ilam. ghar kaha chha?',
                 '"Maya studies in Butwal but her home is in Ilam." Where is her home?'], 'ilam'),
 ('read-count', ['"kitab 4, kapi 7 ra kalam 2 ota chha." kapi kati ota?', 'mero jhola ma kitab 4, kapi 7, kalam 2. kapi kati?',
                 '"kitab 4, kapi 7 ra kalam 2 ota chha." kapi ko sankhya?', 'kitab 4 ota, kapi 7 ota, kalam 2 ota. kati ota kapi?',
                 '"4 books, 7 notebooks and 2 pens." How many notebooks?'], 7),
 ('memory-correct', [['ma pokhara ma baschhu.', 'haina, galti bhayo, ma dharan ma baschhu.', 'ma kaha baschhu?'],
                     ['mero ghar pokhara ho.', 'sorry, mero ghar dharan ma chha.', 'mero ghar kaha?'],
                     ['ma pokhara ko hu.', 'ah haina, ma dharan ko hu.', 'ma kun thau ko hu?'],
                     ['pokhara ma baschhu ma.', 'sachyaunu: dharan ma baschhu.', 'aba bhana, ma kaha baschhu?'],
                     ['I live in Pokhara.', 'Sorry, I meant Dharan.', 'Where do I live?']], 'dharan'),
 ('logic-order', ['hari ram bhanda aglo, ram shyam bhanda aglo. sabai bhanda hocho ko?', 'ram shyam bhanda aglo ra hari ram bhanda aglo. sabai bhanda chhoto ko?',
                  'hari > ram > shyam (uchai ma). hocho ko?', 'uchai: hari ram bhanda badhi, ram shyam bhanda badhi. sabai bhanda kam ko?',
                  'Hari is taller than Ram, Ram is taller than Shyam. Who is shortest?'], 'shyam'),
 ('seq', ['3, 6, 12, 24, arko?', '3, 6, 12, 24 pachhi kun sankhya?', 'kram: 3, 6, 12, 24, ...', '3 6 12 24 ko arko number', 'Next number: 3, 6, 12, 24?'], 48),
]


def ask(model, tok, turns):
    msgs = []
    for t in (turns if isinstance(turns, list) else [turns]):
        msgs.append({'role': 'user', 'content': t})
        ids, _ = render_chat(tok, msgs)
        with torch.no_grad():
            g = generate_ar(model, ids[:-1] + [6], 220, temperature=0.0)
        out = tok.decode(g)
        ans = re.sub(r'<\|think\|>.*?(<\|/think\|>|$)', '', out, flags=re.S).replace('<|end|>', '').strip()
        msgs.append({'role': 'nik', 'content': ans})
    return ans


def ok(ans, gold):
    low = ans.lower()
    if isinstance(gold, int):
        nums = re.findall(r'-?\d+', low.replace(',', ''))
        return bool(nums) and int(nums[-1]) == gold
    return bool(re.search(r'(?<![a-z])' + re.escape(gold) + r'(?![a-z])', low))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--model', required=True); ap.add_argument('--out', default='')
    a = ap.parse_args()
    tok = Tokenizer.load(os.path.join(os.path.dirname(HERE), 'web', 'model', 'tokenizer.json'))
    model = load_any(a.model).eval()
    rows, items_ok, phr_ok, phr_n = [], 0, 0, 0
    for fam, phrasings, gold in ITEMS:
        res = [(p, ask(model, tok, p)) for p in phrasings]
        good = [ok(ans, gold) for _, ans in res]
        items_ok += all(good); phr_ok += sum(good); phr_n += len(good)
        rows.append({'family': fam, 'gold': gold, 'all5': all(good), 'n_ok': sum(good), 'answers': [{'q': p if isinstance(p, str) else p[-1], 'a': ans[:160], 'ok': g} for (p, ans), g in zip(res, good)]})
        print(f"[{'PASS' if all(good) else f'{sum(good)}/5 '}] {fam:15s} gold={gold!s:8s} " + ' | '.join(ans[:28] for _, ans in res))
    print(f'Nik-Hard paraphrase: items {items_ok}/{len(ITEMS)} (all 5 phrasings correct) | phrasings {phr_ok}/{phr_n}')
    if a.out:
        json.dump({'items_ok': items_ok, 'items': len(ITEMS), 'phrasings_ok': phr_ok, 'phrasings': phr_n, 'rows': rows}, open(a.out, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
