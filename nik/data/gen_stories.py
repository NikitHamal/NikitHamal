"""Synthetic "TinyStories"-style corpus in romanized Nepali.

Small models write coherently when part of their diet is simple, consistent,
causally connected text (Eldan & Li, 2023). Real news/wiki text is dense and
jumpy, so this generator composes short stories (character -> goal -> problem
-> help -> resolution -> feeling/moral) and short explanations from many
interchangeable parts. Every story is grammatical and internally consistent;
the combinatorics give hundreds of thousands of distinct texts.

    python nik/data/gen_stories.py --out data/stories.txt --n 80000
"""
from __future__ import annotations
import argparse, random

R = random.Random(7)
pick = R.choice

KIDS = [('ram', 'keta'), ('sita', 'keti'), ('hari', 'keta'), ('gita', 'keti'), ('maya', 'keti'), ('bikash', 'keta'), ('anita', 'keti'), ('suman', 'keta'),
        ('pemba', 'keta'), ('dolma', 'keti'), ('aarati', 'keti'), ('kiran', 'keta'), ('sagar', 'keta'), ('nisha', 'keti'), ('raju', 'keta'), ('puja', 'keti')]
ANIMALS = [('euta sano kukur', 'kukur'), ('euta seto biralo', 'biralo'), ('euta chalakh bandar', 'bandar'), ('euta sano chara', 'chara'),
           ('euta budho kachhuwa', 'kachhuwa'), ('euta ramro danfe', 'danfe'), ('euta khairo kharayo', 'kharayo')]
PLACES = ['pokhara', 'gorkha', 'ilam', 'jumla', 'dhankuta', 'palpa', 'mustang', 'chitwan', 'bandipur', 'solukhumbu', 'kathmandu', 'janakpur']
SETTINGS = ['euta sano gaun ma', 'himal ko kakh ma', 'nadi ko kinar ma', 'euta thulo ban najik', 'pahad ko tuppo ma', 'sahar ko euta galli ma']
GOALS = [
    ('school ko pratiyogita ma bhag lina', 'pratiyogita'), ('aama ko lagi euta upahar kinna', 'upahar'), ('dashain ma ping khelna', 'ping'),
    ('chitta bujhne gari chitra banauna', 'chitra'), ('himal ko suryodaya herna', 'suryodaya'), ('naya sathi banauna', 'sathi'),
    ('sano bagaincha banauna', 'bagaincha'), ('jamma bhayeko paisa le kitab kinna', 'kitab'),
]
PROBLEMS = [
    'tara ekdam pani paryo ra bato chiplo bhayo.', 'tara uslai ali dar lagyo.', 'tara usko paisa pugena.', 'tara bato ma uslai bato bhulyo.',
    'tara pahilo prayas ma u asafal bhayo.', 'tara usko sathi risayeko thiyo.', 'tara samaya thorai thiyo.',
]
HELPERS = ['hajurba le', 'usko didi le', 'euta dayalu chhimeki le', 'school ko teacher le', 'usko sano bhai le', 'gaun ki ama le']
HELP_ACTS = ['dhairya rakhna sikaunubhayo', 'bato dekhaidinubhayo', 'alikati sahayog garnubhayo', 'pheri prayas garna hausala dinubhayo',
             'samasya lai sano tukra ma bandna sikaunubhayo']
ENDS = ['antama {n} le afno sapana pura garyo.', 'antama sab thik bhayo ra {n} haansyo.', 'tyas din {n} le dherai kura sikyo.',
        'beluka samma {n} ko kaam pura bhayo.']
FEEL = ['{n} lai dherai khusi lagyo.', '{n} ko man shanta bhayo.', '{n} le sabai lai dhanyabad bhanyo.', '{n} ko anuhar ma muskan aayo.']
MORALS = ['dhairya ra mehanat le sabai kura sambhav hunchha.', 'sahayog magnu kamjori haina.', 'sano prayas pani mulyawan hunchha.',
          'sathi ko maya sabai bhanda thulo dhan ho.', 'asafalta bata pani sikna sakinchha.', 'imandar hunu sadhai ramro hunchha.']


