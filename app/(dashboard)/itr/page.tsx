import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'
import { computeMemberTaxProfile, getCurrentFY } from '@/lib/analysis/tax-optimizer'
import { ITRGuideClient } from './ITRGuideClient'

function daysHeld(purchaseDate: string): number {
  return Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000)
}

function isEquityMF(fundType: string | null): boolean {
  if (!fundType) return true
  const t = fundType.toUpperCase()
  return t.includes('EQUITY') || t.includes('ELSS') || t.includes('HYBRID') || t.includes('BALANCED')
}

export default async function ITRPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id, full_name')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  const memberId = selfMember?.id

  // ── Fetch holdings ────────────────────────────────────────────────────────
  const [stocksRes, mfRes, cryptoRes] = await Promise.all([
    memberId ? supabaseAdmin.from('stock_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabaseAdmin.from('mf_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabaseAdmin.from('crypto_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
  ])

  const stocks = stocksRes.data ?? []
  const mfs = mfRes.data ?? []
  const cryptos = cryptoRes.data ?? []

  const [navs, cryptoPrices, stockPrices] = await Promise.all([
    getMFNavs(mfs.map(h => h.scheme_code)),
    getCryptoPricesINR(cryptos.map(h => h.coin_id)),
    getStockPrices(stocks.map(h => ({ symbol: h.symbol, exchange: h.exchange as 'NSE' | 'BSE' }))),
  ])

  // ── Capital gains ─────────────────────────────────────────────────────────
  let stcgEquity = 0, ltcgEquity = 0, cryptoGains = 0

  for (const h of stocks) {
    const ltp = stockPrices[`${h.exchange}:${h.symbol}`]?.ltp ?? h.average_price
    const gain = (ltp - h.average_price) * h.quantity
    if (gain <= 0 || !h.purchase_date) continue
    const days = daysHeld(h.purchase_date)
    if (days > 365) ltcgEquity += gain
    else stcgEquity += gain
  }

  for (const h of mfs) {
    const nav = navs[h.scheme_code] ?? h.purchase_nav ?? 0
    const gain = (nav - (h.purchase_nav ?? nav)) * h.units
    if (gain <= 0 || !h.purchase_date) continue
    if (!isEquityMF(h.fund_type)) continue // debt gains taxed at slab — skip for now
    const days = daysHeld(h.purchase_date)
    if (days > 365) ltcgEquity += gain
    else stcgEquity += gain
  }

  for (const h of cryptos) {
    const price = cryptoPrices[h.coin_id] ?? h.average_price_inr
    const gain = (price - h.average_price_inr) * h.quantity
    if (gain > 0) cryptoGains += gain
  }

  // ── Deductions (from tax optimizer) ──────────────────────────────────────
  const fy = getCurrentFY()
  const taxProfile = memberId
    ? await computeMemberTaxProfile(memberId, selfMember?.full_name ?? 'You', 'self', fy)
    : null

  // ── TDS deducted (from tax_deductions table, section=TDS) ─────────────────
  const { data: tdsRows } = memberId
    ? await supabaseAdmin
        .from('tax_deductions')
        .select('amount')
        .eq('member_id', memberId)
        .eq('financial_year', fy.label)
        .eq('section', 'TDS')
    : { data: [] }

  const tdsDeducted = (tdsRows ?? []).reduce((s, r) => s + r.amount, 0)

  const preFill = {
    stcgEquity: Math.round(stcgEquity),
    ltcgEquity: Math.round(ltcgEquity),
    cryptoGains: Math.round(cryptoGains),
    section80C: taxProfile?.section80C.total ?? 0,
    section80CCD1B: taxProfile?.section80CCD1B.total ?? 0,
    section80D: (taxProfile?.section80D.self ?? 0) + (taxProfile?.section80D.parents ?? 0),
    tdsDeducted,
  }

  return <ITRGuideClient preFill={preFill} />
}
