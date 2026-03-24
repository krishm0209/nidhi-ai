'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addManualDeduction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const memberId = formData.get('memberId') as string
  const fyLabel = formData.get('fyLabel') as string
  const section = formData.get('section') as string
  const instrument = formData.get('instrument') as string
  const amount = parseFloat(formData.get('amount') as string)

  if (!memberId || !section || !instrument || isNaN(amount) || amount <= 0) {
    return { error: 'Invalid data' }
  }

  // Upsert — if same section+instrument already exists, update amount
  const { error } = await supabaseAdmin
    .from('tax_deductions')
    .upsert({
      member_id: memberId,
      financial_year: fyLabel,
      section,
      instrument,
      amount,
    }, {
      onConflict: 'member_id,financial_year,section,instrument',
      ignoreDuplicates: false,
    })

  if (error) return { error: error.message }

  revalidatePath('/tax/optimizer')
  return { success: true }
}
