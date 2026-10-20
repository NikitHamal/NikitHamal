# Nik teacher data: audited math, reasoning and explanations

Hand-authored by the teacher (Claude) as **problem families and gold explanations**, not as one-off examples. Every number is computed exactly and every example is machine-audited before it is written. That's how one script produces 5k or 500k examples at the same quality.

```bash
python nik/data/teacher/build.py --n 5000 --out nik/data/teacher/nik_teacher_5k.jsonl     # committed: nik_teacher_5k.jsonl
python nik/data/teacher/build.py --n 90000 --seed 42 --out data/teacher_90k.jsonl           # committed (gzip): nik_teacher_90k.jsonl.gz
python nik/data/teacher/build.py --n 200000 --seed 7 --out data/teacher_200k.jsonl          # any size, ~40 s per 50k
python nik/data/teacher/audit.py nik/data/teacher/nik_teacher_5k.jsonl                      # independent re-audit
```

## What's inside

| part | contents |
|---|---|
| `math_gen.py`, 24 families | column addition with carries, subtraction with borrowing, long multiplication by partial products, division with remainder, fractions (common denominators via LCM, simplification), fraction-of, percentages, discounts, multi-item shopping with change, profit and loss %, simple interest, averages, speed/distance/time (all three directions), unit conversions, area and perimeter (rectangle, triangle), linear equations with a check, ratio sharing, HCF/LCM, prime testing, squares and square roots, bus passengers on/off, ages, savings goals, clock time |
| `reason_gen.py`, 12 families | ordering chains of 3–5 people (extremes and 2nd place); syllogisms, including invalid inferences ("sabai A B hun → sabai B A hun?" → **haina**); conditionals: modus ponens, modus tollens and *affirming the consequent* (→ "pakka bhanna sakidaina"); compass turns; 20 Nepali kinship terms; weekday arithmetic mod 7; Bikram Sambat dates across month ends; handshakes n(n−1)/2; chickens and goats; Venn counting; sequences (arithmetic, geometric, squares, Fibonacci-style); odd-one-out with the reason |
| `explain.py` | about 45 hand-written gold explanations: why the sky is blue, rain, day and night, seasons, gravity, earthquakes (and what to do in one), photosynthesis, rainbows, moon phases, hydropower, sound, vaccines, the heart, sleep, dengue, water, health, stress, anger, friendship, failure, gratitude, studying, memory, exams, time management, math practice, the internet, AI, programming, passwords, phone batteries, online scams, saving, loans, Nepal's unification, provinces, geography, Dashain, Lumbini, critical thinking, the Nepali script, laughter. Each has several question phrasings |
| `math2.py`, 17 families | BODMAS order of operations (and why left-to-right is wrong), decimals and money, negative temperatures, % change against the *old* value, compound vs simple interest, **best-buy per-kilo decisions**, work-rate with fractions, probability, median, rounding, **numbers written in Nepali words** (lakh/karod system), box volume, consecutive numbers, the divisibility-by-3 rule, Nepal time = UTC + 5:45, **distractor problems** with irrelevant numbers, and the 1 kg cotton vs 1 kg iron trick |
| `reason2.py`, 5 families | **critique**: the user proposes an answer (40% right, 60% subtly wrong) and Nik re-derives it step by step, then confirms or gently corrects; **explain on request**: a short answer, then "kasari?" gets the reasoning in prose; seating by elimination; a truth-teller/liar puzzle; **reading a price table** |
| `explain2.py` | about 40 more gold explanations: why the earth is round, stars, volcanoes, snow, boiling and altitude, magnets, air, blood, disease, forests, climate change, plastic, waste, Nepal's democracy timeline, the constitution, voting, the anthem, Kukur Tihar, Karnali, the three valley cities, how computers, apps, WiFi and the cloud work, cyberbullying, budgeting (50-30-20), interest, shares, decisions, logic, fake news, habits, English, yoga, caffeine, eye care (20-20-20), waking early, patience, forgiveness, AI and jobs |
| `build.py` | mix: 52% math, 33% reasoning, 9% explanations, 6% two-turn follow-ups. Polite leads ("sir, …", "malai help garnus: …") are matched to the question type |

**Style rules Nik learns:** short step-by-step thinking ("pahila … ani … antama …"); equations written with `+ - x / =`; a closing **"jaach: … milyo"** check where it makes sense; full-sentence answers; honest "pakka bhanna sakidaina" when the premises don't decide the question; gender-neutral ergative constructions ("usle …", "X le …").

## The audit (`audit.py`)

Every example must pass every check:

- **Exact math:** every equation chain in the reasoning and the answer is re-evaluated with exact fractions (`verify.py`). The 5k set has **12,025 equations verified, 0 wrong**.
- **Answer = gold:** the final number or keyword in the answer must match the computed gold.
- **Reasoning present** for math and logic.
- **Script and style:** no Devanagari or stray Unicode in Nik's turns; Nik's own writing uses the canonical spellings (`chha`, `hunchha`, never `xa`, `cha` or `hunxa`, which only appear in user turns).
- **Repetition, length bounds and duplicate prompts.**

The auditor is itself tested by planting errors (a wrong equation, a wrong answer, Devanagari, chat spellings, repetition, a missing trace), and it must catch each one. That test found and fixed a real verifier bug: sentence-final periods were hiding equations from the checker.

## Iterating

The audit loop: generate → automatic audit → human-style review of a random sample → patch families → rebuild. **90k build:** 90,000 examples, 87,661 unique prompts, **230,533 equations verified, 0 wrong**, and a 100% independent re-audit, in 86 s. Each hand-written explanation is capped at about 30 occurrences so it can't dominate (memorization risk).

Round 2 fixes: the verifier learned negative numbers (`-6 + 15 = 9` had been mis-read as `6 + 15`); a period inside expressions no longer hides equations; follow-up dialogs are exempt from "think required" because they explain in prose; one factual fix (the national anthem was adopted in BS 2064); explanation-repeat cap.

The first review round fixed:
- conditional verb conjugations ("fij aaena / aaunthyo");
- a gendered verb with female names (now ergative: "X le … mukh garyo");
- polite math-only leads that appeared on non-math questions;
- an awkward "+ 0" remainder;
- vague kinship answers (split into 20 precise relations).
