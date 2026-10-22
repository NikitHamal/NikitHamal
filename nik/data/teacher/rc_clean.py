"""reading_contrast.py rows without numbers, for add_rows.py (Claude, 2026-10-22).

The k5 family loses the same trap items (third-person "nikit" -> the Nik biography) and the same bench_reading pairs
(who gave / who got; "gayo tara ... gayena") in every seed. reading_contrast.py teaches exactly those contrasts, but
28% of its rows put digits in the question and answer with no think (`70 km/h ma 3 ghanta` -> `210 km.`), the
"arithmetic -> bare answer" lesson removed from the mix on 2026-10-22. Only rows with no digit in any user turn are kept.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reading_contrast  # noqa: E402

DIGIT = re.compile(r'\d')


def sample(R):
    while True:
        r = reading_contrast.sample(R)
        if not any(m['role'] == 'user' and DIGIT.search(m['content']) for m in r['messages']):
            return r
