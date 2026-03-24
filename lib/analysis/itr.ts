/**
 * ITR tax computation engine — FY 2025-26 (AY 2026-27)
 * Rates per Budget 2025 (Union Budget, February 2025)
 */

// ── New Regime (default from FY 2024-25) ─────────────────────────────────────
// Budget 2025 revised slabs
const NEW_SLABS = [
  { min: 0,          max: 400_000,   rate: 0 },
  { min: 400_000,    max: 800_000,   rate: 0.05 },
  { min: 800_000,    max: 1_200_000, rate: 0.10 },
  { min: 1_200_000,  max: 1_600_000, rate: 0.15 },
  { min: 1_600_000,  max: 2_000_000, rate: 0.20 },
  { min: 2_000_000,  max: 2_400_000, rate: 0.25 },
  { min: 2_400_000,  max: Infinity,  rate: 0.30 },
]
const NEW_STD_DEDUCTION = 75_000
// 87A: full rebate if net taxable income ≤ ₹12L (effective zero tax up to ₹12L + std deduction)
const NEW_87A_THRESHOLD = 1_200_000

// ── Old Regime ────────────────────────────────────────────────────────────────
const OLD_SLABS = [
  { min: 0,          max: 250_000,  rate: 0 },
  { min: 250_000,    max: 500_000,  rate: 0.05 },
  { min: 500_000,    max: 1_000_000,rate: 0.20 },
  { min: 1_000_000,  max: Infinity, rate: 0.30 },
]
const OLD_STD_DEDUCTION = 50_000
const OLD_87A_THRESHOLD = 500_000
const OLD_87A_REBATE    = 12_500

// ── Capital gains rates ───────────────────────────────────────────────────────
export const LTCG_EQUITY_EXEMPTION = 125_000
export const STCG_RATE  = 0.20
export const LTCG_RATE  = 0.125
export const CRYPTO_RATE = 0.30

export interface ITRInputs {
  // Income
  grossSalary: number
  otherIncome: number       // interest, rental, etc.
  // Capital gains (pre-filled from portfolio)
  stcgEquity: number
  ltcgEquity: number
  cryptoGains: number
  debtGains: number         // added to normal income (slab rate)
  // Deductions (old regime only; auto-filled from 80C optimizer)
  section80C: number
  section80CCD1B: number
  section80D: number
  hra: number
  otherDeductions: number
  // Credits
  tdsDeducted: number
  advanceTax: number
}

export interface RegimeTax {
  regime: 'new' | 'old'
  grossIncome: number
  totalDeductions: number
  taxableIncome: number
  basicTax: number
  surcharge: number
  cess: number
  specialRateTax: number
  totalTax: number
  taxPayable: number      // negative = refund
  effectiveRate: number
  breakdown: { label: string; amount: number; note?: string }[]
}

export interface ITRResult {
  newRegime: RegimeTax
  oldRegime: RegimeTax
  recommended: 'new' | 'old'
  saving: number
  itrForm: 'ITR-1' | 'ITR-2'   // ITR-1 if no capital gains, else ITR-2
}

function slabTax(income: number, slabs: typeof NEW_SLABS): number {
  let tax = 0
  for (const s of slabs) {
    if (income <= s.min) break
    tax += (Math.min(income, s.max) - s.min) * s.rate
  }
  return tax
}

function surcharge(income: number, tax: number): number {
  if (income > 50_000_000) return tax * 0.37
  if (income > 20_000_000) return tax * 0.25
  if (income > 10_000_000) return tax * 0.15
  if (income >  5_000_000) return tax * 0.10
  return 0
}

