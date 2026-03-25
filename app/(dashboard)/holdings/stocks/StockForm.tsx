'use client'

import { useActionState, useEffect } from 'react'
import { addStock } from './actions'
import { toast } from '@/components/ui/Toaster'

const initialState = { error: undefined as string | undefined, success: false }

export function StockForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await addStock(formData)
      return result as typeof initialState
    },
    initialState
  )

  useEffect(() => {
    if (state.success) toast('Stock added successfully')
    if (state.error) toast(state.error, 'error')
  }, [state])

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {state?.error && (
        <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Symbol <span className="text-red-500">*</span>
        </label>
        <input
          name="symbol"
          required
          placeholder="e.g. RELIANCE"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 uppercase placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Exchange</label>
        <select
          name="exchange"
          defaultValue="NSE"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Quantity <span className="text-red-500">*</span>
        </label>
        <input
          name="quantity"
          type="number"
          required
          min={1}
          placeholder="100"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Avg. Buy Price (₹) <span className="text-red-500">*</span>
        </label>
        <input
          name="average_price"
          type="number"
          required
          min={0}
          step={0.01}
          placeholder="2500.00"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Purchase Date</label>
        <input
          name="purchase_date"
          type="date"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Broker</label>
        <select
          name="broker_source"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Select broker</option>
          <option value="groww">Groww</option>
          <option value="zerodha">Zerodha</option>
          <option value="angel_one">Angel One</option>
          <option value="upstox">Upstox</option>
          <option value="icici_direct">ICICI Direct</option>
          <option value="hdfc_sky">HDFC Sky</option>
          <option value="manual">Manual entry</option>
        </select>
      </div>

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add stock'}
        </button>
      </div>
    </form>
  )
}
