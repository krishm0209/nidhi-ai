import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createProfile } from './actions'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Already completed onboarding?
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (profile) redirect('/dashboard')

  const { error } = await searchParams

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
      <h2 className="text-xl font-semibold text-zinc-900 mb-2">Complete your profile</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Just a few details to personalise your experience.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={createProfile} className="space-y-4">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-zinc-700 mb-1">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoFocus
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Ravi Sharma"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1">
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="+91 98765 43210"
          />
        </div>

        <div>
          <label htmlFor="date_of_birth" className="block text-sm font-medium text-zinc-700 mb-1">
            Date of birth
          </label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="risk_profile" className="block text-sm font-medium text-zinc-700 mb-1">
            Risk appetite
          </label>
          <select
            id="risk_profile"
            name="risk_profile"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
          >
            <option value="">Select risk profile</option>
            <option value="conservative">Conservative — capital preservation first</option>
            <option value="moderate">Moderate — balanced growth and safety</option>
            <option value="aggressive">Aggressive — maximum long-term growth</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
        >
          Get started
        </button>
      </form>
    </div>
  )
}
