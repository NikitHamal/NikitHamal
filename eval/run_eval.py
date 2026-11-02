#!/usr/bin/env python3
"""Reproducible Zero-GPU Evaluation Harness for nik 0.1.

Covers 5 benchmark categories (125 total items):
  1. short_chat            (25 items): greetings, persona, persona-trap guard, empathy, advice without spurious math
  2. multiturn_chat        (20 items): multi-turn memory recall, arithmetic state tracking, pronoun/entity resolution, follow-ups
  3. arithmetic            (30 items): 15 exact arithmetic (incl. borrow-across-zero & multi-borrow) + 15 word problems
  4. nepali_comprehension  (25 items): reading comprehension, yes/no negation, epistemic honesty/abstention, relational order, list ops, calendar, grammar
  5. english_comprehension (25 items): English reading passages, factual QA, EN<->NE translation, English grammar, quantitative comprehension

Usage:
    python eval/run_eval.py [--model nik/web/model/nik-0.1.bin] [--mode raw|chat|breakthrough] [--out eval/results/baseline.json]
"""
from __future__ import annotations
import argparse
import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build_benchmark_suite() -> list[dict]:
    items: list[dict] = []

    # =========================================================================
    # 1. SHORT CHAT (25 items)
    # =========================================================================
    short_chat_specs = [
        # Greetings & conversational warmth
        ("sc_01", "greeting", "namaste! timi ko hau?",
         {"type": "any_substr", "must_any": ["nik", "ai", "sano", "nepal"], "forbid": ["="]}),
        ("sc_02", "greeting", "kasto chha timro haalkhabar?",
         {"type": "any_substr", "must_any": ["thik", "ramro", "sanchai", "khusi", "hajur", "tapai"], "forbid": ["="]}),
        ("sc_03", "greeting", "hello! can we talk in romanized nepali?",
         {"type": "any_substr", "must_any": ["nepali", "yes", "sure", "sakincha", "sakinchha", "hunchha", "kura", "gaff"], "forbid": ["="]}),
        ("sc_04", "greeting", "dhanyabad hai nik, dherai sahayog bhayo!",
         {"type": "any_substr", "must_any": ["swagat", "khusi", "kehi chhaina", "dhanyabad", "sajilo", "sodhnus", "welcome"], "forbid": ["="]}),
        ("sc_05", "greeting", "subha bihani! aaja ko din kasto rahos?",
         {"type": "any_substr", "must_any": ["subha", "bihani", "ramro", "din", "khusi", "saphal"], "forbid": ["="]}),

        # Persona & creator grounding
        ("sc_06", "persona", "timilai kasle banayeko ho?",
         {"type": "all_substr", "must_all": ["nikit"]}),
        ("sc_07", "persona", "nikit hamal ko hun?",
         {"type": "any_substr", "must_any": ["developer", "android", "engineer", "nepal", "full-stack", "banayeko"]}),
        ("sc_08", "persona", "timi kun bhasha ma kura garna sakchhau?",
         {"type": "any_substr", "must_any": ["nepali", "english", "angreji", "romanized"]}),
        ("sc_09", "persona", "nikit ko email address ke ho?",
         {"type": "any_substr", "must_any": ["iamnikithamal", "gmail"]}),
        ("sc_10", "persona", "ke timi internet bina browser mai chalchhau?",
         {"type": "any_substr", "must_any": ["browser", "device", "ho", "chalchhu", "offline", "bina"]}),

        # Persona-trap resistance (must NOT hallucinate 'nikit' on unrelated people)
        ("sc_11", "trap_guard", "sunita ko bahini ko naam sita ho. sunita ko bahini ko ho?",
         {"type": "substr_and_forbid", "must_any": ["sita"], "forbid": ["nikit"]}),
        ("sc_12", "trap_guard", "ramesh pokhara ma baschha ra u vakil ho. ramesh ke kaam garchha?",
         {"type": "substr_and_forbid", "must_any": ["vakil"], "forbid": ["nikit", "developer", "android"]}),
        ("sc_13", "trap_guard", "mero sathi anil le naya cycle kinyo. anil le ke kinyo?",
         {"type": "substr_and_forbid", "must_any": ["cycle"], "forbid": ["nikit"]}),
        ("sc_14", "trap_guard", "kiran ko ghar biratnagar ma chha. kiran ko ghar kaha chha?",
         {"type": "substr_and_forbid", "must_any": ["biratnagar"], "forbid": ["nikit", "kathmandu", "lalitpur"]}),
        ("sc_15", "trap_guard", "maya le aaja dal bhat pakayin. maya le ke pakayin?",
         {"type": "substr_and_forbid", "must_any": ["dal", "bhat"], "forbid": ["nikit"]}),

        # Empathy & emotional support
        ("sc_16", "empathy", "aaja mero exam naramro bhayo, ekdam dukhi chhu.",
         {"type": "any_substr", "must_any": ["dukha", "chinta", "thik", "arko", "himmat", "bistarai", "ramro"], "forbid": ["="]}),
        ("sc_17", "empathy", "oe nik, aaja ta dherai thakai lagyo yaar",
         {"type": "any_substr", "must_any": ["aaram", "pani", "sutnus", "thakai", "khana", "bistarai", "rest"], "forbid": ["="]}),
        ("sc_18", "empathy", "malai naya sahar ma sathi banauna garo bhairako chha, k garu?",
         {"type": "any_substr", "must_any": ["sathi", "kura", "bistarai", "bhet", "sajilo", "kaam", "ramro"], "forbid": ["="]}),
        ("sc_19", "empathy", "tihar ma ghar jana paina, man nai dukhyo",
         {"type": "any_substr", "must_any": ["ghar", "tihar", "phone", "kura", "dukha", "chinta", "parivar", "ramailo"], "forbid": ["="]}),
        ("sc_20", "empathy", "mero tauko dukhirako chha, ke garne hola?",
         {"type": "any_substr", "must_any": ["pani", "aaram", "doctor", "sutnus", "tauko", "chiso"], "forbid": ["="]}),

        # Everyday advice & number-in-chat trap resistance (must NOT hallucinate equations when user mentions a number in chat)
        ("sc_21", "advice_no_math_trap", "mahina ko 25000 kamaunchhu, saving kasari suru garne?",
         {"type": "substr_and_forbid", "must_any": ["bachat", "kharcha", "saving", "paisa", "budget", "bank", "mahina", "chhutyaunus", "rakhnus"], "forbid": ["= 1.2", "25000 / 15000"]}),
        ("sc_22", "advice_no_math_trap", "ma 3 hapta dekhi gym jaadai chhu tara kehi farak dekhina",
         {"type": "substr_and_forbid", "must_any": ["samaya", "hapta", "bistarai", "khana", "niyamit", "lagatar", "mahina", "protein", "aaram", "farak", "dhairya"], "forbid": ["1 hapta ma gym jaada tapai le thaha"]}),
        ("sc_23", "advice_no_math_trap", "pahilo job interview bholi chha, k k tayari garu?",
         {"type": "substr_and_forbid", "must_any": ["interview", "company", "prasna", "samaya", "cv", "resume", "abhyas", "kapada", "tayari", "bholi", "aatmabiswas"], "forbid": ["dosro din ko antim din"]}),
        ("sc_24", "advice_no_math_trap", "राति छिटो निद्रा नलागे के गर्ने?",
         {"type": "any_substr", "must_any": ["phone", "mobile", "screen", "sutne", "nidra", "pani", "chiya", "coffee", "samaya", "aaram", "kotha"], "forbid": ["="]}),
        ("sc_25", "advice_no_math_trap", "timi lai sabai bhanda man parne khana k ho?",
         {"type": "substr_and_forbid", "must_any": ["ai", "khandina", "momo", "dal", "bhat", "nepali", "program", "khana"], "forbid": ["tapai lai sabai bhanda man parchha."]}),
    ]
    for item_id, subcat, prompt, rule in short_chat_specs:
        items.append({
            "id": item_id,
            "category": "short_chat",
            "subcategory": subcat,
            "prompt": prompt,
            "rule": rule,
        })

    # =========================================================================
    # 2. MULTI-TURN CHAT (20 conversations)
    # =========================================================================
    multiturn_specs = [
        # Memory recall across turns
        ("mt_01", "memory_city",
         ["namaste, mero naam aarati ho ra ma pokhara bata hu.",
          "mero bhai 12 barsha ko chha.",
          "ma kun thau bata hu?"],
         {"type": "any_substr", "must_any": ["pokhara"]}),
        ("mt_02", "memory_age",
         ["namaste, mero naam aarati ho ra ma pokhara bata hu.",
          "mero bhai 12 barsha ko chha.",
          "bhai kati barsha ko bhayo?"],
         {"type": "any_substr", "must_any": ["12"]}),
        ("mt_03", "memory_food",
         ["malai selroti sabai bhanda man parchha.",
          "aaja pani parirako chha.",
          "maile kun kura dherai man parchha bhaneko?"],
         {"type": "any_substr", "must_any": ["selroti"]}),
        ("mt_04", "memory_residence",
         ["ma pahile dharan ma basthe, tara aile lalitpur ma baschhu.",
          "ma aile kaha baschhu?"],
         {"type": "any_substr", "must_any": ["lalitpur"]}),
        ("mt_05", "memory_name",
         ["mero naam dipesh ho ra ma shikshak hu.",
          "mero naam ke ho?"],
         {"type": "any_substr", "must_any": ["dipesh"]}),
        ("mt_06", "memory_profession",
         ["mero naam dipesh ho ra ma shikshak hu.",
          "ma ke kaam garchhu?"],
         {"type": "any_substr", "must_any": ["shikshak", "padhaune", "teacher"]}),
        ("mt_07", "memory_pet",
         ["mero ghar ma kale naam ko kukur chha.",
          "mero kukur ko naam ke ho?"],
         {"type": "any_substr", "must_any": ["kale"]}),

        # Multi-turn arithmetic state & follow-up calculations
        ("mt_08", "state_math",
         ["mero sanga 200 rupiya chha.",
          "maile 75 rupiya ko kitab kinen. aba kati rupiya baki chha?"],
         {"type": "final_number", "gold": 125}),
        ("mt_09", "state_math",
         ["jhola ma 15 wata syau chhan.",
          "aama le 8 wata syau thap dinubhayo. aba jamma kati wata syau bhaye?"],
         {"type": "final_number", "gold": 23}),
        ("mt_10", "state_math",
         ["125 + 75 kati hunchha?",
          "tyasma 50 thapda kati hunchha?"],
         {"type": "final_number", "gold": 250}),
        ("mt_11", "state_math",
         ["40 x 6 kati hunchha?",
          "aba tyo uttar bata 40 ghatauda kati hunchha?"],
         {"type": "final_number", "gold": 200}),
        ("mt_12", "state_math",
         ["euta kalam ko 30 rupiya parchha. 4 wata kalam ko kati parchha?",
          "pakka 120 nai hunchha?"],
         {"type": "any_substr", "must_any": ["120", "ho", "pakka", "milyo"]}),
        ("mt_13", "state_math",
         ["350 - 125 kati hunchha?",
          "jaach garera bhana ta, kati thiyo uttar?"],
         {"type": "final_number", "gold": 225}),

        # Pronoun & entity resolution across turns
        ("mt_14", "entity_pronoun",
         ["sita bholi chitwan jadai chhin.",
          "u kaha jadai chhin?"],
         {"type": "any_substr", "must_any": ["chitwan"]}),
        ("mt_15", "entity_pronoun",
         ["bikash le 3 wata kitab ra 2 wata kapi kinyo.",
          "usle kati wata kitab kinyo?"],
         {"type": "final_number", "gold": 3}),
        ("mt_16", "entity_pronoun",
         ["hamro school bihan 9 baje suru hunchha ra 4 baje chhutti hunchha.",
          "school kati baje suru hunchha?"],
         {"type": "final_number", "gold": 9}),
        ("mt_17", "entity_pronoun",
         ["nepal ko sabai bhanda thulo taal rara taal ho.",
          "tyo taal kun jilla ma parchha ki naam ke ho?"],
         {"type": "any_substr", "must_any": ["rara", "mugu"]}),

        # Bilingual / English multi-turn
        ("mt_18", "english_multiturn",
         ["My sister Maya lives in Butwal.",
          "Where does Maya live?"],
         {"type": "any_substr", "must_any": ["butwal"]}),
        ("mt_19", "english_multiturn",
         ["I bought 14 mangoes and gave 6 to my neighbor.",
          "How many mangoes do I have left?"],
         {"type": "final_number", "gold": 8}),
        ("mt_20", "honest_multiturn",
         ["mero naam binod ho ra ma kathmandu ma baschhu.",
          "mero buwa ko naam k ho?"],
         {"type": "substr_and_forbid",
          "must_any": ["thaha chhaina", "bhannubhayeko chhaina", "bhaneko chhaina", "tha chhaina", "mentioned", "ulleskh"],
          "forbid": ["buwa ko naam binod"]}),
    ]
    for item_id, subcat, turns, rule in multiturn_specs:
        items.append({
            "id": item_id,
            "category": "multiturn_chat",
            "subcategory": subcat,
            "turns": turns,
            "rule": rule,
        })

    # =========================================================================
    # 3. ARITHMETIC: EXACT (15 items) & WORD PROBLEMS (15 items) = 30 items
    # =========================================================================
    arith_exact_specs = [
        # Addition (3 to 7 digits)
        ("ar_01", "add_3d", "485 + 379 kati hunchha?", 864),
        ("ar_02", "add_5d", "46825 + 39487 kati hunchha?", 86312),
        ("ar_03", "add_7d", "8473929 + 384756 kati hunchha?", 8858685),
        # Subtraction with borrows (including borrow chains and zeros where v12p struggles)
        ("ar_04", "sub_borrow", "962 - 288 kati hunchha?", 674),
        ("ar_05", "sub_borrow", "813 - 467 kati hunchha?", 346),
        ("ar_06", "sub_borrow", "642 - 278 = ?", 364),
        ("ar_07", "sub_zero_borrow", "704 - 358 kati hunchha?", 346),
        ("ar_08", "sub_zero_borrow", "5002 - 1847 kati hunchha?", 3155),
        ("ar_09", "sub_7d_zero", "6000000 - 3486521 kati?", 2513479),
        # Multiplication
        ("ar_10", "mul_2x1", "87 x 6 kati hunchha?", 522),
        ("ar_11", "mul_3x1", "957 ko 2 guna kati?", 1914),
        ("ar_12", "mul_3x2", "125 x 16 = ?", 2000),
        # Division & Percentage
        ("ar_13", "div_exact", "864 / 8 = ?", 108),
        ("ar_14", "div_2d", "360 / 24 kati hunchha?", 15),
        ("ar_15", "percent", "480 ko 35% kati hunchha?", 168),
    ]
    for item_id, subcat, prompt, gold in arith_exact_specs:
        items.append({
            "id": item_id,
            "category": "arithmetic",
            "subcategory": f"exact_{subcat}",
            "prompt": prompt,
            "rule": {"type": "final_number", "gold": gold},
        })

    arith_word_specs = [
        ("aw_01", "word_add_sub",
         "mero sanga 500 rupiya thiyo. 180 rupiya kharcha bhayo. aba kati rupiya baki?", 320),
        ("aw_02", "word_mul",
         "euta kitab 250 rupiya ko chha. 4 wata kitab ko kati parchha?", 1000),
        ("aw_03", "word_mul_sub",
         "aarati sanga 90 rupiya chha. usle 4 wata chakleti kinyo, ek ko 12 rupiya. aba kati rupiya bachyo?", 42),
        ("aw_04", "word_grid_sub",
         "euta bagaincha ma 8 wata line chhan ra har line ma 6 wata rukh. 7 wata rukh dhale bhane kati rukh baki?", 41),
        ("aw_05", "word_mul_add",
         "ek kilo aalu 40 rupiya. 3 kilo aalu ra 25 rupiya ko dhaniya kinda jamma kati lagchha?", 145),
        ("aw_06", "word_half_sub",
         "ganesh 50 barsha ko chha. usko chhora usko umer ko aadha bhanda 5 barsha kam chha. chhora kati barsha ko?", 20),
        ("aw_07", "word_bus_stops",
         "ek bus ma 52 jana thiye. pahilo stop ma 17 jana jhare ra 9 jana chadhe. aba kati jana bhaye?", 44),
        ("aw_08", "word_shop_change",
         "maile 3 kg aalu 60 rupiya kg ko dar ma kinen ra 500 ko note diye. kati firta aaunchha?", 320),
        ("aw_09", "word_weekly_rate",
         "rita hapta ma 4 din, har din 45 minet daudinchhin. hapta ma jamma kati minet daudinchhin?", 180),
        ("aw_10", "word_share_div",
         "12 jana sathi le 3600 rupiya barabar banda ek jana lai kati parchha?", 300),
        ("aw_11", "word_age_diff",
         "aama bhanda hari 25 barsa sano chha. aama 52 barsa ki bhaye hari kati barsa ko?", 27),
        ("aw_12", "word_class_present",
         "kaksha ma 28 keta ra 32 keti chhan. 6 jana anupasthit chhan. kati jana upasthit?", 54),
        ("aw_13", "word_en_rate",
         "A bus travels at 60 km per hour for 3 hours, then 15 km more. How far did it travel in total?", 195),
        ("aw_14", "word_en_boxes",
         "There are 7 boxes with 8 apples each. 5 apples are rotten. How many good apples?", 51),
        ("aw_15", "word_discount",
         "euta kitab ko mol 400 rupiya. 10% chhut pachhi 2 wata kitab ko kati tirne?", 720),
    ]
    for item_id, subcat, prompt, gold in arith_word_specs:
        items.append({
            "id": item_id,
            "category": "arithmetic",
            "subcategory": subcat,
            "prompt": prompt,
            "rule": {"type": "final_number", "gold": gold},
        })

    # =========================================================================
    # 4. ROMANIZED-NEPALI COMPREHENSION (25 items)
    # =========================================================================
    nepali_specs = [
        # Reading comprehension (quantity/attribute extraction)
        ("nc_01", "reading", '"gopal le bazaar bata 3 kilo aalu ra 2 kilo pyaj kinyo." gopal le kati kilo pyaj kinyo?',
         {"type": "final_number", "gold": 2}),
        ("nc_02", "reading", '"gopal le bazaar bata 3 kilo aalu ra 2 kilo pyaj kinyo." gopal le kati kilo aalu kinyo?',
         {"type": "final_number", "gold": 3}),
        ("nc_03", "reading", '"sunita doctor ho ra uski bahini engineer." sunita ko bahini ke kaam garchhin?',
         {"type": "substr_and_forbid", "must_any": ["engineer"], "forbid": ["doctor", "nikit"]}),
        ("nc_04", "reading", '"sunita doctor ho ra uski bahini engineer." sunita ke kaam garchhin?',
         {"type": "substr_and_forbid", "must_any": ["doctor"], "forbid": ["nikit"]}),
        ("nc_05", "reading", '"hari le bibek lai 150 rupiya rin diyo." kasle rin payo?',
         {"type": "substr_and_forbid", "must_any": ["bibek"], "forbid": ["nikit"]}),
        ("nc_06", "reading", '"table ma रातो kitab, निलो kalam ra हरियो jhola chha." kalam kun ranga ko chha?',
         {"type": "any_substr", "must_any": ["nilo", "निलो", "blue"]}),
        ("nc_07", "reading", '"bus bihan 7 baje pokhara bata chutyo ra 2 baje kathmandu pugyo." bus kati baje kathmandu pugyo?',
         {"type": "final_number", "gold": 2}),

        # Negation & Yes/No comprehension
        ("nc_08", "yesno", '"ram ghar gayo tara shyam school mai basyo." ke shyam ghar gayo?',
         {"type": "substr_and_forbid", "must_any": ["hoina", "chhaina", "gayena", "school"], "forbid": ["ho, shyam ghar gayo"]}),
        ("nc_09", "yesno", '"ram ghar gayo tara shyam school mai basyo." ke ram ghar gayo?',
         {"type": "any_substr", "must_any": ["ho", "gayo"]}),
        ("nc_10", "yesno", '"aaja sukrabar ho, bank khula chha tara bholi sanibar bandha hunchha." ke aaja bank khula chha?',
         {"type": "any_substr", "must_any": ["ho", "khula"]}),

        # Epistemic honesty / unanswerable abstention
        ("nc_11", "honesty", "mero naam binod ho. mero buwa ko naam k ho?",
         {"type": "substr_and_forbid",
          "must_any": ["thaha chhaina", "bhannubhayeko chhaina", "bhaneko chhaina", "tha chhaina", "ulleskh"],
          "forbid": ["buwa ko naam binod"]}),
        ("nc_12", "honesty", "sita le bazaar bata falful kinin. sita ko umer kati barsha ho?",
         {"type": "substr_and_forbid",
          "must_any": ["thaha chhaina", "bhannubhayeko chhaina", "bhaneko chhaina", "diyeko chhaina", "ulleskh", "chhaina"],
          "forbid": ["barsha ki hun", "20 barsha", "25 barsha"]}),

        # Relational / transitive ordering & comparison
        ("nc_13", "relational", "ram sita bhanda agla chha. sita gita bhanda agli chhin. sabai bhanda hocho ko?",
         {"type": "substr_and_forbid", "must_any": ["gita"], "forbid": ["jawaf sita", "sabai bhanda hocho sita", "sabai bhanda hocho ram"]}),
        ("nc_14", "relational", "ram sita bhanda agla chha. sita gita bhanda agli chhin. sabai bhanda aglo ko?",
         {"type": "substr_and_forbid", "must_any": ["ram"], "forbid": ["jawaf sita", "jawaf gita"]}),
        ("nc_15", "relational", "kaksha ma 14 keta ra 17 keti chhan. keti kati le badhi chhan?",
         {"type": "final_number", "gold": 3}),

        # List operations & extrema
        ("nc_16", "list_ops", "7, 42, 19, 3 madhye sabai bhanda sano kun?",
         {"type": "final_number", "gold": 3}),
        ("nc_17", "list_ops", "7, 42, 19, 3 madhye sabai bhanda thulo kun?",
         {"type": "final_number", "gold": 42}),
        ("nc_18", "list_ops", "5, 9, 2 lai thulo bata sano kram ma lekha.",
         {"type": "any_substr", "must_any": ["9, 5, 2", "9 5 2", "9,5,2"]}),

        # Calendar, units, & general Nepali knowledge
        ("nc_19", "calendar", "aaja sombar ho bhane 10 din pachhi kun bar hunchha?",
         {"type": "any_substr", "must_any": ["bihibar"]}),
        ("nc_20", "calendar", "ek barsa ma lagbhag kati hapta hunchhan?",
         {"type": "final_number", "gold": 52}),
        ("nc_21", "knowledge", "nepal ma jamma kati wata pradesh chhan?",
         {"type": "final_number", "gold": 7}),
        ("nc_22", "logic", "sabai biralo janawar hun. tom biralo ho. tom k ho?",
         {"type": "any_substr", "must_any": ["janawar", "biralo"]}),

        # Nepali grammar & vocabulary
        ("nc_23", "grammar", '"u kheldai chha" lai negative banau.',
         {"type": "any_substr", "must_any": ["kheldai chhaina", "kheldaina"]}),
        ("nc_24", "grammar", '"kalam" ko plural (bahubachan) ke hunchha?',
         {"type": "any_substr", "must_any": ["kalamharu"]}),
        ("nc_25", "vocab", '"river" lai nepali ma k bhanchha?',
         {"type": "any_substr", "must_any": ["nadi", "khola"]}),
    ]
    for item_id, subcat, prompt, rule in nepali_specs:
        items.append({
            "id": item_id,
            "category": "nepali_comprehension",
            "subcategory": subcat,
            "prompt": prompt,
            "rule": rule,
        })

    # =========================================================================
    # 5. ENGLISH COMPREHENSION (25 items)
    # =========================================================================
    english_specs = [
        # English reading comprehension
        ("ec_01", "reading", '"Maya put 4 red books and 6 blue books on the shelf." How many blue books are on the shelf?',
         {"type": "final_number", "gold": 6}),
        ("ec_02", "reading", '"Maya put 4 red books and 6 blue books on the shelf." How many books are on the shelf in total?',
         {"type": "final_number", "gold": 10}),
        ("ec_03", "reading", '"David took the train from Pokhara to Kathmandu on Tuesday." Which city did David travel to?',
         {"type": "any_substr", "must_any": ["kathmandu"]}),
        ("ec_04", "reading", '"David took the train from Pokhara to Kathmandu on Tuesday." On what day did David travel?',
         {"type": "any_substr", "must_any": ["tuesday", "mangalbar"]}),
        ("ec_05", "reading", '"Sara is a teacher and her brother Leo is a pilot." What is Leo\'s job?',
         {"type": "any_substr", "must_any": ["pilot"]}),
        ("ec_06", "reading", '"The library opens at 9 AM and closes at 5 PM." At what time does the library open?',
         {"type": "final_number", "gold": 9}),

        # English quantitative & logical comprehension
        ("ec_07", "quant", "Asha had 12 balloons and 5 flew away. How many does she have left?",
         {"type": "final_number", "gold": 7}),
        ("ec_08", "quant", "What is 7% of 900?",
         {"type": "final_number", "gold": 63}),
        ("ec_09", "quant", "If one notebook costs 45 rupees, how much do 3 notebooks cost?",
         {"type": "final_number", "gold": 135}),
        ("ec_10", "quant", "A box holds 24 eggs. If 6 eggs break, how many whole eggs remain?",
         {"type": "final_number", "gold": 18}),
        ("ec_11", "quant", "How many minutes are there in 3 hours?",
         {"type": "final_number", "gold": 180}),
        ("ec_12", "quant", "How many meters are in 5 kilometers?",
         {"type": "final_number", "gold": 5000}),

        # English factual QA
        ("ec_13", "factual", "What is the capital of Nepal? Answer in English.",
         {"type": "any_substr", "must_any": ["kathmandu"]}),
        ("ec_14", "factual", "What is the highest mountain in the world?",
         {"type": "any_substr", "must_any": ["everest", "sagarmatha"]}),
        ("ec_15", "factual", "How many days are there in one week?",
         {"type": "final_number", "gold": 7}),
        ("ec_16", "factual", "Which planet is closest to the Sun?",
         {"type": "any_substr", "must_any": ["mercury", "budha"]}),

        # English <-> Romanized Nepali translation
        ("ec_17", "translate", '"we are reading" nepali ma bhana.',
         {"type": "any_substr", "must_any": ["hami padhdai chhau", "hami padhdai", "padhdai chhau"]}),
        ("ec_18", "translate", '"ma khana khadai chhu" english ma k ho?',
         {"type": "any_substr", "must_any": ["i am eating", "eating food"]}),
        ("ec_19", "translate", 'translate to english: "mero ghar kathmandu ma chha"',
         {"type": "any_substr", "must_any": ["house is in kathmandu", "home is in kathmandu", "live in kathmandu"]}),
        ("ec_20", "translate", 'nepali ma bhana: "what is your name?"',
         {"type": "any_substr", "must_any": ["naam ke ho", "naam k ho", "timro naam", "tapai ko naam"]}),
        ("ec_21", "translate", '"water" lai nepali ma k bhanchha?',
         {"type": "any_substr", "must_any": ["pani", "paani"]}),

        # English grammar & lexical operations
        ("ec_22", "grammar", '"children" ko singular k ho?',
         {"type": "any_substr", "must_any": ["child"]}),
        ("ec_23", "grammar", 'correct this: "he go to market."',
         {"type": "any_substr", "must_any": ["he goes to market", "he goes to the market", "goes"]}),
        ("ec_24", "grammar", 'What is the opposite of "cold"?',
         {"type": "any_substr", "must_any": ["hot", "warm", "taato"]}),
        ("ec_25", "grammar", 'Which number is smallest: 18, 4, 29, 11?',
         {"type": "final_number", "gold": 4}),
    ]
    for item_id, subcat, prompt, rule in english_specs:
        items.append({
            "id": item_id,
            "category": "english_comprehension",
            "subcategory": subcat,
            "prompt": prompt,
            "rule": rule,
        })

    return items


