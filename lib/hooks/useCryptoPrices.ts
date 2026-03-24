import { useQuery } from '@tanstack/react-query'

/**
 * Polls CoinGecko INR prices every 60s (crypto never "closes").
 * @param coinIds  CoinGecko IDs e.g. ["bitcoin", "ethereum"]
 */
export function useCryptoPrices(coinIds: string[]): Record<string, number> {
  const key = coinIds.slice().sort().join(',')

  const { data } = useQuery<Record<string, number>>({
    queryKey: ['crypto-prices', key],
    queryFn: async () => {
      if (!key) return {}
      const res = await fetch(`/api/market/crypto?ids=${encodeURIComponent(key)}`)
      if (!res.ok) return {}
      return res.json()
    },
    enabled: coinIds.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  return data ?? {}
}
