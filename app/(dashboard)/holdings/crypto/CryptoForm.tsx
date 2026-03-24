'use client'

import { useActionState, useEffect } from 'react'
import { addCrypto } from './actions'
import { toast } from '@/components/ui/Toaster'

const POPULAR_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
]

const initialState = { error: undefined as string | undefined, success: false }

export function CryptoForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await addCrypto(formData)
      return result as typeof initialState
    },
    initialState
  )

  useEffect(() => {
    if (state.success) toast('Crypto holding added successfully')
    if (state.error) toast(state.error, 'error')
  }, [state])

  return (
    <form action={formAction} className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {state?.error && (
        <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Coin <span className="text-red-500">*</span>
        </label>
        <select
          name="coin_id"
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          defaultValue=""
        >
          <option value="" disabled>Select coin</option>
          {POPULAR_COINS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.symbol})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-400">
          Not listed? Use the CoinGecko ID in the symbol field below.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Symbol (or CoinGecko ID) <span className="text-red-500">*</span>
        </label>
        <input
          name="coin_symbol"
          required
          placeholder="BTC"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Quantity <span className="text-red-500">*</span>
        </label>
        <input
          name="quantity"
          type="number"
          required
          min={0}
          step="any"
          placeholder="0.5"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Avg. Buy Price (₹) <span className="text-red-500">*</span>
        </label>
        <input
          name="average_price_inr"
          type="number"
          required
          min={0}
          step={0.01}
          placeholder="5000000"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Exchange</label>
        <select
          name="exchange_source"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Select exchange</option>
          <option value="wazirx">WazirX</option>
          <option value="coindcx">CoinDCX</option>
          <option value="zebpay">ZebPay</option>
          <option value="bitbns">BitBNS</option>
          <option value="binance">Binance</option>
          <option value="coinbase">Coinbase</option>
          <option value="manual">Manual entry</option>
        </select>
      </div>

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add crypto'}
        </button>
      </div>
    </form>
  )
}
