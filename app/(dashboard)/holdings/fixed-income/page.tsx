import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { FixedIncomeForm } from './FixedIncomeForm'
import { FixedIncomeList } from './FixedIncomeList'

export default async function FixedIncomePage() {
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
        .from('fixed_income_holdings')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Fixed Income</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Add FDs, PPF, NPS, SSY, RDs, SCSS, SGBs, Bonds, LIC policies, and post office savings.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Add fixed income holding</h2>
        <FixedIncomeForm />
      </Card>

      {holdings && holdings.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your fixed income ({holdings.length})
            </h2>
          </div>
          <FixedIncomeList holdings={holdings} />
        </Card>
      )}
    </div>
  )
}
