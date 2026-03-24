import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'
import { Card, StatCard } from '@/components/ui/Card'
import { formatINR, formatGain } from '@/lib/utils/format'
import { Clock, TrendingDown, Leaf, Info } from 'lucide-react'

// FY2024-25 rates (post Budget July 23, 2024)
const LTCG_EQUITY_EXEMPTION = 125_000   // ₹1.25 L per year
const LTCG_EQUITY_RATE = 0.125           // 12.5 %
const STCG_EQUITY_RATE = 0.20            // 20 %
const CRYPTO_RATE = 0.30                 // 30 %

type TaxCategory = 'STCG-Equity' | 'LTCG-Equity' | 'Crypto' | 'Debt-Slab' | 'No Date'

interface TaxRow {
  name: string
  assetClass: string
  purchaseDate: string | null
  daysHeld: number | null
  gain: number
  currentValue: number
  category: TaxCategory
}

function daysHeld(purchaseDate: string): number {
  return Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000)
}

function isEquityMF(fundType: string | null): boolean {
  if (!fundType) return true // assume equity if unknown
  const t = fundType.toUpperCase()
  return t.includes('EQUITY') || t.includes('ELSS') || t.includes('HYBRID') || t.includes('BALANCED')
}

function taxCategory(row: TaxRow): { label: string; rate: string; tax: number } {
  if (row.gain <= 0) return { label: row.category === 'No Date' ? 'No Date' : '—', rate: '—', tax: 0 }
  switch (row.category) {
    case 'Crypto':
      return { label: 'Crypto', rate: '30%', tax: row.gain * CRYPTO_RATE }
    case 'Debt-Slab':
      return { label: 'Debt (slab)', rate: 'Slab', tax: 0 }
    case 'No Date':
      return { label: 'Unknown', rate: '—', tax: 0 }
    case 'STCG-Equity':
      return { label: 'STCG', rate: '20%', tax: row.gain * STCG_EQUITY_RATE }
    case 'LTCG-Equity':
      return { label: 'LTCG', rate: '12.5%', tax: 0 } // calculated after applying exemption
  }
}