export function computeTax(inputs: ITRInputs): ITRResult {
  const {
    grossSalary, otherIncome,
    stcgEquity, ltcgEquity, cryptoGains, debtGains,
    section80C, section80CCD1B, section80D, hra, otherDeductions,
    tdsDeducted, advanceTax,
  } = inputs

  const taxPaid = tdsDeducted + advanceTax
  const ltcgTaxable = Math.max(0, ltcgEquity - LTCG_EQUITY_EXEMPTION)

  // Special rate taxes (same under both regimes)
  const specialTax =
    stcgEquity   * STCG_RATE +
    ltcgTaxable  * LTCG_RATE +
    cryptoGains  * CRYPTO_RATE

  const itrForm: ITRResult['itrForm'] =
    (stcgEquity + ltcgEquity + cryptoGains + debtGains) > 0 ? 'ITR-2' : 'ITR-1'

  // ── NEW REGIME ──────────────────────────────────────────────────────────────
  const newGross = grossSalary + otherIncome + debtGains
  const newStd   = Math.min(NEW_STD_DEDUCTION, grossSalary)
  const newTI    = Math.max(0, newGross - newStd)
  let newBasic   = slabTax(newTI, NEW_SLABS)
  if (newTI <= NEW_87A_THRESHOLD) newBasic = 0   // full rebate

  const newSurcharge = surcharge(newTI, newBasic)
  const newCess      = (newBasic + newSurcharge) * 0.04
  const newTotal     = newBasic + newSurcharge + newCess + specialTax

  const newRegime: RegimeTax = {
    regime: 'new',
    grossIncome: newGross,
    totalDeductions: newStd,
    taxableIncome: newTI,
    basicTax:       Math.round(newBasic),
    surcharge:      Math.round(newSurcharge),
    cess:           Math.round(newCess),
    specialRateTax: Math.round(specialTax),
    totalTax:       Math.round(newTotal),
    taxPayable:     Math.round(newTotal - taxPaid),
    effectiveRate:  newGross > 0 ? (newTotal / (grossSalary + otherIncome)) * 100 : 0,
    breakdown: [
      { label: 'Gross Salary',        amount:  grossSalary },
      { label: 'Other Income',        amount:  otherIncome },
      { label: 'Standard Deduction',  amount: -newStd,       note: `₹75,000 in new regime` },
      { label: 'Net Taxable Income',  amount:  newTI },
      { label: 'Income Tax (slabs)',  amount:  Math.round(newBasic),     note: newTI <= NEW_87A_THRESHOLD ? 'Nil — 87A rebate applied (income ≤ ₹12L)' : undefined },
      { label: 'STCG @ 20%',         amount:  Math.round(stcgEquity * STCG_RATE) },
      { label: 'LTCG @ 12.5%',       amount:  Math.round(ltcgTaxable * LTCG_RATE), note: `₹1.25L exempt; taxable: ₹${ltcgTaxable.toLocaleString('en-IN')}` },
      { label: 'Crypto @ 30%',       amount:  Math.round(cryptoGains * CRYPTO_RATE) },
      { label: 'Health & Edu Cess',  amount:  Math.round(newCess),       note: '4% on income tax' },
      { label: 'TDS / Advance Tax',  amount: -taxPaid },
    ].filter(r => r.amount !== 0),
  }

  // ── OLD REGIME ──────────────────────────────────────────────────────────────
  const cap80C   = Math.min(section80C, 150_000)
  const cap80CCD = Math.min(section80CCD1B, 50_000)
  const cap80D   = Math.min(section80D, 75_000)
  const oldGross = grossSalary + otherIncome + debtGains
  const oldDeds  = Math.min(OLD_STD_DEDUCTION, grossSalary) + cap80C + cap80CCD + cap80D + hra + otherDeductions
  const oldTI    = Math.max(0, oldGross - oldDeds)
  let oldBasic   = slabTax(oldTI, OLD_SLABS)
  if (oldTI <= OLD_87A_THRESHOLD) oldBasic = Math.max(0, oldBasic - OLD_87A_REBATE)

  const oldSurcharge = surcharge(oldTI, oldBasic)
  const oldCess      = (oldBasic + oldSurcharge) * 0.04
  const oldTotal     = oldBasic + oldSurcharge + oldCess + specialTax

  const oldRegime: RegimeTax = {
    regime: 'old',
    grossIncome: oldGross,
    totalDeductions: oldDeds,
    taxableIncome: oldTI,
    basicTax:       Math.round(oldBasic),
    surcharge:      Math.round(oldSurcharge),
    cess:           Math.round(oldCess),
    specialRateTax: Math.round(specialTax),
    totalTax:       Math.round(oldTotal),
    taxPayable:     Math.round(oldTotal - taxPaid),
    effectiveRate:  oldGross > 0 ? (oldTotal / (grossSalary + otherIncome)) * 100 : 0,
    breakdown: [
      { label: 'Gross Salary',        amount:  grossSalary },
      { label: 'Standard Deduction',  amount: -Math.min(OLD_STD_DEDUCTION, grossSalary), note: '₹50,000 in old regime' },
      { label: 'Other Income',        amount:  otherIncome },
      { label: '80C Deductions',      amount: -cap80C,    note: `ELSS/PPF/NPS/LIC; max ₹1.5L` },
      { label: '80CCD(1B) NPS',       amount: -cap80CCD,  note: 'Additional NPS; max ₹50K' },
      { label: '80D Health Insurance',amount: -cap80D,    note: 'Self ₹25K + parents ₹50K' },
      { label: 'HRA Exemption',       amount: -hra },
      { label: 'Other Deductions',    amount: -otherDeductions },
      { label: 'Net Taxable Income',  amount:  oldTI },
      { label: 'Income Tax (slabs)',  amount:  Math.round(oldBasic) },
      { label: 'STCG @ 20%',         amount:  Math.round(stcgEquity * STCG_RATE) },
      { label: 'LTCG @ 12.5%',       amount:  Math.round(ltcgTaxable * LTCG_RATE) },
      { label: 'Crypto @ 30%',       amount:  Math.round(cryptoGains * CRYPTO_RATE) },
      { label: 'Health & Edu Cess',  amount:  Math.round(oldCess) },
      { label: 'TDS / Advance Tax',  amount: -taxPaid },
    ].filter(r => r.amount !== 0),
  }

  const recommended: ITRResult['recommended'] =
    newRegime.totalTax <= oldRegime.totalTax ? 'new' : 'old'

  return {
    newRegime,
    oldRegime,
    recommended,
    saving: Math.abs(newRegime.totalTax - oldRegime.totalTax),
    itrForm,
  }
}

export function getAgeBracket(dob: string | null): string {
  if (!dob) return '30-35'
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
  if (age < 25) return '20-25'
  if (age < 30) return '25-30'
  if (age < 35) return '30-35'
  if (age < 40) return '35-40'
  if (age < 50) return '40-50'
  return '50+'
}
