'use client'

import { useActionState, useState, useEffect } from 'react'
import { addGold } from './actions'
import { toast } from '@/components/ui/Toaster'

const initialState = { error: undefined as string | undefined, success: false }

export function GoldForm() {
  const [form, setForm] = useState<string>('physical')
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await addGold(formData)
      return result as typeof initialState
    },
    initialState,
  )

  useEffect(() => {
    if (state.success) toast('Gold holding added successfully')
    if (state.error) toast(state.error, 'error')
  }, [state])

  const isWeightBased = form === 'physical' || form === 'digital'

  return (
    <form action={formAction} className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {state?.error && (
        <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Form <span className="text-red-500">*</span>
        </label>
        <select
          name="form"
          required
          value={form}
          onChange={(e) => setForm(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="physical">Physical Gold</option>
          <option value="digital">Digital Gold</option>
          <option value="sgb">Sovereign Gold Bond (SGB)</option>
          <option value="gold_etf">Gold ETF</option>
          <option value="gold_mf">Gold Mutual Fund</option>
        </select>
      </div>

      {isWeightBased ? (
        <>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Weight (grams) <span className="text-red-500">*</span>
            </label>
            <input
              name="weight_grams"
              type="number"
              required
              min={0}
              step="any"
              placeholder="10"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Purchase Price / gram (₹) <span className="text-red-500">*</span>
            </label>
            <input
              name="purchase_price_per_gram"
              type="number"
              required
              min={0}
              step={0.01}
              placeholder="6500"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Units <span className="text-red-500">*</span>
            </label>
            <input
              name="units"
              type="number"
              required
              min={0}
              step="any"
              placeholder="10"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {form === 'sgb' && (
              <p className="mt-1 text-xs text-zinc-400">Each SGB unit = 1 gram of gold</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Purchase NAV / Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              name="purchase_nav"
              type="number"
              required
              min={0}
              step={0.01}
              placeholder="5000"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </>
      )}

      <div className="col-span-full md:col-span-1">
        <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
        <input
          name="notes"
          type="text"
          placeholder="Jewellery, bank locker, etc."
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add gold'}
        </button>
      </div>
    </form>
  )
}
