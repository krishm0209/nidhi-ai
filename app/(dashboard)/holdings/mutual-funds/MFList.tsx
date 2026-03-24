'use client'

import { useTransition } from 'react'
import { deleteMF } from './actions'
import { formatINR, formatUnits, formatChange, formatGain } from '@/lib/utils/format'
import type { MFHoldingEnriched } from '@/types/portfolio'

function holdingDuration(purchaseDate: string): string {
  const days = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years}y`
}

export function MFList({ holdings }: { holdings: MFHoldingEnriched[] }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Remove this mutual fund holding?')) return
    startTransition(async () => { await deleteMF(id) })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
            <th className="px-5 py-3 font-medium">Fund</th>
            <th className="px-5 py-3 font-medium">Type</th>
            <th className="px-5 py-3 font-medium text-right">Units</th>
            <th className="px-5 py-3 font-medium text-right">Buy NAV</th>
            <th className="px-5 py-3 font-medium text-right">Cur NAV</th>
            <th className="px-5 py-3 font-medium text-right">Invested</th>
            <th className="px-5 py-3 font-medium text-right">Current</th>
            <th className="px-5 py-3 font-medium text-right">P&amp;L</th>
            <th className="px-5 py-3 font-medium">Bought</th>
            <th className="px-5 py-3 font-medium">SIP</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {holdings.map((h) => {
            const hasLiveNav = h.current_nav > 0 && h.current_nav !== (h.purchase_nav ?? 0)
            const isGain = h.gain_loss >= 0
            return (
              <tr key={h.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-medium text-zinc-900 max-w-[240px] truncate" title={h.scheme_name}>
                    {h.scheme_name}
                  </div>
                  <div className="text-xs text-zinc-400">Code: {h.scheme_code}</div>
                </td>
                <td className="px-5 py-3">
                  {h.fund_type ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {h.fund_type}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-zinc-700">{formatUnits(h.units)}</td>
                <td className="px-5 py-3 text-right text-zinc-500">
                  {h.purchase_nav ? formatINR(h.purchase_nav) : '—'}
                </td>
                <td className="px-5 py-3 text-right text-zinc-700">
                  {hasLiveNav ? (
                    <span className="font-medium">{formatINR(h.current_nav)}</span>
                  ) : h.purchase_nav ? (
                    formatINR(h.current_nav)
                  ) : '—'}
                </td>
                <td className="px-5 py-3 text-right text-zinc-500">
                  {h.invested_value > 0 ? formatINR(h.invested_value) : '—'}
                </td>
                <td className="px-5 py-3 text-right font-medium text-zinc-900">
                  {h.current_value > 0 ? formatINR(h.current_value) : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  {h.invested_value > 0 ? (
                    <div className={isGain ? 'text-emerald-600' : 'text-red-500'}>
                      <div className="font-medium">{formatGain(h.gain_loss)}</div>
                      <div className="text-xs">{formatChange(h.gain_loss_pct)}</div>
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-500">
                  {h.purchase_date ? (
                    <div>
                      <div>{new Date(h.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-xs text-zinc-400">{holdingDuration(h.purchase_date)}</div>
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-500">
                  {h.is_sip && h.sip_amount
                    ? `₹${h.sip_amount.toLocaleString('en-IN')}/mo`
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
