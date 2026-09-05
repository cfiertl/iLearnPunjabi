import "server-only";

// Starter A2 deck — blended family/home + everyday core (Eastern/Indian Punjabi).
// `gurmukhi` is the internal audio source of truth (never shown to the user);
// `roman` uses the house phonetic style (doubled long vowels, `h` for aspiration).
// This is a reviewable SEED — meant to be corrected and grown over time.

export type SeedCard = {
  gurmukhi: string;
  roman: string;
  english: string;
  pos?: string;
  example_roman?: string;
  example_english?: string;
  variant_notes?: Record<string, string>;
  tags: string[];
};

export const STARTER_DECK_NAME = "A2 Starter — Family & Everyday";

export const STARTER_DECK: SeedCard[] = [
  // ---- Greetings & courtesy ----
  { gurmukhi: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", roman: "sat sri akaal", english: "Hello (Sikh greeting)", pos: "phrase", tags: ["greetings"] },
  { gurmukhi: "ਕਿੱਦਾਂ", roman: "kiddaan", english: "How's it going? (informal)", pos: "phrase", tags: ["greetings"] },
  { gurmukhi: "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ", roman: "tuseen kiven ho", english: "How are you? (polite)", pos: "phrase", example_roman: "tuseen kiven ho, jee?", example_english: "How are you? (respectful)", tags: ["greetings"] },
  { gurmukhi: "ਮੈਂ ਠੀਕ ਹਾਂ", roman: "main theek haan", english: "I'm fine", pos: "phrase", tags: ["greetings"] },
  { gurmukhi: "ਧੰਨਵਾਦ", roman: "dhannvaad", english: "thank you", pos: "phrase", variant_notes: { pakistani: "'shukriaa' is more common in Urdu-influenced Punjabi" }, tags: ["courtesy"] },
  { gurmukhi: "ਸ਼ੁਕਰੀਆ", roman: "shukriaa", english: "thanks", pos: "phrase", variant_notes: { note: "borrowed from Urdu; widely understood" }, tags: ["courtesy"] },
  { gurmukhi: "ਮਾਫ਼ ਕਰਨਾ", roman: "maaf karnaa", english: "sorry / excuse me", pos: "phrase", tags: ["courtesy"] },
  { gurmukhi: "ਜੀ", roman: "jee", english: "yes (respectful) / honorific", pos: "particle", tags: ["courtesy"] },
  { gurmukhi: "ਹਾਂ", roman: "haan", english: "yes", pos: "particle", tags: ["core"] },
  { gurmukhi: "ਨਹੀਂ", roman: "naheen", english: "no / not", pos: "particle", tags: ["core"] },
  { gurmukhi: "ਫਿਰ ਮਿਲਾਂਗੇ", roman: "phir milaange", english: "see you again", pos: "phrase", tags: ["greetings"] },

  // ---- Family ----
  { gurmukhi: "ਪਰਿਵਾਰ", roman: "parivaar", english: "family", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਮੰਮੀ", roman: "mammi", english: "mum", pos: "noun", variant_notes: { formal: "'maan' is the more formal word for mother" }, tags: ["family"] },
  { gurmukhi: "ਪਾਪਾ", roman: "paapaa", english: "dad", pos: "noun", variant_notes: { formal: "'pitaa' is the more formal word for father" }, tags: ["family"] },
  { gurmukhi: "ਭੈਣ", roman: "bhain", english: "sister", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਵੀਰ", roman: "veer", english: "brother", pos: "noun", variant_notes: { note: "'bharaa' also means brother; 'veer' is affectionate" }, tags: ["family"] },
  { gurmukhi: "ਘਰਵਾਲੀ", roman: "gharwaali", english: "wife", pos: "noun", variant_notes: { formal: "'patnee' is the formal word" }, tags: ["family"] },
  { gurmukhi: "ਘਰਵਾਲਾ", roman: "gharwaala", english: "husband", pos: "noun", variant_notes: { formal: "'patee' is the formal word" }, tags: ["family"] },
  { gurmukhi: "ਧੀ", roman: "dhee", english: "daughter", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਪੁੱਤਰ", roman: "puttar", english: "son", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਬੱਚਾ", roman: "bacchaa", english: "child", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਦਾਦਾ", roman: "daadaa", english: "grandfather (paternal)", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਦਾਦੀ", roman: "daadee", english: "grandmother (paternal)", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਨਾਨਾ", roman: "naanaa", english: "grandfather (maternal)", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਨਾਨੀ", roman: "naanee", english: "grandmother (maternal)", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਸੱਸ", roman: "sass", english: "mother-in-law", pos: "noun", tags: ["family"] },
  { gurmukhi: "ਸਹੁਰਾ", roman: "sohuraa", english: "father-in-law", pos: "noun", tags: ["family"] },

  // ---- Home & food ----
  { gurmukhi: "ਘਰ", roman: "ghar", english: "house / home", pos: "noun", tags: ["home"] },
  { gurmukhi: "ਪਾਣੀ", roman: "paanee", english: "water", pos: "noun", example_roman: "mainu paanee chaahidaa hai", example_english: "I need water", tags: ["home", "food"] },
  { gurmukhi: "ਰੋਟੀ", roman: "rotee", english: "bread / a meal", pos: "noun", tags: ["food"] },
  { gurmukhi: "ਚਾਹ", roman: "chaah", english: "tea", pos: "noun", example_roman: "chaah peeoge?", example_english: "Will you have tea?", tags: ["food"] },
  { gurmukhi: "ਦੁੱਧ", roman: "duddh", english: "milk", pos: "noun", tags: ["food"] },
  { gurmukhi: "ਦਾਲ", roman: "daal", english: "lentils", pos: "noun", tags: ["food"] },
  { gurmukhi: "ਸਬਜ਼ੀ", roman: "sabzee", english: "vegetable(s)", pos: "noun", tags: ["food"] },
  { gurmukhi: "ਚੌਲ", roman: "chaul", english: "rice", pos: "noun", tags: ["food"] },
  { gurmukhi: "ਖਾਣਾ", roman: "khaanaa", english: "food / to eat", pos: "noun/verb", tags: ["food", "verbs"] },

  // ---- Everyday verbs (infinitive) ----
  { gurmukhi: "ਪੀਣਾ", roman: "peenaa", english: "to drink", pos: "verb", tags: ["verbs"] },
  { gurmukhi: "ਜਾਣਾ", roman: "jaanaa", english: "to go", pos: "verb", tags: ["verbs"] },
  { gurmukhi: "ਆਉਣਾ", roman: "aaunaa", english: "to come", pos: "verb", tags: ["verbs"] },
  { gurmukhi: "ਕਰਨਾ", roman: "karnaa", english: "to do / to make", pos: "verb", tags: ["verbs"] },
  { gurmukhi: "ਬੋਲਣਾ", roman: "bolnaa", english: "to speak", pos: "verb", tags: ["verbs"] },
  { gurmukhi: "ਸੁਣਨਾ", roman: "sunnaa", english: "to listen / hear", pos: "verb", tags: ["verbs"] },
  { gurmukhi: "ਸਮਝਣਾ", roman: "samajhnaa", english: "to understand", pos: "verb", tags: ["verbs"] },

  // ---- Question words ----
  { gurmukhi: "ਕੀ", roman: "kee", english: "what", pos: "question", tags: ["questions"] },
  { gurmukhi: "ਕੌਣ", roman: "kaun", english: "who", pos: "question", tags: ["questions"] },
  { gurmukhi: "ਕਿੱਥੇ", roman: "kitthe", english: "where", pos: "question", tags: ["questions"] },
  { gurmukhi: "ਕਦੋਂ", roman: "kadon", english: "when", pos: "question", tags: ["questions"] },
  { gurmukhi: "ਕਿਉਂ", roman: "kyun", english: "why", pos: "question", tags: ["questions"] },
  { gurmukhi: "ਕਿੰਨਾ", roman: "kinnaa", english: "how much / how many", pos: "question", tags: ["questions"] },

  // ---- Useful phrases ----
  { gurmukhi: "ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ", roman: "tuhaadaa naan kee hai", english: "what's your name?", pos: "phrase", tags: ["phrases"] },
  { gurmukhi: "ਮੇਰਾ ਨਾਂ ... ਹੈ", roman: "meraa naan ... hai", english: "my name is ...", pos: "phrase", tags: ["phrases"] },
  { gurmukhi: "ਰੋਟੀ ਖਾਧੀ", roman: "rotee khaadhee?", english: "have you eaten? (common greeting)", pos: "phrase", tags: ["phrases", "food"] },
  { gurmukhi: "ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ", roman: "mainu bhukkh laggi hai", english: "I'm hungry", pos: "phrase", tags: ["phrases", "food"] },
  { gurmukhi: "ਮੈਨੂੰ ਨਹੀਂ ਪਤਾ", roman: "mainu naheen pataa", english: "I don't know", pos: "phrase", tags: ["phrases"] },
  { gurmukhi: "ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਈ", roman: "mainu samajh naheen aayee", english: "I didn't understand", pos: "phrase", tags: ["phrases"] },
  { gurmukhi: "ਠੀਕ ਹੈ", roman: "theek hai", english: "okay / alright", pos: "phrase", tags: ["phrases"] },
  { gurmukhi: "ਬਹੁਤ ਵਧੀਆ", roman: "bahut vadhiaa", english: "very good", pos: "phrase", tags: ["phrases"] },
  { gurmukhi: "ਅੱਛਾ", roman: "acchaa", english: "good / I see / okay", pos: "phrase", tags: ["phrases"] },
  { gurmukhi: "ਮੈਂ ਤੈਨੂੰ ਪਿਆਰ ਕਰਦਾ ਹਾਂ", roman: "main tainu pyaar kardaa haan", english: "I love you (said by a man)", pos: "phrase", variant_notes: { female: "a woman says 'kardee haan' instead of 'kardaa haan'" }, tags: ["phrases", "family"] },

  // ---- Time words ----
  { gurmukhi: "ਹੁਣ", roman: "hun", english: "now", pos: "adverb", tags: ["time"] },
  { gurmukhi: "ਅੱਜ", roman: "ajj", english: "today", pos: "adverb", tags: ["time"] },
  { gurmukhi: "ਕੱਲ੍ਹ", roman: "kall", english: "tomorrow / yesterday", pos: "adverb", variant_notes: { note: "context tells you which; 'kall' covers both" }, tags: ["time"] },

  // ---- Numbers 1–10 ----
  { gurmukhi: "ਇੱਕ", roman: "ikk", english: "one (1)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਦੋ", roman: "do", english: "two (2)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਤਿੰਨ", roman: "tinn", english: "three (3)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਚਾਰ", roman: "chaar", english: "four (4)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਪੰਜ", roman: "panj", english: "five (5)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਛੇ", roman: "chhe", english: "six (6)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਸੱਤ", roman: "satt", english: "seven (7)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਅੱਠ", roman: "atth", english: "eight (8)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਨੌਂ", roman: "naun", english: "nine (9)", pos: "number", tags: ["numbers"] },
  { gurmukhi: "ਦਸ", roman: "das", english: "ten (10)", pos: "number", tags: ["numbers"] },
];
