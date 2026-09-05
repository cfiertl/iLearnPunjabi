// Frame tag reference — one-line rule reminders shown on cloze card backs.
//
// Unknown tags are allowed everywhere: import warns about them rather than
// rejecting, so the deck can grow structures this table has not caught up with.

export const FRAME_TAGS: Record<string, string> = {
  dative_subject:
    "Experiencer takes -nu; verb agrees with the experience, not you",
  copula_agreement: "hai/haan/ho follows the grammatical subject",
  genitive_da_di_de: "Agrees with the thing possessed, not the possessor",
  perfective_object_agr: "Past transitive verb agrees with the object",
  future_anga_angi: "-anga (m) / -angi (f) on the stem",
  polite_imperative: "tusi form, + ji for elders",
  negation_placement: "nahi goes before the verb",
  continuous_agreement: "riha/rahi/rahe matches subject gender and number",
};

export const KNOWN_FRAME_TAGS = Object.keys(FRAME_TAGS);

/** Rule reminder for a tag, or null when the tag is not in the table. */
export function frameRule(tag: string): string | null {
  return FRAME_TAGS[tag] ?? null;
}

/** "perfective_object_agr" -> "Perfective object agr" for table headings. */
export function frameLabel(tag: string): string {
  const s = tag.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
