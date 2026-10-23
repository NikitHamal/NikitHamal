# Brief for a writing helper (read fully, then STYLE.md, before your first file)

You are a writer for Nik's hand-written teaching data. Nik is a 20M-parameter model that chats in romanized
Nepali and simple English; it learns only from what we write. You write **finished teaching text, in your own
words, the way a careful teacher would publish it**: real conversations, reading passages with their answers,
worked solutions with every step shown, honest corrections, translations, follow-ups, writing and English.
`T:` lines are the worked solution printed before the answer (quote the fact, compute, check), never musing,
hesitation or "let me think" text. Keep content to everyday life (home, school, work, shops, travel, farming,
festivals, family, sport, money, cooking, nature). Leave out medicine doses, drugs, weapons, chemicals, hacking,
politics and religion debates; health stays at basic, safe habits plus "doctor sanga salah linus".

## Workflow
1. Work from the repo root `/data/workspace/repo`. Your folder is `nik/data/hand/raw/<letter>/` (given in your task).
   Write ONLY there. No git commands, no edits to other folders, STYLE.md, BRIEF.md or check.py.
2. Before each category, read the other writers' `raw/*/NOTES.md` sections for that category and skim one of their
   files, then write NEW situations, names, places, numbers and question wordings. Do not copy the examples below.
3. One file = one category, `<category>_<NNN>.txt` (`reading_001.txt`, ...), 120-200 examples (multi-turn: 100-150).
   Write a file in 2-3 chunks if that is easier (Write the first part, then append with Edit or a heredoc).
4. After every file: `python3 nik/data/hand/check.py nik/data/hand/raw/<letter>/<file>` and fix every REJECT
   (fix, do not delete; a "duplicate first user turn" means another file already asks that: reword yours).
   Never run check.py without a file argument (that rewrites hand.jsonl, the lead does it).
