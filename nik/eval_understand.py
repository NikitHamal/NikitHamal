"""Does Nik read the message? Hand-written probes phrased unlike any training template.
Each probe passes if all expected words appear in the answer (lowercased).

    python nik/eval_understand.py --model nik/web/model/nik-0.1.bin
"""
import argparse, json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
import torch  # noqa: E402
from export import load_exported  # noqa: E402
from model import NikConfig, NikLM, generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

U = lambda t: {'role': 'user', 'content': t}  # noqa: E731
N = lambda t: {'role': 'nik', 'content': t}   # noqa: E731
PROBES = [
    ('memory', [U('hi, ma rojina. dharan bata.'), N('namaste rojina! dharan ramro thau ho.'), U('ma kun thau bata hu?')], ['dharan']),
    ('memory', [U('mero bhai ko naam suraj ho ra u 12 barsha ko chha.'), U('bhai kati barsha ko bhayo?')], ['12']),
    ('memory', [U('malai momo bhanda chiya dherai man parchha.'), N('chiya mitho hunchha!'), U('maile kun kura dherai man parchha bhaneko?')], ['chiya']),
    ('memory', [U('ma pahila butwal basthe, aile lalitpur ma baschhu.'), U('ma aile kaha baschhu?')], ['lalitpur']),
    ('honest', [U('mero naam binod ho. mero buwa ko naam k ho?')], ['chhaina']),
    ('reading', [U('"gopal le bazaar bata 3 kilo aalu ra 2 kilo pyaj kinyo." gopal le kati kilo pyaj kinyo?')], ['2']),
    ('reading', [U('"sunita doctor ho ra uski bahini engineer." sunita ko bahini k kaam garchhe?')], ['engineer']),
    ('yesno', [U('"ram ghar gayo tara shyam school mai basyo." ke shyam ghar gayo?')], ['hoina']),
    ('translate', [U('"we are reading" nepali ma bhana.')], ['padhdai', 'chhau']),
    ('translate', [U('"ma khana khadai chhu" english ma k ho?')], ['eating']),
    ('vocab', [U('"river" lai nepali ma k bhanchha?')], ['nadi']),
    ('grammar', [U('"u kheldai chha" lai negative banau.')], ['chhaina']),
    ('grammar', [U('"kalam" ko plural?')], ['kalamharu']),
    ('en-grammar', [U('"children" ko singular k ho?')], ['child']),
    ('en-grammar', [U('correct this: "he go to market."')], ['goes']),
    ('english', [U('Asha had 12 balloons and 5 flew away. How many does she have now?')], ['7']),
    ('english', [U('What is the capital of Nepal? answer in english.')], ['kathmandu']),
    ('list', [U('7, 42, 19, 3 madhye sabai bhanda sano kun?')], ['3']),
    ('list', [U('5, 9, 2 lai thulo bata sano kram ma lekha.')], ['9, 5, 2']),
    ('textop', [U('"nepal" ulto lekha.')], ['lapen']),
    ('textop', [U('"kathmandu" ma kati akshar chha?')], ['9']),
    ('math', [U('euta kitab 250 rupiya ko chha. 4 wata kitab ko kati parchha?')], ['1000']),
    ('math', [U('mero sanga 500 rupiya thiyo. 180 kharcha bhayo. kati baki?')], ['320']),
    ('math', [U('15 ko 20 percent kati?')], ['3']),
    ('context', [U('kaksha ma 14 keta ra 17 keti chhan. keti kati le badhi chhan?')], ['3']),
    ('empathy', [U('aaja mero exam naramro bhayo, ekdam dukhi chhu.')], []),
    ('persona', [U('timi lai kasle banako ho?')], ['nikit']),
]


def answer(model, tok, msgs, max_new=160):
    ids, _ = render_chat(tok, msgs + [N('x')])
    # drop the dummy reply: keep everything up to the last <|nik|>
    cut = len(ids) - 1 - ids[::-1].index(6)
    out = generate_ar(model, ids[:cut + 1], max_new, temperature=0.0)
    return tok.decode(out).split('<|/think|>')[-1].replace('<|end|>', '').strip()


def load_any(path):
    if path.endswith('.bin'):
        m = load_exported(path)
    else:
        ck = torch.load(path, map_location='cpu', weights_only=False)
        m = NikLM(NikConfig(**ck['cfg'])); m.load_state_dict(ck['model']); m.eval()
    return m.to('cuda' if torch.cuda.is_available() else 'cpu')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(a.tok)
    model = load_any(a.model)
    rows, ok = [], 0
    for kind, msgs, want in PROBES:
        ans = answer(model, tok, msgs)
        good = all(re.search(r'(?<![\w])' + re.escape(w) + r'(?![\w])', ans.lower()) for w in want) if want else None
        ok += bool(good)
        rows.append({'kind': kind, 'q': msgs[-1]['content'], 'a': ans, 'pass': good})
        print(f'[{"PASS" if good else ("----" if good is None else "FAIL")}] {kind:10s} {msgs[-1]["content"][:60]!r} -> {ans[:110]!r}', flush=True)
    scored = sum(1 for _, _, w in PROBES if w)
    print(f'understanding: {ok}/{scored}')
    if a.out:
        json.dump({'score': ok, 'of': scored, 'rows': rows}, open(a.out, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
