"""Download the human-written English sources for Nik's English skill (Claude, 2026-10-22).

  dolly   databricks/databricks-dolly-15k  (CC BY-SA 3.0, written by Databricks employees)
  oasst   OpenAssistant/oasst1 ready trees  (Apache-2.0, written and ranked by volunteers)
  wiki    wikimedia/wikipedia 20231101.simple (CC BY-SA, Simple English Wikipedia)

No LLM-generated datasets (project rule: no external teacher models).

    python nik/data/english/fetch.py --out data/english/raw
"""
import argparse
import os
import urllib.request

HF = 'https://huggingface.co/datasets'
SRC = {
    'dolly.jsonl': f'{HF}/databricks/databricks-dolly-15k/resolve/main/databricks-dolly-15k.jsonl',
    'oasst_trees.jsonl.gz': f'{HF}/OpenAssistant/oasst1/resolve/main/2023-04-12_oasst_ready.trees.jsonl.gz',
    'simplewiki.parquet': f'{HF}/wikimedia/wikipedia/resolve/main/20231101.simple/train-00000-of-00001.parquet',
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='data/english/raw')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for name, url in SRC.items():
        p = os.path.join(a.out, name)
        if os.path.exists(p) and os.path.getsize(p) > 0:
            print('have', p); continue
        print('downloading', url, flush=True)
        urllib.request.urlretrieve(url, p + '.part'); os.replace(p + '.part', p)
        print(name, os.path.getsize(p) // 1_000_000, 'MB')


if __name__ == '__main__':
    main()
