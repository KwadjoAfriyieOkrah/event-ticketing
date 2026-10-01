import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

/**
 * Increments the counter for `KEYS[1]` and, only on the first hit of a window,
 * arms its expiry. Both steps run as one script so they cannot interleave: a
 * separate INCR-then-EXPIRE pair can leave a key with no TTL if the process dies
 * in between, which would lock that subject out permanently.
 *
 * PEXPIRE rather than EXPIRE so the caller can pass milliseconds straight
 * through without converting to whole seconds.
 *
 * Returns [hits, remaining milliseconds on the window].
 */
const WINDOW_SCRIPT = `
local hits = redis.call("INCR", KEYS[1])
if hits == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { hits, ttl }
`;

let redis: Redis | undefined;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "Rate limiting is not configured. Set UPSTASH_REDIS_REST_URL and " +
          "UPSTASH_REDIS_REST_TOKEN. Refusing to serve traffic with no rate limit.",
      );
    }

    redis = new Redis({ url, token });
  }

  return redis;
}

/**
 * Counts one hit against `key` and reports whether the caller is still within
 * `limit` for the current `windowMs` window.
 *
 * The count is shared state in Redis rather than process memory, which is the
 * whole point: on Railway and Vercel each function instance has its own memory,
 * so an in-process counter is empty on a cold start and never shared between
 * instances. That fails open with no visible error, which is more dangerous
 * than having no limiter, because it looks like protection.
 *
 * A missing configuration throws before any request is served, so a bad deploy
 * is loud rather than silently unprotected. A Redis error at request time is
 * logged and the request is allowed through, so an outage of the limiter cannot
 * also take down login and checkout.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const script = getRedis().createScript<[number, number]>(WINDOW_SCRIPT);

  try {
    const [hits, ttl] = await script.eval(
      [`ratelimit:${key}`],
      [String(windowMs)],
    );

    return {
      success: hits <= limit,
      remaining: Math.max(0, limit - hits),
      reset: Date.now() + Math.max(ttl, 0),
    };
  } catch (error) {
    console.error(`[rate-limit] Redis call failed for "${key}"; allowing the request:`, error);

    return { success: true, remaining: 0, reset: Date.now() + windowMs };
  }
}
