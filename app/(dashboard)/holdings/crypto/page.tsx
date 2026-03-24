import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { Card } from '@/components/ui/Card'
import { CryptoForm } from './CryptoForm'
import { CryptoList } from './CryptoList'
import type { CryptoHoldingEnriched } from '@/types/portfolio'

export default async function CryptoPage() {
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
        .from('crypto_holdings')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const coinIds = (holdings ?? []).map((h) => h.coin_id)
  const prices = await getCryptoPricesINR(coinIds)

  const enriched: CryptoHoldingEnriched[] = (holdings ?? []).map((h) => {
    const current_price_inr = prices[h.coin_id] ?? h.average_price_inr
    const invested_value = h.quantity * h.average_price_inr
    const current_value = h.quantity * current_price_inr
    const gain_loss = current_value - invested_value
    const gain_loss_pct = invested_value > 0 ? (gain_loss / invested_value) * 100 : 0
    return { ...h, current_price_inr, current_value, invested_value, gain_loss, gain_loss_pct }
  })

  const totalInvested = enriched.reduce((s, h) => s + h.invested_value, 0)
  const totalCurrent = enriched.reduce((s, h) => s + h.current_value, 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Crypto</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Add your crypto holdings. Use the CoinGecko ID (e.g. <code>bitcoin</code>, <code>ethereum</code>).
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Add crypto holding</h2>
        <CryptoForm />
      </Card>

      {enriched.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your crypto ({enriched.length})
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
          <CryptoList holdings={enriched} />
        </Card>
      )}
    </div>
  )
}
