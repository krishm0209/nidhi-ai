import { NextResponse } from 'next/server'
import { rotateGrowwToken } from '@/lib/market/groww-auth'

// Runs daily at 6:05 AM IST (00:35 UTC) — just after Groww resets all tokens
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ok = await rotateGrowwToken()
  if (!ok) {
    return NextResponse.json({ error: 'Token rotation failed — check GROWW_API_KEY and GROWW_TOTP_SECRET' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rotatedAt: new Date().toISOString() })
}
