'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const fullName = (formData.get('full_name') as string).trim()
    const phone = (formData.get('phone') as string).trim() || null
    const dateOfBirth = (formData.get('date_of_birth') as string) || null
    const riskProfile = (formData.get('risk_profile') as string) || null

    if (!fullName) {
      setError('Full name is required')
      setLoading(false)
      return
    }

    const supabase = createClient()

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, full_name: fullName, phone, date_of_birth: dateOfBirth, risk_profile: riskProfile })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name: `${fullName}'s Portfolio`, owner_id: userId })
      .select('id')
      .single()

    if (householdError || !household) {
      setError(householdError?.message ?? 'Failed to create household')
      setLoading(false)
      return
    }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({
        household_id: household.id,
        user_id: userId,
        name: fullName,
        relationship: 'self',
        date_of_birth: dateOfBirth,
        is_active: true,
        visibility: 'full',
      })

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
        >
          {loading ? 'Setting up…' : 'Get started'}
        </button>
      </form>
    </>
  )
}
