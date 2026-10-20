// Devanagari -> casual romanized Nepali, a port of nik/data/romanize.py (tables are generated from it).
// Nik was trained on romanized text, so the chat romanizes Devanagari input before tokenizing.
// This is input transliteration only; it never decides what Nik answers.
const T = {"CONS": {"क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p", "फ": "f", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "w", "श": "sh", "ष": "sh", "स": "s", "ह": "h", "ळ": "l", "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "d", "ढ़": "dh", "फ़": "f", "य़": "y"}, "VOWELS": {"अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऍ": "e", "ऑ": "o"}, "MATRAS": {"ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॅ": "e", "ॉ": "o"}, "SIGNS": {"ं": "n", "ँ": "n", "ः": "h", "ऽ": ""}, "DIGITS": {"०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9"}, "PUNCT": {"।": ".", "॥": ".", "‘": "'", "’": "'", "“": "\"", "”": "\"", "–": "-", "—": "-"}, "CONJ": {"कष": "ksh", "जञ": "gy", "तर": "tr", "शर": "shr", "दय": "dy"}, "COMMON": {"छ": "chha", "छन्": "chhan", "छु": "chhu", "छौं": "chhau", "छौँ": "chhau", "छैन": "chhaina", "छस्": "chhas", "हो": "ho", "होइन": "hoina", "हुन्": "hun", "हुन": "huna", "थियो": "thiyo", "थिए": "thie", "थिएँ": "thiye", "म": "ma", "मेरो": "mero", "मलाई": "malai", "हामी": "hami", "हाम्रो": "hamro", "तिमी": "timi", "तिम्रो": "timro", "तपाईं": "tapai", "तपाईँ": "tapai", "तपाई": "tapai", "तपाईंको": "tapaiko", "तपाईँको": "tapaiko", "तपाईंलाई": "tapailai", "उ": "u", "उनी": "uni", "उनको": "unko", "उहाँ": "uha", "उहाँको": "uhako", "यो": "yo", "त्यो": "tyo", "यी": "yi", "ती": "ti", "के": "ke", "को": "ko", "कि": "ki", "की": "ki", "का": "ka", "र": "ra", "वा": "wa", "पनि": "pani", "नै": "nai", "मा": "ma", "ले": "le", "लाई": "lai", "बाट": "bata", "सँग": "sanga", "संग": "sanga", "देखि": "dekhi", "सम्म": "samma", "कस्तो": "kasto", "कहाँ": "kaha", "किन": "kina", "कसरी": "kasari", "कति": "kati", "कहिले": "kahile", "कुन": "kun", "नेपाल": "nepal", "नेपाली": "nepali", "काठमाडौं": "kathmandu", "काठमाडौँ": "kathmandu", "नेपालको": "nepalko", "धन्यवाद": "dhanyabad", "नमस्ते": "namaste", "नमस्कार": "namaskar", "राम्रो": "ramro", "ठिक": "thik", "ठीक": "thik", "एक": "ek", "दुई": "dui", "तीन": "tin", "चार": "char", "पाँच": "pach", "सात": "sat", "आठ": "aath", "नौ": "nau", "दश": "das", "दस": "das", "सय": "saya", "हजार": "hajar", "लाख": "lakh", "करोड": "karod", "पानी": "pani", "खाना": "khana", "घर": "ghar", "मान्छे": "manchhe", "मानिस": "manis", "देश": "desh", "सरकार": "sarkar", "विकास": "bikas", "विश्व": "bishwa", "विद्यालय": "bidyalaya", "विषय": "bishaya", "विभिन्न": "bibhinna", "विशेष": "bishesh", "श्री": "shree", "ज्ञान": "gyan", "क्षेत्र": "kshetra", "प्रदेश": "pradesh", "जिल्ला": "jilla", "गाउँ": "gau", "शहर": "shahar", "सहर": "sahar", "बिहान": "bihana", "बेलुका": "beluka", "आज": "aaja", "भोलि": "bholi", "हिजो": "hijo", "अहिले": "ahile", "समय": "samaya", "दिन": "din", "रात": "raat", "वर्ष": "barsha", "साल": "saal", "महिना": "mahina", "हप्ता": "hapta", "गर्नु": "garnu", "गर्छ": "garchha", "गर्छु": "garchhu", "गर्छन्": "garchhan", "गरेको": "gareko", "गरे": "gare", "गर्ने": "garne", "हुन्छ": "hunchha", "हुँदैन": "hudaina", "भयो": "bhayo", "भए": "bhae", "भएको": "bhaeko", "भन्ने": "bhanne", "भने": "bhane", "जान्छु": "janchhu", "आउँछु": "auchhu", "खान्छु": "khanchhu", "चाहन्छु": "chahanchhu", "सक्छु": "sakchhu", "सक्नुहुन्छ": "saknuhunchha", "मात्र": "matra", "धेरै": "dherai", "थोरै": "thorai", "सबै": "sabai", "अरु": "aru", "अरू": "aru", "एउटा": "euta", "दुईवटा": "duiwata", "हुनुहुन्छ": "hunuhunchha", "गर्नुहुन्छ": "garnuhunchha", "हजुर": "hajur", "माया": "maya", "साथी": "sathi", "जीवन": "jiwan", "प्रेम": "prem", "ईश्वर": "ishwar", "भगवान": "bhagwan", "मन": "man", "खुसी": "khusi", "खुशी": "khusi", "दुःख": "dukha", "सगरमाथा": "sagarmatha", "हिमाल": "himal", "पहाड": "pahad", "तराई": "tarai", "भारत": "bharat", "चीन": "chin"}, "SUFFIXES": ["तर्फबाट", "लगायतका", "हरूलाई", "हरुलाई", "मात्र", "भन्दा", "लगायत", "हरूको", "हरुको", "हरूले", "हरुले", "हरूमा", "हरुमा", "भित्र", "जस्ता", "जस्तो", "स्थित", "सँगै", "तर्फ", "सम्म", "देखि", "माथि", "बाट", "सँग", "संग", "हरू", "हरु", "लाई", "बीच", "पछि", "अघि", "को", "का", "की", "मा", "ले"]};
const VIRAMA = '\u094d', NUKTA = '\u093c';

