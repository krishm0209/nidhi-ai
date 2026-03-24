'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function addGold(formData: FormData) {
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

  const form = formData.get('form') as string
  const isWeightBased = form === 'physical' || form === 'digital'

  const { error } = await supabase.from('gold_holdings').insert({
    member_id: member.id,
    form,
    weight_grams: isWeightBased ? parseFloat(formData.get('weight_grams') as string) || null : null,
    purchase_price_per_gram: isWeightBased ? parseFloat(formData.get('purchase_price_per_gram') as string) || null : null,
    units: !isWeightBased ? parseFloat(formData.get('units') as string) || null : null,
    purchase_nav: !isWeightBased ? parseFloat(formData.get('purchase_nav') as string) || null : null,
    notes: (formData.get('notes') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/holdings/gold')
  return { success: true }
}

export async function deleteGold(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('gold_holdings').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/holdings/gold')
  return { success: true }
}
