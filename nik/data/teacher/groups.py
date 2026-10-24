"""Groups, then a change (Claude, 2026-10-24): `N groups of M items, then K removed / added -> how many?` asked in many
scenes, verbs and sentence shapes, with minimal pairs that ask for a different step of the same story.

Why: every candidate of 2026-10-24 fails the nested gate on one NikBench word template (`euta bagaincha ma 6 wata line
chhan ra har line ma 4 wata rukh. 7 wata rukh dhale bhane kati rukh baki?`): they write `jamma: 6 x 4 = 24. rukh:
24 x 4 = 96` (5-7 items lost per arm). Probing the live model m50 itself shows it never had the skill, only the
template: change one verb (`dhale` -> `kaate`) and m50 answers 96 too; `7 wata rukh thape bhane jamma kati?` -> 96;
apples in baskets, children in rows, glasses in boxes: all wrong. So this teaches the skill, not the template:
  - scenes: trees in rows, apples in baskets, students on benches, glasses in boxes, books on shelves, hens in coops,
    momo on plates, eggs in trays, chairs in rows, saplings in beds, pencils in boxes, bricks in stacks;
  - changes: removal verbs (dhalyo, kaatyo, sukera mare, kuhiye, phute, haraayo, bechiye, khaye, ghar gaye, ...) and
    addition verbs (ropyo, thapiyo, kinyo, aaye, lyaiyo, ...);
  - questions: left / total now (2 steps), the starting total (1 step: stop there), how many were removed (a lookup:
    no arithmetic), per-group changes (`har line bata 2 wata`), two changes, the inverse (`... 17 baki chhan. har line
    ma kati thiye?`), English (~15%), and named distractor numbers that are not used;
  - the think keeps m50's own words (jamma / bacheko / jaach) so the live model's style is extended, not replaced.
The NikBench sentence itself is never generated (no `wata line chhan ra har line ma ... 7 wata rukh dhale bhane`).
Every equation is exact (verify.py, test below).
"""
import random

from math_gen import ex, pick

# (place/owner phrase, group word, item word, classifier, removal clauses, addition clauses, English (group, item, removed, added))
SCENES = [
    ('bagaincha ma', 'line', 'rukh', 'wata',
     ['aandhi le {k} wata rukh dhalyo', 'kisan le {k} wata rukh kaatyo', '{k} wata rukh sukera mare', '{k} wata rukh kaatiye', 'bato banauda {k} wata rukh hataiyo'],
     ['maali le {k} wata naya rukh ropyo', 'aru {k} wata rukh ropiye'], ('rows', 'trees', 'were cut down', 'were planted')),
    ('pasal ma', 'tokri', 'aanp', 'wata',
     ['{k} wata aanp kuhiye', 'bachha haru le {k} wata aanp khaye', '{k} wata aanp bechiye', '{k} wata aanp bhui ma khasera phute'],
     ['saahu le aru {k} wata aanp thape', '{k} wata aanp thapiye'], ('baskets', 'mangoes', 'went bad', 'were added')),
    ('kaksha ma', 'bench', 'bidyarthi', 'jana',
     ['{k} jana bidyarthi ghar gaye', '{k} jana khelna bahira gaye', '{k} jana bidyarthi library gaye'],
     ['aru {k} jana bidyarthi aaye', '{k} jana naya bidyarthi bhitra aaye'], ('benches', 'students', 'went home', 'came in')),
    ('bhanchha ma', 'box', 'glass', 'wata',
     ['{k} wata glass phute', 'saarda {k} wata glass phutyo', '{k} wata glass chiriye'],
     ['aru {k} wata glass kinera thapiyo'], ('boxes', 'glasses', 'broke', 'were bought')),
    ('pustakalaya ma', 'tah', 'kitab', 'wata',
     ['bidyarthi haru le {k} wata kitab ghar lage', '{k} wata kitab haraaye', '{k} wata purana kitab hataiyo'],
     ['aru {k} wata naya kitab thapiyo', 'pustakalaya le {k} wata kitab kinyo'], ('shelves', 'books', 'were borrowed', 'were added')),
    ('farm ma', 'khor', 'kukhura', 'wata',
     ['{k} wata kukhura bechiye', '{k} wata kukhura haraaye', 'syal le {k} wata kukhura lagyo'],
     ['aru {k} wata kukhura kiniye', 'kisan le {k} wata kukhura thapyo'], ('coops', 'hens', 'were sold', 'were bought')),
    ('bhoj ma', 'plate', 'momo', 'wata',
     ['sathi haru le {k} wata momo khaye', '{k} wata momo bhui ma khase'],
     ['aama le aru {k} wata momo thapnubhayo'], ('plates', 'momos', 'were eaten', 'were added')),
    ('dokan ma', 'kret', 'anda', 'wata',
     ['lyaunda {k} wata anda phute', '{k} wata anda bigriye'],
     ['aru {k} wata anda thapiyo'], ('trays', 'eggs', 'broke', 'were added')),
    ('hall ma', 'line', 'kursi', 'wata',
     ['{k} wata kursi bhaachiye', 'safai garda {k} wata kursi hataiyo'],
     ['aru {k} wata kursi lyaiyo'], ('rows', 'chairs', 'were removed', 'were brought')),
    ('nursery ma', 'kyaari', 'biruwa', 'wata',
     ['{k} wata biruwa sukera mare', 'bakhra le {k} wata biruwa khayo', '{k} wata biruwa arko thau sariyo'],
     ['aru {k} wata biruwa ropiyo'], ('beds', 'seedlings', 'dried up', 'were planted')),
    ('school ko store ma', 'dabba', 'pencil', 'wata',
     ['{k} wata pencil bidyarthi lai baadiyo', '{k} wata pencil bhaachiye'],
     ['aru {k} wata pencil kiniyo'], ('boxes', 'pencils', 'were given away', 'were bought')),
    ('ghar banaune thau ma', 'thupro', 'ita', 'wata',
     ['{k} wata ita phute', 'mistri le {k} wata ita parkhal ma lagayo'],
     ['truck le aru {k} wata ita lyayo'], ('stacks', 'bricks', 'were used', 'were delivered')),
]
NAMES = ['sita', 'hari', 'gita', 'ram', 'binod', 'sarita', 'pemba', 'anjali', 'dipak', 'kamala', 'suman', 'rojina', 'bikash', 'laxmi']
DISTRACT = [('{x} barsa purano', 'barsa'), ('{x} meter lamo', 'meter'), ('ghar bata {x} minet ko duri ma', 'minet'), ('{x} meter chauda', 'meter')]


