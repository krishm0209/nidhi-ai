'use client'

import { useActionState, useState, useEffect } from 'react'
import { addMF } from './actions'
import { toast } from '@/components/ui/Toaster'

const initialState = { error: undefined as string | undefined, success: false }

export function MFForm() {
  const [isSip, setIsSip] = useState(false)

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await addMF(formData)
      return result as typeof initialState
    },
    initialState
  )

  useEffect(() => {
    if (state.success) toast('Mutual fund added successfully')
    if (state.error) toast(state.error, 'error')
  }, [state])

  return (
    <form action={formAction} className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {state?.error && (
        <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="col-span-2 md:col-span-2">
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Fund name <span className="text-red-500">*</span>
        </label>
        <input
          name="scheme_name"
          required
          placeholder="e.g. HDFC Top 100 Fund - Direct Plan"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          AMFI Scheme Code <span className="text-red-500">*</span>
        </label>
        <input
          name="scheme_code"
          type="number"
          required
          placeholder="100033"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Units held <span className="text-red-500">*</span>
        </label>
        <input
          name="units"
          type="number"
          required
          step={0.0001}
          min={0}
          placeholder="123.4567"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Purchase NAV (₹)</label>
        <input
          name="purchase_nav"
          type="number"
          step={0.0001}
          min={0}
          placeholder="85.2300"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Purchase date</label>
        <input
          name="purchase_date"
          type="date"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Fund type</label>
        <select
          name="fund_type"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Select type</option>
          <option value="Equity">Equity</option>
          <option value="Index">Index</option>
          <option value="ELSS">ELSS</option>
          <option value="Debt">Debt</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Folio number</label>
        <input
          name="folio_number"
          placeholder="123456789"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* SIP toggle */}
      <div className="col-span-full flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="is_sip"
          name="is_sip"
          checked={isSip}
          onChange={(e) => setIsSip(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
        />
        <label htmlFor="is_sip" className="text-sm font-medium text-zinc-700 cursor-pointer">
          This is an active SIP
        </label>
      </div>

      {isSip && (
        <>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">SIP amount (₹)</label>
            <input
              name="sip_amount"
              type="number"
              min={100}
              step={100}
              placeholder="5000"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">SIP date (day of month)</label>
            <input
              name="sip_date"
              type="number"
              min={1}
              max={28}
              placeholder="5"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </>
      )}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add fund'}
        </button>
      </div>
    </form>
  )
}
