import { createClient } from '@supabase/supabase-js'

// Service role client — never expose to the browser.
// Use only in server-side cron jobs or trusted server actions.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
