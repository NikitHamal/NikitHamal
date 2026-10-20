"""Conservative read-subset scoring: require an actual answer, not a stray digit.

Kept separate from generation and training. This remains a lexical screen;
manual review is needed for contradictions and grammatical paraphrases.
"""
import re


def matches(answer, expected):
    low = answer.lower().strip()
    for group in expected:
        found = False
        for alternative in group.split('|'):
            if not re.fullmatch(r'\d+', alternative):
                found |= bool(re.search(r'(?<!\w)' + re.escape(alternative) + r'(?!\w)', low))
                continue
            # An extractive count answer cannot also claim other numerical values
            # or hide the target inside a fraction or decimal.
            numbers = re.findall(r'(?<!\w)[+-]?\d+(?:[./]\d+)*(?!\w)', low)
            found |= bool(numbers) and all(n == alternative for n in numbers)
        if not found:
            return False
    return True
