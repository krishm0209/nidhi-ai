import { supabaseAdmin } from '@/lib/supabase/admin'

export const SECTION_80C_LIMIT = 150_000
export const SECTION_80CCD1B_LIMIT = 50_000
export const SECTION_80D_SELF_LIMIT = 25_000
export const SECTION_80D_PARENTS_LIMIT = 50_000

export interface FYInfo {
  label: string      // '2025-26'
  start: Date
  end: Date
  daysLeft: number
}

export function getCurrentFY(): FYInfo {
  const today = new Date()
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  const start = new Date(fyStartYear, 3, 1)
  const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59)
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000))
  return {
    label: `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
    start,
    end,
    daysLeft,
  }
}

export interface Section80C {
  elss: number
  ppf: number
  nps: number
  lic: number
  ssy: number
  manual: number   // from tax_deductions table
  total: number
  limit: number
  remaining: number
}

export interface Section80CCD1B {
  nps: number
  total: number
  limit: number
  remaining: number
}

export interface Section80D {
  self: number
  parents: number
  selfLimit: number
  parentsLimit: number
  remaining: number
}

export interface MemberTaxProfile {
  memberId: string
  memberName: string
  relationship: string
  section80C: Section80C
  section80CCD1B: Section80CCD1B
  section80D: Section80D
  // Estimated tax savings if remaining 80C is fully used
  savingAt30Pct: number
  savingAt20Pct: number
}

const ELSS_TYPES = ['elss', 'equity linked savings scheme']

function isELSS(fundType: string | null): boolean {
  if (!fundType) return false
  const t = fundType.toLowerCase()
  return ELSS_TYPES.some(k => t.includes(k))
}

const INSTRUMENTS_80C = ['ppf', 'lic', 'ssy']
const INSTRUMENTS_NPS = ['nps']

export async function computeMemberTaxProfile(
  memberId: string,
  memberName: string,
  relationship: string,
  fy: FYInfo,
): Promise<MemberTaxProfile> {
  const fyStart = fy.start.toISOString()
  const fyEnd = fy.end.toISOString()

  // ── Fetch from holdings tables (current FY via created_at) ──────────────────
  const [mfRes, fiRes, deductionsRes] = await Promise.all([
    supabaseAdmin
      .from('mf_holdings')
      .select('fund_type, units, purchase_nav, sip_amount, created_at')
      .eq('member_id', memberId)
      .gte('created_at', fyStart)
      .lte('created_at', fyEnd),
    supabaseAdmin
      .from('fixed_income_holdings')
      .select('instrument_type, principal, created_at')
      .eq('member_id', memberId)
      .gte('created_at', fyStart)
      .lte('created_at', fyEnd),
    supabaseAdmin
      .from('tax_deductions')
      .select('section, instrument, amount')
      .eq('member_id', memberId)
      .eq('financial_year', fy.label),
  ])

  const mfRows = mfRes.data ?? []
  const fiRows = fiRes.data ?? []
  const deductions = deductionsRes.data ?? []

  // ── 80C computation ──────────────────────────────────────────────────────────
  let elss = 0, ppf = 0, nps80C = 0, lic = 0, ssy = 0

  for (const m of mfRows) {
    if (isELSS(m.fund_type)) {
      // Use invested amount: units × purchase_nav, fallback to sip_amount
      const invested = m.purchase_nav ? m.units * m.purchase_nav : (m.sip_amount ?? 0)
      elss += invested
    }
  }

  for (const f of fiRows) {
    const t = f.instrument_type
    if (INSTRUMENTS_80C.includes(t)) {
      if (t === 'ppf') ppf += f.principal
      else if (t === 'lic') lic += f.principal
      else if (t === 'ssy') ssy += f.principal
    }
    if (INSTRUMENTS_NPS.includes(t)) {
      nps80C += f.principal
    }
  }

  // Manual deductions from tax_deductions table
  let manual80C = 0
  let manual80CCD1B = 0
  let selfHealthInsurance = 0
  let parentsHealthInsurance = 0

  for (const d of deductions) {
    const section = d.section.toUpperCase()
    if (section === '80C') manual80C += d.amount
    else if (section === '80CCD1B') manual80CCD1B += d.amount
    else if (section === '80D') {
      const instrument = d.instrument.toLowerCase()
      if (instrument.includes('parent')) parentsHealthInsurance += d.amount
      else selfHealthInsurance += d.amount
    }
  }

  const total80C = Math.min(elss + ppf + nps80C + lic + ssy + manual80C, SECTION_80C_LIMIT)
  const remaining80C = Math.max(0, SECTION_80C_LIMIT - total80C)

  const total80CCD1B = Math.min(manual80CCD1B, SECTION_80CCD1B_LIMIT)
  const remaining80CCD1B = Math.max(0, SECTION_80CCD1B_LIMIT - total80CCD1B)

  const remaining80D = Math.max(0, SECTION_80D_SELF_LIMIT - selfHealthInsurance)
    + Math.max(0, SECTION_80D_PARENTS_LIMIT - parentsHealthInsurance)

  const totalRemaining = remaining80C + remaining80CCD1B

  return {
    memberId,
    memberName,
    relationship,
    section80C: {
      elss: Math.round(elss),
      ppf: Math.round(ppf),
      nps: Math.round(nps80C),
      lic: Math.round(lic),
      ssy: Math.round(ssy),
      manual: Math.round(manual80C),
      total: Math.round(total80C),
      limit: SECTION_80C_LIMIT,
      remaining: Math.round(remaining80C),
    },
    section80CCD1B: {
      nps: Math.round(manual80CCD1B),
      total: Math.round(total80CCD1B),
      limit: SECTION_80CCD1B_LIMIT,
      remaining: Math.round(remaining80CCD1B),
    },
    section80D: {
      self: Math.round(selfHealthInsurance),
      parents: Math.round(parentsHealthInsurance),
      selfLimit: SECTION_80D_SELF_LIMIT,
      parentsLimit: SECTION_80D_PARENTS_LIMIT,
      remaining: Math.round(remaining80D),
    },
    savingAt30Pct: Math.round(totalRemaining * 0.30),
    savingAt20Pct: Math.round(totalRemaining * 0.20),
  }
}
