import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'
import { Card } from '@/components/ui/Card'
import { AllocationPie } from '@/components/charts/AllocationPie'
import { formatINR, formatGain, formatChange } from '@/lib/utils/format'

import type { AllocationSlice } from '@/components/charts/AllocationPie'
import { XRayInsights } from '@/components/ai/XRayInsights'

const COLORS = {
  Stocks: '#10b981',
  'Mutual Funds': '#3b82f6',
  Crypto: '#f97316',
  'Fixed Income': '#8b5cf6',
  Gold: '#eab308',
}

interface Holding {
  name: string
  assetClass: string
  currentValue: number
  investedValue: number
  gainLoss: number
  gainLossPct: number
  pct: number
}

export default async function XRayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const [navs, cryptoPrices, stockPrices] = await Promise.all([
    getMFNavs(mfs.map((h) => h.scheme_code)),
    getCryptoPricesINR(cryptos.map((h) => h.coin_id)),
    getStockPrices(stocks.map((h) => ({ symbol: h.symbol, exchange: h.exchange as 'NSE' | 'BSE' }))),
  ])

  // Build individual holdings list
  const holdings: Holding[] = []

  for (const h of stocks) {
    const quote = stockPrices[`${h.exchange}:${h.symbol}`]
    const invested = h.average_price * h.quantity
    const current = (quote?.ltp ?? h.average_price) * h.quantity
    holdings.push({
      name: h.symbol,
      assetClass: 'Stocks',
      currentValue: current,
      investedValue: invested,
      gainLoss: current - invested,
      gainLossPct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
      pct: 0,
    })
  }

  for (const h of mfs) {
    const nav = navs[h.scheme_code] ?? h.purchase_nav ?? 0
    const invested = h.units * (h.purchase_nav ?? nav)
    const current = h.units * nav
    holdings.push({
      name: h.scheme_name,
      assetClass: 'Mutual Funds',
      currentValue: current,
      investedValue: invested,
      gainLoss: current - invested,
      gainLossPct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
      pct: 0,
    })
  }

  for (const h of cryptos) {
    const price = cryptoPrices[h.coin_id] ?? h.average_price_inr
    const invested = h.quantity * h.average_price_inr
    const current = h.quantity * price
    holdings.push({
      name: h.coin_symbol.toUpperCase(),
      assetClass: 'Crypto',
      currentValue: current,
      investedValue: invested,
      gainLoss: current - invested,
      gainLossPct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
      pct: 0,
    })
  }

  for (const h of fixedIncomes) {
    const value = h.current_value ?? h.principal
    holdings.push({
      name: `${h.instrument_type.toUpperCase()}${h.institution ? ` · ${h.institution}` : ''}`,
      assetClass: 'Fixed Income',
      currentValue: value,
      investedValue: h.principal,
      gainLoss: value - h.principal,
      gainLossPct: h.principal > 0 ? ((value - h.principal) / h.principal) * 100 : 0,
      pct: 0,
    })
  }

  for (const h of golds) {
    const value = h.weight_grams && h.purchase_price_per_gram
      ? h.weight_grams * h.purchase_price_per_gram
      : (h.units && h.purchase_nav ? h.units * h.purchase_nav : 0)
    holdings.push({
      name: `Gold · ${h.form}`,
      assetClass: 'Gold',
      currentValue: value,
      investedValue: value,
      gainLoss: 0,
      gainLossPct: 0,
      pct: 0,
    })
  }

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  const enriched = holdings
    .map(h => ({ ...h, pct: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0 }))
    .sort((a, b) => b.currentValue - a.currentValue)

  // Asset class rollup
  const classMap: Record<string, { invested: number; current: number }> = {}
  for (const h of enriched) {
    if (!classMap[h.assetClass]) classMap[h.assetClass] = { invested: 0, current: 0 }
    classMap[h.assetClass].invested += h.investedValue
    classMap[h.assetClass].current += h.currentValue
  }

  const allocation: AllocationSlice[] = Object.entries(classMap)
    .filter(([, v]) => v.current > 0)
    .map(([name, v]) => ({
      name,
      value: v.current,
      color: COLORS[name as keyof typeof COLORS] ?? '#71717a',
      pct: totalValue > 0 ? (v.current / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const concentrated = enriched.filter(h => h.pct > 20)
  const top10 = enriched.slice(0, 10)

  if (enriched.length === 0) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Portfolio X-ray</h1>
        <p className="text-sm text-zinc-500">Add holdings to see your portfolio analysis.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Portfolio X-ray</h1>
        <p className="text-sm text-zinc-500 mt-0.5">A complete breakdown of your portfolio across all asset classes.</p>
      </div>

      {/* AI Insights */}
      <XRayInsights payload={{
        totalValue,
        totalInvested: enriched.reduce((s, h) => s + h.investedValue, 0),
        totalGainLoss: enriched.reduce((s, h) => s + h.gainLoss, 0),
        totalGainLossPct: (() => {
          const inv = enriched.reduce((s, h) => s + h.investedValue, 0)
          const gl = enriched.reduce((s, h) => s + h.gainLoss, 0)
          return inv > 0 ? (gl / inv) * 100 : 0
        })(),
        allocation: allocation.map(a => ({ name: a.name, value: a.value, pct: a.pct })),
        topHoldings: top10.map(h => ({ name: h.name, assetClass: h.assetClass, currentValue: h.currentValue, pct: h.pct, gainLossPct: h.gainLossPct })),
        concentrated: concentrated.map(h => ({ name: h.name, pct: h.pct })),
      }} />

      {/* Chart + class table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Asset Allocation</h2>
          <AllocationPie data={allocation} />
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">By Asset Class</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
                <th className="px-5 py-2.5 font-medium">Class</th>
                <th className="px-5 py-2.5 font-medium text-right">Value</th>
                <th className="px-5 py-2.5 font-medium text-right">Alloc</th>
                <th className="px-5 py-2.5 font-medium text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {allocation.map((a) => {
                const cls = classMap[a.name]
                const gl = cls.current - cls.invested
                const glPct = cls.invested > 0 ? (gl / cls.invested) * 100 : 0
                return (
                  <tr key={a.name} className="hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                        <span className="font-medium text-zinc-800">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-700">{formatINR(a.value)}</td>
                    <td className="px-5 py-3 text-right text-zinc-500">{a.pct.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-right">
                      {cls.invested > 0 ? (
                        <div className={gl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          <div className="font-medium">{formatGain(gl)}</div>
                          <div className="text-xs">{formatChange(glPct)}</div>
                        </div>
                      ) : <span className="text-zinc-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td className="px-5 py-3 text-sm font-semibold text-zinc-900">Total</td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-zinc-900">{formatINR(totalValue)}</td>
                <td className="px-5 py-3 text-right text-sm text-zinc-500">100%</td>
                <td className="px-5 py-3 text-right">
                  {(() => {
                    const totalInv = enriched.filter(h => h.assetClass !== 'Gold' && h.assetClass !== 'Fixed Income').reduce((s, h) => s + h.investedValue, 0)
                    const totalGL = enriched.filter(h => h.assetClass !== 'Gold' && h.assetClass !== 'Fixed Income').reduce((s, h) => s + h.gainLoss, 0)
                    const pct = totalInv > 0 ? (totalGL / totalInv) * 100 : 0
                    return (
                      <div className={totalGL >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                        <div className="text-sm font-semibold">{formatGain(totalGL)}</div>
                        <div className="text-xs">{formatChange(pct)}</div>
                      </div>
                    )
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>

      {/* Top holdings */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Top Holdings</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
              <th className="px-5 py-2.5 font-medium">Holding</th>
              <th className="px-5 py-2.5 font-medium">Class</th>
              <th className="px-5 py-2.5 font-medium text-right">Value</th>
              <th className="px-5 py-2.5 font-medium text-right">Portfolio %</th>
              <th className="px-5 py-2.5 font-medium text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {top10.map((h, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-zinc-900 max-w-[220px] truncate" title={h.name}>
                    {h.name}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: (COLORS[h.assetClass as keyof typeof COLORS] ?? '#71717a') + '1a',
                      color: COLORS[h.assetClass as keyof typeof COLORS] ?? '#71717a',
                    }}
                  >
                    {h.assetClass}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-medium text-zinc-900">{formatINR(h.currentValue)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(h.pct, 100)}%`,
                          background: COLORS[h.assetClass as keyof typeof COLORS] ?? '#71717a',
                        }}
                      />
                    </div>
                    <span className="text-zinc-500 w-10 text-right">{h.pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  {h.investedValue > 0 && h.assetClass !== 'Gold' ? (
                    <div className={h.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      <div className="font-medium">{formatGain(h.gainLoss)}</div>
                      <div className="text-xs">{formatChange(h.gainLossPct)}</div>
                    </div>
                  ) : <span className="text-zinc-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
