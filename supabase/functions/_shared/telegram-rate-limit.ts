export type AiRateLimitDecision = { allowed: boolean; count: number };

export function rateLimitUnavailableDecision(): AiRateLimitDecision {
  return { allowed: false, count: 0 };
}
