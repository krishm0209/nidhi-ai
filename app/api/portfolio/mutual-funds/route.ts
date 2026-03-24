import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('relationship', 'self')
    .single()

  if (!member) {
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await supabase
    .from('mf_holdings')
    .select('*')
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('relationship', 'self')
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const body = await request.json()

  // Batch import (from CAS parser)
  if (Array.isArray(body.batch)) {
    const rows = body.batch.map((h: Record<string, unknown>) => ({ ...h, member_id: member.id }))
    const { error } = await supabase.from('mf_holdings').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    // Mark CAS as imported this month so the reminder banner clears
    await supabase.from('profiles').update({ last_cas_import_at: new Date().toISOString() }).eq('id', user.id)
    return NextResponse.json({ count: rows.length }, { status: 201 })
  }

  // Single insert
  const { data, error } = await supabase
    .from('mf_holdings')
    .insert({ ...body, member_id: member.id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await request.json()
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await supabase.from('mf_holdings').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
