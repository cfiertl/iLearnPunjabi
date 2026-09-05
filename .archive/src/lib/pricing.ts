// USD pricing for paid APIs. Keep these in sync with provider pricing pages.
// Only TTS is live today; chat/STT rates are used from Phase 2/3 onward.
export const PRICING = {
  tts: {
    // Google Cloud TTS WaveNet voices: $16 per 1,000,000 characters.
    googleWavenetPerChar: 16 / 1_000_000,
  },
  chat: {
    // Claude Opus 4.8 (the default TUTOR_MODEL): $5 / $25 per 1M tokens.
    // If you switch models in src/lib/anthropic.ts, update these to match.
    inputPerToken: 5 / 1_000_000,
    outputPerToken: 25 / 1_000_000,
  },
  stt: {
    // Rough placeholder (~$0.024/min) — verify when Phase 3 lands.
    perSecond: 0.024 / 60,
  },
} as const;

export function ttsCost(chars: number): number {
  return chars * PRICING.tts.googleWavenetPerChar;
}

export function chatCost(inputTokens: number, outputTokens: number): number {
  return (
    inputTokens * PRICING.chat.inputPerToken +
    outputTokens * PRICING.chat.outputPerToken
  );
}

/** Format a USD amount for display, keeping tiny amounts legible. */
export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}
