import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { AdvisorClient } from './AdvisorClient'

export default async function AdvisorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <div className="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)]">
      <AdvisorClient initialSessions={sessions ?? []} />
    </div>
  )
}
