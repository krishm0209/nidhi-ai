import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'
import { computeXIRR } from '@/lib/analysis/simulator'
import { getAgeBracket } from '@/lib/analysis/itr'

export interface UserMetrics {
  portfolioValue: number
  equityPct: number
  monthlySlp: number   // total SIP per month
  holdingsCount: number
  xirr: number | null
}

export interface Percentiles {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  sampleSize: number
}

export interface BenchmarkResult {
  ageBracket: string
  userMetrics: UserMetrics
  percentiles: Record<string, Percentiles | null>
  userRank: Record<string, number | null>   // percentile rank 0-100
}

function percentileRank(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 50
  const below = sorted.filter(v => v < value).length
  return Math.round((below / sorted.length) * 100)
}

function computePercentiles(sorted: number[]): Percentiles {
  const n = sorted.length
  const at = (pct: number) => sorted[Math.floor((pct / 100) * (n - 1))]
  return {
    p10: at(10), p25: at(25), p50: at(50), p75: at(75), p90: at(90),
    sampleSize: n,
  }
}

export async function computeUserMetrics(memberId: string): Promise<UserMetrics> {
  const [stocksRes, mfRes, cryptoRes, fiRes, goldRes] = await Promise.allSettled([
    supabaseAdmin.from('stock_holdings').select('symbol, exchange, quantity, average_price, purchase_date').eq('member_id', memberId),
    supabaseAdmin.from('mf_holdings').select('scheme_code, units, purchase_nav, is_sip, sip_amount').eq('member_id', memberId),
    supabaseAdmin.from('crypto_holdings').select('coin_id, quantity, average_price_inr').eq('member_id', memberId),
    supabaseAdmin.from('fixed_income_holdings').select('principal, current_value').eq('member_id', memberId),
    supabaseAdmin.from('gold_holdings').select('weight_grams, units, purchase_nav').eq('member_id', memberId),
  ])

  const stocks = stocksRes.status === 'fulfilled' ? (stocksRes.value.data ?? []) : []
  const mfs    = mfRes.status    === 'fulfilled' ? (mfRes.value.data ?? [])    : []
  const cryptos= cryptoRes.status=== 'fulfilled' ? (cryptoRes.value.data ?? []): []
  const fis    = fiRes.status    === 'fulfilled' ? (fiRes.value.data ?? [])    : []
  const golds  = goldRes.status  === 'fulfilled' ? (goldRes.value.data ?? [])  : []

  const [stockPrices, mfNavs, cryptoPrices] = await Promise.allSettled([
    getStockPrices(stocks.map(s => ({ symbol: s.symbol, exchange: s.exchange as 'NSE' | 'BSE' }))),
    getMFNavs(mfs.map(m => m.scheme_code)),
    getCryptoPricesINR(cryptos.map(c => c.coin_id)),
  ])

  const sp = stockPrices.status === 'fulfilled' ? stockPrices.value : {}
  const navs = mfNavs.status === 'fulfilled' ? mfNavs.value : {}
  const cp = cryptoPrices.status === 'fulfilled' ? cryptoPrices.value : {}

  let stocksVal = 0, mfVal = 0, cryptoVal = 0, fiVal = 0, goldVal = 0
  let stocksInv = 0, mfInv = 0, cryptoInv = 0

  for (const s of stocks) {
    const ltp = sp[`${s.exchange}:${s.symbol}`]?.ltp ?? s.average_price
    stocksVal += ltp * s.quantity
    stocksInv += s.average_price * s.quantity
  }
  for (const m of mfs) {
    const nav = navs[m.scheme_code] ?? m.purchase_nav ?? 0
    mfVal += nav * m.units
    mfInv += (m.purchase_nav ?? nav) * m.units
  }
  for (const c of cryptos) {
    const price = cp[c.coin_id] ?? c.average_price_inr
    cryptoVal += price * c.quantity
    cryptoInv += c.average_price_inr * c.quantity
  }
  for (const f of fis) fiVal += f.current_value ?? f.principal
  for (const g of golds) goldVal += g.weight_grams ? g.weight_grams * 8000 : (g.units ?? 0) * (g.purchase_nav ?? 0)

  const totalVal = stocksVal + mfVal + cryptoVal + fiVal + goldVal
  const equityVal = stocksVal + mfVal   // simplified — equity portion
  const equityPct = totalVal > 0 ? (equityVal / totalVal) * 100 : 0
  const holdingsCount = stocks.length + mfs.length + cryptos.length + fis.length + golds.length
  const monthlySlp = mfs.filter(m => m.is_sip).reduce((s, m) => s + (m.sip_amount ?? 0), 0)

  // Simple XIRR approximation
  const totalInvested = stocksInv + mfInv + cryptoInv
  let xirr: number | null = null
  if (totalInvested > 1000 && totalVal > 0) {
    // Single cash flow approximation
    const daysAgo = 365  // assume 1yr avg holding
    xirr = computeXIRR([
      { amount: -totalInvested, date: new Date(Date.now() - daysAgo * 86400000) },
      { amount: totalVal, date: new Date() },
    ])
  }

  return { portfolioValue: totalVal, equityPct, monthlySlp, holdingsCount, xirr }
}

