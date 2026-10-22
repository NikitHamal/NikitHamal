"""Everyday English for Nik (Claude, 2026-10-22): the gap Dolly/OASST leave (they have no small talk, no Nik persona,
no simple facts Nik already knows in Nepali). Short replies, because English costs ~2.5-3 tokens/word here.
Rows: {'cat', 'gold', 'messages'}; sample(R) for build/cpu_microsft --share."""

GREET = ['Hello!', 'Hi!', 'Hey there!', 'Good morning!', 'Good evening!', 'Hi Nik!', 'Hello, how are you?',
         'Hey, how is it going?', 'Hi, how are you doing today?']
GREET_REPLY = ['Hello! I am doing well, thank you. How can I help you today?',
               'Hi! I am fine, thanks for asking. What would you like to talk about?',
               'Hello! Nice to hear from you. How can I help?']
THANKS = ['Thank you!', 'Thanks a lot.', 'Thanks for your help.', 'That was helpful, thank you.']
THANKS_REPLY = ['You are welcome!', 'Happy to help!', 'Any time. Let me know if you need anything else.']
BYE = ['Bye!', 'Goodbye.', 'See you later.', 'Good night!']
BYE_REPLY = ['Goodbye! Have a nice day.', 'See you soon. Take care!', 'Good night! Sleep well.']

WHO = ['Who are you?', 'What is your name?', 'Tell me about yourself.', 'What are you?', 'Who made you?']
WHO_REPLY = {
    'Who made you?': 'I was made by Nikit Hamal, a developer from Nepal. He built me from scratch, including my tokenizer and model.',
}
WHO_DEFAULT = ('I am Nik, a small AI made by Nikit Hamal. I usually speak romanized Nepali, '
               'and I can also answer in English if you ask.')

FACTS = [  # (question, short English answer)
    ('What is the capital of Nepal?', 'The capital of Nepal is Kathmandu.'),
    ('What is the highest mountain in the world?', 'Mount Everest is the highest mountain in the world. It is in Nepal.'),
    ('How many provinces does Nepal have?', 'Nepal has seven provinces.'),
    ('Where was Gautama Buddha born?', 'Gautama Buddha was born in Lumbini, Nepal.'),
    ('What is the national flower of Nepal?', 'The national flower of Nepal is the rhododendron.'),
    ('What is the currency of Nepal?', 'The currency of Nepal is the Nepali rupee.'),
    ('Which festival do Nepali people celebrate with tika and jamara?', 'That is Dashain, the biggest festival in Nepal.'),
    ('What is dal bhat?', 'Dal bhat is a common Nepali meal of lentil soup and rice, often served with vegetables.'),
]

SWITCH = [  # (romanized Nepali request for English, English answer)
    ('english ma bhana: tapai lai kasto chha?', 'How are you?'),
    ('"mero naam ram ho" english ma k hunchha?', 'My name is Ram.'),
    ('"ma school janchhu" lai english ma lekha.', 'I go to school.'),
    ('"aaja mausam ramro chha" english ma bhana.', 'The weather is nice today.'),
    ('"dhanyabad" ko english k ho?', 'Thank you.'),
]
TO_NEPALI = [  # (English request for romanized Nepali, Nepali answer)
    ('Say "good morning" in romanized Nepali.', 'subha prabhat.'),
    ('How do you say "thank you" in Nepali?', 'dhanyabad.'),
    ('Translate "I am hungry" into romanized Nepali.', 'malai bhok lagyo.'),
    ('How do you say "how are you" in Nepali?', 'tapai lai kasto chha?'),
]


def _row(cat, q, a, gold=None):
    return {'cat': f'en-basic-{cat}', 'gold': gold, 'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a}]}


def sample(R):
    k = R.random()
    if k < 0.2:
        return _row('greet', R.choice(GREET), R.choice(GREET_REPLY))
    if k < 0.3:
        return _row('thanks', R.choice(THANKS), R.choice(THANKS_REPLY))
    if k < 0.38:
        return _row('bye', R.choice(BYE), R.choice(BYE_REPLY))
    if k < 0.55:
        q = R.choice(WHO)
        return _row('who', q, WHO_REPLY.get(q, WHO_DEFAULT))
    if k < 0.75:
        q, a = R.choice(FACTS)
        return _row('fact', q, a, a)
    if k < 0.9:
        q, a = R.choice(SWITCH)
        return _row('switch', q, a, a)
    q, a = R.choice(TO_NEPALI)
    return _row('to-ne', q, a, a)
