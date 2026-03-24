'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function addFixedIncome(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('relationship', 'self')
    .single()

  if (!member) return { error: 'Member not found' }

  const currentValueStr = formData.get('current_value') as string
  const interestRateStr = formData.get('interest_rate') as string
  const npsEquityPctStr = formData.get('nps_equity_pct') as string

  const { error } = await supabase.from('fixed_income_holdings').insert({
    member_id: member.id,
    instrument_type: formData.get('instrument_type') as string,
    institution: (formData.get('institution') as string).trim() || null,
    principal: parseFloat(formData.get('principal') as string),
    interest_rate: interestRateStr ? parseFloat(interestRateStr) : null,
    maturity_date: (formData.get('maturity_date') as string) || null,
    current_value: currentValueStr ? parseFloat(currentValueStr) : null,
    nps_equity_pct: npsEquityPctStr ? parseInt(npsEquityPctStr, 10) : 0,
    notes: (formData.get('notes') as string).trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/holdings/fixed-income')
  return { success: true }
}

export async function deleteFixedIncome(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('fixed_income_holdings').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/holdings/fixed-income')
  return { success: true }
}
