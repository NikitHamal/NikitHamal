"""Every python file in the repo must parse, and every shell script must be LF.

Local-C, 2026-10-21.  The box could not import `nik/data/teacher/frame.py` ("unterminated
string literal") and the local test suite did not notice, because the local run used the
stale __pycache__ from before the file was broken.  A file that only breaks on the box
is a file that breaks the arms, so the check lives in the test suite now:

  * every .py under nik/ must parse (ast.parse, no import, no side effects)
  * every .sh must have LF line endings (the box's bash dies on CRLF)
  * no file may start with a UTF-8 BOM (Python on Linux rejects it)

    python -m unittest discover -s nik/tests -v
"""
import ast
import os
import unittest

NIK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(NIK)


def walk(ext):
    out = []
    for base, dirs, files in os.walk(os.path.join(NIK)):
        dirs[:] = [d for d in dirs if d not in ('__pycache__', 'node_modules', 'runs')]
        for f in files:
            if f.endswith(ext):
                out.append(os.path.join(base, f))
    return sorted(out)


class TestTreeIsLoadable(unittest.TestCase):
    def test_every_python_file_parses(self):
        bad = []
        for p in walk('.py'):
            src = open(p, 'rb').read()
            if src.startswith(b'\xef\xbb\xbf'):
                bad.append((os.path.relpath(p, ROOT), 'starts with a UTF-8 BOM'))
                continue
            try:
                ast.parse(src.decode('utf8'), p)
            except SyntaxError as e:
                bad.append((os.path.relpath(p, ROOT), f'line {e.lineno}: {e.msg}'))
        self.assertEqual(bad, [], f'python files that do not parse: {bad}')

    def test_shell_scripts_are_lf(self):
        bad = [os.path.relpath(p, ROOT) for p in walk('.sh') if b'\r\n' in open(p, 'rb').read()]
        self.assertEqual(bad, [], f'shell scripts with CRLF (the box bash dies on them): {bad}')


if __name__ == '__main__':
    unittest.main()
