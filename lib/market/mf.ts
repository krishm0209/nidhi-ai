import { getOrSet } from '@/lib/cache/redis'

/**
 * Fetch current NAVs for the given AMFI scheme codes directly from AMFI NAVAll.txt.
 * The full NAV map is cached in Redis for 1 hour (NAV is published once a day).
 * Returns a map of schemeCode → NAV (missing entries = fetch failed).
 */

async function getAMFINavMap(): Promise<Record<number, number>> {
  return getOrSet<Record<number, number>>(
    'amfi:navall',
    async () => {
      const res = await fetch('https://portal.amfiindia.com/spages/NAVAll.txt', {
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return {}
      const text = await res.text()
      const map: Record<number, number> = {}
      for (const line of text.split('\n')) {
        const parts = line.split(';')
        if (parts.length < 5) continue
        const code = parseInt(parts[0].trim())
        const nav = parseFloat(parts[4].trim())
        if (!isNaN(code) && !isNaN(nav) && nav > 0) map[code] = nav
      }
      return map
    },
    3600, // 1 hour — NAV is published once a day
  )
}

export async function getMFNavs(schemeCodes: number[]): Promise<Record<number, number>> {
  if (schemeCodes.length === 0) return {}
  const allNavs = await getAMFINavMap()
  const result: Record<number, number> = {}
  for (const code of schemeCodes) {
    if (allNavs[code]) result[code] = allNavs[code]
  }
  return result
}
