'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function addMF(formData: FormData) {
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

  const isSip = formData.get('is_sip') === 'on'
  const sipAmount = isSip ? parseFloat(formData.get('sip_amount') as string) : null
  const sipDate = isSip ? parseInt(formData.get('sip_date') as string, 10) : null

  const purchaseDateRaw = (formData.get('purchase_date') as string).trim()

  const { error } = await supabase.from('mf_holdings').insert({
    member_id: member.id,
    scheme_code: parseInt(formData.get('scheme_code') as string, 10),
    scheme_name: (formData.get('scheme_name') as string).trim(),
    folio_number: (formData.get('folio_number') as string).trim() || null,
    units: parseFloat(formData.get('units') as string),
    purchase_nav: parseFloat(formData.get('purchase_nav') as string) || null,
    purchase_date: purchaseDateRaw || null,
    fund_type: (formData.get('fund_type') as string) || null,
    is_sip: isSip,
    sip_amount: sipAmount,
    sip_date: sipDate,
  })

  if (error) return { error: error.message }

  revalidatePath('/holdings/mutual-funds')
  return { success: true }
}

export async function updateMF(id: string, units: number, purchaseNav: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('mf_holdings')
    .update({ units, purchase_nav: purchaseNav })
    .eq('id', id)
  if (error) return { error: error.message }

  // Mark portfolio as updated this month so SIP reminder banner dismisses
  if (user) {
    await supabase
      .from('profiles')
      .update({ last_cas_import_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  revalidatePath('/holdings/mutual-funds')
  revalidatePath('/')
  return { success: true }
}

export async function deleteMF(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('mf_holdings').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/holdings/mutual-funds')
  return { success: true }
}
