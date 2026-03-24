import { createClient } from '@/lib/supabase/server'
import { generateWrapped } from '@/lib/analysis/wrapped'
import { formatINR } from '@/lib/utils/format'
import { TrendingUp, TrendingDown, Sparkles, Star, IndianRupee, Repeat2, Layers, Award } from 'lucide-react'
import { clsx } from 'clsx'

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-2xl p-6 shadow-sm', className)}>
      {children}
    </div>
  )
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
      <span className="text-sm opacity-80">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold">{value}</span>
        {sub && <p className="text-[10px] opacity-60">{sub}</p>}
      </div>
    </div>
  )
}

export default async function WrappedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const year = new Date().getFullYear() - 1   // previous calendar year
  const report = await generateWrapped(user!.id, year)

  if (!report) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <Sparkles className="h-10 w-10 text-zinc-300 mx-auto" />
        <h2 className="text-lg font-semibold text-zinc-700">No data yet</h2>
        <p className="text-sm text-zinc-400">Add your holdings and come back at year-end to see your {year} Wrapped!</p>
      </div>
    )
  }

  const gainColor = report.totalGain >= 0 ? 'text-emerald-300' : 'text-red-300'
  const gainIcon = report.totalGain >= 0 ? TrendingUp : TrendingDown

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-5 w-5" />
          <span className="font-bold text-lg">{year} Wrapped</span>
        </div>
        <p className="text-2xl font-bold mb-1">Hey {report.userName} 👋</p>
        <p className="opacity-70 text-sm">Here's your {year} investing journey in numbers.</p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs opacity-70 mb-1">Portfolio Value</p>
            <p className="text-xl font-bold">{formatINR(report.totalValue)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs opacity-70 mb-1">Total Gain / Loss</p>
            <p className={clsx('text-xl font-bold', gainColor)}>
              {report.totalGain >= 0 ? '+' : ''}{formatINR(report.totalGain)}
            </p>
            <p className="text-xs opacity-60 mt-0.5">
              {report.gainPct >= 0 ? '+' : ''}{report.gainPct}%
            </p>
          </div>
        </div>
      </Card>

      {/* Best & Worst */}
      {(report.bestHolding || report.worstHolding) && (
        <div className="grid grid-cols-2 gap-4">
          {report.bestHolding && (
            <Card className="bg-emerald-600 text-white">
              <div className="flex items-center gap-1.5 mb-3">
                <Star className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Best Pick</span>
              </div>
              <p className="font-bold text-base leading-tight truncate">{report.bestHolding.name}</p>
              <p className="text-xs opacity-70 mt-0.5">{report.bestHolding.assetClass}</p>
              <p className="text-2xl font-bold mt-2 text-emerald-200">
                +{report.bestHolding.gainPct.toFixed(1)}%
              </p>
            </Card>
          )}
          {report.worstHolding && (
            <Card className="bg-red-500 text-white">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingDown className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Worst</span>
              </div>
              <p className="font-bold text-base leading-tight truncate">{report.worstHolding.name}</p>
              <p className="text-xs opacity-70 mt-0.5">{report.worstHolding.assetClass}</p>
              <p className="text-2xl font-bold mt-2 text-red-200">
                {report.worstHolding.gainPct.toFixed(1)}%
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Tax & ELSS */}
      {report.totalElss80C > 0 && (
        <Card className="bg-amber-500 text-white">
          <div className="flex items-center gap-1.5 mb-4">
            <IndianRupee className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Tax Savings</span>
          </div>
          <StatRow
            label="ELSS invested this year"
            value={formatINR(report.totalElss80C)}
          />
          <StatRow
            label="Estimated tax saved (30% slab)"
            value={formatINR(report.estimatedTaxSaved)}
            sub="Under Section 80C"
          />
        </Card>
      )}

      {/* SIPs */}
      {report.activeSIPs > 0 && (
        <Card className="bg-blue-600 text-white">
          <div className="flex items-center gap-1.5 mb-4">
            <Repeat2 className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">SIP Discipline</span>
          </div>
          <p className="text-3xl font-bold">{report.activeSIPs}</p>
          <p className="text-sm opacity-80 mt-1">active SIPs running</p>
          <p className="mt-3 text-sm">
            You're auto-investing{' '}
            <span className="font-bold">{formatINR(report.monthlySlpAmount)}</span> every month.
          </p>
        </Card>
      )}

      {/* Holdings & top asset */}
      <Card className="bg-zinc-800 text-white">
        <div className="flex items-center gap-1.5 mb-4">
          <Layers className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Portfolio Mix</span>
        </div>
        <StatRow label="Total holdings" value={String(report.holdingsCount)} />
        <StatRow label="Top asset class" value={report.topAssetClass} />
        {report.xrayScore !== null && (
          <StatRow
            label="X-ray health score"
            value={`${report.xrayScore}/100`}
            sub="Based on diversification & overlap"
          />
        )}
      </Card>

      {/* Motivational footer */}
      <Card className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white text-center">
        <Award className="h-8 w-8 mx-auto mb-3 text-yellow-400" />
        <p className="font-bold text-lg">
          {report.gainPct >= 15
            ? 'Outstanding year! 🚀'
            : report.gainPct >= 0
            ? 'Solid year — keep going! 💪'
            : 'Markets have ups and downs. Stay the course! 🧘'}
        </p>
        <p className="text-sm opacity-60 mt-2">See you in {year + 1}.</p>
      </Card>
    </div>
  )
}
