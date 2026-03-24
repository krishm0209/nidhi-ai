import { NextRequest, NextResponse } from 'next/server'
import { backtestSIP } from '@/lib/analysis/simulator'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { schemeCode, monthlyAmount, startDate, endDate } = body as {
      schemeCode: number
      monthlyAmount: number
      startDate: string
      endDate: string
    }

    if (!schemeCode || !monthlyAmount || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await backtestSIP(
      schemeCode,
      monthlyAmount,
      new Date(startDate),
      new Date(endDate),
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error('[simulator/backtest]', err)
    return NextResponse.json({ error: 'Backtest failed' }, { status: 500 })
  }
}