def _intro(R, place, grp, item, cl, n, m):
    nm = R.choice(NAMES)
    return pick(R, [
        f'{nm} ko {place} {n} wata {grp} chhan. har {grp} ma {m} {cl} {item} chhan.',
        f'{place} {n} {grp} {item} chha, pratyek {grp} ma {m} {cl}.',
        f'{n} wata {grp} chhan, ek ek {grp} ma {m} {cl} {item}. yo {nm} ko {place.replace(" ma", "")} ho.',
        f'{place} {item} {n} {grp} ma rakhieko chha: har {grp} ma {m} {cl}.',
        f'{nm} le {n} wata {grp} ma {m}/{m} {cl} {item} milayo.',
    ])


def _distractor(R, place):
    """an unused number about the place (\"tyo thau 18 barsa purano chha.\"), named and set aside in the think"""
    if R.random() < 0.3:
        d, unit = R.choice(DISTRACT)
        x = R.randint(3, 40)
        return f' tyo {place.replace(" ma", "")} {d.format(x=x)} chha.', f'{x} {unit}: yo hisab ma chahidaina. '
    return '', ''


def sample_ne(R):
    place, grp, item, cl, rem, add, _ = R.choice(SCENES)
    n, m = R.randint(3, 15), R.randint(3, 15)
    t = n * m
    kind = R.choices(['remove', 'add', 'start', 'lookup', 'pergroup', 'two', 'inverse'], [30, 16, 12, 10, 10, 12, 10])[0]
    intro = _intro(R, place, grp, item, cl, n, m)
    dtext, dthink = _distractor(R, place)
    if kind in ('remove', 'start', 'lookup'):
        k = R.randint(1, max(1, t - 1))
        ev = R.choice(rem).format(k=k)
        if kind == 'remove':
            q = pick(R, [f'aba kati {cl} {item} baki chha?', f'kati {item} bachyo?', f'aba jamma kati {item} chha?', f'baki {item} kati?'])
            think = f'{dthink}jamma: {n} x {m} = {t}. bacheko: {t} - {k} = {t - k}. jaach: {t - k} + {k} = {t}, milyo'
            ans = pick(R, [f'aba {t - k} {cl} {item} baki chha.', f'{t - k} {cl} {item} bachyo.', f'baki {t - k} {cl} {item} chha.'])
            gold = t - k
        elif kind == 'start':
            q = pick(R, [f'suru ma jamma kati {item} thiyo?', f'{item} ghatnu bhanda pahila kati thiyo?', f'pahila jamma kati {cl} {item} thiye?'])
            think = f'{dthink}sodheko suru ko jamma: {n} x {m} = {t}. pachhi ko ghatna yo prashna ma chahidaina.'
            ans = f'suru ma jamma {t} {cl} {item} thiye.'
            gold = t
        else:
            q = pick(R, [f'kati {cl} {item} gaye?', f'kati {item} ghate?', f'kati wata ko kura bhaeko chha?'])
            think = f'path ma "{ev}" bhaneko chha. sodheko kura sidhai lekheko chha, hisab chahidaina.'
            ans = f'{k} {cl} {item}.'
            gold = k
        return f'{intro}{dtext} {ev}. {q}', think, ans, gold
    if kind == 'add':
        k = R.randint(1, 40)
        ev = R.choice(add).format(k=k)
        q = pick(R, [f'aba jamma kati {item} chha?', f'aba kati {cl} {item} bhayo?', f'jamma {item} kati pugyo?'])
        think = f'{dthink}jamma: {n} x {m} = {t}. thapepachhi: {t} + {k} = {t + k}. jaach: {t + k} - {k} = {t}, milyo'
        return f'{intro}{dtext} {ev}. {q}', think, f'aba jamma {t + k} {cl} {item} chha.', t + k
    if kind == 'pergroup':
        j = R.randint(1, m - 1)
        verb = pick(R, ['hataiyo', 'ghatyo', 'gayo', 'nikaliyo'])
        q = pick(R, [f'aba jamma kati {item} chha?', f'kati {item} baki chha?'])
        think = f'{dthink}har {grp} ma baki: {m} - {j} = {m - j}. jamma: {n} x {m - j} = {n * (m - j)}. jaach: {n * (m - j)} / {n} = {m - j}, milyo'
        return f'{intro}{dtext} har {grp} bata {j} {cl} {item} {verb}. {q}', think, f'aba jamma {n * (m - j)} {cl} {item} chha.', n * (m - j)
    if kind == 'two':
        k1 = R.randint(1, max(1, t - 1)); k2 = R.randint(1, 30)
        e1, e2 = R.choice(rem).format(k=k1), R.choice(add).format(k=k2)
        r = t - k1 + k2
        q = pick(R, [f'aba jamma kati {item} chha?', f'antya ma kati {cl} {item} bhayo?'])
        think = (f'{dthink}jamma: {n} x {m} = {t}. ghatepachhi: {t} - {k1} = {t - k1}. thapepachhi: {t - k1} + {k2} = {r}. '
                 f'jaach: {r} + {k1} - {k2} = {t}, milyo')
        return f'{intro}{dtext} pahila {e1}, ani {e2}. {q}', think, f'antya ma {r} {cl} {item} chha.', r
    # inverse: per-group count from the total after a removal
    k = R.randint(1, max(1, t - 1))
    ev = R.choice(rem).format(k=k)
    nm = R.choice(NAMES)
    user = (f'{nm} ko {place} {n} wata {grp} ma barabar {item} thiyo. {ev}, ani {t - k} {cl} {item} baki chha. '
            f'suru ma har {grp} ma kati {cl} thiye?')
    think = f'suru ko jamma: {t - k} + {k} = {t}. har {grp} ma: {t} / {n} = {m}. jaach: {n} x {m} = {t}, milyo'
    return user, think, f'suru ma har {grp} ma {m} {cl} {item} thiye.', m


