import { getOrSet } from '@/lib/cache/redis'
import { getCacheTTL } from '@/lib/utils/market-calendar'

/**
 * Fetch current INR prices for the given CoinGecko coin IDs.
 * Batches all IDs into a single CoinGecko request and caches the result.
 * Returns a map of coinId → INR price (missing entries = fetch failed).
 */
export async function getCryptoPricesINR(coinIds: string[]): Promise<Record<string, number>> {
  if (coinIds.length === 0) return {}

  const unique = [...new Set(coinIds)]
  const sorted = [...unique].sort()
  const cacheKey = `crypto:prices:inr:${sorted.join(',')}`
  const ttl = getCacheTTL()

  return getOrSet<Record<string, number>>(
    cacheKey,
    async () => {
      const url = `${process.env.COINGECKO_API_URL}/simple/price?ids=${sorted.join(',')}&vs_currencies=inr`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return {}
      const json = await res.json()
      const result: Record<string, number> = {}
      for (const id of sorted) {
        if (typeof json[id]?.inr === 'number') result[id] = json[id].inr
      }
      return result
    },
    ttl,
  )
}