def story():
    n, kind = pick(KIDS)
    goal, gk = pick(GOALS)
    place = pick(PLACES)
    lines = [f'{pick(SETTINGS)} {n} naam ko euta {kind} basthyo.' if R.random() < .5 else
             f'{place} ma {n} naam ko euta {pick([kind, "baccha"])} thiyo.']
    if R.random() < 0.4:
        a, short = pick(ANIMALS)
        lines.append(f'{n} sanga {a} thiyo. {short} sadhai {n} sangai hidthyo.')
    lines.append(f'ek din {n} le {goal} chahyo.')
    lines.append(pick(PROBLEMS))
    if R.random() < 0.5:
        lines.append(f'{n} le socheko: "aba ma k garu?"')
    lines.append(f'tyasbela {pick(HELPERS)} {pick(HELP_ACTS)}.')
    lines.append(f'{n} le pheri prayas garyo.')
    lines.append(pick(ENDS).format(n=n))
    lines.append(pick(FEEL).format(n=n))
    if R.random() < 0.6:
        lines.append(f'yo katha le sikauchha: {pick(MORALS)}')
    return ' '.join(lines)


FACT_TOPICS = [
    ('pani', ['pani jiwan ko lagi ati jaruri chha.', 'manchhe, janawar ra biruwa sabai lai pani chahinchha.', 'safa pani piunu swasthya ko lagi ramro ho.',
              'nadi, tal ra mul pani ka mukhya srot hun.', 'pani bachaunu hamro kartabya ho.']),
    ('rukh', ['rukh le hami lai oxygen dinchha.', 'rukh ko chhaya ma garmi kam lagchha.', 'rukh le mato bagna dindaina.', 'chara haru rukh ma gund banaunchhan.',
              'ek manchhe le ek rukh ropda pani dharti harao hunchha.']),
    ('himal', ['nepal ma sansar ka dherai aglo himal chhan.', 'sagarmatha sansar ko sabai bhanda aglo himal ho.', 'himal ma barsabhari hiun hunchha.',
               'himal bata pagleko hiun le nadi lai pani dinchha.', 'dherai paryatak himal herna nepal aauchhan.']),
    ('school', ['school ma hami naya kura sikchhau.', 'teacher le hami lai padhaunu hunchha.', 'sathi haru sanga khelna ra sikna ramailo hunchha.',
                'homework samaya mai garnu ramro bani ho.', 'kitab padhda gyan badhchha.']),
    ('swasthya', ['ramro swasthya ko lagi santulit khana chahinchha.', 'har din alikati byayam garnu ramro ho.', 'raati samaya mai sutnu jaruri chha.',
                  'haat dhuna le rog bata bachauchha.', 'tarkari ra fal le sarir lai bal dinchha.']),
    ('computer', ['computer le hisab ra kaam chhito garchha.', 'programming bhaneko computer lai nirdesan dinu ho.', 'internet le sansar lai jodchha.',
                  'AI bhaneko computer lai sikna sikaune prabidhi ho.', 'sano kaam bata coding sikna suru garna sakinchha.']),
    ('chad', ['dashain nepal ko sabai bhanda thulo chad ho.', 'dashain ma thulo manchhe bata tika ra aashirbad linchhau.', 'tihar ma diyo balinchha ra ghar sajainchha.',
              'tihar ma kag, kukur ra gai ko puja garinchha.', 'chad le pariwar lai ek thau ma bhela garauchha.']),
]


def explain():
    topic, facts = pick(FACT_TOPICS)
    k = R.randint(3, len(facts))
    chosen = R.sample(facts, k)
    opener = pick([f'{topic} ko barema kehi kura:', f'aau {topic} bare bujhaun.', f'{topic} hamro jiwan ma mahattwapurna chha.'])
    closer = pick(['tyasaile yo kura yaad rakhnu ramro hunchha.', 'yasari hami dherai kura sikna sakchhau.', ''])
    return ' '.join([opener] + chosen + ([closer] if closer else []))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='data/stories.txt')
    ap.add_argument('--n', type=int, default=80000)
    a = ap.parse_args()
    seen = set()
    with open(a.out, 'w') as f:
        while len(seen) < a.n:
            t = story() if R.random() < 0.75 else explain()
            if t not in seen:
                seen.add(t)
                f.write(t + '\n')
    print('wrote', a.out, len(seen))


if __name__ == '__main__':
    main()