export default async function TaxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  const memberId = selfMember?.id

  const [stocksRes, mfRes, cryptoRes] = await Promise.all([
    memberId ? supabase.from('stock_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabase.from('mf_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
    memberId ? supabase.from('crypto_holdings').select('*').eq('member_id', memberId) : Promise.resolve({ data: [] }),
  ])

  const stocks = stocksRes.data ?? []
  const mfs = mfRes.data ?? []
  const cryptos = cryptoRes.data ?? []

  const [navs, cryptoPrices, stockPrices] = await Promise.all([
    getMFNavs(mfs.map((h) => h.scheme_code)),
    getCryptoPricesINR(cryptos.map((h) => h.coin_id)),
    getStockPrices(stocks.map((h) => ({ symbol: h.symbol, exchange: h.exchange as 'NSE' | 'BSE' }))),
  ])

  const rows: TaxRow[] = []

  for (const h of stocks) {
    const quote = stockPrices[`${h.exchange}:${h.symbol}`]
    const invested = h.average_price * h.quantity
    const current = (quote?.ltp ?? h.average_price) * h.quantity
    const gain = current - invested
    const days = h.purchase_date ? daysHeld(h.purchase_date) : null
    rows.push({
      name: h.symbol,
      assetClass: 'Stocks',
      purchaseDate: h.purchase_date,
      daysHeld: days,
      gain,
      currentValue: current,
      category: !h.purchase_date ? 'No Date' : days! > 365 ? 'LTCG-Equity' : 'STCG-Equity',
    })
  }

  for (const h of mfs) {
    const nav = navs[h.scheme_code] ?? h.purchase_nav ?? 0
    const invested = h.units * (h.purchase_nav ?? nav)
    const current = h.units * nav
    const gain = current - invested
    const days = h.purchase_date ? daysHeld(h.purchase_date) : null
    const equity = isEquityMF(h.fund_type)
    let category: TaxCategory
    if (!h.purchase_date) category = 'No Date'
    else if (!equity) category = 'Debt-Slab'
    else category = days! > 365 ? 'LTCG-Equity' : 'STCG-Equity'
    rows.push({
      name: h.scheme_name,
      assetClass: 'Mutual Funds',
      purchaseDate: h.purchase_date,
      daysHeld: days,
      gain,
      currentValue: current,
      category,
    })
  }

  for (const h of cryptos) {
    const price = cryptoPrices[h.coin_id] ?? h.average_price_inr
    const invested = h.quantity * h.average_price_inr
    const current = h.quantity * price
    rows.push({
      name: h.coin_symbol.toUpperCase(),
      assetClass: 'Crypto',
      purchaseDate: null,
      daysHeld: null,
      gain: current - invested,
      currentValue: current,
      category: 'Crypto',
    })
  }

  // ── Compute tax ─────────────────────────────────────────────────────────────
  const stcgEquityGains = rows.filter(r => r.category === 'STCG-Equity' && r.gain > 0).reduce((s, r) => s + r.gain, 0)
  const ltcgEquityGains = rows.filter(r => r.category === 'LTCG-Equity' && r.gain > 0).reduce((s, r) => s + r.gain, 0)
  const cryptoGains = rows.filter(r => r.category === 'Crypto' && r.gain > 0).reduce((s, r) => s + r.gain, 0)

  const stcgTax = stcgEquityGains * STCG_EQUITY_RATE
  const ltcgTaxableGain = Math.max(0, ltcgEquityGains - LTCG_EQUITY_EXEMPTION)
  const ltcgTax = ltcgTaxableGain * LTCG_EQUITY_RATE
  const cryptoTax = cryptoGains * CRYPTO_RATE
  const totalEstTax = stcgTax + ltcgTax + cryptoTax

  // ── Tax-saving suggestions ───────────────────────────────────────────────────
  const suggestions: { icon: React.ElementType; title: string; body: string; color: string }[] = []

  // 1. Wait to convert STCG → LTCG (within 90 days of 1 year)
  const waitCandidates = rows
    .filter(r => r.category === 'STCG-Equity' && r.gain > 0 && r.daysHeld !== null && r.daysHeld >= 275)
    .map(r => {
      const daysLeft = 366 - r.daysHeld!
      const stcgTaxOnThis = r.gain * STCG_EQUITY_RATE
      const ltcgExemptionLeft = Math.max(0, LTCG_EQUITY_EXEMPTION - ltcgEquityGains)
      const ltcgTaxOnThis = Math.max(0, r.gain - ltcgExemptionLeft) * LTCG_EQUITY_RATE
      const saving = stcgTaxOnThis - ltcgTaxOnThis
      return { ...r, daysLeft, saving }
    })
    .filter(r => r.saving > 500)
    .sort((a, b) => b.saving - a.saving)

  for (const c of waitCandidates.slice(0, 2)) {
    suggestions.push({
      icon: Clock,
      color: 'text-blue-600',
      title: `Wait ${c.daysLeft} more days on ${c.name}`,
      body: `Holding for ${c.daysLeft} more days switches this to LTCG, potentially saving ~${formatINR(c.saving)} in tax.`,
    })
  }

  // 2. LTCG harvesting — if LTCG < exemption, harvest more tax-free
  const ltcgExemptionRemaining = Math.max(0, LTCG_EQUITY_EXEMPTION - ltcgEquityGains)
  if (ltcgExemptionRemaining > 10_000) {
    suggestions.push({
      icon: Leaf,
      color: 'text-emerald-600',
      title: `${formatINR(ltcgExemptionRemaining)} LTCG exemption unused this year`,
      body: `You can book up to ${formatINR(ltcgExemptionRemaining)} more in long-term equity gains completely tax-free before the financial year ends.`,
    })
  }

  // 3. Tax-loss harvesting — top 2 loss-making holdings
  const lossCandidates = rows
    .filter(r => r.gain < -5000 && (r.category === 'STCG-Equity' || r.category === 'LTCG-Equity'))
    .sort((a, b) => a.gain - b.gain)

  for (const c of lossCandidates.slice(0, 2)) {
    const offsetTax = Math.abs(c.gain) * (c.category === 'STCG-Equity' ? STCG_EQUITY_RATE : LTCG_EQUITY_RATE)
    suggestions.push({
      icon: TrendingDown,
      color: 'text-red-500',
      title: `Harvest loss in ${c.name}`,
      body: `Booking the ${formatINR(Math.abs(c.gain))} loss here can offset gains and save ~${formatINR(offsetTax)} in tax. You can repurchase after 30 days.`,
    })
  }

  const gainRows = rows.filter(r => r.gain !== 0).sort((a, b) => b.gain - a.gain)

  if (gainRows.length === 0) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Tax & Gains</h1>
        <p className="text-sm text-zinc-500">Add holdings with purchase dates to see your capital gains analysis.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Tax & Gains</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Capital gains estimate for the current financial year. Not tax advice.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="STCG Gains" value={formatINR(stcgEquityGains)} sub="Taxed at 20%" />
        <StatCard label="LTCG Gains" value={formatINR(ltcgEquityGains)} sub={`₹1.25L exempt · ${formatINR(ltcgTaxableGain)} taxable`} />
        <StatCard label="Crypto Gains" value={formatINR(cryptoGains)} sub="Taxed at 30%" />
        <StatCard
          label="Est. Tax Liability"
          value={formatINR(totalEstTax)}
          sub="Equity + Crypto"
          subPositive={false}
        />
      </div>

      {/* Tax-saving suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">Ways to save on tax</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-zinc-200 px-4 py-3.5 flex gap-3">
                <div className={`mt-0.5 shrink-0 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{s.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings breakdown */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Holdings Breakdown</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
              <th className="px-5 py-2.5 font-medium">Holding</th>
              <th className="px-5 py-2.5 font-medium">Held</th>
              <th className="px-5 py-2.5 font-medium text-right">Gain / Loss</th>
              <th className="px-5 py-2.5 font-medium text-right">Category</th>
              <th className="px-5 py-2.5 font-medium text-right">Rate</th>
              <th className="px-5 py-2.5 font-medium text-right">Est. Tax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {gainRows.map((row, i) => {
              const days = row.daysHeld
              const heldStr = !days ? '—'
                : days >= 365 ? `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}mo`
                : days >= 30 ? `${Math.floor(days / 30)}mo`
                : `${days}d`

              // Per-row tax (LTCG applied after exemption on totals, so here show indicative)
              let rowTax = 0
              let rateStr = '—'
              let categoryLabel = '—'
              let categoryColor = 'text-zinc-400'

              if (row.gain > 0) {
                switch (row.category) {
                  case 'STCG-Equity':
                    rateStr = '20%'; categoryLabel = 'STCG'; categoryColor = 'text-orange-600'
                    rowTax = row.gain * STCG_EQUITY_RATE
                    break
                  case 'LTCG-Equity':
                    rateStr = '12.5%'; categoryLabel = 'LTCG'; categoryColor = 'text-emerald-600'
                    rowTax = row.gain * LTCG_EQUITY_RATE // individual row; exemption shown in summary
                    break
                  case 'Crypto':
                    rateStr = '30%'; categoryLabel = 'Crypto'; categoryColor = 'text-purple-600'
                    rowTax = row.gain * CRYPTO_RATE
                    break
                  case 'Debt-Slab':
                    rateStr = 'Slab'; categoryLabel = 'Debt'; categoryColor = 'text-blue-600'
                    break
                  case 'No Date':
                    categoryLabel = 'No Date'; categoryColor = 'text-zinc-400'
                    break
                }
              } else if (row.gain < 0) {
                categoryLabel = 'Loss'; categoryColor = 'text-red-500'
              }

              return (
                <tr key={i} className="hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-zinc-900 max-w-[200px] truncate" title={row.name}>{row.name}</div>
                    <div className="text-xs text-zinc-400">{row.assetClass}</div>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{heldStr}</td>
                  <td className={`px-5 py-3 text-right font-medium ${row.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatGain(row.gain)}
                  </td>
                  <td className={`px-5 py-3 text-right text-xs font-semibold ${categoryColor}`}>{categoryLabel}</td>
                  <td className="px-5 py-3 text-right text-zinc-500">{rateStr}</td>
                  <td className="px-5 py-3 text-right text-zinc-700">
                    {rowTax > 0 ? formatINR(rowTax) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50">
              <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-zinc-900">Total estimated tax</td>
              <td className="px-5 py-3 text-right text-sm font-semibold text-red-600">{formatINR(totalEstTax)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* Disclaimer */}
      <div className="flex gap-2 text-xs text-zinc-400">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Estimates use FY2024-25 rates: STCG equity 20%, LTCG equity 12.5% (₹1.25L/yr exempt), crypto 30%.
          Debt MF gains are taxed at your income slab rate and not estimated here. This is not tax advice — consult a CA before filing.
        </span>
      </div>
    </div>
  )
}
