'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function addStock(formData: FormData) {
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

  const { error } = await supabase.from('stock_holdings').insert({
    member_id: member.id,
    symbol: (formData.get('symbol') as string).toUpperCase().trim(),
    exchange: formData.get('exchange') as string,
    quantity: parseInt(formData.get('quantity') as string, 10),
    average_price: parseFloat(formData.get('average_price') as string),
    purchase_date: (formData.get('purchase_date') as string) || null,
    broker_source: (formData.get('broker_source') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/holdings/stocks')
  return { success: true }
}

export async function deleteStock(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('stock_holdings').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/holdings/stocks')
  return { success: true }
}