// Called by nightly cron — aggregates all users into benchmark_aggregates
export async function runBenchmarkAggregation(): Promise<number> {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (!users) return 0

  type Bucket = Record<string, number[]>
  const buckets: Record<string, Bucket> = {}

  let processed = 0
  for (const user of users.users) {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('date_of_birth').eq('id', user.id).single()
      const { data: member } = await supabaseAdmin.from('household_members').select('id').eq('user_id', user.id).eq('relationship', 'self').single()
      if (!member) continue

      const metrics = await computeUserMetrics(member.id)
      if (metrics.portfolioValue < 1000) continue   // skip empty portfolios

      const bracket = getAgeBracket(profile?.date_of_birth ?? null)
      if (!buckets[bracket]) buckets[bracket] = { portfolio_value: [], equity_pct: [], monthly_sip: [], holdings_count: [], xirr: [] }

      buckets[bracket].portfolio_value.push(metrics.portfolioValue)
      buckets[bracket].equity_pct.push(metrics.equityPct)
      buckets[bracket].monthly_sip.push(metrics.monthlySlp)
      buckets[bracket].holdings_count.push(metrics.holdingsCount)
      if (metrics.xirr !== null) buckets[bracket].xirr.push(metrics.xirr)
      processed++
    } catch { /* skip individual failures */ }
  }

  // Upsert into benchmark_aggregates
  for (const [bracket, data] of Object.entries(buckets)) {
    for (const [metric, values] of Object.entries(data)) {
      if (values.length < 3) continue
      const sorted = [...values].sort((a, b) => a - b)
      const p = computePercentiles(sorted)
      await supabaseAdmin.from('benchmark_aggregates').upsert({
        age_bracket: bracket,
        metric,
        percentile_10: p.p10,
        percentile_25: p.p25,
        percentile_50: p.p50,
        percentile_75: p.p75,
        percentile_90: p.p90,
        sample_size: p.sampleSize,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'age_bracket,metric' })
    }
  }

  return processed
}

export async function getUserBenchmark(userId: string): Promise<BenchmarkResult | null> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('date_of_birth').eq('id', userId).single()
  const { data: member } = await supabaseAdmin.from('household_members').select('id').eq('user_id', userId).eq('relationship', 'self').single()
  if (!member) return null

  const bracket = getAgeBracket(profile?.date_of_birth ?? null)
  const userMetrics = await computeUserMetrics(member.id)

  const METRICS = ['portfolio_value', 'equity_pct', 'monthly_sip', 'holdings_count', 'xirr']
  const { data: agg } = await supabaseAdmin
    .from('benchmark_aggregates')
    .select('*')
    .eq('age_bracket', bracket)
    .in('metric', METRICS)

  const percentiles: BenchmarkResult['percentiles'] = {}
  const userRank: BenchmarkResult['userRank'] = {}

  for (const metric of METRICS) {
    const row = agg?.find(r => r.metric === metric)
    if (!row || row.sample_size < 5) {
      percentiles[metric] = null
      userRank[metric] = null
      continue
    }
    percentiles[metric] = {
      p10: row.percentile_10, p25: row.percentile_25, p50: row.percentile_50,
      p75: row.percentile_75, p90: row.percentile_90, sampleSize: row.sample_size,
    }
    // Compute user's percentile rank
    const userVal = metric === 'portfolio_value' ? userMetrics.portfolioValue
      : metric === 'equity_pct' ? userMetrics.equityPct
      : metric === 'monthly_sip' ? userMetrics.monthlySlp
      : metric === 'holdings_count' ? userMetrics.holdingsCount
      : (userMetrics.xirr ?? 0)

    // Approximate rank from stored percentiles
    const p = percentiles[metric]!
    if (userVal <= p.p10) userRank[metric] = 10
    else if (userVal <= p.p25) userRank[metric] = 25
    else if (userVal <= p.p50) userRank[metric] = 50
    else if (userVal <= p.p75) userRank[metric] = 75
    else if (userVal <= p.p90) userRank[metric] = 90
    else userRank[metric] = 95
  }

  return { ageBracket: bracket, userMetrics, percentiles, userRank }
}
