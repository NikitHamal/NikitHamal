"""Necessary grounding checks for generated reading rows (not semantic proof).

Run: python nik/data/teacher/grounding.py --samples 100000 --out audit.json
Checks input support, never assistant replies; unsupported categories are reported
as skipped. Comparisons are derived answers, so their gold need not occur verbatim.
"""
import argparse
import collections
import json
import random
import re

import lexicon as L


def contains(text, value):
    return bool(re.search(r'(?<!\w)' + re.escape(str(value).lower()) + r'(?!\w)', text.lower()))


def check(example):
    kind = example.get('kind', example.get('cat', ''))
    messages = example['messages']
    errors = []
    context = []
    for i, message in enumerate(messages):
        if message['role'] == 'user':
            context.append(message['content'])
            continue
        source = '\n'.join(context)
        think = message.get('think', '')
        # Only literal evidence markers: story_qa's "katha ma hernu" is an
        # answer paraphrase, not a quotation, and must not be treated as one.
        if kind.startswith('read-'):
            quotes = re.findall(r'"([^"\n]+)"', think)
            if kind == 'read-compare' and len(quotes) != 2:
                errors.append(f'turn {i}: comparison needs two evidence quotes')
            for quote in quotes:
                if quote.lower() not in source.lower():
                    errors.append(f'turn {i}: evidence quote absent from user context')
        if i == len(messages) - 1 and kind in {
            'read-lookup', 'read-memory', 'read-english', 'memory',
            'understand-memory', 'memory-long', 'understand-memory-long',
            'english-read', 'understand-english-read', 'reading', 'understand-reading',
        }:
            # Summary gold can be an inflected label ('bahini' for 'sibling'),
            # so it is not an extractive target. Do not pretend to validate it.
            summary = (messages[i-1]['content'] == 'ahile samma mero barema timi lai k k thaha chha?'
                       or 'katha ko sikai k ho?' in messages[i-1]['content'])
            if not summary and example.get('gold') is not None and not contains(source, example['gold']):
                errors.append(f'turn {i}: gold absent from user context')
        if kind == 'read-memory' and 'kun bar' in messages[i-1]['content']:
            for day in L.DAYS:
                if contains(message['content'], day) and not contains(source, day):
                    errors.append(f'turn {i}: weekday answer absent from user context')
        if kind == 'read-unknown':
            # read.not_mentioned asks about one of these five attributes.
            # Test the rendered factual sentences, excluding the trailing question.
            prompt = context[-1]
            name_match = re.search(r'passage ma (\w+) ko', think)
            if name_match:
                name = name_match[1]
                question = prompt.rsplit('?', 1)[0].rsplit('.', 1)[-1]
                passage = prompt[:len(prompt) - len(question) - (1 if prompt.endswith('?') else 0)]
                sentences = re.split(r'[.\n]', passage)
                patterns = {
                    'umer': r'\b(?:umer|barsha|pugyo|pugin)\b',
                    'ruchi': r'\b(?:ruchi|shokh)\b|' + '|'.join(map(re.escape, L.HOBBIES)),
                    'man parne khana': r'\b(?:khana|mitho)\b|man parchha',
                    'thau': '|'.join(map(re.escape, L.PLACES)),
                    'kaam': '|'.join(map(re.escape, L.JOBS)),
                }
                for attribute, pattern in patterns.items():
                    if f'ko {attribute} khojchhu' in think:
                        def stated(sentence):
                            if not contains(sentence, name):
                                return False
                            if attribute == 'man parne khana':
                                return bool(re.search(pattern, sentence)) and any(contains(sentence, food) for food in L.FOODS)
                            return bool(re.search(r'(?<!\w)(?:' + pattern + r')(?!\w)', sentence))
                        if any(stated(sentence) for sentence in sentences):
                            errors.append(f'turn {i}: unknown attribute appears stated')
    return sorted(set(errors))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--samples', type=int, default=10000)
    ap.add_argument('--seed', type=int, default=821)
    ap.add_argument('--out')
    a = ap.parse_args()
    import read
    import understand
    import understand2
    report = {}
    extractive = {'read-lookup', 'read-memory', 'read-english', 'memory', 'memory-long', 'english-read', 'reading'}
    for module in (read, understand, understand2):
        rng = random.Random(a.seed)
        failures, kinds, coverage, examples = collections.Counter(), collections.Counter(), collections.Counter(), []
        for _ in range(a.samples):
            row = module.sample(rng)
            kinds[row['kind']] += 1
            coverage['checked' if row['kind'].startswith('read-') or row['kind'] in extractive else 'skipped'] += 1
            errors = check(row)
            if errors:
                failures[row['kind']] += 1
                if len(examples) < 5:
                    examples.append(dict(row=row, errors=errors))
        report[module.__name__] = dict(samples=a.samples, coverage=dict(coverage), by_kind=dict(kinds), failures=dict(failures), examples=examples)
    print(json.dumps(report, indent=2))
    if a.out:
        with open(a.out, 'w') as f:
            json.dump(report, f, indent=2)
    return int(any(r['failures'] for r in report.values()))


if __name__ == '__main__':
    raise SystemExit(main())
