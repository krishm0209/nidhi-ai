import { NextRequest, NextResponse } from 'next/server'
import { runBenchmarkAggregation } from '@/lib/analysis/benchmark'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const processed = await runBenchmarkAggregation()
    return NextResponse.json({ ok: true, processed })
  } catch (err) {
    console.error('[benchmark/cron]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
