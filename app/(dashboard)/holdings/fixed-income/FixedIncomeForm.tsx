'use client'

import { useActionState, useState, useEffect } from 'react'
import { addFixedIncome } from './actions'
import { toast } from '@/components/ui/Toaster'

const INSTRUMENT_LABELS: Record<string, string> = {
  fd: 'Fixed Deposit (FD)',
  ppf: 'Public Provident Fund (PPF)',
  nps: 'National Pension System (NPS)',
  ssy: 'Sukanya Samriddhi Yojana (SSY)',
  rd: 'Recurring Deposit (RD)',
  scss: 'Senior Citizens Savings Scheme (SCSS)',
  sgb: 'Sovereign Gold Bond (SGB)',
  bonds: 'Government / Corporate Bonds',
  lic: 'LIC / Insurance Policy',
  post_office: 'Post Office Savings',
}

const initialState = { error: undefined as string | undefined, success: false }

export function FixedIncomeForm() {
  const [instrumentType, setInstrumentType] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await addFixedIncome(formData)
      return result as typeof initialState
    },
    initialState
  )

  useEffect(() => {
    if (state.success) toast('Holding added successfully')
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
          Instrument type <span className="text-red-500">*</span>
        </label>
        <select
          name="instrument_type"
          required
          value={instrumentType}
          onChange={(e) => setInstrumentType(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Select instrument</option>
          {Object.entries(INSTRUMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Institution / Bank</label>
        <input
          name="institution"
          placeholder="e.g. SBI, HDFC Bank"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Principal / Amount (₹) <span className="text-red-500">*</span>
        </label>
        <input
          name="principal"
          type="number"
          required
          min={0}
          step={100}
          placeholder="100000"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Interest rate (% p.a.)</label>
        <input
          name="interest_rate"
          type="number"
          step={0.01}
          min={0}
          max={30}
          placeholder="7.10"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Maturity date</label>
        <input
          name="maturity_date"
          type="date"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Current value (₹)</label>
        <input
          name="current_value"
          type="number"
          step={0.01}
          min={0}
          placeholder="Leave blank to auto-compute"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* NPS-specific: equity allocation % */}
      {instrumentType === 'nps' && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            NPS equity allocation (%)
          </label>
          <input
            name="nps_equity_pct"
            type="number"
            min={0}
            max={75}
            defaultValue={50}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1 text-xs text-zinc-400">Max 75% equity under auto choice</p>
        </div>
      )}

      <div className="col-span-full md:col-span-2">
        <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
        <input
          name="notes"
          placeholder="Optional notes (account number, nominee, etc.)"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="col-span-full">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add holding'}
        </button>
      </div>
    </form>
  )
}
