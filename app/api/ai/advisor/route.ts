import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Max history messages to include (pairs of user+model)
const MAX_HISTORY_PAIRS = 10

async function buildPortfolioContext(memberId: string): Promise<string> {
  const [stocksRes, mfRes, cryptoRes, fiRes, goldRes] = await Promise.allSettled([
    supabaseAdmin.from('stock_holdings').select('symbol, exchange, quantity, average_price').eq('member_id', memberId),
    supabaseAdmin.from('mf_holdings').select('scheme_code, scheme_name, units, purchase_nav, fund_type').eq('member_id', memberId),
    supabaseAdmin.from('crypto_holdings').select('coin_id, coin_symbol, quantity, average_price_inr').eq('member_id', memberId),
    supabaseAdmin.from('fixed_income_holdings').select('instrument_type, institution, principal, interest_rate, maturity_date, current_value').eq('member_id', memberId),
    supabaseAdmin.from('gold_holdings').select('form, weight_grams, units, purchase_nav').eq('member_id', memberId),
  ])

  const stocks = stocksRes.status === 'fulfilled' ? (stocksRes.value.data ?? []) : []
  const mfs = mfRes.status === 'fulfilled' ? (mfRes.value.data ?? []) : []
  const cryptos = cryptoRes.status === 'fulfilled' ? (cryptoRes.value.data ?? []) : []
  const fis = fiRes.status === 'fulfilled' ? (fiRes.value.data ?? []) : []
  const golds = goldRes.status === 'fulfilled' ? (goldRes.value.data ?? []) : []

  // Fetch prices with individual timeouts — failures are OK
  const [stockPrices, mfNavs, cryptoPrices] = await Promise.allSettled([
    getStockPrices(stocks.map((s) => ({ symbol: s.symbol, exchange: s.exchange as 'NSE' | 'BSE' }))),
    getMFNavs(mfs.map((m) => m.scheme_code)),
    getCryptoPricesINR(cryptos.map((c) => c.coin_id)),
  ])

  const sp = stockPrices.status === 'fulfilled' ? stockPrices.value : {}
  const navs = mfNavs.status === 'fulfilled' ? mfNavs.value : {}
  const cp = cryptoPrices.status === 'fulfilled' ? cryptoPrices.value : {}

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  let stocksCurrent = 0, stocksInvested = 0
  const stockLines = stocks.map((s) => {
    const ltp = sp[`${s.exchange}:${s.symbol}`]?.ltp ?? s.average_price
    const curr = ltp * s.quantity
    const inv = s.average_price * s.quantity
    stocksCurrent += curr; stocksInvested += inv
    const gl = inv > 0 ? (curr - inv) / inv * 100 : 0
    return `  ${s.symbol} (${s.exchange}): ${s.quantity} shares @ avg ${fmt(s.average_price)}, LTP ${fmt(ltp)}, ${fmtPct(gl)}`
  })

  let mfCurrent = 0, mfInvested = 0
  const mfLines = mfs.map((m) => {
    const nav = navs[m.scheme_code] ?? m.purchase_nav ?? 0
    const curr = nav * m.units
    const inv = (m.purchase_nav ?? nav) * m.units
    mfCurrent += curr; mfInvested += inv
    const gl = inv > 0 ? (curr - inv) / inv * 100 : 0
    return `  ${m.scheme_name} [${m.fund_type ?? 'MF'}]: ${m.units.toFixed(3)} units @ NAV ${nav.toFixed(4)}, value ${fmt(curr)}, ${fmtPct(gl)}`
  })

  let cryptoCurrent = 0, cryptoInvested = 0
  const cryptoLines = cryptos.map((c) => {
    const price = cp[c.coin_id] ?? c.average_price_inr
    const curr = price * c.quantity
    const inv = c.average_price_inr * c.quantity
    cryptoCurrent += curr; cryptoInvested += inv
    const gl = inv > 0 ? (curr - inv) / inv * 100 : 0
    return `  ${c.coin_symbol.toUpperCase()}: ${c.quantity} units, value ${fmt(curr)}, ${fmtPct(gl)}`
  })

  let fiTotal = 0
  const fiLines = fis.map((f) => {
    const val = f.current_value ?? f.principal
    fiTotal += val
    return `  ${f.instrument_type.toUpperCase()}${f.institution ? ` at ${f.institution}` : ''}: principal ${fmt(f.principal)}${f.interest_rate ? `, rate ${f.interest_rate}%` : ''}${f.maturity_date ? `, matures ${f.maturity_date}` : ''}`
  })

  let goldTotal = 0
  const goldLines = golds.map((g) => {
    const val = g.weight_grams ? g.weight_grams * 8000 : (g.units ?? 0) * (g.purchase_nav ?? 0)
    goldTotal += val
    return `  ${g.form}: ${g.weight_grams ? `${g.weight_grams}g` : `${g.units} units`}, ~${fmt(val)}`
  })

  const totalInvested = stocksInvested + mfInvested + cryptoInvested
  const totalCurrent = stocksCurrent + mfCurrent + cryptoCurrent + fiTotal + goldTotal
  const totalGainLoss = (stocksCurrent - stocksInvested) + (mfCurrent - mfInvested) + (cryptoCurrent - cryptoInvested)

  const lines: string[] = [
    `PORTFOLIO SNAPSHOT (Indian investor, INR):`,
    `Total value: ${fmt(totalCurrent)} | Invested: ${fmt(totalInvested)} | P&L: ${fmt(totalGainLoss)} (${fmtPct(totalInvested > 0 ? totalGainLoss / totalInvested * 100 : 0)})`,
    ``,
    `ALLOCATION:`,
    stocksCurrent > 0 ? `  Stocks: ${fmt(stocksCurrent)} (${(stocksCurrent / totalCurrent * 100).toFixed(1)}%)` : '',
    mfCurrent > 0 ? `  Mutual Funds: ${fmt(mfCurrent)} (${(mfCurrent / totalCurrent * 100).toFixed(1)}%)` : '',
    cryptoCurrent > 0 ? `  Crypto: ${fmt(cryptoCurrent)} (${(cryptoCurrent / totalCurrent * 100).toFixed(1)}%)` : '',
    fiTotal > 0 ? `  Fixed Income: ${fmt(fiTotal)} (${(fiTotal / totalCurrent * 100).toFixed(1)}%)` : '',
    goldTotal > 0 ? `  Gold: ${fmt(goldTotal)} (${(goldTotal / totalCurrent * 100).toFixed(1)}%)` : '',
    ``,
    stocks.length > 0 ? `STOCKS:\n${stockLines.join('\n')}` : '',
    mfs.length > 0 ? `MUTUAL FUNDS:\n${mfLines.join('\n')}` : '',
    cryptos.length > 0 ? `CRYPTO:\n${cryptoLines.join('\n')}` : '',
    fis.length > 0 ? `FIXED INCOME:\n${fiLines.join('\n')}` : '',
    golds.length > 0 ? `GOLD:\n${goldLines.join('\n')}` : '',
  ].filter(Boolean)

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const rl = await rateLimit(`advisor:${user.id}`, 20, 60)
  if (!rl.success) {
    return new Response('Too many requests — please wait a moment.', { status: 429 })
  }

  const body = await req.json() as { message: string; sessionId?: string }
  const { message, sessionId: incomingSessionId } = body

  if (!message?.trim()) return new Response('Empty message', { status: 400 })

  // Get self member for portfolio context
  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('relationship', 'self')
    .single()

  // Get or create session
  let sessionId = incomingSessionId
  if (!sessionId) {
    const title = message.slice(0, 60) + (message.length > 60 ? '…' : '')
    const { data: newSession } = await supabaseAdmin
      .from('chat_sessions')
      .insert({ user_id: user.id, title })
      .select('id')
      .single()
    sessionId = newSession?.id ?? null
  }

  // Save user message
  if (sessionId) {
    await supabaseAdmin.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
    })
  }

  // Load recent history for this session
  let geminiHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
  if (sessionId) {
    const { data: msgs } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_PAIRS * 2 + 1)

    // Build history (exclude the last user message we just saved)
    const history = (msgs ?? []).slice(0, -1)
    for (const msg of history) {
      if (msg.role !== 'user' && msg.role !== 'assistant') continue
      geminiHistory.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }
  }

  // Build portfolio context
  const portfolioContext = selfMember
    ? await buildPortfolioContext(selfMember.id)
    : 'No portfolio data available yet.'

  const systemInstruction = `You are NidhiAI, a personal finance advisor for Indian investors. You are knowledgeable about Indian tax laws (STCG/LTCG), SEBI regulations, mutual funds (AMFI), NSE/BSE stocks, and investment strategies relevant to India.

Here is the user's current portfolio for context:

${portfolioContext}

Guidelines:
- Be concise, specific, and actionable
- Reference actual holdings, numbers, and percentages from the portfolio when relevant
- Apply Indian financial context: INR, tax rates (STCG equity 20%, LTCG equity 12.5% above ₹1.25L, crypto 30%), SEBI rules
- Never give absolute buy/sell orders — give informed suggestions with caveats
- If asked something outside finance, politely redirect
- Format with clear paragraphs; use bullet points only for lists`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction,
  })

  const chat = model.startChat({ history: geminiHistory })

  let fullResponse = ''
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await chat.sendMessageStream(message)
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            fullResponse += text
            controller.enqueue(new TextEncoder().encode(text))
          }
        }
        controller.close()

        // Persist assistant response
        if (sessionId && fullResponse) {
          await supabaseAdmin.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullResponse,
          })
        }
      } catch (err) {
        controller.error(err)
      }
    },
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
  }
  if (sessionId) headers['X-Session-Id'] = sessionId

  return new Response(stream, { headers })
}
