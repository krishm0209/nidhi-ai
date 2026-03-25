import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { MFForm } from './MFForm'
import { MFList } from './MFList'
import type { MFHolding } from '@/types/portfolio'

export default async function MutualFundsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: member } = await supabaseAdmin
    .from('household_members')
    .select('id')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  const { data: holdings } = member
    ? await supabase
        .from('mf_holdings')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const raw: MFHolding[] = (holdings ?? []) as MFHolding[]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Mutual Funds</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Add and manage your mutual fund holdings. Use the AMFI scheme code for each fund.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Add mutual fund holding</h2>
        <MFForm />
      </Card>

      {raw.length > 0 && (
        <Card padding="none">
          <MFList holdings={raw} />
        </Card>
      )}
    </div>
  )
}
