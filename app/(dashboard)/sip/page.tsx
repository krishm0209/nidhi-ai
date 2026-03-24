import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMemberSIPHealth } from '@/lib/analysis/sip-health'
import { Card } from '@/components/ui/Card'
import { formatINR } from '@/lib/utils/format'
import { TrendingUp, Calendar, Target, Info, ArrowUpRight } from 'lucide-react'

function GainBadge({ pct }: { pct: number }) {
  const pos = pct >= 0
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

export default async function SIPTrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  if (!selfMember) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">SIP Tracker</h1>
        <p className="text-sm text-zinc-500">No household found.</p>
      </div>
    )
  }

  const sipHealthData = await getMemberSIPHealth(selfMember.id)

  if (sipHealthData.length === 0) {
    return (
      <div className="max-w-4xl space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">SIP Tracker</h1>
        <Card>
          <p className="text-sm text-zinc-500">
            No active SIPs found. When adding mutual funds, enable the SIP toggle to track them here.
          </p>
        </Card>
      </div>
    )
  }

  const totalMonthlyInvestment = sipHealthData.reduce((s, h) => s + h.record.sipAmount, 0)
  const totalCurrentValue = sipHealthData.reduce((s, h) => s + h.record.currentValue, 0)
  const totalInvested = sipHealthData.reduce((s, h) => s + h.record.investedValue, 0)

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">SIP Tracker</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {sipHealthData.length} active SIP{sipHealthData.length !== 1 ? 's' : ''} · projections at 12% CAGR
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Monthly Investment</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{formatINR(totalMonthlyInvestment)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">across {sipHealthData.length} SIPs</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Current Value</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{formatINR(totalCurrentValue)}</p>
          <GainBadge pct={totalInvested > 0 ? (totalCurrentValue - totalInvested) / totalInvested * 100 : 0} />
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Invested</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{formatINR(totalInvested)}</p>
          <p className="text-xs text-emerald-600 font-medium mt-0.5">
            {formatINR(totalCurrentValue - totalInvested)} gain
          </p>
        </Card>
      </div>

      {/* Per-SIP cards */}
      <div className="space-y-4">
        {sipHealthData.map((sip) => {
          const { record, monthsRunning, projections, stepUpProjections } = sip
          const gainPct = record.investedValue > 0
            ? (record.currentValue - record.investedValue) / record.investedValue * 100
            : 0

          return (
            <Card key={record.id} padding="none">
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-medium text-zinc-900 text-sm truncate" title={record.schemeName}>
                      {record.schemeName}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        SIP on day {record.sipDay} · {monthsRunning} months running
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-zinc-900">{formatINR(record.sipAmount)}/mo</p>
                    {record.currentValue > 0 && (
                      <div className="flex items-center gap-1.5 justify-end mt-1">
                        <span className="text-sm font-medium text-zinc-700">{formatINR(record.currentValue)}</span>
                        <GainBadge pct={gainPct} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Current NAV */}
                {record.currentNav && (
                  <div className="mt-2 text-xs text-zinc-400">
                    NAV: ₹{record.currentNav.toFixed(4)} · {record.units.toFixed(3)} units
                  </div>
                )}
              </div>

              {/* Projections */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Projected Corpus (12% CAGR)
                </p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {projections.map((p) => (
                    <div key={p.years} className="bg-zinc-50 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-zinc-400">{p.years} years</p>
                      <p className="text-sm font-semibold text-zinc-900 mt-0.5">{formatINR(p.corpus)}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">on {formatINR(p.invested)} invested</p>
                    </div>
                  ))}
                </div>

                {/* Step-up SIP comparison */}
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-800">
                      With 10% annual step-up (starts {formatINR(Math.round(record.sipAmount * 1.1))}/mo next year)
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {stepUpProjections.map((p, i) => (
                      <div key={p.years}>
                        <p className="text-xs text-emerald-600">{p.years} years</p>
                        <p className="text-sm font-semibold text-emerald-900">{formatINR(p.corpus)}</p>
                        <p className="text-xs text-emerald-500">
                          +{formatINR(p.corpus - projections[i].corpus)} extra
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Disclaimer */}
      <div className="flex gap-2 text-xs text-zinc-400">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Projections assume 12% annual returns compounded monthly. Actual returns may differ.
          Step-up projections assume 10% SIP increase each year. This is not financial advice.
        </span>
      </div>
    </div>
  )
}
