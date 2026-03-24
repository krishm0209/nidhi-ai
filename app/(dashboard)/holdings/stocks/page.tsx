import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getStockPrices } from '@/lib/market/stocks'
import { Card } from '@/components/ui/Card'
import { StockForm } from './StockForm'
import { StockList } from './StockList'
import type { StockHoldingEnriched } from '@/types/portfolio'

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

  const tickers = (holdings ?? []).map((h) => ({
    symbol: h.symbol,
    exchange: h.exchange as 'NSE' | 'BSE',
  }))
  const prices = await getStockPrices(tickers)

  const enriched: StockHoldingEnriched[] = (holdings ?? []).map((h) => {
    const quote = prices[`${h.exchange}:${h.symbol}`]
    const current_price = quote?.ltp ?? h.average_price
    const invested_value = h.average_price * h.quantity
    const current_value = current_price * h.quantity
    const gain_loss = current_value - invested_value
    const gain_loss_pct = invested_value > 0 ? (gain_loss / invested_value) * 100 : 0
    return {
      ...h,
      current_price,
      current_value,
      invested_value,
      gain_loss,
      gain_loss_pct,
      day_change_pct: quote?.day_change_pct ?? 0,
    }
  })

  const totalInvested = enriched.reduce((s, h) => s + h.invested_value, 0)
  const totalCurrent = enriched.reduce((s, h) => s + h.current_value, 0)

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

      {enriched.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your stocks ({enriched.length})
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
          <StockList holdings={enriched} />
        </Card>
      )}
    </div>
  )
}
