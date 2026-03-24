import { NextResponse, type NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(`xray:${user.id}`, 10, 60)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await request.json()

  const {
    totalValue,
    totalInvested,
    totalGainLoss,
    totalGainLossPct,
    allocation,   // [{ name, value, pct }]
    topHoldings,  // [{ name, assetClass, currentValue, pct, gainLossPct, purchaseDate? }]
    concentrated, // [{ name, pct }]
  } = body

  const prompt = `You are a personal finance analyst for an Indian investor. Analyze this portfolio and give 4-5 SHORT, specific, actionable insights. Be direct and personalized — reference actual fund names, numbers, and percentages from the data.

PORTFOLIO SUMMARY:
- Total value: ₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
- Total invested: ₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
- Overall P&L: ${totalGainLoss >= 0 ? '+' : ''}₹${Math.abs(totalGainLoss).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${totalGainLossPct.toFixed(2)}%)

ASSET ALLOCATION:
${allocation.map((a: { name: string; pct: number; value: number }) => `- ${a.name}: ${a.pct.toFixed(1)}% (₹${a.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`).join('\n')}

TOP HOLDINGS:
${topHoldings.map((h: { name: string; assetClass: string; pct: number; gainLossPct: number }) => `- ${h.name} (${h.assetClass}): ${h.pct.toFixed(1)}% of portfolio, ${h.gainLossPct >= 0 ? '+' : ''}${h.gainLossPct.toFixed(2)}% return`).join('\n')}

${concentrated.length > 0 ? `CONCENTRATION RISK: ${concentrated.map((c: { name: string; pct: number }) => `${c.name} at ${c.pct.toFixed(1)}%`).join(', ')}` : ''}

Rules:
- Write in plain English, no markdown headers or bullet symbols — just numbered points (1. 2. 3. etc.)
- Each insight max 2 sentences
- Reference specific fund names and numbers
- Focus on: diversification, risk, tax efficiency (LTCG/STCG), rebalancing, and next steps
- Be honest, not just positive`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContentStream(prompt)

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) controller.enqueue(new TextEncoder().encode(text))
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
