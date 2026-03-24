import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMFNavs } from '@/lib/market/mf'
import { getCryptoPricesINR } from '@/lib/market/crypto'
import { getStockPrices } from '@/lib/market/stocks'
import { Card } from '@/components/ui/Card'
import { AllocationPie } from '@/components/charts/AllocationPie'
import { formatINR } from '@/lib/utils/format'
import { Users, TrendingUp, TrendingDown, Trash2, AlertTriangle } from 'lucide-react'
import { AddMemberDialog } from './AddMemberDialog'
import { deleteFamilyMember } from './actions'
import type { AllocationSlice } from '@/components/charts/AllocationPie'

const ASSET_COLORS = {
  Stocks: '#10b981',
  'Mutual Funds': '#3b82f6',
  Crypto: '#f97316',
  'Fixed Income': '#8b5cf6',
  Gold: '#eab308',
}

const GOLD_PRICE_PER_GRAM = 8000 // approx fallback

interface MemberNetWorth {
  id: string
  name: string
  relationship: string
  isSelf: boolean
  stocks: number
  mf: number
  crypto: number
  fi: number
  gold: number
  total: number
}

function RelationshipBadge({ rel }: { rel: string }) {
  const label = rel === 'self' ? 'You' : rel.charAt(0).toUpperCase() + rel.slice(1)
  const colors: Record<string, string> = {
    self: 'bg-emerald-100 text-emerald-700',
    spouse: 'bg-blue-100 text-blue-700',
    parent: 'bg-violet-100 text-violet-700',
    child: 'bg-orange-100 text-orange-700',
    sibling: 'bg-yellow-100 text-yellow-700',
    grandparent: 'bg-zinc-100 text-zinc-600',
    other: 'bg-zinc-100 text-zinc-600',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[rel] ?? colors.other}`}>
      {label}
    </span>
  )
}

function DeleteButton({ memberId }: { memberId: string }) {
  async function action() {
    'use server'
    await deleteFamilyMember(memberId)
  }
  return (
    <form action={action}>
      <button
        type="submit"
        className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
        title="Remove member"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  )
}

export default async function HouseholdPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get the household
  const { data: selfMember } = await supabaseAdmin
    .from('household_members')
    .select('id, household_id')
    .eq('user_id', user!.id)
    .eq('relationship', 'self')
    .single()

  if (!selfMember) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Family</h1>
        <p className="text-sm text-zinc-500">No household found. Please complete onboarding first.</p>
      </div>
    )
  }

  // Get all members in the household
  const { data: members } = await supabaseAdmin
    .from('household_members')
    .select('id, name, relationship, date_of_birth, user_id')
    .eq('household_id', selfMember.household_id)
    .order('created_at', { ascending: true })

  const allMembers = members ?? []

  // Fetch all holdings for all members in parallel
  const memberIds = allMembers.map((m) => m.id)

  const [stocksRows, mfRows, cryptoRows, fiRows, goldRows] = await Promise.all([
    supabaseAdmin.from('stock_holdings').select('member_id, symbol, exchange, quantity, average_price').in('member_id', memberIds),
    supabaseAdmin.from('mf_holdings').select('member_id, scheme_code, scheme_name, units, purchase_nav').in('member_id', memberIds),
    supabaseAdmin.from('crypto_holdings').select('member_id, coin_id, quantity, average_price_inr').in('member_id', memberIds),
    supabaseAdmin.from('fixed_income_holdings').select('member_id, principal, current_value').in('member_id', memberIds),
    supabaseAdmin.from('gold_holdings').select('member_id, form, weight_grams, purchase_price_per_gram, units, purchase_nav').in('member_id', memberIds),
  ])

  const stocks = stocksRows.data ?? []
  const mfs = mfRows.data ?? []
  const cryptos = cryptoRows.data ?? []
  const fis = fiRows.data ?? []
  const golds = goldRows.data ?? []

  // Batch-fetch all prices
  const uniqueTickers = [...new Set(stocks.map((s) => `${s.exchange}:${s.symbol}`))]
    .map((k) => { const [exchange, symbol] = k.split(':'); return { symbol, exchange: exchange as 'NSE' | 'BSE' } })
  const uniqueSchemeCodes = [...new Set(mfs.map((m) => m.scheme_code))]
  const uniqueCoinIds = [...new Set(cryptos.map((c) => c.coin_id))]

  const [stockPrices, mfNavs, cryptoPrices] = await Promise.all([
    getStockPrices(uniqueTickers),
    getMFNavs(uniqueSchemeCodes),
    getCryptoPricesINR(uniqueCoinIds),
  ])

  // Compute per-member net worth
  const memberNetWorth: MemberNetWorth[] = allMembers.map((m) => {
    const stocksValue = stocks
      .filter((s) => s.member_id === m.id)
      .reduce((sum, s) => {
        const price = stockPrices[`${s.exchange}:${s.symbol}`]?.ltp ?? s.average_price
        return sum + price * s.quantity
      }, 0)

    const mfValue = mfs
      .filter((f) => f.member_id === m.id)
      .reduce((sum, f) => {
        const nav = mfNavs[f.scheme_code] ?? f.purchase_nav ?? 0
        return sum + nav * f.units
      }, 0)

    const cryptoValue = cryptos
      .filter((c) => c.member_id === m.id)
      .reduce((sum, c) => {
        const price = cryptoPrices[c.coin_id] ?? c.average_price_inr
        return sum + price * c.quantity
      }, 0)

    const fiValue = fis
      .filter((f) => f.member_id === m.id)
      .reduce((sum, f) => sum + (f.current_value ?? f.principal), 0)

    const goldValue = golds
      .filter((g) => g.member_id === m.id)
      .reduce((sum, g) => {
        if (g.weight_grams) return sum + g.weight_grams * GOLD_PRICE_PER_GRAM
        if (g.units && g.purchase_nav) return sum + g.units * g.purchase_nav
        return sum
      }, 0)

    return {
      id: m.id,
      name: m.name,
      relationship: m.relationship,
      isSelf: m.user_id === user!.id,
      stocks: stocksValue,
      mf: mfValue,
      crypto: cryptoValue,
      fi: fiValue,
      gold: goldValue,
      total: stocksValue + mfValue + cryptoValue + fiValue + goldValue,
    }
  })

  const householdTotal = memberNetWorth.reduce((s, m) => s + m.total, 0)

  // Household-level allocation
  const householdStocks = memberNetWorth.reduce((s, m) => s + m.stocks, 0)
  const householdMF = memberNetWorth.reduce((s, m) => s + m.mf, 0)
  const householdCrypto = memberNetWorth.reduce((s, m) => s + m.crypto, 0)
  const householdFI = memberNetWorth.reduce((s, m) => s + m.fi, 0)
  const householdGold = memberNetWorth.reduce((s, m) => s + m.gold, 0)

  const allocationSlices: AllocationSlice[] = [
    { name: 'Stocks', value: householdStocks, color: ASSET_COLORS.Stocks, pct: householdTotal > 0 ? householdStocks / householdTotal * 100 : 0 },
    { name: 'Mutual Funds', value: householdMF, color: ASSET_COLORS['Mutual Funds'], pct: householdTotal > 0 ? householdMF / householdTotal * 100 : 0 },
    { name: 'Crypto', value: householdCrypto, color: ASSET_COLORS.Crypto, pct: householdTotal > 0 ? householdCrypto / householdTotal * 100 : 0 },
    { name: 'Fixed Income', value: householdFI, color: ASSET_COLORS['Fixed Income'], pct: householdTotal > 0 ? householdFI / householdTotal * 100 : 0 },
    { name: 'Gold', value: householdGold, color: ASSET_COLORS.Gold, pct: householdTotal > 0 ? householdGold / householdTotal * 100 : 0 },
  ].filter((s) => s.value > 0)

  // Cross-member duplicate detection
  // Stocks: same symbol across 2+ members
  const stockBySymbol = new Map<string, string[]>()
  for (const s of stocks) {
    const member = allMembers.find((m) => m.id === s.member_id)
    if (!member) continue
    const key = `${s.exchange}:${s.symbol}`
    if (!stockBySymbol.has(key)) stockBySymbol.set(key, [])
    stockBySymbol.get(key)!.push(member.name)
  }
  const duplicateStocks = [...stockBySymbol.entries()].filter(([, names]) => names.length > 1)

  // MFs: same scheme_code across 2+ members
  const mfByScheme = new Map<number, { name: string; memberNames: string[] }>()
  for (const f of mfs as (typeof mfs[0] & { scheme_name?: string })[]) {
    const member = allMembers.find((m) => m.id === f.member_id)
    if (!member) continue
    if (!mfByScheme.has(f.scheme_code)) {
      mfByScheme.set(f.scheme_code, { name: f.scheme_name ?? String(f.scheme_code), memberNames: [] })
    }
    mfByScheme.get(f.scheme_code)!.memberNames.push(member.name)
  }
  const duplicateMFs = [...mfByScheme.entries()].filter(([, v]) => v.memberNames.length > 1)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Family Portfolio</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Combined net worth across {allMembers.length} member{allMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <AddMemberDialog />
      </div>

      {/* Household summary */}
      {householdTotal > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Total Household Net Worth</p>
            <p className="text-3xl font-bold text-zinc-900">{formatINR(householdTotal)}</p>
            <p className="text-sm text-zinc-400 mt-0.5">{allMembers.length} member{allMembers.length !== 1 ? 's' : ''}</p>
          </Card>
          {allocationSlices.length > 0 && (
            <Card>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Household Allocation</p>
              <AllocationPie data={allocationSlices} size="sm" />
            </Card>
          )}
        </div>
      )}

      {/* Member cards */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Members</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {memberNetWorth.map((m) => (
            <Card key={m.id} padding="none">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-zinc-600">
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-zinc-900 text-sm">{m.name}</span>
                        <RelationshipBadge rel={m.relationship} />
                      </div>
                    </div>
                  </div>
                  {!m.isSelf && (
                    <DeleteButton memberId={m.id} />
                  )}
                </div>

                <p className="text-2xl font-semibold text-zinc-900 mb-3">
                  {formatINR(m.total)}
                </p>

                {m.total > 0 && (
                  <div className="space-y-1.5">
                    {[
                      { label: 'Stocks', value: m.stocks, color: ASSET_COLORS.Stocks },
                      { label: 'Mutual Funds', value: m.mf, color: ASSET_COLORS['Mutual Funds'] },
                      { label: 'Crypto', value: m.crypto, color: ASSET_COLORS.Crypto },
                      { label: 'Fixed Income', value: m.fi, color: ASSET_COLORS['Fixed Income'] },
                      { label: 'Gold', value: m.gold, color: ASSET_COLORS.Gold },
                    ]
                      .filter((row) => row.value > 0)
                      .map((row) => (
                        <div key={row.label} className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: row.color }} />
                          <span className="text-zinc-500 flex-1">{row.label}</span>
                          <span className="font-medium text-zinc-700">{formatINR(row.value)}</span>
                          <span className="text-zinc-400 w-12 text-right">
                            {m.total > 0 ? `${(row.value / m.total * 100).toFixed(0)}%` : '—'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {m.total === 0 && (
                  <p className="text-sm text-zinc-400">No holdings added yet.</p>
                )}
              </div>

              {/* Share of household */}
              {householdTotal > 0 && m.total > 0 && (
                <div className="px-5 py-2 border-t border-zinc-50 bg-zinc-50 rounded-b-xl">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Share of household</span>
                    <span className="font-medium text-zinc-600">
                      {(m.total / householdTotal * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${(m.total / householdTotal * 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Cross-member duplicates */}
      {(duplicateStocks.length > 0 || duplicateMFs.length > 0) && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Duplicate Holdings</h2>
            <span className="text-xs text-zinc-400">Same asset held by multiple family members</span>
          </div>
          <div className="divide-y divide-zinc-50">
            {duplicateStocks.map(([symbol, names]) => (
              <div key={symbol} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-zinc-800">{symbol.split(':')[1]}</span>
                  <span className="ml-2 text-xs text-zinc-400">Stock · {symbol.split(':')[0]}</span>
                </div>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {names.join(', ')}
                </span>
              </div>
            ))}
            {duplicateMFs.map(([code, { name, memberNames }]) => (
              <div key={code} className="px-5 py-3 flex items-center justify-between text-sm gap-4">
                <span className="font-medium text-zinc-800 truncate">{name}</span>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                  {memberNames.join(', ')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
