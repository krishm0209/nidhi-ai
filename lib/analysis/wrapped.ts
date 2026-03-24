import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'

export interface WrappedReport {
  year: number
  userName: string
  totalInvested: number
  totalValue: number
  totalGain: number
  gainPct: number
  bestHolding: { name: string; gainPct: number; assetClass: string } | null
  worstHolding: { name: string; gainPct: number; assetClass: string } | null
  totalElss80C: number        // ELSS invested this year
  estimatedTaxSaved: number   // at 30% slab
  activeSIPs: number
  monthlySlpAmount: number
  holdingsCount: number
  topAssetClass: string
  xrayScore: number | null
}

export async function generateWrapped(userId: string, year: number): Promise<WrappedReport | null> {
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', userId).single()
  const { data: member } = await supabaseAdmin.from('household_members').select('id').eq('user_id', userId).eq('relationship', 'self').single()
  if (!member) return null

  const memberId = member.id

  const [stocksRes, mfRes, cryptoRes, fiRes, goldRes, xrayRes] = await Promise.allSettled([
    supabaseAdmin.from('stock_holdings').select('symbol, exchange, quantity, average_price').eq('member_id', memberId),
    supabaseAdmin.from('mf_holdings').select('scheme_code, scheme_name, units, purchase_nav, fund_type, is_sip, sip_amount').eq('member_id', memberId),
    supabaseAdmin.from('crypto_holdings').select('coin_id, coin_symbol, quantity, average_price_inr').eq('member_id', memberId),
    supabaseAdmin.from('fixed_income_holdings').select('principal, current_value').eq('member_id', memberId),
    supabaseAdmin.from('gold_holdings').select('weight_grams, units, purchase_nav').eq('member_id', memberId),
    supabaseAdmin.from('xray_scores').select('overall_score').eq('user_id', userId).order('computed_at', { ascending: false }).limit(1).single(),
  ])

  const stocks  = stocksRes.status  === 'fulfilled' ? (stocksRes.value.data ?? [])  : []
  const mfs     = mfRes.status      === 'fulfilled' ? (mfRes.value.data ?? [])      : []
  const cryptos = cryptoRes.status  === 'fulfilled' ? (cryptoRes.value.data ?? [])  : []
  const fis     = fiRes.status      === 'fulfilled' ? (fiRes.value.data ?? [])      : []
  const golds   = goldRes.status    === 'fulfilled' ? (goldRes.value.data ?? [])    : []
  const xray    = xrayRes.status    === 'fulfilled' ? xrayRes.value.data            : null

  const [sp, navs, cp] = await Promise.allSettled([
    getStockPrices(stocks.map(s => ({ symbol: s.symbol, exchange: s.exchange as 'NSE' | 'BSE' }))),
    getMFNavs(mfs.map(m => m.scheme_code)),
    getCryptoPricesINR(cryptos.map(c => c.coin_id)),
  ])
  const stockPrices = sp.status === 'fulfilled' ? sp.value : {}
  const mfNavs = navs.status === 'fulfilled' ? navs.value : {}
  const cryptoPrices = cp.status === 'fulfilled' ? cp.value : {}

  interface HoldingPerf { name: string; gainPct: number; assetClass: string }
  const performances: HoldingPerf[] = []

  let totalInvested = 0, totalValue = 0
  let stocksVal = 0, mfVal = 0, cryptoVal = 0, fiVal = 0, goldVal = 0

  for (const s of stocks) {
    const ltp = stockPrices[`${s.exchange}:${s.symbol}`]?.ltp ?? s.average_price
    const inv = s.average_price * s.quantity
    const val = ltp * s.quantity
    totalInvested += inv; totalValue += val; stocksVal += val
    if (inv > 0) performances.push({ name: s.symbol, gainPct: (val - inv) / inv * 100, assetClass: 'Stocks' })
  }
  for (const m of mfs) {
    const nav = mfNavs[m.scheme_code] ?? m.purchase_nav ?? 0
    const inv = (m.purchase_nav ?? nav) * m.units
    const val = nav * m.units
    totalInvested += inv; totalValue += val; mfVal += val
    if (inv > 0) performances.push({ name: m.scheme_name, gainPct: (val - inv) / inv * 100, assetClass: 'Mutual Funds' })
  }
  for (const c of cryptos) {
    const price = cryptoPrices[c.coin_id] ?? c.average_price_inr
    const inv = c.average_price_inr * c.quantity
    const val = price * c.quantity
    totalInvested += inv; totalValue += val; cryptoVal += val
    if (inv > 0) performances.push({ name: c.coin_symbol.toUpperCase(), gainPct: (val - inv) / inv * 100, assetClass: 'Crypto' })
  }
  for (const f of fis) { const val = f.current_value ?? f.principal; fiVal += val; totalValue += val }
  for (const g of golds) { const val = g.weight_grams ? g.weight_grams * 8000 : (g.units ?? 0) * (g.purchase_nav ?? 0); goldVal += val; totalValue += val }

  const sortedPerf = [...performances].sort((a, b) => b.gainPct - a.gainPct)
  const best  = sortedPerf[0] ?? null
  const worst = sortedPerf[sortedPerf.length - 1] ?? null

  // ELSS invested this year (for 80C)
  const { data: elssRows } = await supabaseAdmin
    .from('mf_holdings')
    .select('units, purchase_nav, fund_type')
    .eq('member_id', memberId)
    .gte('created_at', yearStart)
    .lte('created_at', `${yearEnd}T23:59:59`)
  const totalElss80C = (elssRows ?? [])
    .filter(r => r.fund_type?.toUpperCase().includes('ELSS'))
    .reduce((s, r) => s + r.units * (r.purchase_nav ?? 0), 0)

  const totalGain = totalValue - totalInvested
  const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0

  const assetValues = { Stocks: stocksVal, 'Mutual Funds': mfVal, Crypto: cryptoVal, 'Fixed Income': fiVal, Gold: goldVal }
  const topAssetClass = Object.entries(assetValues).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mutual Funds'

  const activeSIPs = mfs.filter(m => m.is_sip).length
  const monthlySlpAmount = mfs.filter(m => m.is_sip).reduce((s, m) => s + (m.sip_amount ?? 0), 0)

  return {
    year,
    userName: profile?.full_name?.split(' ')[0] ?? 'Investor',
    totalInvested: Math.round(totalInvested),
    totalValue: Math.round(totalValue),
    totalGain: Math.round(totalGain),
    gainPct: Math.round(gainPct * 10) / 10,
    bestHolding: best,
    worstHolding: worst && worst.gainPct < 0 ? worst : null,
    totalElss80C: Math.round(totalElss80C),
    estimatedTaxSaved: Math.round(Math.min(totalElss80C, 150_000) * 0.30),
    activeSIPs,
    monthlySlpAmount: Math.round(monthlySlpAmount),
    holdingsCount: performances.length,
    topAssetClass,
    xrayScore: xray?.overall_score ?? null,
  }
}
