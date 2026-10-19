# Data

Everything is reproducible: `nik/data/build_corpus.py` and `nik/data/gen_sft.py`.

## Pretraining corpus: casual romanized Nepali

People type Nepali as `"nepal ko rajdhani kathmandu ho"`, not as scholarly ITRANS (`nepaala ko raajadhaanii`). There is no large corpus in that style, so we **make one** from clean Devanagari text.

| source | license | used |
|---|---|---|
| `sabin1234/NEPALI_TO_ROMANIZED_WIKIPEDIA`, Devanagari column (Nepali Wikipedia, 21k articles) | Apache-2.0 | split into ~600-char paragraphs |
| `Sakonii/nepalitext-language-model-dataset`, news and web, 14 shards × ~190M chars | Apache-2.0 | 1–2 shards |
| `syubraj/roman2nepali-transliteration`, 2.4M word pairs | MIT | romanizer lexicon |

The romanized column of the Wikipedia set is *not* used: it is noisy, with ITRANS doubling and typos.

**Romanizer** (`nik/data/romanize.py`):
1. Lexicon lookup (2.4M inflected forms plus a hand-checked table of the ~300 most frequent words).
2. Suffix-aware splitting for postpositions (`-bata`, `-sanga`, `-ma`, `-ko`, `-haru…`).
3. A rule engine for everything else:
   - casual vowel folding (`aa→a`, `ii→i`);
   - word-final schwa deletion, kept after conjuncts (`dharma`, `matra`);
   - casual consonants (`छ→chh`, `फ→f`, `क्ष→ksh`, `ज्ञ→gy`, `व→b/w`);
   - Devanagari digits converted to ASCII.

The rule engine alone matches the lexicon exactly on 60% of held-out words. Most remaining differences are spelling variants of English loanwords.

After cleaning (drop lines with leftover foreign script or junk, normalize whitespace, dedupe by hash), one news shard plus Wikipedia gives **248,901 documents, 247.6M characters and 62.4M tokens**.

## SFT: chat, persona, reasoning

`gen_sft.py` generates 60k–120k conversations from hand-written seeds. It is procedural, license-clean, and contains no copied model outputs.

| category | what it teaches |
|---|---|
| identity | who Nik is, who built it, what it can and can't do |
| nikit | facts from nikit.is-a.dev: Consica Labs, Lami Nepal, NEBians, AstroWeb, skills, essays, contact |
| smalltalk | greetings, feelings, advice, jokes, goodbyes |
| nepal | grounded facts (capital, Sagarmatha 8848.86 m, 7 provinces, festivals…) |
| reason | word problems, comparison, weekdays, sequences, letter counting, time/money, syllogisms |
| math | column addition with carries, subtraction with borrowing, long multiplication, division with remainder, percentages, multi-step shopping |
| philosophy | short reflections in the voice of Nikit's essays |
| multi | 2–4 turns stitched together, so the model uses earlier context |

Reasoning and math answers carry a `think` trace. Only Nik's side of each conversation is learned (loss mask). During SFT, 20–25% of each batch is pretraining text, so the model keeps its general Nepali.
