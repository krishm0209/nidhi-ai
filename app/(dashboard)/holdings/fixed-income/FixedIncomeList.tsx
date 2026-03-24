'use client'

import { useTransition } from 'react'
import { deleteFixedIncome } from './actions'
import { formatINR } from '@/lib/utils/format'
import type { FixedIncomeHolding } from '@/types/portfolio'

const INSTRUMENT_LABELS: Record<string, string> = {
  fd: 'FD', ppf: 'PPF', nps: 'NPS', ssy: 'SSY', rd: 'RD',
  scss: 'SCSS', sgb: 'SGB', bonds: 'Bonds', lic: 'LIC', post_office: 'Post Office',
}

export function FixedIncomeList({ holdings }: { holdings: FixedIncomeHolding[] }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Remove this holding?')) return
    startTransition(async () => { await deleteFixedIncome(id) })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
            <th className="px-5 py-3 font-medium">Type</th>
            <th className="px-5 py-3 font-medium">Institution</th>
            <th className="px-5 py-3 font-medium text-right">Principal</th>
            <th className="px-5 py-3 font-medium text-right">Rate</th>
            <th className="px-5 py-3 font-medium text-right">Current Value</th>
            <th className="px-5 py-3 font-medium">Matures</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {holdings.map((h) => (
            <tr key={h.id} className="hover:bg-zinc-50 transition-colors">
              <td className="px-5 py-3">
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {INSTRUMENT_LABELS[h.instrument_type] ?? h.instrument_type.toUpperCase()}
                </span>
              </td>
              <td className="px-5 py-3 text-zinc-700">{h.institution ?? '—'}</td>
              <td className="px-5 py-3 text-right font-medium text-zinc-900">
                {formatINR(h.principal)}
              </td>
              <td className="px-5 py-3 text-right text-zinc-500">
                {h.interest_rate != null ? `${h.interest_rate}%` : '—'}
              </td>
              <td className="px-5 py-3 text-right text-zinc-700">
                {h.current_value != null ? formatINR(h.current_value) : '—'}
              </td>
              <td className="px-5 py-3 text-zinc-500">
                {h.maturity_date
                  ? new Date(h.maturity_date).toLocaleDateString('en-IN')
                  : '—'}
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => handleDelete(h.id)}
                  disabled={isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
