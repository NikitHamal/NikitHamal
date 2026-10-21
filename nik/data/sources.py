"""Public source manifest and mix plan for the next corpus (survey 2026-10-21).

Every source that enters a training mix must also be added to
`nik/data/corpus_v2/manifest.py` with a verified licence and pass the corpus audit.
Rows marked (verify) are uploader-asserted or gated; do not train on them until the
primary licence is checked and recorded.

    python nik/data/sources.py
"""
SOURCES = [
    {'name': 'fineweb2_npi_deva', 'licence': 'ODC-BY-1.0', 'size': '4.89M docs, ~2.5-3B tok', 'verified': True,
     'url': 'https://huggingface.co/datasets/HuggingFaceFW/fineweb-2',
     'fetch': 'hf download HuggingFaceFW/fineweb-2 --repo-type dataset --include "data/npi_Deva/train/*" --local-dir data/fw2_ne'},
    {'name': 'indiccorp2_ne', 'licence': 'CC0-1.0', 'size': '16.99M docs, ~1.5-2B tok', 'verified': True,
     'url': 'https://huggingface.co/datasets/ai4bharat/IndicCorpV2',
     'fetch': 'hf download ai4bharat/IndicCorpV2 --repo-type dataset --include "data/ne.txt" --local-dir data/indiccorp2'},
    {'name': 'hplt2_npi_deva', 'licence': 'CC0-1.0 packaging', 'size': '2.78M docs, ~1B tok', 'verified': True,
     'url': 'https://huggingface.co/datasets/HPLT/HPLT2.0_cleaned',
     'fetch': 'hf download HPLT/HPLT2.0_cleaned --repo-type dataset --include "npi_Deva/*" --local-dir data/hplt2_ne'},
    {'name': 'wikipedia_ne', 'licence': 'CC-BY-SA-4.0', 'size': '32,885 articles, ~15-20M tok', 'verified': True,
     'url': 'https://huggingface.co/datasets/wikimedia/wikipedia',
     'fetch': 'hf download wikimedia/wikipedia --repo-type dataset --include "20231101.ne/*" --local-dir data/wiki_ne'},
    {'name': 'cyferaj_news', 'licence': 'Apache-2.0 (verify uploader chain)', 'size': '1.006M docs, ~0.5B tok', 'verified': False,
     'url': 'https://huggingface.co/datasets/cyferaj/nepali-news-corpus',
     'fetch': 'hf download cyferaj/nepali-news-corpus --repo-type dataset --local-dir data/news'},
    {'name': 'iriis_text', 'licence': 'MIT (verify uploader chain)', 'size': '6.39M articles, ~2B tok', 'verified': False,
     'url': 'https://huggingface.co/datasets/IRIIS-RESEARCH/Nepali-Text-Corpus',
     'fetch': 'hf download IRIIS-RESEARCH/Nepali-Text-Corpus --repo-type dataset --local-dir data/iriis'},
    {'name': 'nepali_textbooks', 'licence': 'Apache-2.0 (verify OCR provenance)', 'size': '5,634 segments, 16.4M chars', 'verified': False,
     'url': 'https://huggingface.co/datasets/dineshkarki/nepali-textbooks-corpus',
     'fetch': 'hf download dineshkarki/nepali-textbooks-corpus --repo-type dataset --local-dir data/textbooks'},
    {'name': 'aya_npi', 'licence': 'Apache-2.0 packaging (MT text)', 'size': '4.12M translated examples', 'verified': False,
     'url': 'https://huggingface.co/datasets/CohereForAI/aya_collection',
     'fetch': 'hf download CohereForAI/aya_collection --repo-type dataset --local-dir data/aya_ne'},
    {'name': 'gsm8k', 'licence': 'MIT', 'size': '8.5k English word problems', 'verified': True,
     'url': 'https://huggingface.co/datasets/openai/gsm8k',
     'fetch': 'hf download openai/gsm8k --repo-type dataset --local-dir data/gsm8k'},
    {'name': 'math', 'licence': 'MIT', 'size': '12.5k competition problems', 'verified': True,
     'url': 'https://github.com/hendrycks/math',
     'fetch': '# clone/download per repo README; hand-translate the traces'},
    {'name': 'metamathqa', 'licence': 'MIT', 'size': '395k CoT problems', 'verified': True,
     'url': 'https://huggingface.co/datasets/meta-math/MetaMathQA',
     'fetch': 'hf download meta-math/MetaMathQA --repo-type dataset --local-dir data/metamath'},
    {'name': 'openslr54', 'licence': 'CC-BY-SA-4.0', 'size': '154.6h ASR, 527 speakers', 'verified': True,
     'url': 'https://www.openslr.org/54/', 'fetch': 'wget https://www.openslr.org/resources/54/Nepali.zip'},
    {'name': 'openslr43', 'licence': 'CC-BY-SA-4.0', 'size': '~4-6h read speech', 'verified': True,
     'url': 'https://www.openslr.org/43/', 'fetch': 'wget https://www.openslr.org/resources/43/Nepali.zip'},
    {'name': 'fleurs_ne', 'licence': 'CC-BY-4.0', 'size': '~10h train', 'verified': True,
     'url': 'https://huggingface.co/datasets/google/fleurs', 'fetch': 'hf download google/fleurs --repo-type dataset --local-dir data/fleurs'},
]

