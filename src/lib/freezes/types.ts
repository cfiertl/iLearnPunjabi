export type Bucket = "A" | "B" | "C";

/** Bucket meanings, as shown on the triage row. Order is fixed. */
export const BUCKETS = [
  {
    bucket: "A",
    label: "A — missing a word",
    hint: "Structure was known, vocabulary wasn't",
  },
  {
    bucket: "B",
    label: "B — missing a frame",
    hint: "Words known, no idea how to assemble them",
  },
  {
    bucket: "C",
    label: "C — knew it, froze",
    hint: "Needs drilling, not teaching",
  },
] as const satisfies ReadonlyArray<{
  bucket: Bucket;
  label: string;
  hint: string;
}>;

export function isBucket(value: unknown): value is Bucket {
  return value === "A" || value === "B" || value === "C";
}

export type Freeze = {
  id: string;
  english: string;
  capturedAt: string;
  bucket: Bucket | null;
  note: string | null;
  resolved: boolean;
  /** Cards this freeze produced. Display-only; never affects scheduling. */
  cards: { id: string; englishPrompt: string }[];
};
