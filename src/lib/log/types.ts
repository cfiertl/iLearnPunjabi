/** The parts of the routine the app cannot observe, so they are entered by hand. */
export const LOG_KINDS = [
  { kind: "session", label: "Session", hint: "Wed 1:20 · Sat" },
  { kind: "gurmukhi", label: "Gurmukhi", hint: "Thu or Fri · Sat · Sun" },
  { kind: "sbs", label: "SBS", hint: "weekday commute" },
  { kind: "solo", label: "Solo", hint: "Sun: listening, export, checkpoint" },
] as const;

export type LogKind = (typeof LOG_KINDS)[number]["kind"];

export function isLogKind(value: unknown): value is LogKind {
  return LOG_KINDS.some((k) => k.kind === value);
}

/** ISO date, YYYY-MM-DD, as stored in `occurred_on`. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type LogDay = {
  day: string;
  /** Derived from review_events — never entered by hand. */
  reviews: number;
  kinds: LogKind[];
};

export type LearningLog = {
  today: string;
  days: LogDay[];
  totals: { cardDays: number; window: number } & Record<LogKind, number>;
};
