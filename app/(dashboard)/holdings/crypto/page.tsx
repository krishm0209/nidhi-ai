import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'
import { CryptoForm } from './CryptoForm'
import { CryptoList } from './CryptoList'
import type { CryptoHolding } from '@/types/portfolio'

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

  const raw: CryptoHolding[] = (holdings ?? []) as CryptoHolding[]

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

      {raw.length > 0 && (
        <Card padding="none">
          <CryptoList holdings={raw} />
        </Card>
      )}
    </div>
  )
}
