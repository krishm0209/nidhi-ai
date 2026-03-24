/**
 * Groww Trade API — access token provider with auto-rotation.
 *
 * Token lifecycle:
 *   - Daily access token expires at 6:00 AM IST
 *   - GROWW_API_KEY is a long-lived TOTP JWT used to generate daily tokens
 *   - On first call each day: POST to Groww auth → cache access token in Redis
 *   - Subsequent calls: read from Redis (no network request)
 *   - Cron at 6:05 AM IST forces a fresh token for the new day
 *
 * Required env vars:
 *   GROWW_API_KEY      — long-lived TOTP JWT from Groww dashboard
 *   GROWW_ACCESS_TOKEN — fallback: manually copied daily token
 */

import { redis } from '@/lib/cache/redis'

const REDIS_KEY = 'groww:access_token'
const GROWW_AUTH_URL = 'https://api.groww.in/v1/login/trading/public/v2/validate/totp'

/** Seconds until 6:00 AM IST tomorrow — aligns with Groww's daily reset. */
function secondsUntilNextReset(): number {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const reset = new Date(ist)
  reset.setHours(6, 0, 0, 0)
  if (ist >= reset) reset.setDate(reset.getDate() + 1)
  return Math.floor((reset.getTime() - ist.getTime()) / 1000)
}

/** Call Groww auth endpoint using the TOTP JWT to get a daily access token. */
async function fetchFreshToken(): Promise<string | null> {
  const totpJwt = process.env.GROWW_API_KEY
  if (!totpJwt) return null

  try {
    const res = await fetch(GROWW_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${totpJwt}`,
      },
      body: JSON.stringify({}),
    })

    if (!res.ok) {
      console.error('[groww-auth] auth endpoint returned', res.status, await res.text())
      return null
    }

    const json = await res.json()
    // Groww returns access_token inside payload or at root — handle both
    const token: string | null = json?.payload?.access_token ?? json?.access_token ?? null

    if (token) {
      const ttl = secondsUntilNextReset()
      await redis.set(REDIS_KEY, token, { ex: ttl })
      console.log(`[groww-auth] new token cached for ${Math.round(ttl / 3600)}h`)
    } else {
      console.error('[groww-auth] no access_token in response:', JSON.stringify(json))
    }

    return token
  } catch (err) {
    console.error('[groww-auth] failed to fetch token:', err)
    return null
  }
}

/**
 * Returns a valid Groww access token.
 * Priority: Redis cache (set via /admin) → env fallback
 *
 * Note: auto-rotation via fetchFreshToken() is disabled until Groww
 * publishes a public auth endpoint. Use /admin to update the token daily.
 */
export async function getGrowwAccessToken(): Promise<string | null> {
  // 1. Try Redis cache first — set manually via /admin page
  try {
    const cached = await redis.get<string>(REDIS_KEY)
    if (cached) return cached
  } catch {
    // Redis unavailable — fall through
  }

  // 2. Env var fallback
  return process.env.GROWW_ACCESS_TOKEN ?? null
}

/**
 * Force-refresh the token — called by the daily cron at 6:05 AM IST.
 */
export async function rotateGrowwToken(): Promise<boolean> {
  try {
    await redis.del(REDIS_KEY)
  } catch {
    // ignore
  }
  const token = await fetchFreshToken()
  return token !== null
}
