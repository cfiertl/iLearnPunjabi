import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

/** The four grades shown as review buttons, in display order. */
export const REVIEW_RATINGS = [
  { rating: Rating.Again, label: "Again", hint: "Forgot" },
  { rating: Rating.Hard, label: "Hard", hint: "Tough" },
  { rating: Rating.Good, label: "Good", hint: "Got it" },
  { rating: Rating.Easy, label: "Easy", hint: "Simple" },
] as const;

export { Rating, State };

/** Shape of a public.review_state row (timestamps come back as ISO strings). */
export type ReviewStateRow = {
  card_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

/** DB row -> ts-fsrs Card. */
export function toFsrsCard(row: ReviewStateRow): FsrsCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

/** ts-fsrs Card -> columns for public.review_state (dates as ISO strings). */
export function fromFsrsCard(card: FsrsCard) {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review
      ? new Date(card.last_review).toISOString()
      : null,
  };
}

/**
 * Apply a review grade to a card's current state (or a fresh card if unseen).
 * Returns the scheduled next state plus the review log.
 */
export function applyReview(
  current: ReviewStateRow | null,
  rating: Grade,
  now = new Date(),
): RecordLogItem {
  const card = current ? toFsrsCard(current) : createEmptyCard(now);
  return scheduler.next(card, now, rating);
}

/** Type guard: is this a valid review grade (1–4)? */
export function isGrade(value: number): value is Grade {
  return value === Rating.Again || value === Rating.Hard || value === Rating.Good || value === Rating.Easy;
}
