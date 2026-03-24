import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { Card } from '@/components/ui/Card'
import { MFForm } from './MFForm'
import { MFList } from './MFList'
import type { MFHoldingEnriched } from '@/types/portfolio'

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

  const schemeCodes = (holdings ?? []).map((h) => h.scheme_code)
  const navs = await getMFNavs(schemeCodes)

  const enriched: MFHoldingEnriched[] = (holdings ?? []).map((h) => {
    const current_nav = navs[h.scheme_code] ?? h.purchase_nav ?? 0
    const invested_value = h.units * (h.purchase_nav ?? current_nav)
    const current_value = h.units * current_nav
    const gain_loss = current_value - invested_value
    const gain_loss_pct = invested_value > 0 ? (gain_loss / invested_value) * 100 : 0
    return { ...h, current_nav, current_value, invested_value, gain_loss, gain_loss_pct }
  })

  const totalInvested = enriched.reduce((s, h) => s + h.invested_value, 0)
  const totalCurrent = enriched.reduce((s, h) => s + h.current_value, 0)

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

      {enriched.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your mutual funds ({enriched.length})
            </h2>
            <div className="text-xs text-zinc-500">
              Current:{' '}
              <span className="font-medium text-zinc-800">
                ₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              {'  '}Invested:{' '}
              <span className="font-medium text-zinc-800">
                ₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          <MFList holdings={enriched} />
        </Card>
      )}
    </div>
  )
}