def sample_en(R):
    _, _, _, _, _, _, (grp, item, removed, added) = R.choice(SCENES)
    n, m = R.randint(3, 15), R.randint(3, 15)
    t = n * m
    if R.random() < 0.6:
        k = R.randint(1, t - 1)
        user = pick(R, [f'There are {n} {grp} with {m} {item} in each. {k} {item} {removed}. How many {item} are left?',
                        f'{n} {grp}, {m} {item} in every one. Then {k} {item} {removed}. How many are left now?'])
        think = f'total: {n} x {m} = {t}. left: {t} - {k} = {t - k}. check: {t - k} + {k} = {t}, milyo'
        return user, think, f'{t - k} {item} are left.', t - k
    k = R.randint(1, 30)
    user = f'There are {n} {grp} with {m} {item} in each. {k} more {item} {added}. How many {item} are there now?'
    think = f'total: {n} x {m} = {t}. now: {t} + {k} = {t + k}. check: {t + k} - {k} = {t}, milyo'
    return user, think, f'There are {t + k} {item} now.', t + k


def sample(R):
    import build
    from augment import augment_example
    user, think, ans, gold = (sample_en if R.random() < 0.15 else sample_ne)(R)
    return augment_example(build.to_example(ex(user, think, ans, gold, 'word'), 'math', R), R)


if __name__ == '__main__':
    import collections
    import re
    import verify
    R = random.Random(5); bad = 0; n = 0; seen = collections.Counter()
    for i in range(6000):
        r = sample(R); u = r['messages'][0]['content']; m = r['messages'][1]
        assert 'wata line chhan ra har line ma' not in u, u
        k, b = verify.check_equations(m.get('think', '') + ' ' + m['content']); n += k
        g = str(r.get('gold', ''))
        if b or (g and g not in m['content'].replace(',', '')):
            bad += 1
            if bad < 4: print('BAD', b, r)
        if i < 8: print(u, '||', m.get('think', ''), '||', m['content'])
    print('bad rows', bad, 'of 6000; equations', n)
