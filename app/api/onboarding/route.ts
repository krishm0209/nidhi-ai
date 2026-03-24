import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { fullName, phone, dateOfBirth, riskProfile } = await request.json()

  const admin = createAdmin()

  // Upsert profile
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: user.id, full_name: fullName, phone, date_of_birth: dateOfBirth, risk_profile: riskProfile })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Create household
  const { data: household, error: householdError } = await admin
    .from('households')
    .insert({ name: `${fullName}'s Portfolio`, owner_id: user.id })
    .select('id')
    .single()

  if (householdError || !household) {
    return NextResponse.json({ error: householdError?.message ?? 'Failed to create household' }, { status: 500 })
  }

  // Create self member
  const { error: memberError } = await admin
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
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
