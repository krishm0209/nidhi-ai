'use client'

import { useState } from 'react'
import { Plus, ChevronDown, Loader2 } from 'lucide-react'
import { addManualDeduction } from './actions'
import { toast } from '@/components/ui/Toaster'

const INSTRUMENTS: Record<string, string[]> = {
  '80C': ['Home Loan Principal', 'Tuition Fees', 'Stamp Duty', 'NSC', 'ULIP', 'Senior Citizen Savings Scheme', 'Post Office 5Y FD', 'Other'],
  '80CCD1B': ['NPS Additional Contribution'],
  '80D': ['Self / Spouse / Children Health Insurance', 'Parents Health Insurance (Senior Citizen)'],
}

export function AddDeductionForm({ memberId, fyLabel }: { memberId: string; fyLabel: string }) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('80C')
  const [instrument, setInstrument] = useState(INSTRUMENTS['80C'][0])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setLoading(true)
    setError(null)
    const fd = new FormData()
    fd.append('memberId', memberId)
    fd.append('fyLabel', fyLabel)
    fd.append('section', section)
    fd.append('instrument', instrument)
    fd.append('amount', amount)
    const result = await addManualDeduction(fd)
    if (result.error) {
      setError(result.error)
      toast(result.error, 'error')
    } else {
      toast('Deduction saved')
      setSuccess(true)
      setAmount('')
      setTimeout(() => { setSuccess(false); setOpen(false) }, 1200)
    }
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add manual deduction (home loan, tuition fees, etc.)
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-4 border-t border-zinc-100 pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Section</label>
              <select
                value={section}
                onChange={(e) => { setSection(e.target.value); setInstrument(INSTRUMENTS[e.target.value][0]) }}
                className="w-full px-2 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {Object.keys(INSTRUMENTS).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Instrument</label>
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                className="w-full px-2 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {INSTRUMENTS[section].map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={1}
                max={200000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !amount || success}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {success ? 'Saved!' : 'Save Deduction'}
          </button>
        </form>
      )}
    </div>
  )
}
