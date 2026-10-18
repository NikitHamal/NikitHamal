#!/usr/bin/env python3
"""Subset Remix Icon to the ri-* classes this site actually uses -> css/remixicon.css + assets/fonts/remixicon-subset.woff2
(~3 KB instead of the 145 KB full font from the CDN).
Needs: pip install fonttools brotli.   Run after using a new icon:   python3 tools/remixicon-subset.py"""
import os, re, subprocess, tempfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CDN = 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/'
SKIP = {'node_modules', '.git', '_preview', 'showreel'}


def used_classes():
    found = set()
    for p in ROOT.rglob('*'):
        if p.suffix in ('.html', '.js', '.css') and not SKIP & set(p.relative_to(ROOT).parts) and p.name != 'remixicon.css':
            found |= set(re.findall(r'ri-[a-z0-9-]+', p.read_text(errors='ignore')))
    return found


def main():
    tmp = Path(tempfile.mkdtemp())
    for f in ('remixicon.css', 'remixicon.woff2'):
        urllib.request.urlretrieve(CDN + f, tmp / f)
    rules = dict(re.findall(r'\.(ri-[a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-f]+)";', (tmp / 'remixicon.css').read_text()))
    used = used_classes()
    icons = {k: v for k, v in rules.items() if k in used}
    (ROOT / 'assets/fonts').mkdir(parents=True, exist_ok=True)
    subprocess.run(['pyftsubset', str(tmp / 'remixicon.woff2'), '--unicodes=' + ','.join('U+' + v for v in icons.values()),
                    '--flavor=woff2', '--no-hinting', '--desubroutinize',
                    '--output-file=' + str(ROOT / 'assets/fonts/remixicon-subset.woff2')], check=True)
    css = ('/* Remix Icon v3.5.0 (Apache-2.0, remixicon.com), subset to the icons this site uses.\n'
           '   Rebuild after adding an icon: python3 tools/remixicon-subset.py */\n'
           '@font-face{font-family:"remixicon";src:url("../assets/fonts/remixicon-subset.woff2") format("woff2");font-display:block}\n'
           '[class^="ri-"],[class*=" ri-"]{font-family:"remixicon"!important;font-style:normal;'
           '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}\n')
    css += ''.join(f'.{k}:before{{content:"\\{v}"}}\n' for k, v in sorted(icons.items()))
    if 'ri-spin' in used:
        css += '.ri-spin{animation:ri-spin 1s linear infinite}@keyframes ri-spin{to{transform:rotate(360deg)}}\n'
    (ROOT / 'css/remixicon.css').write_text(css)
    missing = sorted(used - set(icons) - {'ri-spin'})
    print(f'{len(icons)} icons -> css/remixicon.css' + (f'  (unknown: {missing})' if missing else ''))


if __name__ == '__main__':
    main()
