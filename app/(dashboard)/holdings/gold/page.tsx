import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { GoldForm } from './GoldForm'
import { GoldList } from './GoldList'

export default async function GoldPage() {
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
        .from('gold_holdings')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Gold</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Add physical gold, digital gold, SGBs, Gold ETFs, and Gold mutual funds.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Add gold holding</h2>
        <GoldForm />
      </Card>

      {holdings && holdings.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your gold ({holdings.length})
            </h2>
          </div>
          <GoldList holdings={holdings} />
        </Card>
      )}
    </div>
  )
}
