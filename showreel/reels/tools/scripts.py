#!/usr/bin/env python3
"""Reel scripts for every post, written compactly and timed automatically onto the 100 BPM grid (beat = 36 frames @ 60 fps).
Each reel: 1404 frames of beats + the 216-frame end card (27 s). Run from showreel/reels:  python3 tools/scripts.py
It merges into reels.json (hand-tuned reels already there are kept unless a script below replaces them)."""
import json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def ln(t, size=84, f='serif', c='ink', y=0.0, at=None, step=None, rate=None):
    L = {'t': t, 'size': size, 'f': f, 'c': c, 'y': y}
    if at is not None: L['at'] = at
    if step is not None: L['step'] = step
    if rate is not None: L['rate'] = rate
    return L

def blk(dur, mode, kind, lines=(), **extra):
    return {'dur': dur, 'mode': mode, 'kind': kind, 'lines': list(lines), **extra}

def timed(b):
    """word timing: lines land one after another; steps shrink if a block is crowded"""
    dur, cur = b['dur'], 6
    free = [L for L in b['lines'] if 'at' not in L]
    words = sum(len(L['t'].split()) for L in free) or 1
    budget = max(40, dur - 70 - 16 * len(free))
    base = max(5, min(12, budget // words))
    for L in b['lines']:
        n = len(L['t'].split())
        if 'step' not in L: L['step'] = base if L['size'] < 110 else min(18, base + 6)
        if 'at' not in L: L['at'] = cur
        cur = L['at'] + n * L['step'] + 16
    return b

def reel(title, cat, date, key, ghost, beats, scene=None):
    out, f = [], 0
    for b in beats:
        b = dict(b); b['lines'] = [dict(L) for L in b['lines']]
        if b['kind'] == 'scene':     # lines beside the pixel window read larger
            for L in b['lines']: L['size'] = round(L['size'] * 1.3)
        if b['kind'] == 'type':
            for L in b['lines']: L['size'] = round(L['size'] * 1.18); L['y'] = round(L['y'] * 1.12, 2)
        b = timed(b); d = b.pop('dur'); b['from'], b['to'] = f, f + d; f += d
        out.append({k: b[k] for k in ['from', 'to', 'mode', 'kind'] if k in b} | {k: v for k, v in b.items() if k not in ('from', 'to', 'mode', 'kind')})
    assert f == 1404, (title, f)
    r = {'title': title, 'cat': cat, 'date': date, 'key': key, 'ghost': ghost, 'beats': out}
    if scene: r['scene'] = scene
    return r

S = {}

# ---------------------------------------------------------------- reflections & poems (short posts)
S['take-me-as-i-am'] = reel('Take me as I am', 'A reflection', 'February 27, 2025', 52, 'WHOLE', [
    blk(216, 'dark', 'impact', [ln('Take me as I am,', 150, 'serif', 'paper', -0.55, 4, 14), ln('whatever I may be.', 96, 'serifI', 'pink', 0.6, 70, 10)]),
    blk(216, 'light', 'impact', [ln('You may go on comparing,', 76, y=-1.6), ln('inventing infinite ideals,', 76, y=-0.6), ln('but the fact remains', 76, 'serifI', 'pink', 0.6), ln('as it is.', 92, 'serifI', 'pink', 1.6)]),
    blk(216, 'light', 'scene', [ln('Accept not only light,', 64), ln('but all of my darkness,', 64), ln('because I am both.', 72, 'serifI', 'pink')]),
    blk(216, 'dark', 'impact', [ln('Without darkness,', 96, 'serif', 'paper', -1.1), ln('light cannot be visible.', 84, 'serif', 'paper', 0), ln('Without light, darkness cannot be.', 72, 'serifI', 'pink', 1.2)]),
    blk(252, 'light', 'strike', [ln('What you meet is my body,', 84, y=-1.25, step=6), ln('or a part of me,', 92, y=0, step=6), ln('an idea of me.', 100, 'serifI', y=1.25, step=6)], strikes=[150, 172, 194]),
    blk(288, 'light', 'zoom', [ln('All your relationships are with your own ideas;', 60, 'serif', 'ink2', -1.9, 6, 7), ln('you are in relationship only with', 76, 'serif', 'ink', -0.8, 80, 8)], word='yourself.', wy=0.8, zat=150),
])
S['effort-clouds-effortless'] = reel('Effort clouds effortless', 'A reflection', 'February 27, 2025', 49, 'MAYA', [
    blk(216, 'dark', 'impact', [ln('Effort clouds', 150, 'serif', 'paper', -0.55, 4, 16), ln('effortless.', 110, 'serifI', 'pink', 0.6, 64, 14)]),
    blk(288, 'light', 'couplets', [], pairs=[['Focus clouds', 'attention.'], ['Choice clouds', 'choice-less.'], ['Known clouds', 'unknown.']]),
    blk(216, 'dark', 'impact', [ln('How can the hands of a dream', 84, 'serif', 'paper', -1.1), ln('reach the pillow', 84, 'serif', 'paper', 0), ln('of the real world?', 96, 'serifI', 'pink', 1.15)]),
    blk(216, 'light', 'scene', [ln('The known', 76), ln('cannot touch', 76), ln('the unknown.', 84, 'serifI', 'pink')]),
    blk(216, 'light', 'wind', [ln('Doer. Planner. Thinker.', 96, y=-0.6, at=6, step=12), ln('Observer.', 110, 'serifI', 'pink', 0.7, 60, 12)], blow=120),
    blk(252, 'light', 'impact', [ln('It is always', 110, y=-0.65, at=8, step=16), ln('already there.', 110, 'serifI', 'pink', 0.65, 60, 16)]),
])
S['there-is-only-one-step'] = reel('There is only one step', 'A reflection', 'December 15, 2024', 55, 'WAKE', [
    blk(216, 'dark', 'impact', [ln('There is only', 150, 'serif', 'paper', -0.55, 4, 16), ln('one step.', 120, 'serifI', 'pink', 0.6, 70, 16)]),
    blk(216, 'light', 'strike', [ln('No gradual process.', 100, y=-1.25, step=5), ln('No ladders.', 110, y=0, step=5), ln('No path.', 110, y=1.25, step=5)], strikes=[120, 140, 160]),
    blk(216, 'dark', 'impact', [ln('Just wake up,', 130, 'serif', 'paper', -0.55, 6, 14), ln('and all is finished.', 96, 'serifI', 'pink', 0.6, 70, 10)]),
    blk(216, 'light', 'impact', [ln('Before waking up,', 80, y=-1.6), ln('all is a dream.', 80, y=-0.6), ln('In dreams,', 80, 'serifI', 'pink', 0.6), ln('we dream of waking up.', 80, 'serifI', 'pink', 1.6)]),
    blk(252, 'light', 'scene', [ln('The man on the bench', 60), ln('is not saving energy', 60), ln('to stand up.', 70, 'serifI', 'pink')]),
    blk(288, 'light', 'zoom', [ln('The realisation is', 80, 'serif', 'ink', -1.0, 8, 10)], word='a random happening.', wy=0.7, zat=70),
])
S['what-is-divine-self'] = reel('What is divine self?', 'A reflection', 'December 15, 2024', 51, 'ONE', [
    blk(216, 'dark', 'impact', [ln('What is', 150, 'serif', 'paper', -0.55, 4, 18), ln('divine self?', 120, 'serifI', 'pink', 0.6, 54, 16)]),
    blk(216, 'light', 'impact', [ln('When the little, petty', 84, y=-1.2), ln('individual self falls,', 84, y=-0.1), ln('there is love.', 104, 'serifI', 'pink', 1.15)]),
    blk(324, 'light', 'gather', [ln('The countless drops', 66, y=-3.3, at=4, step=8), ln('become one', 66, y=-2.4, at=44, step=9), ln('whole ocean.', 120, 'serifI', 'pink', 2.6, 220, 14)], gather=96),
    blk(216, 'dark', 'impact', [ln('The ocean has no waves;', 92, 'serif', 'paper', -0.6), ln('the wave itself is the ocean.', 84, 'serifI', 'pink', 0.65)]),
    blk(216, 'light', 'scene', [ln('When I am whole space,', 60), ln('what space is left', 60), ln('for me to move?', 70, 'serifI', 'pink')]),
    blk(216, 'light', 'impact', [ln('The mind is a bucket', 84, y=-1.2), ln('of five litres.', 84, y=-0.1), ln('Totality is an endless river.', 80, 'serifI', 'pink', 1.15)]),
])
S['interconnectedness'] = reel('Interconnectedness', 'A reflection', 'December 14, 2024', 53, 'FLOW', [
    blk(216, 'dark', 'impact', [ln('A tree falls', 150, 'serif', 'paper', -0.55, 4, 16), ln('seconds after he passes.', 92, 'serifI', 'pink', 0.6, 64, 10)]),
    blk(216, 'light', 'impact', [ln('Because his tiffin', 80, y=-1.6), ln('was packed a little late.', 80, y=-0.6), ln('Because he woke up', 80, 'serifI', 'pink', 0.6), ln('a little late.', 80, 'serifI', 'pink', 1.6)]),
    blk(288, 'light', 'type', [ln('because his boss gave him more work,', 46, 'mono', 'ink', -1.6, 6, rate=1), ln('because a workmate was on leave,', 46, 'mono', 'ink', -0.55, 70, rate=1), ln("because of a cousin's wedding,", 46, 'mono', 'ink', 0.55, 130, rate=1), ln('because two people fell in love.', 46, 'mono', 'pink', 1.6, 188, rate=1)]),
    blk(216, 'dark', 'impact', [ln('This goes on and on,', 80, 'serif', 'paper', -1.6), ln('connecting every event,', 80, 'serif', 'paper', -0.6), ln('every individual,', 80, 'serifI', 'pink', 0.6), ln('the whole universe.', 92, 'serifI', 'pink', 1.6)]),
    blk(216, 'light', 'scene', [ln('One grand movement.', 70), ln('One flow.', 84, 'serifI', 'pink')]),
    blk(252, 'light', 'impact', [ln('He cannot curse his past.', 92, y=-0.6), ln('His present is made of it.', 92, 'serifI', 'pink', 0.65)]),
])
S['perfect'] = reel('Perfect', 'A poem', 'November 30, 2024', 57, 'PERFECT', [
    blk(216, 'dark', 'impact', [ln('Perfect,', 160, 'serifI', 'paper', -0.55, 6, 14), ln('is the perfect name for you,', 84, 'serif', 'pink', 0.7, 54, 10)]),
    blk(216, 'light', 'impact', [ln('which is perfectly true,', 84, y=-1.2), ln('as it perfectly defines', 84, y=-0.1), ln('the perfect you.', 104, 'serifI', 'pink', 1.15)]),
    blk(216, 'light', 'scene', [ln('Like the radiance', 64), ln('of the morning dew,', 64), ln('perfectly fresh, perfectly new.', 60, 'serifI', 'pink')]),
    blk(216, 'dark', 'impact', [ln('Not just a name,', 96, 'serif', 'paper', -1.1), ln("it's a spark,", 96, 'serif', 'paper', 0), ln('a glowing flame,', 104, 'serifI', 'pink', 1.15)]),
    blk(252, 'light', 'impact', [ln('the beauty, the essence,', 92, y=-0.6), ln("the heart of life's game,", 92, 'serifI', 'pink', 0.65)]),
    blk(288, 'light', 'zoom', [ln('Constant, steady,', 96, 'serif', 'ink', -1.0, 8, 14)], word='always the same.', wy=0.7, zat=60),
])
S['blessed'] = reel('Blessed', 'A poem', 'November 30, 2024', 52, 'BLESSED', [
    blk(216, 'dark', 'impact', [ln('Blessed,', 160, 'serifI', 'paper', -0.55, 6, 14), ln('to have you by my side.', 88, 'serif', 'pink', 0.7, 54, 10)]),
    blk(216, 'light', 'impact', [ln('In every tide,', 80, y=-1.6), ln('in every storm,', 80, y=-0.6), ln('in every dark night,', 80, y=0.6), ln('for being the light.', 88, 'serifI', 'pink', 1.6)]),
    blk(216, 'light', 'impact', [ln('To hold my hand,', 92, y=-1.15), ln('to help me stand,', 92, y=0), ln('through the shifting time.', 84, 'serifI', 'pink', 1.15)]),
    blk(216, 'light', 'scene', [ln('A heart so kind,', 66), ln('a peaceful mind,', 66), ln("a bond that doesn't bind.", 62, 'serifI', 'pink')]),
    blk(252, 'dark', 'impact', [ln("Oh, it's fine,", 110, 'serifI', 'paper', -1.1), ln('if you must go,', 92, 'serif', 'paper', 0), ln('as long as you know', 84, 'serifI', 'pink', 1.15)]),
    blk(288, 'light', 'zoom', [ln("you'll forever", 92, 'serif', 'ink', -1.6, 8, 14), ln("in my heart's eternal flow.", 72, 'serifI', 'ink2', 1.9, 170, 9)], word='glow,', wy=0.0, zat=50),
])
S['god-and-the-ocean'] = reel('God and The Ocean', 'A reflection', 'November 23, 2024', 48, 'OCEAN', [
    blk(216, 'dark', 'impact', [ln('God and the Ocean', 130, 'serif', 'paper', -0.55, 4, 14), ln('are the same.', 104, 'serifI', 'pink', 0.6, 70, 14)]),
    blk(216, 'light', 'impact', [ln('They both are,', 120, y=-0.6, at=8, step=14), ln('and they both are not.', 100, 'serifI', 'pink', 0.65, 70, 12)]),
    blk(252, 'light', 'drops', [ln('In the name of the Ocean,', 66, y=-3.3, at=4, step=8), ln('all you can show me are countless drops of water.', 56, 'serifI', 'ink2', 3.4, 150, 6)], word='ocean', fall=70),
    blk(216, 'dark', 'impact', [ln('In the name of God,', 92, 'serif', 'paper', -1.1), ln('all you can show me', 84, 'serif', 'paper', 0), ln('are countless fragments of creation.', 70, 'serifI', 'pink', 1.15)]),
    blk(216, 'light', 'scene', [ln('Countless drops.', 70), ln('Countless fragments.', 70, 'serifI', 'pink')]),
    blk(288, 'light', 'center', [ln('They both are, and they both are not.', 80, 'serifI', 'pink', 0.9, 40, 9)]),
])
S['we-never-met'] = reel('We never met', 'An essay', 'November 22, 2024', 54, 'MET', [
    blk(216, 'dark', 'impact', [ln('We never met.', 150, 'serif', 'paper', -0.55, 4, 16), ln('You and I have never met anyone.', 80, 'serifI', 'pink', 0.6, 64, 9)]),
    blk(216, 'light', 'strike', [ln('the good Nikit,', 100, y=-1.25, step=5), ln('the wise Nikit,', 100, y=0, step=5), ln('the silent Nikit,', 100, y=1.25, step=5)], strikes=[120, 140, 160]),
    blk(216, 'dark', 'zoom', [ln('Have you ever met', 96, 'serif', 'paper', -1.1, 6, 12)], word='the whole Nikit?', wy=0.6, zat=56),
    blk(216, 'light', 'impact', [ln('Between the actual you', 80, y=-1.6), ln('and the actual me', 80, y=-0.6), ln('sits a translator:', 80, 'serifI', 'ink2', 0.6), ln('the mind.', 100, 'serifI', 'pink', 1.6)]),
    blk(252, 'light', 'scene', [ln('I met my idea of you.', 62), ln('You met your idea of me.', 62, 'serifI', 'pink')]),
    blk(288, 'dark', 'impact', [ln('Only when there is no mediator', 80, 'serif', 'paper', -0.6), ln('can we really meet.', 110, 'serifI', 'pink', 0.7, 110, 14)]),
])

# the same scene the post's writing page shows (port of pickScene in js/pixel-scenes.js)
import re
LIST = ['sakura', 'plum', 'maple', 'lantern', 'koi', 'bonsai', 'torii', 'bamboo', 'incense', 'lotus', 'snow', 'fuji', 'chime', 'heron', 'waterfall', 'cat', 'rabbit', 'tea']
THEMES = [(r'ocean|water|flow', ['koi', 'lotus', 'waterfall', 'heron']), (r'love|relationship|heart|you-never|take-me|blessed', ['sakura', 'plum', 'lotus', 'cat', 'tea']), (r'god|divine|self|curse|prayer', ['torii', 'incense', 'lantern', 'rabbit']),
          (r'thought|wisdom|step|effort|cloud|wake', ['bonsai', 'bamboo', 'incense', 'fuji', 'chime']), (r'happy|unity|world|met|lie', ['maple', 'sakura', 'lantern', 'tea', 'cat']), (r'trust', ['lantern', 'bamboo', 'snow', 'heron'])]
def hstr(t):
    h = 2166136261
    for ch in t: h ^= ord(ch); h = (h * 16777619) & 0xffffffff
    return h
def pick_scene(slug):
    for rx, opts in THEMES:
        if re.search(rx, slug): return opts[hstr(slug) % len(opts)]
    return LIST[hstr(slug) % len(LIST)]

if __name__ == '__main__':
    p = os.path.join(HERE, 'reels.json'); d = json.load(open(p))
    for k, v in S.items(): d[k] = v
    for k, v in d.items():
        if k == '_doc': continue
        v['scene'] = v.get('scene') or pick_scene(k); v['sceneAmb'] = 'water' if v['scene'] in ('koi', 'lotus', 'waterfall', 'heron') else 'air'
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
    print(len(S), 'scripts merged;', len(d) - 1, 'reels in reels.json')
