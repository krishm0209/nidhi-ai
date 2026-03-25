// NSE/BSE trading holidays for 2026
const NSE_HOLIDAYS_2026: readonly string[] = [
  '2026-01-26', // Republic Day
  '2026-03-10', // Maha Shivaratri
  '2026-03-17', // Holi
  '2026-03-31', // Id-Ul-Fitr
  '2026-04-02', // Ram Navami
  '2026-04-06', // Mahavir Jayanti
  '2026-04-10', // Good Friday
  '2026-04-14', // Dr. Ambedkar Jayanti
  '2026-05-01', // May Day
  '2026-06-07', // Bakri Id
  '2026-07-07', // Moharram
  '2026-08-15', // Independence Day
  '2026-08-19', // Janmashtami
  '2026-09-05', // Milad-Un-Nabi
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-10-21', // Dussehra
  '2026-10-22', // Dussehra
  '2026-11-09', // Diwali (Laxmi Pujan)
  '2026-11-10', // Diwali (Balipratipada)
  '2026-11-30', // Guru Nanak Jayanti
  '2026-12-25', // Christmas
]

/** Returns the current time as a Date in IST. */
function nowIST(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
}

/** Returns true if the market is currently open (NSE/BSE, IST). */
export function isMarketOpen(): boolean {
  const ist = nowIST()
  const day = ist.getDay()

  // Saturday (6) or Sunday (0)
  if (day === 0 || day === 6) return false

  const dateStr = ist.toISOString().split('T')[0]
  if ((NSE_HOLIDAYS_2026 as string[]).includes(dateStr)) return false

  const hours = ist.getHours()
  const minutes = ist.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  // Pre-open: 9:00 AM, Regular: 9:15 AM – 3:30 PM IST
  return timeInMinutes >= 555 && timeInMinutes <= 930
}

/**
 * Returns the appropriate cache TTL in seconds.
 * Short TTL during market hours, long TTL when closed.
 */
export function getCacheTTL(): number {
  return isMarketOpen() ? 25 : 3600
}

/** Returns a human-readable market status string. */
export function getMarketStatus(): { open: boolean; label: string } {
  const open = isMarketOpen()
  const ist = nowIST()
  const hours = ist.getHours()
  const minutes = ist.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  if (open) return { open: true, label: 'Market Open' }

  const day = ist.getDay()
  if (day === 0 || day === 6) return { open: false, label: 'Market Closed (Weekend)' }

  if (timeInMinutes < 555) return { open: false, label: 'Pre-Market' }
  return { open: false, label: 'Market Closed' }
}

/** Returns the next trading date as a string (YYYY-MM-DD). */
export function getNextTradingDate(): string {
  const ist = nowIST()
  const candidate = new Date(ist)

  for (let i = 1; i <= 7; i++) {
    candidate.setDate(ist.getDate() + i)
    const day = candidate.getDay()
    if (day === 0 || day === 6) continue
    const dateStr = candidate.toISOString().split('T')[0]
    if ((NSE_HOLIDAYS_2026 as string[]).includes(dateStr)) continue
    return dateStr
  }

  return '' // unreachable in practice
}