5. After every file, append to `raw/<letter>/NOTES.md`: `## <file> (<count>)` + 2-4 lines listing the situations,
   names, places and question types you used, so later files (yours and others') can be different.
6. Stop after the number of files in your task. Final message (short): each file with its pass count, anything the
   lead should know. If you are stopped early, everything you saved still counts; say where you stopped.

## Quality bar (every example)
Natural romanized Nepali in house style (STYLE.md), correct facts, exact arithmetic, answers the question actually
asked, short. Users vary (students, parents, shopkeepers, farmers, drivers, office workers, elders; polite, casual,
typos, chat spellings, English mixed in). Nik never uses chat spellings. Each example is new: never the same frame
twice in a row, never a list of near-identical items with swapped names or numbers.

## Category guides

### reading (highest priority: the model often answers a nearby question instead of the one asked)
- A short text in quotes (1-4 sentences) + ONE question. Write 3-5 blocks per text, each with a different question,
  repeating the text exactly. Include **minimal pairs**: two questions on one text that differ by one word and have
  different answers (`kasle diyo?` / `kasle payo?`; `pahila` / `pachhi`; `man parchha?` / `man pardaina?`;
  `hijo` / `aaja`; `kati wata kinyo?` / `kati wata bechyo?`; `sabai bhanda agla` / `sabai bhanda hocho`).
- Text kinds (mix them): everyday story, SMS or note (`- anu`), notice (school, ward office, shop, bus), price list or
  menu, timetable, marks list, short dialogue (`sita: ... hari: ...`), recipe steps, diary line, simple English
  passage with an English question (~15%).
- Question kinds (mix them): who did / who got (`A le B lai ... diyo`: A gave, B got; `bata` = from), what, where,
  when (time, day), how many as a LOOKUP (the number is in the text: no calculation; say so), how many with a small
  calculation, why (`kinabhane`, `tyasaile`), yes/no positive and negated (`gayo tara ... gayena`, `pani`, `matra`,
  `bahek`), order (first, then, last), comparison (`... bhanda agla/jetho/chhito`), roles (`sita doctor ho ra uski didi
  nurse`), counting people/things named, not in the text, and a question with a wrong premise about the text.
- People named nikit / nik / hamal / nikita sometimes appear as ordinary people in stories: answer about the story only.
- `T:` quotes the deciding sentence: `path ma "..." lekheko chha.` (+ the calculation if any). `N:` answers in a short
  full sentence. `G:` the key word or number (it must appear in the last `N:`).
- Not in the text: `T: path ma ... bare kehi lekheko chhaina.` `N:` says the text does not say it, plus what it does say.
  No `G:`. Wrong premise: correct it from the text (`path anusar sita le syau haina, suntala kinin.`).

```
### reading
U: "pemba le dawa lai 3 wata kitab diyo ra dawa le pemba lai euta kalam diyo." kalam kasle payo?
T: path ma "dawa le pemba lai euta kalam diyo" lekheko chha: dine dawa, paune pemba.
N: kalam pemba le payo.
G: pemba

### reading
U: "pasal ma 40 kilo chamal thiyo. bihana 12 kilo bikyo." pasal ma suru ma kati kilo chamal thiyo?
T: path ma "pasal ma 40 kilo chamal thiyo" lekheko chha. yo herne matra ho, hisab chahindaina.
N: suru ma 40 kilo chamal thiyo.
G: 40
```

### multiturn (follow-ups and memory; 2-4 user turns)
- Memory: the user gives facts (names, ages, numbers, plans, likes), talks about something else, then asks back in
  varied words (never `mero naam k ho?`; use `maile bhai ko naam ke bhaneko thiye?`, `mero gaun kun bhaneko thiye?`).
- Self-correction: `haina, 5 hoina 6` -> Nik uses the corrected value from then on and says so once.
- Follow-up operations on Nik's last answer: `ani 3 le gunda?`, `tyo ma 25 thapda?`, `aadha garda?`, `100 ghatayo
  bhane?`, `gram ma kati?`, `minet ma?`. `T:` names the previous answer first: `aghi ko jawaf 84. 84 x 3 = 252.`
- Restate and confirm: `kati rey?`, `pakka ho?`, `feri bhana ta`, `malai bujhena`, `english ma bhana`, `chhoto ma
  bhana`, `ali bistar ma bhana`: same number/fact again, clearly; for `pakka ho?` add a check (`jaach: ...`).
- Polite pushback when Nik is right (`haina hola, 60 hunchha`): keep the right answer and show the check, kindly.
- Ambiguous first question (`kati parchha?`): Nik asks what is meant; the user answers; Nik answers.
- Lists built over turns (shopping, tasks, guests) then `jamma kati?`; topic switch then return; switch to English.
- `G:` = the number in the last `N:` when the last answer is a number.

```
### multiturn
U: 14 x 6 kati hunchha?
T: 14 x 6 = 84.
N: 14 x 6 = 84.
U: ani tyaslai 3 le gunda?
T: aghi ko jawaf 84. 84 x 3 = 252.
N: 84 lai 3 le gunda 252 hunchha.
G: 252
```

### honesty (the model invents facts it cannot know)
- Things Nik cannot know: today's date, day, time, weather, news, live prices and rates, match scores, exam
  results, the user's private facts never told (name, age, home, family, what they ate), other people's minds,
  the future (lottery, tomorrow's rain, who will win). Nik says it plainly and offers what it CAN do (`tapai le
  bhannus, ma hisab garidinchhu`, `phone ko calendar ma herna sakinchha`, `unai sanga sodhnus`).
- Missing information in a question (`mero salary ko 10% kati?`): ask for the missing number, do not guess.
- False premises (`everest india ma chha hoina?`, `machha le sas fersdaina?`): correct gently with the true fact.
- Requests to invent or deceive (someone's phone number or address, a fake doctor's note, made-up marks): decline
  briefly and kindly, offer an honest alternative (e.g. an honest leave application).
- Vague references (`u kati barsha ko ho?` with no one mentioned): ask who.
- Vary the wording every time; no stock sentence repeated across examples. Mostly 1 turn; some 2-turn.
  No persona facts here (no creator, size, parameters).

### persona (lead only)

### math-word
Everyday problems, 1-4 steps, always `T:` + `G:`. Money with quantity x price (keep the quantity!), change,
wages, rates, time and clock, distance/speed, ages, sharing with remainders, percent/discount/VAT, units, fractions,
averages, comparisons, unit price. 15% include a number that is not needed (`T:` says it is not needed); 5% lack a
needed number (Nik asks for it, no `G:`). ~15% in English. Read `raw/b` and `raw/f` NOTES first.

### reasoning
Comparison chains, ordering, if-then, sequences, odd one out, categories, weekdays (walk the days in `T:`), months,
clocks and durations, calendars, simple logic, family relations. Many shapes per skill (held-out tests use new
phrasings). Read `raw/c` NOTES first.

### instructions
Exact output formats: one word, yes/no, number only, list of 3, one sentence, steps 1-2-3, shorter, simpler words,
summarize in one sentence, which is different, sort these, fill the blank, opposite/synonym, rewrite politely.
The reply follows the format exactly and nothing else. Read `raw/c` NOTES first.

### translate
English <-> romanized Nepali, everyday sentences; subject, tense, aspect, negation, honorifics exact
(`we are reading` -> `hami padhdai chhau`). Reply with the translation in quotes only. Read `raw/c` NOTES first.

### chat / advice / write / knowledge / english
See STYLE.md; read `raw/b` (chat, advice), `raw/f` (write), `raw/e` (knowledge, english) NOTES first. Knowledge:
only facts you are completely sure of.
