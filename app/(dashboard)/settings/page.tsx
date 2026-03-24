import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, created_at')
    .eq('id', user!.id)
    .single()

  return (
    <SettingsClient
      userId={user!.id}
      email={user!.email ?? ''}
      fullName={profile?.full_name ?? ''}
      createdAt={profile?.created_at ?? ''}
    />
  )
}