function rule(word) {
  const chars = [];
  for (const ch of word.normalize('NFC')) { if (ch === NUKTA && chars.length) chars[chars.length - 1] += NUKTA; else chars.push(ch); }
  const units = [];
  let i = 0;
  const n = chars.length;
  while (i < n) {
    const ch = chars[i];
    if (ch in T.CONS) {
      let rom;
      if (chars[i + 1] === VIRAMA && i + 2 < n && (ch + chars[i + 2]) in T.CONJ) { rom = T.CONJ[ch + chars[i + 2]]; i += 3; }
      else { rom = T.CONS[ch]; i += 1; }
      if (i < n && chars[i] === VIRAMA) { units.push([rom, '', 'C']); i++; }
      else if (i < n && chars[i] in T.MATRAS) { units.push([rom, T.MATRAS[chars[i]], 'C']); i++; }
      else units.push([rom, 'a', 'Ca']);
    } else if (ch in T.VOWELS) { units.push([T.VOWELS[ch], '', 'V']); i++; }
    else if (ch in T.SIGNS) { if (units.length) units[units.length - 1][1] += T.SIGNS[ch]; i++; }
    else if (ch in T.MATRAS) { units.push(['', T.MATRAS[ch], 'V']); i++; }
    else { units.push([T.DIGITS[ch] ?? ch, '', 'X']); i++; }
  }
  const k = units.length;
  if (k >= 2 && units[k - 1][2] === 'Ca') {
    const prevDead = units[k - 2][2] === 'C' && units[k - 2][1] === '';
    if (!prevDead && units[k - 1][0] !== 'y') units[k - 1][1] = '';
  }
  let out = units.map(([r, v]) => r + v).join('');
  if (out.startsWith('w') && out.length > 2 && 'iaeu'.includes(out[1])) out = 'b' + out.slice(1);
  return out.replaceAll('aa', 'a').replaceAll('ii', 'i').replaceAll('uu', 'u').replaceAll('ngg', 'ng');
}

const FIXED = { '\u092c\u093e\u091f': 'bata', '\u0938\u0901\u0917': 'sanga', '\u0938\u0902\u0917': 'sanga', '\u092e\u093e\u0924\u094d\u0930': 'matra' };

function word(w) {
  if (w in T.COMMON) return T.COMMON[w];
  for (const suf of T.SUFFIXES) {
    if (w.endsWith(suf) && [...w].length > [...suf].length + 1) {
      const stem = w.slice(0, w.length - suf.length);
      if (stem.endsWith(VIRAMA)) break;
      return (T.COMMON[stem] ?? rule(stem)) + (FIXED[suf] ?? T.COMMON[suf] ?? rule(suf));
    }
  }
  return rule(w);
}

export const hasDevanagari = (s) => /[\u0900-\u097f]/.test(s);

export function romanize(text) {
  let t = text.normalize('NFC');
  for (const [a, b] of Object.entries(T.PUNCT)) t = t.replaceAll(a, b);
  t = [...t].map((c) => T.DIGITS[c] ?? c).join('');
  t = t.replace(/[\u0900-\u097f]+/g, (m) => word(m));
  t = t.replaceAll('\u200d', '').replaceAll('\u200c', '');
  return t.replace(/[ \t]+/g, ' ').trim().toLowerCase();
}
