import { redis } from '@/lib/cache/redis'

/**
 * Fixed-window rate limiter using Upstash Redis.
 * Returns { success: true } if the request is allowed, { success: false } if limited.
 *
 * @param identifier  Unique key (e.g. userId, IP address)
 * @param limit       Max requests per window
 * @param windowSec   Window size in seconds
 */
export async function rateLimit(
  identifier: string,
  limit = 20,
  windowSec = 60,
): Promise<{ success: boolean; remaining: number }> {
  const window = Math.floor(Date.now() / 1000 / windowSec)
  const key = `rl:${identifier}:${window}`

  try {
    const count = await redis.incr(key)
    if (count === 1) {
      // First request in this window — set expiry
      await redis.expire(key, windowSec)
    }
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
    }
  } catch {
    // Redis unavailable — fail open (allow request)
    return { success: true, remaining: limit }
  }
}
