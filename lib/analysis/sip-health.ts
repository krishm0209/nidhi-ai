import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'

export interface SIPRecord {
  id: string
  schemeName: string
  schemeCode: number
  sipAmount: number
  sipDay: number          // day of month (1-28)
  isActive: boolean
  startDate: string       // ISO date
  goalName: string | null
  goalTarget: number | null
  goalTargetDate: string | null
  currentValue: number    // units × current NAV
  investedValue: number   // purchase_nav × units (approx)
  units: number
  currentNav: number | null
}

export interface SIPProjection {
  years: number
  corpus: number
  invested: number
}

export interface SIPHealth {
  record: SIPRecord
  monthsRunning: number
  expectedInstallments: number
  projections: SIPProjection[]   // 5, 10, 15 year
  stepUpProjections: SIPProjection[] // with 10% annual step-up at same horizons
  goalProgressPct: number | null
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

function projectCorpus(
  monthlyAmount: number,
  months: number,
  annualReturnPct = 12,
): number {
  const r = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1
  // FV = P × [(1+r)^n - 1] / r × (1+r)
  return monthlyAmount * ((Math.pow(1 + r, months) - 1) / r) * (1 + r)
}

function projectStepUpCorpus(
  monthlyAmount: number,
  months: number,
  annualReturnPct = 12,
  annualStepUpPct = 10,
): number {
  let total = 0
  const r = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1
  let sip = monthlyAmount
  let remainingMonths = months

  for (let year = 0; year < Math.ceil(months / 12); year++) {
    const mInYear = Math.min(12, remainingMonths)
    // Future value of this year's SIP, compounded for the rest of the period
    for (let m = 0; m < mInYear; m++) {
      const compoundMonths = months - year * 12 - m
      total += sip * Math.pow(1 + r, compoundMonths)
    }
    sip *= 1 + annualStepUpPct / 100
    remainingMonths -= 12
  }

  return total
}

export async function getMemberSIPHealth(memberId: string): Promise<SIPHealth[]> {
  const { data: mfRows } = await supabaseAdmin
    .from('mf_holdings')
    .select('id, scheme_code, scheme_name, sip_amount, sip_date, is_sip, units, purchase_nav, created_at')
    .eq('member_id', memberId)
    .eq('is_sip', true)

  if (!mfRows || mfRows.length === 0) return []

  const schemeCodes = [...new Set(mfRows.map(r => r.scheme_code))]
  const navs = await getMFNavs(schemeCodes)

  const today = new Date()

  return mfRows.map(row => {
    const sipAmount = row.sip_amount ?? 0
    const sipDay = row.sip_date ?? 1
    const startDate = new Date(row.created_at)
    const currentNav = navs[row.scheme_code] ?? null

    const monthsRunning = Math.max(0,
      (today.getFullYear() - startDate.getFullYear()) * 12
      + today.getMonth() - startDate.getMonth()
    )
    const expectedInstallments = monthsRunning + 1

    const currentValue = currentNav ? row.units * currentNav : 0
    const investedValue = row.purchase_nav ? row.units * row.purchase_nav : sipAmount * expectedInstallments

    const record: SIPRecord = {
      id: row.id,
      schemeName: row.scheme_name,
      schemeCode: row.scheme_code,
      sipAmount,
      sipDay,
      isActive: true,
      startDate: row.created_at,
      goalName: null,
      goalTarget: null,
      goalTargetDate: null,
      currentValue,
      investedValue,
      units: row.units,
      currentNav,
    }

    const horizons = [5, 10, 15]
    const projections: SIPProjection[] = horizons.map(years => ({
      years,
      corpus: Math.round(projectCorpus(sipAmount, years * 12)),
      invested: sipAmount * years * 12,
    }))

    const stepUpProjections: SIPProjection[] = horizons.map(years => ({
      years,
      corpus: Math.round(projectStepUpCorpus(sipAmount, years * 12)),
      invested: sipAmount * years * 12, // approx
    }))

    const goalProgressPct = record.goalTarget && record.goalTarget > 0
      ? Math.min(100, (currentValue / record.goalTarget) * 100)
      : null

    return {
      record,
      monthsRunning,
      expectedInstallments,
      projections,
      stepUpProjections,
      goalProgressPct,
    }
  })
}
