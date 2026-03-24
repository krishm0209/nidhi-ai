import { getOrSet } from '@/lib/cache/redis'
import { getCacheTTL } from '@/lib/utils/market-calendar'
import { getGrowwAccessToken } from './groww-auth'

export interface StockQuote {
  ltp: number
  day_change_pct: number
}

const GROWW_BASE = 'https://api.groww.in/v1'

/**
 * Fetch live stock quotes from the Groww Trade API.
 * Endpoint: GET /v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol={SYMBOL}
 * Each symbol is cached independently with a market-aware TTL.
 */
export async function getStockPrices(
  tickers: Array<{ symbol: string; exchange: 'NSE' | 'BSE' }>,
): Promise<Record<string, StockQuote>> {
  if (tickers.length === 0) return {}

  const ttl = getCacheTTL()
  const apiKey = await getGrowwAccessToken()

  const entries = await Promise.all(
    tickers.map(async ({ symbol, exchange }) => {
      const key = `${exchange}:${symbol}`
      const quote = await getOrSet<StockQuote | null>(
        `stock:quote:${key}`,
        async () => {
          const url = `${GROWW_BASE}/live-data/quote?exchange=${exchange}&segment=CASH&trading_symbol=${symbol}`
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
              'X-API-VERSION': '1.0',
            },
          })
          if (!res.ok) return null
          const json = await res.json()
          const p = json?.payload
          if (!p) return null
          const ltp = p.last_price ?? p.ltp
          if (!ltp) return null
          return {
            ltp: Number(ltp),
            day_change_pct: Number(p.day_change_perc ?? 0),
          }
        },
        ttl,
      )
      return [key, quote] as const
    }),
  )

  const result: Record<string, StockQuote> = {}
  for (const [key, quote] of entries) {
    if (quote !== null && quote !== undefined) result[key] = quote
  }
  return result
}
