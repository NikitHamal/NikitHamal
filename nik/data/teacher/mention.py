"""People who happen to be called nikit / nik / hamal / nikita, in everyday stories (Claude, 2026-10-22).

Why: every repaired-mix model answers `aaja nikit birami chha, k garne?` with Nik's own biography ("aaja android ...")
and `nikit hamal bhanne mero chhimeki ...` / `mero chhimeki k garnuhunchha?` with Nik's identity (9 of 12 arms today).
reading_contrast.py's identity slice makes it worse: it answers almost any question that contains "nikit" (`nikit ko
umer kati?`, `nikit kaha baschha?`) with a canned line about Nikit's essays (k7 with 3% of those rows: traps 21).
Here a person with that name (45% of rows) or an ordinary name (55%: the name must not matter) is sick, has a
birthday, is new somewhere, lent money, went somewhere, has a job; the reply is about the story and uses the name, and
never contains persona facts. Two-turn rows check the fact is remembered.

HELD OUT (nik/tests/chat/mention_heldout.json, never generated here): learning to ride a cycle, homework, guitar,
swimming, a wedding invitation, a broken phone, moving house, a haircut, a new job, an exam result.
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexicon as L  # noqa: E402

SPECIAL = ['nikit', 'nik', 'hamal', 'nikit hamal', 'nikita']
FEMALE = set(L.NAMES_F) | {'nikita'}
REL = ['dai', 'mama', 'kaka', 'chhimeki', 'classmate', 'bhinaju', 'phupaju', 'saathi ko buwa']
JOBS = ['shikshak', 'doctor', 'kisan', 'driver', 'nurse', 'byapari', 'lekhak', 'pasale', 'police', 'pilot', 'sipahi']
WORK = {'shikshak': 'school ma padhaunuhunchha', 'doctor': 'aspatal ma birami jachnuhunchha', 'kisan': 'khet ma kaam garnuhunchha',
        'driver': 'gadi chalaunuhunchha', 'nurse': 'aspatal ma birami ko seva garnuhunchha', 'byapari': 'byapar garnuhunchha',
        'lekhak': 'kitab lekhnuhunchha', 'pasale': 'pasal chalaunuhunchha', 'police': 'police ma kaam garnuhunchha',
        'pilot': 'jahaj udaunuhunchha', 'sipahi': 'sena ma kaam garnuhunchha'}


def _name(R):
    while True:
        n = R.choice(SPECIAL) if R.random() < 0.45 else R.choice(L.NAMES_M)
        if n not in FEMALE:          # replies below use masculine verbs
            return n


def U(t):
    return {'role': 'user', 'content': t}


def N(t):
    return {'role': 'nik', 'content': t}


def sick(R):
    n = _name(R)
    what = R.choice(['lai jaro aayo', 'lai rugha lagyo', 'ko tauko dukhyo', 'ko pet dukhyo', 'birami parechha',
                     'lai khoki lagyo'])
    q = R.choice([f'mero sathi {n} {what}, k garne hola?', f'{n} {what}. kasari help garu?', f'hijo dekhi {n} {what}, k salah dinchhau?',
                  f'{n} {what}, malai chinta lagyo.'])
    a = R.choice([f'{n} lai aaram garna ra prasasta pani piuna bhannus. du-tin din ma niko bhayena bhane doctor dekhaunus.',
                  f'{n} lai chhito niko hos! jhol khana, aaram ra pani dherai chahinchha. jaro badhyo bhane doctor kahan lanus.',
                  f'{n} lai bhetna jaanus, phal lanus ra aaram garna bhannus. lakshan badhe aspatal jaanu ramro.'])
    return {'cat': 'mention-sick', 'gold': None, 'messages': [U(q), N(a)]}


def birthday(R):
    n = _name(R)
    when = R.choice(['bholi', 'parsi', 'aaitabar', 'yo hapta', 'arko mahina'])
    q = R.choice([f'{when} {n} ko janmadin ho. k upahar dida ramro hola?', f'mero bhai {n} ko birthday {when} chha, k dine?',
                  f'{n} ko janmadin {when}. k gift ramro hunchha?'])
    a = R.choice([f'{n} lai man parne kura sochnus: euta ramro kitab, ghadi, ya hath le banayeko card. sano upahar pani maya le diye ramro lagchha.',
                  f'{n} ko ruchi anusar dinus: khel man parchha bhane ball, padhna man parchha bhane kitab. sangai cake katna pani ramailo hunchha.'])
    return {'cat': 'mention-birthday', 'gold': None, 'messages': [U(q), N(a)]}


def newcomer(R):
    n = _name(R)
    where = R.choice(['hamro office ma', 'hamro tole ma', 'hamro team ma', 'mero kaksha ma', 'hamro gaun ma'])
    q = R.choice([f'{n} bhanne manchhe {where} naya aaunubhayo.', f'{where} {n} naya aayo.', f'aaja {where} {n} bhanne naya sathi aayo.'])
    a = R.choice([f'ramro! {n} lai swagat garnus ra aru sanga chinjan garaidinus. naya thau ma sathi paye chhito ramaunchha.',
                  f'{n} lai naya thau ma sajilo hos bhanera ali sahayog garnus: thau dekhaidinus, sangai khaja khanus.'])
    return {'cat': 'mention-new', 'gold': None, 'messages': [U(q), N(a)]}


def job_memory(R):
    n = _name(R)
    rel = R.choice(REL)
    j = R.choice(JOBS)
    q1 = R.choice([f'{n} bhanne mero {rel} hunuhunchha, uha {j} hunuhunchha.', f'mero {rel} ko naam {n} ho, uha {WORK[j]}.',
                   f'{n} mero {rel} ho. uha {j} hunuhunchha.'])
    a1 = R.choice([f'ramro, tapai ko {rel} {n} {j} hunuhunchha bhanera bujhe.', f'thik chha, {n} ji {j} hunuhunchha. ramro kaam ho.'])
    q2 = R.choice([f'mero {rel} ko pesha k ho?', f'{n} ko pesha k ho?', f'mero {rel} kun kaam ma hunuhunchha?', f'{n} ko kaam ke ho?'])
    a2 = R.choice([f'tapai ko {rel} {n} {j} hunuhunchha.', f'{n} {j} hunuhunchha: uha {WORK[j]}.'])
    return {'cat': 'mention-job', 'gold': j, 'messages': [U(q1), N(a1), U(q2), N(a2)]}


def travel(R):
    n = _name(R)
    p = R.choice(L.PLACES)
    when = R.choice(['bholi', 'parsi', 'aaja beluka', 'arko hapta', 'aaitabar'])
    q1 = R.choice([f'mero sathi {n} {when} {p} jandai chha.', f'{when} {n} {p} ghumna janchha.', f'{n} ko {when} {p} jane plan chha.'])
    a1 = R.choice([f'ramro! {n} ko yatra ramro hos.', f'{p} ramro thau ho, {n} lai ramailo hola.'])
    q2 = R.choice([f'{n} kun thau jandai chha?', f'{n} kata jandai chha?', f'{n} kahile jandai chha?'])
    a2 = f'{n} {when} {p} janchha.'
    return {'cat': 'mention-travel', 'gold': p, 'messages': [U(q1), N(a1), U(q2), N(a2)]}


def lent(R):
    n = _name(R)
    k = R.choice([100, 200, 300, 500, 1000, 1500, 2000])
    q1 = R.choice([f'hijo {n} bata {k} rupiya udharo liye.', f'{n} lai {k} rupiya tirna baki chha.', f'gaya hapta {n} bata {k} rupiya sapati line.'])
    a1 = R.choice([f'thik chha. {n} lai {k} rupiya samaya mai firta garnus, bharosa badhchha.',
                   f'{n} ramro sathi raichha. {k} rupiya birsanu hunna, firta garnus.'])
    q2 = R.choice([f'maile {n} lai kati firta garnu parchha?', 'kati rupiya tirnu chha?'])
    a2 = f'{n} lai {k} rupiya firta garnu parchha.'
    return {'cat': 'mention-lent', 'gold': str(k), 'messages': [U(q1), N(a1), U(q2), N(a2)]}


def chore(R):
    n = _name(R)
    did = R.choice(['khana pakayo', 'luga dhoyo', 'bagaincha ma phool ropyo', 'bhanda majhyo', 'kotha milayo', 'pani bharyo'])
    q = R.choice([f'aaja {n} le {did}.', f'hijo {n} le eklai {did}.', f'{n} le aaja {did}, ma thakeko thie.'])
    a = R.choice([f'{n} le ramro kaam garyo! dhanyabad bhannus, arko choti tapai le pani sahayog garnus.',
                  f'waah, {n} le {did}. sangai kaam garda ramailo pani hunchha.'])
    return {'cat': 'mention-chore', 'gold': None, 'messages': [U(q), N(a)]}


def together(R):
    n = _name(R)
    what = R.choice([('football khelchhau', 'khelda'), ('school janchhau', 'janda'), ('kaam garchhau', 'kaam garda'), ('bihana hidchhau', 'hidda')])
    q = R.choice([f'{n} ra ma sangai {what[0]}.', f'ma ra mero sathi {n} sangai {what[0]}.'])
    a = R.choice([f'ramro! sathi sanga {what[1]} ramailo hunchha. {n} sanga kati barsha dekhi chinjan chha?',
                  f'{n} jasto sathi hunu ramro kura ho. sangai {what[1]} ek arka bata sikna sakinchha.'])
    return {'cat': 'mention-together', 'gold': None, 'messages': [U(q), N(a)]}


def mood(R):
    n = _name(R)
    m = R.choice([('dukhi chha', f'{n} sanga kura garnus, k bhayo bhanera sodhnus. dukha ma sathi ko saath le dherai farak parchha.'),
                  ('risayeko chha', f'{n} lai ali samaya dinus, ani shanta bhayepachhi kura garnus.'),
                  ('dherai khusi chha', f'ramro kura! {n} lai k le khusi banayo, sodhnus na.')])
    q = R.choice([f'aaja {n} {m[0]}.', f'mero sathi {n} aaja {m[0]}, k garne?'])
    return {'cat': 'mention-mood', 'gold': None, 'messages': [U(q), N(m[1])]}


def pet(R):
    n = R.choice(['nik', 'nikit', 'hamal'] + L.PET_NAMES)
    an = R.choice(['kukur', 'biralo', 'kharayo', 'suga'])
    col = R.choice(L.COLORS)
    q1 = R.choice([f'mero {an} ko naam {n} ho, u {col} chha.', f'{n} naam ko mero euta {an} chha. u {col} rang ko chha.'])
    a1 = R.choice([f'{n} ramro naam ho! {col} {an} kati pyaro hola.', f'waah, {col} {an} {n}. kati barsha ko bhayo?'])
    q2 = R.choice([f'maile mero {an} ko naam k bhaneko thiye?', f'mero {an} ko rang k ho?'])
    a2 = f'tapai ko {an} ko naam {n} ho.' if 'naam' in q2 else f'tapai ko {an} {n} {col} rang ko chha.'
    return {'cat': 'mention-pet', 'gold': n if 'naam' in q2 else col, 'messages': [U(q1), N(a1), U(q2), N(a2)]}


GENS = [sick, birthday, newcomer, job_memory, travel, lent, chore, together, mood, pet]


def sample(R):
    return R.choice(GENS)(R)


if __name__ == '__main__':
    import json
    R = random.Random(1)
    for _ in range(10):
        print(json.dumps(sample(R), ensure_ascii=False))
