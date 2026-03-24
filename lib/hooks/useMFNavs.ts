import { useQuery } from '@tanstack/react-query'

/**
 * Fetches MF NAVs once per hour (NAV is published once a day after 9 PM).
 * @param schemeCodes  AMFI scheme codes
 */
export function useMFNavs(schemeCodes: number[]): Record<number, number> {
  const key = schemeCodes.slice().sort().join(',')

  const { data } = useQuery<Record<number, number>>({
    queryKey: ['mf-navs', key],
    queryFn: async () => {
      if (!key) return {}
      const res = await fetch(`/api/market/mf?codes=${encodeURIComponent(key)}`)
      if (!res.ok) return {}
      return res.json()
    },
    enabled: schemeCodes.length > 0,
    refetchInterval: 60 * 60_000, // 1 hour
    staleTime: 30 * 60_000,
  })

  return data ?? {}
}