def extract_final_number(text: str) -> int | float | None:
    cleaned = re.sub(r'(\d),(\d)', r'\1\2', text)
    cleaned = re.sub(r'(\d),(\d)', r'\1\2', cleaned)
    nums = re.findall(r'-?\d+(?:\.\d+)?', cleaned)
    if not nums:
        return None
    val = float(nums[-1])
    return int(val) if val.is_integer() else val


def score_item(answer: str, rule: dict) -> tuple[bool, str]:
    ans_low = (answer or "").strip().lower()
    if not ans_low:
        return False, "empty_answer"

    rtype = rule["type"]
    if rtype == "final_number":
        gold = rule["gold"]
        pred = extract_final_number(ans_low)
        ok = pred == gold
        return ok, f"pred={pred}, gold={gold}"

    if rtype == "all_substr":
        must_all = [s.lower() for s in rule["must_all"]]
        ok = all(s in ans_low for s in must_all)
        return ok, f"must_all={must_all}"

    if rtype == "any_substr":
        must_any = [s.lower() for s in rule["must_any"]]
        forbid = [s.lower() for s in rule.get("forbid", [])]
        has_any = any(s in ans_low for s in must_any)
        has_forbid = any(f in ans_low for f in forbid)
        ok = has_any and not has_forbid
        return ok, f"has_any={has_any}, has_forbid={has_forbid}"

    if rtype == "substr_and_forbid":
        must_any = [s.lower() for s in rule["must_any"]]
        forbid = [s.lower() for s in rule.get("forbid", [])]
        has_any = any(s in ans_low for s in must_any)
        has_forbid = any(f in ans_low for f in forbid)
        ok = has_any and not has_forbid
        return ok, f"has_any={has_any}, has_forbid={has_forbid}"

    raise ValueError(f"Unknown rule type: {rtype}")


