import { createClient } from '@/lib/supabase/server'
import { getUserBenchmark } from '@/lib/analysis/benchmark'
import { Card } from '@/components/ui/Card'
import { formatINR } from '@/lib/utils/format'
import { Users, TrendingUp, Info } from 'lucide-react'

interface BarProps {
  label: string
  userValue: string
  rank: number | null
  p50Label: string
  p90Label: string
}

function PercentileBar({ label, userValue, rank, p50Label, p90Label }: BarProps) {
  const pct = rank ?? 50
  const color =
    pct >= 75 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-blue-500' :
    pct >= 25 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        <div className="text-right">
          <span className="text-sm font-semibold text-zinc-900">{userValue}</span>
          {rank !== null && (
            <span className="ml-2 text-xs text-zinc-400">top {100 - rank}%</span>
          )}
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
        {/* Median marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-400 opacity-60" style={{ left: '50%' }} />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-400">
        <span>Median: {p50Label}</span>
        <span>Top 10%: {p90Label}</span>
      </div>
    </div>
  )
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return null
  const emoji =
    rank >= 90 ? '🏆' :
    rank >= 75 ? '🥈' :
    rank >= 50 ? '📈' : '🌱'
  const label =
    rank >= 90 ? 'Top 10%' :
    rank >= 75 ? 'Top 25%' :
    rank >= 50 ? 'Above Average' : 'Growing'
  const color =
    rank >= 90 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
    rank >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    rank >= 50 ? 'bg-blue-50 text-blue-700 border-blue-200' :
    'bg-zinc-50 text-zinc-600 border-zinc-200'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${color}`}>
      {emoji} {label}
    </span>
  )
}

export default async function BenchmarkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const result = await getUserBenchmark(user!.id)

  if (!result) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <Users className="h-10 w-10 text-zinc-300 mx-auto" />
        <h2 className="text-lg font-semibold text-zinc-700">No portfolio data yet</h2>
        <p className="text-sm text-zinc-400">Add your holdings to see how you compare with peers in your age group.</p>
      </div>
    )
  }

  const { ageBracket, userMetrics, percentiles, userRank } = result

  const fmtINR = (n: number) => formatINR(n)
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  const portfolioPerc = percentiles['portfolio_value']
  const equityPerc = percentiles['equity_pct']
  const sipPerc = percentiles['monthly_sip']
  const holdingsPerc = percentiles['holdings_count']
  const xirrPerc = percentiles['xirr']

  const overallRank = userRank['portfolio_value']
  const insufficientData = !portfolioPerc

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Portfolio Benchmark</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            How you compare with others aged <span className="font-medium text-zinc-700">{ageBracket}</span>
          </p>
        </div>
        <RankBadge rank={overallRank} />
      </div>

      {insufficientData && (
        <Card>
          <div className="flex gap-3 items-start">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-zinc-600">
              Benchmarks are built anonymously from users in your age group. We need at least 5 users in your bracket to show percentiles — check back soon as the community grows!
            </p>
          </div>
        </Card>
      )}

      {/* Your metrics snapshot */}
      <Card>
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Your Portfolio Snapshot</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Portfolio Value', value: fmtINR(userMetrics.portfolioValue) },
            { label: 'Equity Allocation', value: fmtPct(userMetrics.equityPct) },
            { label: 'Monthly SIP', value: fmtINR(userMetrics.monthlySlp) },
            { label: 'Holdings Count', value: String(userMetrics.holdingsCount) },
            { label: 'XIRR (Est.)', value: userMetrics.xirr !== null ? fmtPct(userMetrics.xirr) : 'N/A' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-50 rounded-lg px-4 py-3">
              <p className="text-xs text-zinc-400">{label}</p>
              <p className="text-base font-semibold text-zinc-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Percentile bars */}
      {!insufficientData && (
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-zinc-700">Percentile Breakdown</h2>
          </div>
          <div className="space-y-6">
            {portfolioPerc && (
              <PercentileBar
                label="Portfolio Value"
                userValue={fmtINR(userMetrics.portfolioValue)}
                rank={userRank['portfolio_value']}
                p50Label={fmtINR(portfolioPerc.p50)}
                p90Label={fmtINR(portfolioPerc.p90)}
              />
            )}
            {equityPerc && (
              <PercentileBar
                label="Equity Allocation"
                userValue={fmtPct(userMetrics.equityPct)}
                rank={userRank['equity_pct']}
                p50Label={fmtPct(equityPerc.p50)}
                p90Label={fmtPct(equityPerc.p90)}
              />
            )}
            {sipPerc && (
              <PercentileBar
                label="Monthly SIP"
                userValue={fmtINR(userMetrics.monthlySlp)}
                rank={userRank['monthly_sip']}
                p50Label={fmtINR(sipPerc.p50)}
                p90Label={fmtINR(sipPerc.p90)}
              />
            )}
            {holdingsPerc && (
              <PercentileBar
                label="Holdings Count"
                userValue={String(userMetrics.holdingsCount)}
                rank={userRank['holdings_count']}
                p50Label={String(holdingsPerc.p50)}
                p90Label={String(holdingsPerc.p90)}
              />
            )}
            {xirrPerc && userMetrics.xirr !== null && (
              <PercentileBar
                label="XIRR (annualised return)"
                userValue={fmtPct(userMetrics.xirr)}
                rank={userRank['xirr']}
                p50Label={fmtPct(xirrPerc.p50)}
                p90Label={fmtPct(xirrPerc.p90)}
              />
            )}
          </div>
        </Card>
      )}

      {/* Sample size note */}
      {portfolioPerc && (
        <p className="text-xs text-zinc-400 text-center">
          Based on <span className="font-medium">{portfolioPerc.sampleSize} anonymous users</span> in the {ageBracket} age group. Data updated nightly.
        </p>
      )}
    </div>
  )
}
