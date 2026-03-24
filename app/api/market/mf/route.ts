import { NextResponse, type NextRequest } from 'next/server'
import { getMFNavs } from '@/lib/market/mf'

// GET /api/market/mf?codes=119598,120465
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('codes') ?? ''
  if (!raw) return NextResponse.json({})

  const codes = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))

  const navs = await getMFNavs(codes)
  return NextResponse.json(navs)
}
