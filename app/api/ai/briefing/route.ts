import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateBriefing } from '@/lib/ai/briefing'
import { rateLimit } from '@/lib/rate-limit'

const CACHE_TABLE = 'price_cache' // reuse existing table with a special key won't work cleanly
// We'll store briefings in a simple JSONB blob keyed by user_id + date in xray_scores for now
// Actually: we'll just generate on demand and cache for 6 hours via the response

export async function GET(req: NextRequest) {
  // Allow Vercel Cron (CRON_SECRET) or authenticated user
  const isCron = req.headers.get('Authorization') === `Bearer ${process.env.CRON_SECRET}`

  if (isCron) {
    // Run for all active users
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 })
    let count = 0
    for (const user of users.users) {
      await generateBriefing(user.id)
      count++
    }
    return NextResponse.json({ generated: count })
  }

  // Authenticated user — generate for self
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(`briefing:${user.id}`, 5, 3600) // 5 per hour
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const briefing = await generateBriefing(user.id)
  if (!briefing) return NextResponse.json({ error: 'Could not generate briefing' }, { status: 500 })

  return NextResponse.json(briefing, {
    headers: {
      'Cache-Control': 'private, max-age=21600', // cache 6h in browser
    },
  })
}
