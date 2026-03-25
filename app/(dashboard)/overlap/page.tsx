import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { formatINR } from '@/lib/utils/format'
import { Info, Sparkles } from 'lucide-react'
import {
  getMFUnderlyingHoldings,
  computeOverlap,
  type UnderlyingHolding,
} from '@/lib/market/mf-holdings'

function overlapColor(pct: number): { bg: string; text: string; label: string } {
  if (pct < 15)  return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Low' }
  if (pct < 35)  return { bg: 'bg-yellow-50',  text: 'text-yellow-700',  label: 'Moderate' }
  if (pct < 55)  return { bg: 'bg-orange-50',  text: 'text-orange-700',  label: 'High' }
  return           { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Very High' }
}

function shortName(name: string): string {
  return name
    .replace(/\s*-\s*regular plan.*/i, '')
    .replace(/\s*-\s*direct plan.*/i, '')
    .replace(/\s*-\s*growth.*/i, '')
    .replace(/\s*fund\s*$/i, ' Fund')
    .trim()
}

export default async function OverlapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  const memberId = selfMember?.id
  const { data: mfRows } = memberId
    ? await supabase.from('mf_holdings').select('scheme_code, scheme_name, fund_type').eq('member_id', memberId)
    : { data: [] }

  const mfs = mfRows ?? []

  // Deduplicate by scheme_code
  const uniqueMFs = [...new Map(mfs.map(m => [m.scheme_code, m])).values()]

  // Build scheme info from stored data — no external API call needed
  // Fund type stored in DB maps to equity category for overlap analysis
  const EQUITY_TYPES = new Set(['Equity', 'ELSS', 'Index', 'Hybrid'])
  const equityFunds = uniqueMFs
    .filter(m => !m.fund_type || EQUITY_TYPES.has(m.fund_type))
    .map(m => ({
      scheme_code: m.scheme_code,
      scheme_name: m.scheme_name,
      scheme_category: m.fund_type ?? 'Equity',
      fund_house: '',
    }))

  if (equityFunds.length < 2) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">MF Overlap</h1>
        <p className="text-sm text-zinc-500">
          {equityFunds.length < 1
            ? 'Add at least 2 equity mutual funds to see overlap analysis.'
            : 'You need at least 2 equity mutual funds to compare overlap.'}
        </p>
      </div>
    )
  }

  // Fetch holdings for all equity funds in parallel
  const holdingsMap = new Map<number, UnderlyingHolding[]>()
  const holdingsResults = await Promise.allSettled(
    equityFunds.map(f => getMFUnderlyingHoldings(f))
  )
  for (let i = 0; i < equityFunds.length; i++) {
    const result = holdingsResults[i]
    holdingsMap.set(
      equityFunds[i].scheme_code,
      result.status === 'fulfilled' ? result.value : []
    )
  }

  // Compute all pairs
  const pairs: {
    a: typeof equityFunds[0]
    b: typeof equityFunds[0]
    overlap: ReturnType<typeof computeOverlap>
  }[] = []

  for (let i = 0; i < equityFunds.length; i++) {
    for (let j = i + 1; j < equityFunds.length; j++) {
      const a = equityFunds[i]
      const b = equityFunds[j]
      const hA = holdingsMap.get(a.scheme_code) ?? []
      const hB = holdingsMap.get(b.scheme_code) ?? []
      pairs.push({ a, b, overlap: computeOverlap(hA, hB) })
    }
  }

  pairs.sort((a, b) => b.overlap.pct - a.overlap.pct)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">MF Overlap</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          How much your equity mutual funds overlap — high overlap means you&apos;re less diversified than you think.
        </p>
      </div>

      {/* Matrix */}
      {equityFunds.length >= 2 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Overlap Matrix</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium w-40"></th>
                  {equityFunds.map(f => (
                    <th key={f.scheme_code} className="px-4 py-3 text-center text-zinc-600 font-medium max-w-[100px]">
                      <span className="block truncate" title={f.scheme_name}>{shortName(f.scheme_name)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {equityFunds.map((rowFund, i) => (
                  <tr key={rowFund.scheme_code} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-700 max-w-[160px]">
                      <span className="block truncate" title={rowFund.scheme_name}>{shortName(rowFund.scheme_name)}</span>
                    </td>
                    {equityFunds.map((colFund, j) => {
                      if (i === j) {
                        return <td key={colFund.scheme_code} className="px-4 py-3 text-center text-zinc-300">—</td>
                      }
                      const pair = pairs.find(
                        p =>
                          (p.a.scheme_code === rowFund.scheme_code && p.b.scheme_code === colFund.scheme_code) ||
                          (p.b.scheme_code === rowFund.scheme_code && p.a.scheme_code === colFund.scheme_code)
                      )
                      const pct = pair?.overlap.pct ?? 0
                      const c = overlapColor(pct)
                      return (
                        <td key={colFund.scheme_code} className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${c.bg} ${c.text}`}>
                            {pct}%
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-200" /> &lt;15% Low</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-200" /> 15–35% Moderate</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-200" /> 35–55% High</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-200" /> &gt;55% Very High</span>
          </div>
        </Card>
      )}

      {/* Per-pair breakdown */}
      <div className="space-y-4">
        {pairs.map(({ a, b, overlap }, idx) => {
          const c = overlapColor(overlap.pct)
          return (
            <Card key={idx} padding="none">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-zinc-900 text-sm">{shortName(a.scheme_name)}</span>
                    <span className="text-zinc-300 text-xs">×</span>
                    <span className="font-medium text-zinc-900 text-sm">{shortName(b.scheme_name)}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{overlap.common.length} common stocks</p>
                </div>
                <div className={`shrink-0 px-3 py-1 rounded-full text-sm font-semibold ${c.bg} ${c.text}`}>
                  {overlap.pct}% · {c.label}
                </div>
              </div>

              {overlap.common.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
                      <th className="px-5 py-2 font-medium">Stock</th>
                      <th className="px-5 py-2 font-medium text-right">{shortName(a.scheme_name)}</th>
                      <th className="px-5 py-2 font-medium text-right">{shortName(b.scheme_name)}</th>
                      <th className="px-5 py-2 font-medium text-right">Min Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {overlap.common.map((stock, i) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-5 py-2.5 font-medium text-zinc-800">{stock.name}</td>
                        <td className="px-5 py-2.5 text-right text-zinc-600">{stock.pctA.toFixed(1)}%</td>
                        <td className="px-5 py-2.5 text-right text-zinc-600">{stock.pctB.toFixed(1)}%</td>
                        <td className="px-5 py-2.5 text-right text-zinc-500 font-medium">
                          {Math.min(stock.pctA, stock.pctB).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-5 py-4 text-sm text-zinc-400">No common holdings found between these funds.</p>
              )}
            </Card>
          )
        })}
      </div>

      {/* Disclaimer */}
      <div className="flex gap-2 text-xs text-zinc-400">
        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-400" />
        <span>
          Holdings are AI-inferred from publicly available portfolio disclosures and cached for 30 days.
          Overlap is computed as the sum of the minimum allocation in each common stock.
          Actual overlaps may differ — verify against the latest AMC factsheet before making decisions.
        </span>
      </div>
    </div>
  )
}
