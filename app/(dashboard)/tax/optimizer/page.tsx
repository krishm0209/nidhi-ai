import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { formatINR } from '@/lib/utils/format'
import {
  computeMemberTaxProfile,
  getCurrentFY,
  SECTION_80C_LIMIT,
  SECTION_80CCD1B_LIMIT,
  SECTION_80D_SELF_LIMIT,
  SECTION_80D_PARENTS_LIMIT,
  type MemberTaxProfile,
} from '@/lib/analysis/tax-optimizer'
import { AlertTriangle, CheckCircle, IndianRupee, Info, Clock } from 'lucide-react'
import { AddDeductionForm } from './AddDeductionForm'

function UtilizationBar({ used, limit, color = 'bg-emerald-500' }: { used: number; limit: number; color?: string }) {
  const pct = Math.min(100, (used / limit) * 100)
  const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-blue-400'
  return (
    <div className="w-full">
      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Section80CCard({ profile }: { profile: MemberTaxProfile }) {
  const { section80C: s } = profile
  const rows = [
    { label: 'ELSS Mutual Funds', value: s.elss },
    { label: 'PPF', value: s.ppf },
    { label: 'NPS (80C portion)', value: s.nps },
    { label: 'LIC Premium', value: s.lic },
    { label: 'SSY', value: s.ssy },
    { label: 'Other (manual)', value: s.manual },
  ].filter(r => r.value > 0)

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Section 80C</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Max deduction ₹1.5L/year</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-zinc-900">{formatINR(s.total)}</p>
            <p className="text-xs text-zinc-400">of {formatINR(s.limit)}</p>
          </div>
        </div>
        <div className="mt-3">
          <UtilizationBar used={s.total} limit={s.limit} />
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>{((s.total / s.limit) * 100).toFixed(0)}% used</span>
            <span className={s.remaining > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
              {s.remaining > 0 ? `${formatINR(s.remaining)} remaining` : 'Fully utilized ✓'}
            </span>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="divide-y divide-zinc-50">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-zinc-600">{r.label}</span>
              <span className="font-medium text-zinc-900">{formatINR(r.value)}</span>
            </div>
          ))}
        </div>
      )}

      {s.remaining > 0 && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 rounded-b-xl">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Invest {formatINR(s.remaining)} more in ELSS</span> to save{' '}
            <span className="font-semibold">{formatINR(Math.round(s.remaining * 0.30))}</span> at 30% tax slab
            (or {formatINR(Math.round(s.remaining * 0.20))} at 20%).
          </p>
        </div>
      )}
    </Card>
  )
}

function Section80D({ profile }: { profile: MemberTaxProfile }) {
  const { section80D: s } = profile
  const selfUsed = s.self
  const parentsUsed = s.parents
  const totalUsed = selfUsed + parentsUsed
  const totalLimit = s.selfLimit + s.parentsLimit

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Section 80D</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Health insurance premiums</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-zinc-900">{formatINR(totalUsed)}</p>
            <p className="text-xs text-zinc-400">of {formatINR(totalLimit)}</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-zinc-50">
        <div className="flex items-center justify-between px-5 py-2.5 text-sm">
          <span className="text-zinc-600">Self / Family (max {formatINR(s.selfLimit)})</span>
          <span className={`font-medium ${selfUsed > 0 ? 'text-zinc-900' : 'text-zinc-400'}`}>
            {selfUsed > 0 ? formatINR(selfUsed) : 'Not entered'}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-2.5 text-sm">
          <span className="text-zinc-600">Senior citizen parents (max {formatINR(s.parentsLimit)})</span>
          <span className={`font-medium ${parentsUsed > 0 ? 'text-zinc-900' : 'text-zinc-400'}`}>
            {parentsUsed > 0 ? formatINR(parentsUsed) : 'Not entered'}
          </span>
        </div>
      </div>
    </Card>
  )
}

