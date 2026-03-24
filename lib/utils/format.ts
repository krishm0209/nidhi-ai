/**
 * Format a number as Indian Rupees.
 * Automatically switches to lakhs / crores notation.
 */
export function formatINR(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (abs >= 10_000_000) {
    return `${sign}₹${(abs / 10_000_000).toFixed(2)} Cr`
  }
  if (abs >= 100_000) {
    return `${sign}₹${(abs / 100_000).toFixed(2)} L`
  }
  return `${sign}₹${new Intl.NumberFormat('en-IN').format(Math.round(abs))}`
}

/**
 * Format a percentage change with a sign prefix.
 */
export function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

/**
 * Format an absolute gain/loss in INR with sign.
 */
export function formatGain(amount: number): string {
  const sign = amount >= 0 ? '+' : ''
  return `${sign}${formatINR(amount)}`
}

/**
 * Format units (mutual fund / crypto) with up to 4 decimal places.
 */
export function formatUnits(units: number, decimals = 4): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(units)
}

/**
 * Format a number using Indian numbering (lakhs / crores) without ₹ symbol.
 */
export function formatIndianNumber(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`
  if (abs >= 100_000) return `${(n / 100_000).toFixed(2)} L`
  return new Intl.NumberFormat('en-IN').format(Math.round(n))
}
