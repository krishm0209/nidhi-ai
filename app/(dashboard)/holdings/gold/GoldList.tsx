'use client'

import { useTransition } from 'react'
import { deleteGold } from './actions'
import { formatINR } from '@/lib/utils/format'
import type { GoldHolding } from '@/types/portfolio'

const FORM_LABELS: Record<string, string> = {
  physical: 'Physical',
  digital: 'Digital',
  sgb: 'SGB',
  gold_etf: 'Gold ETF',
  gold_mf: 'Gold MF',
}

function holdingValue(h: GoldHolding): number {
  if (h.weight_grams && h.purchase_price_per_gram) {
    return h.weight_grams * h.purchase_price_per_gram
  }
  if (h.units && h.purchase_nav) {
    return h.units * h.purchase_nav
  }
  return 0
}

export function GoldList({ holdings }: { holdings: GoldHolding[] }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Remove this gold holding?')) return
    startTransition(async () => { await deleteGold(id) })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
            <th className="px-5 py-3 font-medium">Form</th>
            <th className="px-5 py-3 font-medium text-right">Weight / Units</th>
            <th className="px-5 py-3 font-medium text-right">Buy Price</th>
            <th className="px-5 py-3 font-medium text-right">Invested</th>
            <th className="px-5 py-3 font-medium">Notes</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {holdings.map((h) => (
            <tr key={h.id} className="hover:bg-zinc-50 transition-colors">
              <td className="px-5 py-3">
                <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  {FORM_LABELS[h.form] ?? h.form}
                </span>
              </td>
              <td className="px-5 py-3 text-right text-zinc-700">
                {h.weight_grams != null
                  ? `${h.weight_grams}g`
                  : h.units != null
                  ? `${h.units} units`
                  : '—'}
              </td>
              <td className="px-5 py-3 text-right text-zinc-500">
                {h.purchase_price_per_gram != null
                  ? `${formatINR(h.purchase_price_per_gram)}/g`
                  : h.purchase_nav != null
                  ? formatINR(h.purchase_nav)
                  : '—'}
              </td>
              <td className="px-5 py-3 text-right font-medium text-zinc-900">
                {holdingValue(h) > 0 ? formatINR(holdingValue(h)) : '—'}
              </td>
              <td className="px-5 py-3 text-zinc-500 max-w-[180px] truncate">
                {h.notes ?? '—'}
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
