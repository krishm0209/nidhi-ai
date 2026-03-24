import { NextResponse, type NextRequest } from 'next/server'
import { getCryptoPricesINR } from '@/lib/market/crypto'

// GET /api/market/crypto?ids=bitcoin,ethereum
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('ids') ?? ''
  if (!raw) return NextResponse.json({})

  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const prices = await getCryptoPricesINR(ids)
  return NextResponse.json(prices)
}
