import { NextResponse, type NextRequest } from 'next/server'
import { getStockPrices } from '@/lib/market/stocks'

// GET /api/market/stocks?symbols=NSE:TATAPOWER,BSE:RELIANCE
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('symbols') ?? ''
  if (!raw) return NextResponse.json({})

  const tickers = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [exchange, symbol] = s.split(':')
      return { exchange: exchange as 'NSE' | 'BSE', symbol }
    })
    .filter((t) => t.symbol && (t.exchange === 'NSE' || t.exchange === 'BSE'))

  const prices = await getStockPrices(tickers)
  return NextResponse.json(prices)
}
