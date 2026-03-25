import Link from 'next/link'
import { SipReminderBanner } from '@/components/dashboard/SipReminderBanner'
import { MorningBriefing } from '@/components/dashboard/MorningBriefing'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'
import { StatCard, Card } from '@/components/ui/Card'
import { AllocationPie } from '@/components/charts/AllocationPie'
import { formatINR, formatGain, formatChange } from '@/lib/utils/format'
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import type { AllocationSlice } from '@/components/charts/AllocationPie'

const DOT_COLORS: Record<string, string> = {
  Stocks: '#10b981',
  'Mutual Funds': '#3b82f6',
  Crypto: '#f97316',
  'Fixed Income': '#8b5cf6',
  Gold: '#eab308',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, last_cas_import_at')
    .eq('id', user!.id)
    .single()

  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  const memberId = selfMember?.id

  const [stocksRes, mfRes, cryptoRes, fiRes, goldRes] = await Promise.all([
    memberId ? supabase.from('stock_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabase.from('mf_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabase.from('crypto_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabase.from('fixed_income_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabase.from('gold_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
  ])

  const stocks = stocksRes.data ?? []
  const mfs = mfRes.data ?? []
  const cryptos = cryptoRes.data ?? []
  const fixedIncomes = fiRes.data ?? []
  const golds = goldRes.data ?? []

  const hasHoldings = stocks.length + mfs.length + cryptos.length + fixedIncomes.length + golds.length > 0

  const [navs, cryptoPrices, stockPrices] = await Promise.all([
    getMFNavs(mfs.map((h) => h.scheme_code)),
    getCryptoPricesINR(cryptos.map((h) => h.coin_id)),
    getStockPrices(stocks.map((h) => ({ symbol: h.symbol, exchange: h.exchange as 'NSE' | 'BSE' }))),
  ])

  // Stocks
  let stocksInvested = 0, stocksCurrent = 0, stocksDayChange = 0
  for (const h of stocks) {
    const quote = stockPrices[`${h.exchange}:${h.symbol}`]
    const invested = h.average_price * h.quantity
    const current = (quote?.ltp ?? h.average_price) * h.quantity
    stocksInvested += invested
    stocksCurrent += current
    if (quote) stocksDayChange += current * (quote.day_change_pct / 100)
  }

  // Mutual funds
  let mfInvested = 0, mfCurrent = 0
  for (const h of mfs) {
    const nav = navs[h.scheme_code] ?? h.purchase_nav ?? 0
    mfInvested += h.units * (h.purchase_nav ?? nav)
    mfCurrent += h.units * nav
  }

  // Crypto
  let cryptoInvested = 0, cryptoCurrent = 0
  for (const h of cryptos) {
    const price = cryptoPrices[h.coin_id] ?? h.average_price_inr
    cryptoInvested += h.quantity * h.average_price_inr
    cryptoCurrent += h.quantity * price
  }

  // Fixed income
  let fiValue = 0
  for (const h of fixedIncomes) fiValue += h.current_value ?? h.principal

  // Gold
  let goldValue = 0
  for (const h of golds) {
    if (h.weight_grams && h.purchase_price_per_gram) {
      goldValue += h.weight_grams * h.purchase_price_per_gram
    } else if (h.units && h.purchase_nav) {
      goldValue += h.units * h.purchase_nav
    }
  }

  const totalInvested = stocksInvested + mfInvested + cryptoInvested
  const totalCurrent = stocksCurrent + mfCurrent + cryptoCurrent + fiValue + goldValue
  const totalGainLoss = (stocksCurrent - stocksInvested) + (mfCurrent - mfInvested) + (cryptoCurrent - cryptoInvested)
  const totalGainLossPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0
  const gainPositive = totalGainLoss >= 0

  const allSlices: AllocationSlice[] = [
    { name: 'Stocks', value: stocksCurrent, color: DOT_COLORS.Stocks, pct: 0 },
    { name: 'Mutual Funds', value: mfCurrent, color: DOT_COLORS['Mutual Funds'], pct: 0 },
    { name: 'Crypto', value: cryptoCurrent, color: DOT_COLORS.Crypto, pct: 0 },
    { name: 'Fixed Income', value: fiValue, color: DOT_COLORS['Fixed Income'], pct: 0 },
    { name: 'Gold', value: goldValue, color: DOT_COLORS.Gold, pct: 0 },
  ].filter(s => s.value > 0)

  const totalForPct = allSlices.reduce((s, d) => s + d.value, 0)
  const allocation = allSlices.map(s => ({ ...s, pct: totalForPct > 0 ? (s.value / totalForPct) * 100 : 0 }))

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const hasActiveSips = mfs.some(h => h.is_sip)
  const lastImport = profile?.last_cas_import_at ? new Date(profile.last_cas_import_at) : null
  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const importedThisMonth = lastImport
    && lastImport.getMonth() === istNow.getMonth()
    && lastImport.getFullYear() === istNow.getFullYear()
  const showSipReminder = hasActiveSips && !importedThisMonth

  const holdingRows = [
    { label: 'Stocks', count: stocks.length, value: stocksCurrent, href: '/holdings/stocks', colorKey: 'Stocks' },
    { label: 'Mutual Funds', count: mfs.length, value: mfCurrent, href: '/holdings/mutual-funds', colorKey: 'Mutual Funds' },
    { label: 'Crypto', count: cryptos.length, value: cryptoCurrent, href: '/holdings/crypto', colorKey: 'Crypto' },
    { label: 'Fixed Income', count: fixedIncomes.length, value: fiValue, href: '/holdings/fixed-income', colorKey: 'Fixed Income' },
    { label: 'Gold', count: golds.length, value: goldValue, href: '/holdings/gold', colorKey: 'Gold' },
  ]

  return (
    <div className="space-y-4 max-w-5xl">

      {showSipReminder && <SipReminderBanner />}

      {hasHoldings ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg">
          <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 -right-4 h-48 w-48 rounded-full bg-white/5" />
          <p className="text-xs font-medium text-emerald-200 uppercase tracking-wider mb-1">Total Portfolio</p>
          <p className="text-4xl font-bold tracking-tight mb-3">{formatINR(totalCurrent)}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={clsx(
              'flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full',
              gainPositive ? 'bg-white/15 text-white' : 'bg-red-500/30 text-red-100'
            )}>
              {gainPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {gainPositive ? '+' : ''}{formatINR(totalGainLoss)} ({gainPositive ? '+' : ''}{totalGainLossPct.toFixed(2)}%)
            </div>
            {stocksDayChange !== 0 && (
              <div className={clsx(
                'text-xs font-medium px-2.5 py-1 rounded-full',
                stocksDayChange >= 0 ? 'bg-white/10 text-emerald-100' : 'bg-red-500/20 text-red-200'
              )}>
                Today {stocksDayChange >= 0 ? '+' : ''}{formatINR(stocksDayChange)}
              </div>
            )}
          </div>
          <p className="text-xs text-emerald-200/70 mt-3">
            Invested {formatINR(totalInvested + fiValue + goldValue)}
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg">
          <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/5" />
          <p className="text-sm font-medium text-emerald-200 mb-1">Welcome, {firstName}!</p>
          <p className="text-2xl font-bold mb-3">Start your portfolio</p>
          <p className="text-sm text-emerald-100/80 mb-4">Add your holdings to track your net worth, gains, and taxes — all in one place.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/holdings/stocks" className="flex items-center gap-1.5 bg-white text-emerald-700 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add stocks
            </Link>
            <Link href="/holdings/mutual-funds" className="flex items-center gap-1.5 bg-white/15 text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-white/20 transition-colors">
              Add mutual funds
            </Link>
            <Link href="/import" className="flex items-center gap-1.5 bg-white/15 text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-white/20 transition-colors">
              Import CAS
            </Link>
          </div>
        </div>
      )}

      {hasHoldings && <MorningBriefing />}

      {hasHoldings && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total P&L"
              value={formatGain(totalGainLoss)}
              sub={formatChange(totalGainLossPct)}
              subPositive={gainPositive}
              icon={gainPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              accent={gainPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}
            />
            <StatCard
              label="Day Change"
              value={formatGain(stocksDayChange)}
              sub="Stocks"
              subPositive={stocksDayChange >= 0}
              icon={stocksDayChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              accent={stocksDayChange >= 0 ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}
            />
            <StatCard
              label="Fixed Income"
              value={formatINR(fiValue)}
              sub={`${fixedIncomes.length} instrument${fixedIncomes.length !== 1 ? 's' : ''}`}
              icon={<BarChart3 className="h-4 w-4" />}
              accent="bg-violet-50 text-violet-500"
            />
            <StatCard
              label="Holdings"
              value={String(stocks.length + mfs.length + cryptos.length + fixedIncomes.length + golds.length)}
              sub="across all assets"
              icon={<Wallet className="h-4 w-4" />}
              accent="bg-amber-50 text-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {allocation.length > 0 && (
              <Card>
                <h2 className="text-sm font-semibold text-zinc-900 mb-4">Asset Allocation</h2>
                <AllocationPie data={allocation} />
              </Card>
            )}
            <Card padding="none">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Holdings</h2>
                <span className="text-xs text-zinc-400">{formatINR(totalCurrent)}</span>
              </div>
              {holdingRows.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 active:bg-zinc-100 transition-colors border-b border-zinc-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: DOT_COLORS[item.colorKey] }} />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{item.label}</p>
                      <p className="text-xs text-zinc-400">
                        {item.count > 0 ? `${item.count} holding${item.count !== 1 ? 's' : ''}` : 'None'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900">
                      {item.count > 0 ? formatINR(item.value) : (
                        <span className="text-xs text-emerald-600 font-medium">Add →</span>
                      )}
                    </span>
                    {item.count > 0 && <ArrowUpRight className="h-3.5 w-3.5 text-zinc-300" />}
                  </div>
                </Link>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
