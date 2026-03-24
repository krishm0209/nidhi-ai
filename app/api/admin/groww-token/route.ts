import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redis } from '@/lib/cache/redis'

const REDIS_KEY = 'groww:access_token'

// Only you can call this — checks that the logged-in user is the admin
const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { token } = await request.json()
  if (!token || typeof token !== 'string' || token.length < 20) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  // Cache until 6 AM IST tomorrow (same TTL as auto-rotation)
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const reset = new Date(ist)
  reset.setHours(6, 0, 0, 0)
  if (ist >= reset) reset.setDate(reset.getDate() + 1)
  const ttl = Math.floor((reset.getTime() - ist.getTime()) / 1000)

  await redis.set(REDIS_KEY, token, { ex: ttl })

  return NextResponse.json({ ok: true })
}
