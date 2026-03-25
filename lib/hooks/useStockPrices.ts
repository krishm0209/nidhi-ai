import { useQuery } from '@tanstack/react-query'
import { isMarketOpen } from '@/lib/utils/market-calendar'
import type { StockQuote } from '@/lib/market/stocks'

/**
 * Polls live stock prices during market hours (every 15s), static otherwise.
 * @param tickers  Array of "EXCHANGE:SYMBOL" strings e.g. ["NSE:TATAPOWER"]
 */
export function useStockPrices(tickers: string[]): Record<string, StockQuote> {
  const key = tickers.slice().sort().join(',')

  const { data } = useQuery<Record<string, StockQuote>>({
    queryKey: ['stock-prices', key],
    queryFn: async () => {
      if (!key) return {}
      const res = await fetch(`/api/market/stocks?symbols=${encodeURIComponent(key)}`)
      if (!res.ok) return {}
      return res.json()
    },
    enabled: tickers.length > 0,
    refetchInterval: () => isMarketOpen() ? 30_000 : false,
    staleTime: 10_000,
  })

  return data ?? {}
}
