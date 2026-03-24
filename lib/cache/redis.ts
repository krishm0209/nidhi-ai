import { Redis } from '@upstash/redis'
import { getCacheTTL } from '@/lib/utils/market-calendar'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Get a cached value or fetch and store it.
 * Null/undefined results are NOT cached so failed fetches are always retried.
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = getCacheTTL(),
): Promise<T> {
  try {
    const cached = await redis.get<T>(key)
    if (cached !== null && cached !== undefined) return cached
  } catch {
    // Redis unavailable — proceed without cache
  }

  const fresh = await fetcher()

  if (fresh !== null && fresh !== undefined) {
    try {
      await redis.set(key, fresh, { ex: ttl })
    } catch {
      // Best-effort cache write
    }
  }

  return fresh
}
