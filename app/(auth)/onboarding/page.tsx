import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  if (profile?.full_name) redirect('/dashboard')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
      <h2 className="text-xl font-semibold text-zinc-900 mb-2">Complete your profile</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Just a few details to personalise your experience.
      </p>
      <OnboardingForm userId={user.id} />
    </div>
  )
}
