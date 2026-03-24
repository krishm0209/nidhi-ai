import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getCurrentFY } from '@/lib/analysis/tax-optimizer'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const NIFTY_KEY_LEVELS = [22000, 22500, 23000, 23500, 24000, 24500, 25000]

function nearestKeyLevel(nifty: number): { level: number; above: boolean; dist: number } {
  let best = NIFTY_KEY_LEVELS[0]
  let bestDist = Math.abs(nifty - best)
  for (const lvl of NIFTY_KEY_LEVELS) {
    const d = Math.abs(nifty - lvl)
    if (d < bestDist) { best = lvl; bestDist = d }
  }
  return { level: best, above: nifty > best, dist: Math.round(bestDist) }
}

export interface Briefing {
  userId: string
  date: string    // ISO date
  headline: string
  body: string    // Gemini-generated 4-5 lines
  stats: {
    portfolioChange: number | null
    portfolioChangePct: number | null
    sipsDueToday: string[]
    ltcgCrossings: string[]   // names crossing 1yr threshold this week
    daysToFYEnd: number
  }
}

export async function generateBriefing(userId: string): Promise<Briefing | null> {
  try {
    // Get self member
    const { data: selfMember } = await supabaseAdmin
      .from('household_members')
      .select('id, name')
      .eq('user_id', userId)
      .eq('relationship', 'self')
      .single()

    if (!selfMember) return null

    const memberId = selfMember.id
    const firstName = selfMember.name.split(' ')[0]

    // Fetch holdings
    const [stocksRes, mfRes, cryptoRes] = await Promise.all([
      supabaseAdmin.from('stock_holdings').select('symbol, exchange, quantity, average_price, purchase_date').eq('member_id', memberId),
      supabaseAdmin.from('mf_holdings').select('scheme_code, scheme_name, units, purchase_nav, is_sip, sip_date, purchase_date').eq('member_id', memberId),
      supabaseAdmin.from('crypto_holdings').select('coin_id, coin_symbol, quantity, average_price_inr').eq('member_id', memberId),
    ])

    const stocks = stocksRes.data ?? []
    const mfs = mfRes.data ?? []
    const cryptos = cryptoRes.data ?? []

    // Fetch current prices
    const [stockPrices, mfNavs, cryptoPrices] = await Promise.all([
      getStockPrices(stocks.map(s => ({ symbol: s.symbol, exchange: s.exchange as 'NSE' | 'BSE' }))),
      getMFNavs(mfs.map(m => m.scheme_code)),
      getCryptoPricesINR(cryptos.map(c => c.coin_id)),
    ])

    // Total portfolio value
    let totalValue = 0
    let totalInvested = 0

    for (const s of stocks) {
      const ltp = stockPrices[`${s.exchange}:${s.symbol}`]?.ltp ?? s.average_price
      totalValue += ltp * s.quantity
      totalInvested += s.average_price * s.quantity
    }
    for (const m of mfs) {
      const nav = mfNavs[m.scheme_code] ?? m.purchase_nav ?? 0
      totalValue += nav * m.units
      totalInvested += (m.purchase_nav ?? nav) * m.units
    }
    for (const c of cryptos) {
      const price = cryptoPrices[c.coin_id] ?? c.average_price_inr
      totalValue += price * c.quantity
      totalInvested += c.average_price_inr * c.quantity
    }

    const portfolioChange = totalValue - totalInvested
    const portfolioChangePct = totalInvested > 0 ? (portfolioChange / totalInvested) * 100 : 0

    // SIPs executing today or tomorrow
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const sipsDueToday: string[] = mfs
      .filter(m => m.is_sip && m.sip_date && (m.sip_date === today.getDate() || m.sip_date === tomorrow.getDate()))
      .map(m => m.scheme_name)

    // STCG → LTCG crossings this week (within 7 days of 1-year mark)
    const ltcgCrossings: string[] = []
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    for (const s of stocks) {
      if (!s.purchase_date) continue
      const oneYearMark = new Date(s.purchase_date)
      oneYearMark.setFullYear(oneYearMark.getFullYear() + 1)
      if (oneYearMark >= today && oneYearMark <= sevenDaysFromNow) {
        ltcgCrossings.push(`${s.symbol} (${Math.ceil((oneYearMark.getTime() - today.getTime()) / 86400000)}d)`)
      }
    }
    for (const m of mfs) {
      if (!m.purchase_date) continue
      const oneYearMark = new Date(m.purchase_date)
      oneYearMark.setFullYear(oneYearMark.getFullYear() + 1)
      if (oneYearMark >= today && oneYearMark <= sevenDaysFromNow) {
        ltcgCrossings.push(`${m.scheme_name.split('-')[0].trim()} (${Math.ceil((oneYearMark.getTime() - today.getTime()) / 86400000)}d)`)
      }
    }

    const fy = getCurrentFY()

    // Build Gemini prompt
    const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
    const pctStr = `${portfolioChangePct >= 0 ? '+' : ''}${portfolioChangePct.toFixed(2)}%`

    const prompt = `You are NidhiAI, a concise Indian personal finance assistant. Write a "Good morning, ${firstName}!" briefing in exactly 4-5 short sentences. Be friendly but factual. Reference specific numbers.

Portfolio P&L: ${fmt(portfolioChange)} (${pctStr}) overall
FY end: ${fy.daysLeft} days remaining until March 31
${sipsDueToday.length > 0 ? `SIPs executing today/tomorrow: ${sipsDueToday.slice(0, 2).join(', ')}` : 'No SIPs scheduled today'}
${ltcgCrossings.length > 0 ? `LTCG crossings this week: ${ltcgCrossings.slice(0, 2).join(', ')}` : ''}
${fy.daysLeft <= 10 ? `URGENT: Only ${fy.daysLeft} days left to make 80C/ELSS investments for this FY.` : ''}

Write 4-5 sentences maximum. No bullet points, no headers. Just flowing text. Start with "Good morning, ${firstName}!"`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const body = result.response.text().trim()

    return {
      userId,
      date: today.toISOString().split('T')[0],
      headline: `Good morning, ${firstName}`,
      body,
      stats: {
        portfolioChange: Math.round(portfolioChange),
        portfolioChangePct: Math.round(portfolioChangePct * 100) / 100,
        sipsDueToday,
        ltcgCrossings,
        daysToFYEnd: fy.daysLeft,
      },
    }
  } catch {
    return null
  }
}
