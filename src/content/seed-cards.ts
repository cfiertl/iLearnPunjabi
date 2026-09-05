import "server-only";

// Build-order step 2: a seed batch of 4 dummy sentence cards, one per common
// agreement frame, so the review loop can be exercised before real cards exist.
//
// These are DUMMIES. Correct them (or delete them and import a real batch)
// once the loop is confirmed end to end.

export type SeedSentence = {
  englishPrompt: string;
  gurmukhi: string;
  roman: string;
  frameTag: string;
  agreementSlot: string;
  slotIndexRoman: number;
  slotIndexGurmukhi: number;
  notes?: string;
};

export const SEED_DECK_NAME = "Sentence bank";

export const SEED_SENTENCES: SeedSentence[] = [
  {
    englishPrompt: "I ate roti yesterday",
    gurmukhi: "ਮੈਂ ਕੱਲ੍ਹ ਰੋਟੀ ਖਾਧੀ",
    roman: "main kal roti khadhi",
    frameTag: "perfective_object_agr",
    agreementSlot: "khadhi",
    slotIndexRoman: 3,
    slotIndexGurmukhi: 3,
    notes: "roti is feminine, so the past verb takes -i, not -a.",
  },
  {
    englishPrompt: "I am hungry",
    gurmukhi: "ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ",
    roman: "mainu bhukh laggi hai",
    frameTag: "dative_subject",
    agreementSlot: "laggi",
    slotIndexRoman: 2,
    slotIndexGurmukhi: 2,
    notes: "You are the experiencer (mainu), so the verb agrees with bhukh (f).",
  },
  {
    englishPrompt: "This is my sister's book",
    gurmukhi: "ਇਹ ਮੇਰੀ ਭੈਣ ਦੀ ਕਿਤਾਬ ਹੈ",
    roman: "ih meri bhain di kitaab hai",
    frameTag: "genitive_da_di_de",
    agreementSlot: "di",
    slotIndexRoman: 3,
    slotIndexGurmukhi: 3,
    notes: "di agrees with kitaab (the thing possessed), not with bhain.",
  },
  {
    englishPrompt: "I will go tomorrow (said by a man)",
    gurmukhi: "ਮੈਂ ਕੱਲ੍ਹ ਜਾਵਾਂਗਾ",
    roman: "main kal jaavaanga",
    frameTag: "future_anga_angi",
    agreementSlot: "jaavaanga",
    slotIndexRoman: 2,
    slotIndexGurmukhi: 2,
    notes: "A woman would say jaavaangi.",
  },
];
