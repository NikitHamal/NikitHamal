#!/usr/bin/env python3
"""Build posts/summary.json: the lightweight list the homepage preview, /writings and read pages load
(slug, title, date, category, excerpt, reading minutes) instead of fetching every full post.
Run after adding or editing anything in posts/:   python3 tools/posts-summary.py"""
import html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / 'posts'


def text_of(markup):
    t = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', markup or '', flags=re.S | re.I)
    return html.unescape(re.sub(r'<[^>]+>', ' ', t))


def main():
    out = []
    for slug in json.loads((POSTS / 'index.json').read_text())['posts']:
        p = json.loads((POSTS / f'{slug}.json').read_text())
        words = len(text_of(p.get('contentHtml')).split())
        excerpt = p.get('excerpt') or ' '.join(text_of(p.get('contentHtml')).split())[:140] + '...'
        out.append({k: v for k, v in {
            'slug': p.get('slug', slug), 'title': p.get('title'), 'date': p.get('date'),
            'category': p.get('category'), 'featured': p.get('featured'), 'image': p.get('image'),
            'excerpt': excerpt, 'mins': max(1, round(words / 220)),
        }.items() if v is not None})
    out.sort(key=lambda p: p.get('date') or '', reverse=True)
    (POSTS / 'summary.json').write_text(json.dumps({'posts': out}, ensure_ascii=False, separators=(',', ':')))
    print(f'posts/summary.json: {len(out)} posts')


if __name__ == '__main__':
    main()
