import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { StockForm } from './StockForm'
import { StockList } from './StockList'
import type { StockHolding } from '@/types/portfolio'

export default async function StocksPage() {
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
        .from('stock_holdings')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const raw: StockHolding[] = (holdings ?? []) as StockHolding[]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Stocks</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Add and manage your NSE/BSE stock holdings.</p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Add stock holding</h2>
        <StockForm />
      </Card>

      {raw.length > 0 && (
        <Card padding="none">
          <StockList holdings={raw} />
        </Card>
      )}
    </div>
  )
}