MIX_300M = [
    ('fineweb2_npi_deva filtered (language_score>0.85, wordlist_ratio>0.5)', '120M'),
    ('indiccorp2_ne + hplt2_npi_deva after global dedup', '40M'),
    ('wikipedia_ne + textbooks + news', '25M'),
    ('romanized synthetic from clean Devanagari (our romanizer)', '15M'),
    ('GSM8K/MATH/hand-written exam-style traces (translated by the teacher agent)', '5M'),
    ('TOTAL', '205M (room to 300M)'),
]

MIX_3B = [
    ('wikipedia + textbooks + news, over-sample Wikipedia/textbooks 2-3x', '~0.6B'),
    ('fineweb2_npi_deva', '2.5-3B'),
    ('indiccorp2_ne + hplt2_npi_deva', '2.5-3B'),
    ('global MinHash + URL dedup; hold out 20M validation', '4-4.5B final'),
]

TRAPS = [
    'Wikitext markup: strip templates/tables/refs; use HF parquet, not raw dumps.',
    'Transliteration mismatch: casual romanized vs ITRANS; FineWeb-2 npi_Latn has only ~2,500 real romanized docs; himalaya-ai/nepali-roman-pretrain (22GB) is machine romanization with bugs and no licence; do not train raw.',
    'Contamination: never train on GSM8K/MATH test, AIME/AMC, NuminaMath eval, the 900-prompt np-neupane romanized eval, or BarshaKC eval; add them to the corpus audit eval sets.',
    'No open NEB/Loksewa/SEE corpus; official PDFs are copyrighted. Hand-write exam-style gold; do not copy.',
    'Licence ambiguity: Sakonii card CC0 vs project docs Apache-2.0; CC-100, OSCAR/CulturaX, OpenHermes unclear; OpenSLR 143 is NC-SA. Resolve before training.',
    'Duplication: IRIIS/cyferaj/FineWeb/IndicCorp overlap heavily; dedup by URL + MinHash across all sources.',
    'OCR noise in textbooks: broken conjuncts and misread digits; verify every equation-bearing row.',
]


def main():
    print('SOURCES (verified first)')
    for s in sorted(SOURCES, key=lambda x: (not x['verified'], x['name'])):
        print(f"  {'OK ' if s['verified'] else 'VERIFY'} {s['name']:22s} {s['licence']:34s} {s['size']}")
        print(f"         {s['fetch']}")
    print('\nTOP-TIER 300M MIX')
    for name, size in MIX_300M:
        print(f'  {size:8s} {name}')
    print('\n3-5B CORPUS PLAN')
    for name, size in MIX_3B:
        print(f'  {size:8s} {name}')
    print('\nTRAPS')
    for t in TRAPS:
        print(' -', t)


if __name__ == '__main__':
    main()
