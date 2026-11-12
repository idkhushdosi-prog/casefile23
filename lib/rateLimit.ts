const buckets = new Map<string, number[]>();

/**
 * Simple sliding-window in-memory rate limiter for API routes.
 */
export function checkRateLimit(
  identifier: string,
  limit = 60,
  windowMs = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(identifier) ?? [];
  const active = existing.filter((ts) => now - ts < windowMs);
  if (active.length >= limit) {
    buckets.set(identifier, active);
    return { allowed: false, remaining: 0 };
  }
  active.push(now);
  buckets.set(identifier, active);
  return { allowed: true, remaining: limit - active.length };
}
