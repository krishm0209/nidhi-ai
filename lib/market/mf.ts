import { getOrSet } from '@/lib/cache/redis'
import { getCacheTTL } from '@/lib/utils/market-calendar'

/**
 * Fetch current NAVs for the given AMFI scheme codes from MFapi.in.
 * Results are cached in Redis with a market-aware TTL.
 * Returns a map of schemeCode → NAV (missing entries = fetch failed).
 */
export async function getMFNavs(schemeCodes: number[]): Promise<Record<number, number>> {
  if (schemeCodes.length === 0) return {}

  const ttl = getCacheTTL()

  const entries = await Promise.all(
    schemeCodes.map(async (code) => {
      const nav = await getOrSet<number | null>(
        `mf:nav:${code}`,
        async () => {
          const res = await fetch(`${process.env.MFAPI_BASE_URL}/mf/${code}/latest`)
          if (!res.ok) return null
          const json = await res.json()
          const navStr: string | undefined = json?.data?.[0]?.nav
          return navStr ? parseFloat(navStr) : null
        },
        ttl,
      )
      return [code, nav] as const
    }),
  )

  const result: Record<number, number> = {}
  for (const [code, nav] of entries) {
    if (nav !== null && nav !== undefined) result[code] = nav
  }
  return result
}
