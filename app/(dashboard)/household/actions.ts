'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addFamilyMember(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: household } = await supabaseAdmin
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!household) return { error: 'No household found' }

  const name = formData.get('name') as string
  const relationship = formData.get('relationship') as string
  const dob = formData.get('date_of_birth') as string | null

  if (!name || !relationship) return { error: 'Name and relationship are required' }

  const { error } = await supabaseAdmin.from('household_members').insert({
    household_id: household.id,
    name,
    relationship,
    date_of_birth: dob || null,
    is_active: false,
  })

  if (error) return { error: error.message }

  revalidatePath('/household')
  return { success: true }
}

export async function deleteFamilyMember(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify member belongs to user's household
  const { data: member } = await supabaseAdmin
    .from('household_members')
    .select('relationship, household_id')
    .eq('id', memberId)
    .single()

  if (!member) return { error: 'Member not found' }
  if (member.relationship === 'self') return { error: 'Cannot delete yourself' }

  const { error } = await supabaseAdmin
    .from('household_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/household')
  return { success: true }
}
