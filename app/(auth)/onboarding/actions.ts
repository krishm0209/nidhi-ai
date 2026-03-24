'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/login')
  }

  const fullName = (formData.get('full_name') as string).trim()
  const phone = (formData.get('phone') as string).trim() || null
  const dateOfBirth = (formData.get('date_of_birth') as string) || null
  const riskProfile = formData.get('risk_profile') as string || null

  // 1. Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      phone,
      date_of_birth: dateOfBirth,
      risk_profile: riskProfile,
    })

  if (profileError) {
    redirect(`/onboarding?error=${encodeURIComponent(profileError.message)}`)
  }

  // 2. Create default household
  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: `${fullName}'s Portfolio`, owner_id: user.id })
    .select('id')
    .single()

  if (householdError || !household) {
    redirect(`/onboarding?error=${encodeURIComponent(householdError?.message ?? 'Failed to create household')}`)
  }

  // 3. Create "self" household member
  const { error: memberError } = await supabase
    .from('household_members')
    .insert({
      household_id: household.id,
      user_id: user.id,
      name: fullName,
      relationship: 'self',
      date_of_birth: dateOfBirth,
      is_active: true,
      visibility: 'full',
    })

  if (memberError) {
    redirect(`/onboarding?error=${encodeURIComponent(memberError.message)}`)
  }

  redirect('/dashboard')
}
