'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function addCrypto(formData: FormData) {
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

  const { error } = await supabase.from('crypto_holdings').insert({
    member_id: member.id,
    coin_id: (formData.get('coin_id') as string).toLowerCase().trim(),
    coin_symbol: (formData.get('coin_symbol') as string).toUpperCase().trim(),
    quantity: parseFloat(formData.get('quantity') as string),
    average_price_inr: parseFloat(formData.get('average_price_inr') as string),
    exchange_source: (formData.get('exchange_source') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/holdings/crypto')
  return { success: true }
}

export async function deleteCrypto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('crypto_holdings').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/holdings/crypto')
  return { success: true }
}
