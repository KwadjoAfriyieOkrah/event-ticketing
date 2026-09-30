const rateLimits = new Map<string, number[]>();

const MAX_TRACKED_KEYS = 10_000;

function prune(now: number, windowMs: number) {
  if (rateLimits.size <= MAX_TRACKED_KEYS) return;

  for (const [key, stamps] of rateLimits) {
    const fresh = stamps.filter((timestamp) => now - timestamp < windowMs);
    if (fresh.length === 0) {
      rateLimits.delete(key);
    } else {
      rateLimits.set(key, fresh);
    }
  }
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();

  prune(now, windowMs);

  const stamps = rateLimits.get(key) ?? [];
  const recent = stamps.filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= limit) {
    return { success: false, remaining: 0, reset: recent[0] + windowMs };
  }

  recent.push(now);
  rateLimits.set(key, recent);

  return {
    success: true,
    remaining: limit - recent.length,
    reset: now + windowMs,
  };
}

export function resetRateLimit(key: string) {
  rateLimits.delete(key);
}
