/**
 * SIP Backtest & Projection engine using mfapi.in historical NAVs.
 * mfapi format: GET /mf/{schemeCode} → { data: [{date: "DD-MM-YYYY", nav: "123.45"}], meta: {...} }
 */

export interface SimDataPoint {
  date: string   // "YYYY-MM"
  invested: number
  value: number
  units: number
}

export interface BacktestResult {
  schemeCode: number
  schemeName: string
  dataPoints: SimDataPoint[]
  totalInvested: number
  finalValue: number
  totalGain: number
  gainPct: number
  xirr: number | null
  installments: number
}

export interface ProjectionResult {
  dataPoints: SimDataPoint[]
  totalInvested: number
  projectedValue: number
  expectedReturnPct: number
}

// Parse "DD-MM-YYYY" → Date
function parseNavDate(s: string): Date {
  const [d, m, y] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Format Date → "YYYY-MM"
function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Add months to a Date
function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

// XIRR via Newton-Raphson
// cashflows: array of { amount, date } where:
//   - investments are negative
//   - final redemption value is positive
export function computeXIRR(
  cashflows: { amount: number; date: Date }[],
  maxIter = 100,
  tol = 1e-7,
): number | null {
  if (cashflows.length < 2) return null

  const t0 = cashflows[0].date.getTime()

  function f(r: number): number {
    return cashflows.reduce((sum, cf) => {
      const t = (cf.date.getTime() - t0) / (365 * 24 * 60 * 60 * 1000)
      return sum + cf.amount / Math.pow(1 + r, t)
    }, 0)
  }

  function df(r: number): number {
    return cashflows.reduce((sum, cf) => {
      const t = (cf.date.getTime() - t0) / (365 * 24 * 60 * 60 * 1000)
      return sum - t * cf.amount / Math.pow(1 + r, t + 1)
    }, 0)
  }

  let r = 0.1
  for (let i = 0; i < maxIter; i++) {
    const fr = f(r)
    const dfr = df(r)
    if (Math.abs(dfr) < 1e-12) return null
    const rNew = r - fr / dfr
    if (Math.abs(rNew - r) < tol) return Math.round(rNew * 10000) / 100 // % with 2dp
    r = rNew
    if (r < -0.9999) r = -0.9999
  }
  return null
}

export async function backtestSIP(
  schemeCode: number,
  monthlyAmount: number,
  startDate: Date,
  endDate: Date,
): Promise<BacktestResult> {
  const res = await fetch(`${process.env.MFAPI_BASE_URL}/mf/${schemeCode}`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`mfapi fetch failed for ${schemeCode}`)
  const json = await res.json()

  const schemeName: string = json.meta?.scheme_name ?? String(schemeCode)

  // Build a Map from "YYYY-MM-DD" → NAV (data is desc order)
  const navByDate = new Map<string, number>()
  for (const row of json.data as { date: string; nav: string }[]) {
    const d = parseNavDate(row.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    navByDate.set(key, parseFloat(row.nav))
  }

  // All available dates sorted ascending
  const allDates = [...navByDate.keys()].sort()

  // Find NAV on or after a given date
  function navOn(d: Date): { nav: number; date: Date } | null {
    const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    // find earliest date >= target
    let lo = 0, hi = allDates.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (allDates[mid] < target) lo = mid + 1
      else hi = mid
    }
    if (lo >= allDates.length) return null
    const found = allDates[lo]
    const [y, m, day] = found.split('-').map(Number)
    return { nav: navByDate.get(found)!, date: new Date(y, m - 1, day) }
  }

  const dataPoints: SimDataPoint[] = []
  const cashflows: { amount: number; date: Date }[] = []
  let totalUnits = 0
  let totalInvested = 0
  let installments = 0

  let cur = new Date(startDate)
  const end = new Date(endDate)

  while (cur <= end) {
    const point = navOn(cur)
    if (point) {
      const units = monthlyAmount / point.nav
      totalUnits += units
      totalInvested += monthlyAmount
      installments++
      cashflows.push({ amount: -monthlyAmount, date: point.date })
    }

    const latestPoint = navOn(cur > end ? end : cur)
    const currentNav = latestPoint?.nav ?? 0
    const value = totalUnits * currentNav

    dataPoints.push({
      date: toYearMonth(cur),
      invested: Math.round(totalInvested),
      value: Math.round(value),
      units: Math.round(totalUnits * 1000) / 1000,
    })

    cur = addMonths(cur, 1)
  }

  // Final value for XIRR
  const lastPoint = dataPoints[dataPoints.length - 1]
  if (lastPoint && lastPoint.value > 0) {
    cashflows.push({ amount: lastPoint.value, date: endDate })
  }

  const xirr = cashflows.length >= 2 ? computeXIRR(cashflows) : null

  return {
    schemeCode,
    schemeName,
    dataPoints,
    totalInvested,
    finalValue: lastPoint?.value ?? 0,
    totalGain: (lastPoint?.value ?? 0) - totalInvested,
    gainPct: totalInvested > 0 ? ((lastPoint?.value ?? 0) - totalInvested) / totalInvested * 100 : 0,
    xirr,
    installments,
  }
}

export function projectSIP(
  monthlyAmount: number,
  currentNav: number,
  months: number,
  annualReturnPct: number,
): ProjectionResult {
  const monthlyReturn = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1
  const dataPoints: SimDataPoint[] = []
  let totalUnits = 0
  let totalInvested = 0
  const today = new Date()

  for (let i = 0; i < months; i++) {
    const nav = currentNav * Math.pow(1 + monthlyReturn, i)
    const units = monthlyAmount / nav
    totalUnits += units
    totalInvested += monthlyAmount
    const value = totalUnits * nav * Math.pow(1 + monthlyReturn, 0) // value at current nav projected

    const d = addMonths(today, i)
    dataPoints.push({
      date: toYearMonth(d),
      invested: Math.round(totalInvested),
      value: Math.round(totalUnits * currentNav * Math.pow(1 + monthlyReturn, i)),
      units: Math.round(totalUnits * 1000) / 1000,
    })
  }

  return {
    dataPoints,
    totalInvested,
    projectedValue: dataPoints[dataPoints.length - 1]?.value ?? 0,
    expectedReturnPct: annualReturnPct,
  }
}