export default async function TaxOptimizerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const fy = getCurrentFY()

  // Get all household members
  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id, household_id')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  if (!selfMember) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">80C Optimizer</h1>
        <p className="text-sm text-zinc-500">Complete onboarding first.</p>
      </div>
    )
  }

  const { data: members } = await supabaseAdmin
    .from('household_members')
    .select('id, name, relationship')
    .eq('household_id', selfMember.household_id)
    .order('created_at', { ascending: true })

  const allMembers = members ?? []

  // Compute tax profile for all members in parallel
  const profiles = await Promise.all(
    allMembers.map(m => computeMemberTaxProfile(m.id, m.name, m.relationship, fy))
  )

  const totalRemaining80C = profiles.reduce((s, p) => s + p.section80C.remaining, 0)
  const totalLimit80C = profiles.reduce((s, p) => s + p.section80C.limit, 0)
  const totalUsed80C = profiles.reduce((s, p) => s + p.section80C.total, 0)
  const totalSavingPossible = profiles.reduce((s, p) => s + p.savingAt30Pct, 0)

  const selfProfile = profiles.find(p => p.relationship === 'self')

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">80C Tax Optimizer</h1>
        <p className="text-sm text-zinc-500 mt-0.5">FY {fy.label} · Based on investments added this financial year</p>
      </div>

      {/* FY deadline banner */}
      {fy.daysLeft <= 30 && (
        <div className={`rounded-xl border px-5 py-4 flex items-start gap-3 ${
          fy.daysLeft <= 7
            ? 'border-red-200 bg-red-50'
            : 'border-amber-200 bg-amber-50'
        }`}>
          <Clock className={`h-5 w-5 shrink-0 mt-0.5 ${fy.daysLeft <= 7 ? 'text-red-500' : 'text-amber-500'}`} />
          <div>
            <p className={`text-sm font-semibold ${fy.daysLeft <= 7 ? 'text-red-800' : 'text-amber-800'}`}>
              {fy.daysLeft} day{fy.daysLeft !== 1 ? 's' : ''} left to invest for FY {fy.label} tax savings
            </p>
            <p className={`text-xs mt-0.5 ${fy.daysLeft <= 7 ? 'text-red-600' : 'text-amber-600'}`}>
              Investments must be made before March 31, {fy.label.split('-')[0] === String(new Date().getFullYear() - 1) ? new Date().getFullYear() : new Date().getFullYear() + 1}.
              ELSS units typically take 2-3 business days to allot.
            </p>
          </div>
        </div>
      )}

      {/* Household summary */}
      {allMembers.length > 1 && (
        <div className="grid grid-cols-3 gap-4">
          <Card padding="sm">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total 80C Used</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{formatINR(totalUsed80C)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">of {formatINR(totalLimit80C)} across {allMembers.length} PANs</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Remaining Capacity</p>
            <p className="mt-1 text-xl font-semibold text-amber-600">{formatINR(totalRemaining80C)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">unused across family</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Potential Tax Saving</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">{formatINR(totalSavingPossible)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">at 30% slab if fully invested</p>
          </Card>
        </div>
      )}

      {/* Per-member profiles */}
      {profiles.map((profile) => (
        <div key={profile.memberId} className="space-y-4">
          {allMembers.length > 1 && (
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-800">{profile.memberName}</h2>
              <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full capitalize">
                {profile.relationship}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section80CCard profile={profile} />

            <div className="space-y-4">
              {/* 80CCD(1B) */}
              <Card padding="none">
                <div className="px-5 py-4 border-b border-zinc-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">Section 80CCD(1B)</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">Additional NPS contribution (max ₹50K)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-zinc-900">{formatINR(profile.section80CCD1B.total)}</p>
                      <p className="text-xs text-zinc-400">of {formatINR(SECTION_80CCD1B_LIMIT)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <UtilizationBar used={profile.section80CCD1B.total} limit={SECTION_80CCD1B_LIMIT} />
                    <p className="text-xs text-zinc-400 mt-1">
                      {profile.section80CCD1B.remaining > 0
                        ? `${formatINR(profile.section80CCD1B.remaining)} remaining — invest in NPS to save an additional ${formatINR(Math.round(profile.section80CCD1B.remaining * 0.30))}`
                        : 'Fully utilized ✓'}
                    </p>
                  </div>
                </div>
              </Card>

              <Section80D profile={profile} />
            </div>
          </div>

          {/* Add manual deduction */}
          <AddDeductionForm memberId={profile.memberId} fyLabel={fy.label} />
        </div>
      ))}

      {/* Disclaimer */}
      <div className="flex gap-2 text-xs text-zinc-400">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Auto-detected from holdings added this FY. Add manual deductions (home loan principal, tuition fees, etc.) using the form above.
          Actual deduction limits and eligibility may vary — consult your CA before filing.
        </span>
      </div>
    </div>
  )
}