def evaluate_model(model_path: str, mode: str = "raw", seed: int = 42) -> dict:
    suite = build_benchmark_suite()
    runner_mjs = ROOT / "eval" / "wasm_runner.mjs"
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(suite, tf, ensure_ascii=False)
        tmp_in = tf.name

    try:
        cmd = [
            "node",
            str(runner_mjs),
            "--model", str(model_path),
            "--mode", mode,
            "--seed", str(seed),
            tmp_in,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        raw_out = json.loads(proc.stdout)
    finally:
        if os.path.exists(tmp_in):
            os.remove(tmp_in)

    categories = [
        "short_chat",
        "multiturn_chat",
        "arithmetic",
        "nepali_comprehension",
        "english_comprehension",
    ]
    cat_stats = {c: {"correct": 0, "total": 0, "accuracy": 0.0} for c in categories}
    subcat_stats: dict[str, dict[str, int]] = {}
    scored_items = []

    rule_map = {item["id"]: item["rule"] for item in suite}
    for r in raw_out["results"]:
        rule = rule_map[r["id"]]
        ok, detail = score_item(r["answer"], rule)
        cat = r["category"]
        subcat = f"{cat}.{r['subcategory']}"
        cat_stats[cat]["total"] += 1
        cat_stats[cat]["correct"] += int(ok)
        if subcat not in subcat_stats:
            subcat_stats[subcat] = {"correct": 0, "total": 0}
        subcat_stats[subcat]["total"] += 1
        subcat_stats[subcat]["correct"] += int(ok)

        scored_items.append({
            **r,
            "ok": ok,
            "score_detail": detail,
        })

    total_correct = sum(v["correct"] for v in cat_stats.values())
    total_items = sum(v["total"] for v in cat_stats.values())
    for c in categories:
        tot = cat_stats[c]["total"]
        cat_stats[c]["accuracy"] = round(cat_stats[c]["correct"] / max(1, tot), 4)

    # Compute arithmetic exact vs word breakdown explicitly
    arith_exact_ok = sum(1 for x in scored_items if x["category"] == "arithmetic" and x["subcategory"].startswith("exact_") and x["ok"])
    arith_exact_tot = sum(1 for x in scored_items if x["category"] == "arithmetic" and x["subcategory"].startswith("exact_"))
    arith_word_ok = sum(1 for x in scored_items if x["category"] == "arithmetic" and x["subcategory"].startswith("word_") and x["ok"])
    arith_word_tot = sum(1 for x in scored_items if x["category"] == "arithmetic" and x["subcategory"].startswith("word_"))

    return {
        "model": str(model_path),
        "mode": mode,
        "seed": seed,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "overall": {
            "correct": total_correct,
            "total": total_items,
            "accuracy": round(total_correct / max(1, total_items), 4),
            "elapsed_sec": raw_out["elapsed_sec"],
            "total_tokens": raw_out["total_tokens"],
            "tokens_per_sec": raw_out["tokens_per_sec"],
        },
        "categories": cat_stats,
        "arithmetic_breakdown": {
            "exact": {
                "correct": arith_exact_ok,
                "total": arith_exact_tot,
                "accuracy": round(arith_exact_ok / max(1, arith_exact_tot), 4),
            },
            "word_problems": {
                "correct": arith_word_ok,
                "total": arith_word_tot,
                "accuracy": round(arith_word_ok / max(1, arith_word_tot), 4),
            },
        },
        "subcategories": {
            k: {**v, "accuracy": round(v["correct"] / max(1, v["total"]), 4)}
            for k, v in sorted(subcat_stats.items())
        },
        "items": scored_items,
    }


def print_summary(rep: dict) -> None:
    ov = rep["overall"]
    print(f"======================================================================")
    print(f"Nik 0.1 Benchmark Suite | model={os.path.basename(rep['model'])} | mode={rep['mode']}")
    print(f"Overall: {ov['correct']}/{ov['total']} ({ov['accuracy']*100:.2f}%) | {ov['tokens_per_sec']} tok/s ({ov['elapsed_sec']}s)")
    print(f"----------------------------------------------------------------------")
    for cat, st in rep["categories"].items():
        print(f"  {cat:<24}: {st['correct']:>2}/{st['total']:<2} ({st['accuracy']*100:6.2f}%)")
    ab = rep["arithmetic_breakdown"]
    print(f"    ├─ exact arithmetic   : {ab['exact']['correct']:>2}/{ab['exact']['total']:<2} ({ab['exact']['accuracy']*100:6.2f}%)")
    print(f"    └─ word problems      : {ab['word_problems']['correct']:>2}/{ab['word_problems']['total']:<2} ({ab['word_problems']['accuracy']*100:6.2f}%)")
    print(f"======================================================================")


def main() -> None:
    ap = argparse.ArgumentParser(description="Run reproducible evaluation harness for nik 0.1")
    ap.add_argument("--model", default=str(ROOT / "nik/web/model/nik-0.1.bin"), help="Path to NIK1 .bin model")
    ap.add_argument("--mode", default="raw", choices=["raw", "chat", "breakthrough", "both"],
                    help="Decoding mode: raw (greedy weights), chat (/chat worker defaults), breakthrough, or both (raw + chat)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(ROOT / "eval/results/baseline.json"))
    ap.add_argument("--show-misses", action="store_true", help="Print missed items for diagnostic inspection")
    args = ap.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    if args.mode == "both":
        raw_rep = evaluate_model(args.model, mode="raw", seed=args.seed)
        chat_rep = evaluate_model(args.model, mode="chat", seed=args.seed)
        print_summary(raw_rep)
        print_summary(chat_rep)
        combined = {
            "primary_mode": "raw",
            "overall": raw_rep["overall"],
            "categories": raw_rep["categories"],
            "arithmetic_breakdown": raw_rep["arithmetic_breakdown"],
            "subcategories": raw_rep["subcategories"],
            "raw": raw_rep,
            "chat": chat_rep,
        }
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(combined, f, indent=2, ensure_ascii=False)
        if args.show_misses:
            print("\n=== RAW MODE MISSES ===")
            for it in raw_rep["items"]:
                if not it["ok"]:
                    q = it.get("prompt") or it["turns"][-1]["user"]
                    print(f"[{it['id']} | {it['category']}.{it['subcategory']}] Q: {q}")
                    if it.get("think"):
                        print(f"   think : {it['think'][:160]}")
                    print(f"   answer: {it['answer'][:160]} ({it['score_detail']})")
    else:
        rep = evaluate_model(args.model, mode=args.mode, seed=args.seed)
        print_summary(rep)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=2, ensure_ascii=False)
        if args.show_misses:
            print(f"\n=== {args.mode.upper()} MODE MISSES ===")
            for it in rep["items"]:
                if not it["ok"]:
                    q = it.get("prompt") or it["turns"][-1]["user"]
                    print(f"[{it['id']} | {it['category']}.{it['subcategory']}] Q: {q}")
                    if it.get("think"):
                        print(f"   think : {it['think'][:160]}")
                    print(f"   answer: {it['answer'][:160]} ({it['score_detail']})")


if __name__ == "__main__":
    main()
