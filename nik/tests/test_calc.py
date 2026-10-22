"""Exact-pencil regressions (calc.py mirrors web/nik.js calcForce; JS tests: web/test_calc.mjs)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from calc import correct, evaluate  # noqa: E402


def fixed(t):
    return correct(t)[0]


def test_plain():
    assert fixed('347 + 285 = 631 ho.') == '347 + 285 = 632 ho.'
    assert fixed('3 x 4 = 12, 12 + 1 = 14, bas') == '3 x 4 = 12, 12 + 1 = 13, bas'
    assert fixed('7 / 2 = 3 ho.') == '7 / 2 = 3 ho.'            # inexact division left to the model


def test_grouped_numbers():
    assert fixed('1,200 + 300 = 1,500 ho.') == '1,200 + 300 = 1,500 ho.'   # used to become 500
    assert fixed('1,200 + 300 = 500 ho.') == '1,200 + 300 = 1500 ho.'
    assert fixed('2,50,000 + 50,000 = 3,00,000 ho.') == '2,50,000 + 50,000 = 3,00,000 ho.'
    assert evaluate('1,000,000 - 1') == '999999'


def test_signs_and_times():
    assert fixed('-5 + 3 = 8 ho.') == '-5 + 3 = -2 ho.'
    assert fixed('0 - 5 = 5. ok') == '0 - 5 = -5. ok'
    assert fixed('10 - 3 - 2 = 6. ok') == '10 - 3 - 2 = 5. ok'
    assert fixed('samaya 2:30 + 1 = 3:30 ho.') == 'samaya 2:30 + 1 = 3:30 ho.'
