"""Writing that follows the request (v4 stress test: "himal ko haiku" -> a news paragraph about a party leader).
Structured by hand: leave applications, wishes (festival, birthday, exam, wedding, new job), short descriptions of
places from a fact table, short poems on a topic, short stories with the requested characters, messages, and
English one-liners. Every output is about the requested topic and uses the user's details (names, places, dates)."""
import random

import lexicon as L

PLACE_FACTS = {
    'pokhara': ['phewa tal', 'machhapuchhre himal', 'paragliding', 'gandaki pradesh ko rajdhani'],
    'kathmandu': ['nepal ko rajdhani', 'pashupatinath', 'swayambhu', 'basantapur durbar kshetra'],
    'ilam': ['chiya bagan', 'kanyam', 'antu danda ko suryodaya', 'thandaa mausam'],
    'lumbini': ['buddha ko janmasthal', 'mayadevi mandir', 'shanti stupa', 'UNESCO sampada'],
    'chitwan': ['rashtriya nikunja', 'ek singe gaida', 'sauraha', 'rapti nadi'],
    'mustang': ['upallo mustang', 'muktinath', 'syau', 'sukkha pahad'],
    'bhaktapur': ['nyatapola mandir', 'juju dhau', 'durbar kshetra', 'mato ko bhanda'],
    'janakpur': ['janaki mandir', 'mithila chitrakala', 'sita ko janmasthal', 'pokhari haru'],
    'dharan': ['bhedetar', 'dantakali mandir', 'chhito badhdo sahar', 'pahad ra tarai ko bich'],
    'jumla': ['rara tal najik', 'marsi chamal', 'syau', 'karnali pradesh'],
    'gorkha': ['gorkha durbar', 'manakamana', 'prithvi narayan shah', 'pahadi gaun'],
    'palpa': ['tansen bazaar', 'rani mahal', 'dhaka kapada', 'shrinagar danda'],
}
FESTIVALS = {
    'dashain': ['tika', 'jamara', 'thula haru ko ashirbad', 'ping'], 'tihar': ['diyo', 'deusi bhailo', 'bhai tika', 'laxmi puja'],
    'chhath': ['surya ko puja', 'nadi kinar', 'arghya', 'thekuwa'], 'losar': ['naya barsha', 'naach gaan', 'pariwar', 'khana'],
    'holi': ['rang', 'pani', 'sathi haru', 'ramailo'], 'teej': ['rato luga', 'naach', 'dar', 'maiti'],
    'naya barsha': ['naya suruwat', 'sapana', 'mehnat', 'khusi'],
}
POEM_TOPICS = {
    'himal': ['seto hiun', 'chiso hawa', 'aakash chhune chuchura', 'bihana ko sunaulo ghaam'],
    'aama': ['maya', 'tyag', 'nyano kakh', 'pahilo guru'], 'nadi': ['bagdo pani', 'dhunga', 'samudra tira yatra', 'kalakal aawaj'],
    'gaun': ['khet', 'chautari', 'dhara', 'saanjh ko dhuwa'], 'pani': ['badal', 'jharna', 'pyaas', 'jiwan'],
    'sathi': ['hasaai', 'bharosa', 'sangai hidne bato', 'dukha ma saath'], 'desh': ['jhanda', 'himal pahad tarai', 'maato', 'gaurav'],
    'bihana': ['ghaam', 'chara ko chirbir', 'chiya', 'naya din'], 'barsha': ['jhari', 'mato ko basna', 'hariyo khet', 'chhata'],
    'school': ['kitab', 'guru', 'sathi', 'sapana'], 'jun': ['raat', 'chandani', 'shanti', 'tara haru'],
}
ANIMAL_TRAITS = {'kukur': 'imandar', 'biralo': 'chalakh', 'kharayo': 'chhito', 'kachhuwa': 'dhilo tara dhiraj bhayeko',
                 'bhalu': 'baliyo', 'bandar': 'chanchal', 'suga': 'boliraune', 'hatti': 'thulo ra dayalu', 'syal': 'chatur', 'chara': 'swatantra'}


def U(t):
    return {'role': 'user', 'content': t}


def N(t):
    return {'role': 'nik', 'content': t}


def ex(q, a, kind):
    return {'kind': f'write-{kind}', 'gold': None, 'messages': [U(q), N(a)]}


def leave(R):
    n = R.choice(L.NAMES_M + L.NAMES_F); cls = R.randint(1, 12); days = R.randint(1, 5)
    why = R.choice(['jworo aayeko', 'didi ko bihe', 'gharma puja', 'hajurama birami bhaeko', 'gaun jaanu pareko', 'pet dukheko'])
    sch = R.choice(['shree janata ma. vi.', 'shree saraswati ma. vi.', 'shree adarsha school', 'shree bal kalyan ma. vi.'])
    q = R.choice([f'school bida ko lagi nibedan lekha, {why} le {days} din', f'{days} din ko chhutti ko nibedan lekhdinus ({why})',
                  f'mero naam {n}, kaksha {cls}. {why} le bida chahiyo, nibedan lekhdeu'])
    if 'mero naam' not in q:
        n, cls = '[tapai ko naam]', '___'
    a = (f'shrimaan pradhanadhyapak jyu,\n{sch}\n\nbishaya: {days} din ko bida sambandhama.\n\nmahodaya,\n'
         f'ma yas vidyalaya ko kaksha {cls} ma adhyayan garne bidyarthi hu. {why} le garda ma {days} din school aauna sakdina. '
         f'tyasaile malai {days} din ko bida dinuhuna namra anurodh garchhu.\n\nbhavadiya,\n{n}\nkaksha: {cls}')
    return ex(q, a, 'leave')


def wish(R):
    k = R.random()
    n = R.choice(L.NAMES_M + L.NAMES_F)
    if k < 0.45:
        f, items = R.choice(list(FESTIVALS.items()))
        q = R.choice([f'{f} ko shubhakamana message lekha', f'{n} lai {f} ko wish lekhdeu', f'{f} ko lagi chhoto shubhakamana'])
        to = f'{n}, ' if n in q else ''
        a = f'{to}{f} ko hardik shubhakamana! {items[0]} ra {items[1]} sangai yo {f} le tapai ko jiwan ma khusi, swasthya ra safalta lyaos. ' + R.choice(
            [f'{items[2]} ko yo pawan awasar ma sabai lai dherai maya.', 'pariwar sanga ramailo garnus!', f'{items[3]} ko maja linus!'])
        return ex(q, a, 'festival')
    if k < 0.7:
        age = R.randint(5, 60)
        q = R.choice([f'{n} lai birthday wish lekha', f'sathi {n} ko janmadin ho, euta message lekhdeu', f'{n} {age} barsha pugyo, birthday wish'])
        extra = f'{age} barsha ko yo naya yatra ' if str(age) in q else 'naya barsha '
        a = f'janmadin ko dherai dherai shubhakamana, {n}! {extra}khusi, swasthya ra safalta le bhariyos. tapai jasto sathi paunu mero bhagya ho. happy birthday!'
        return ex(q, a, 'birthday')
    occ = R.choice([('exam', 'exam ko lagi shubhakamana! ramro sanga tayari gareko chhau, aba aatmabishwas sanga lekha. safal hos!'),
                    ('naya job', 'naya job ko badhai chha! yo naya suruwat ma dherai sikna ra agadi badhna paos.'),
                    ('bihe', 'bihe ko hardik badhai! dubai jana ko jiwan maya, samjhadari ra khusi le bhariyos.'),
                    ('graduation', 'graduation ko badhai! mehnat ko phal paunubhayo, aba naya sapana tira agadi badhnus.')])
    q = R.choice([f'{n} lai {occ[0]} ko wish lekha', f'{occ[0]} ko lagi euta badhai message'])
    return ex(q, (f'{n}, ' if n in q else '') + occ[1], 'occasion')


def place(R):
    p, facts = R.choice(list(PLACE_FACTS.items()))
    nl = R.choice([2, 3, 4])
    q = R.choice([f'{p} ko barema {nl} line lekha', f'{p} ko barema chhoto anuchhed', f'{p} kasto thau ho? {nl} line ma bhana', f'write about {p} in nepali'])
    s = [f'{p} nepal ko euta sundar thau ho.', f'yaha {facts[0]} prasiddha chha.', f'{facts[1]} herna dherai paryatak aauchhan.',
         f'{facts[2]} pani {p} ko pahichan ho.', f'{facts[3]} le garda {p} jaanai parne thau ho.']
    n = nl if 'line' in q else 4
    return ex(q, '\n'.join(s[:n]) if 'line' in q else ' '.join(s[:n]), 'place')


def poem(R):
    t, imgs = R.choice(list(POEM_TOPICS.items()))
    form = R.choice(['kabita', 'haiku', '4 line kabita', 'chhoto kabita'])
    q = R.choice([f'{t} ko barema euta {form}', f'{t} ma {form} lekha', f'euta {form} lekhdeu: {t}'])
    a_, b_, c_, d_ = R.sample(imgs, 4)
    if form == 'haiku':
        a = f'{a_} bhitra\n{t} le bistarai bhanchha\n{b_} ko kura'
    else:
        a = f'{t}, timi {a_} jastai,\n{b_} ma lukeko maya.\n{c_} sanga hidne bato,\n{d_} ma sadhai saathi.'
    return ex(q, a, 'poem')


def story(R):
    x, y = R.sample(list(ANIMAL_TRAITS), 2)
    q = R.choice([f'euta chhoto kahani: {x} ra {y}', f'{x} ra {y} ko kahani sunau', f'{x} ra {y} bare 5 line ko kahani'])
    lesson = R.choice(['sathi ko saath nai sabai bhanda thulo bal ho.', 'ghamanda le haina, mehnat le jitinchha.', 'sahayog garda sabai ko bhalo hunchha.'])
    a = (f'euta jangal ma {ANIMAL_TRAITS[x]} {x} ra {ANIMAL_TRAITS[y]} {y} basthe. ek din {x} khola tarna khojyo tara sakena. '
         f'{y} le upaya nikalyo ra dubai milera paari pugey. tyas din dekhi {x} ra {y} pakka sathi bhae. sikai: {lesson}')
    return ex(q, a, 'story')


def english(R):
    p = R.choice(list(PLACE_FACTS))
    q = R.choice(['english ma 1 sentence about Nepal', 'write one english sentence about nepal', f'one sentence in english about {p}'])
    a = ('Nepal is a beautiful Himalayan country, home to Mount Everest and the birthplace of Buddha.' if p not in q
         else f'{p.title()} is a lovely place in Nepal, known for {PLACE_FACTS[p][0]}.')
    return ex(q, a, 'english')


GENS = [(leave, 0.14), (wish, 0.26), (place, 0.2), (poem, 0.2), (story, 0.12), (english, 0.08)]


def sample(R):
    x, acc = R.random(), 0.0
    for g, w in GENS:
        acc += w
        if x < acc:
            return g(R)
    return place(R)


if __name__ == '__main__':
    import json, sys
    R = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    for _ in range(int(sys.argv[2]) if len(sys.argv) > 2 else 6):
        print(json.dumps(sample(R), ensure_ascii=False))
