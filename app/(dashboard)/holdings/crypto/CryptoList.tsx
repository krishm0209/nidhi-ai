'use client'

import { useTransition } from 'react'
import { deleteCrypto } from './actions'
import { formatINR, formatChange, formatGain } from '@/lib/utils/format'
import type { CryptoHoldingEnriched } from '@/types/portfolio'

export function CryptoList({ holdings }: { holdings: CryptoHoldingEnriched[] }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm('Remove this crypto holding?')) return
    startTransition(async () => { await deleteCrypto(id) })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
            <th className="px-5 py-3 font-medium">Coin</th>
            <th className="px-5 py-3 font-medium text-right">Qty</th>
            <th className="px-5 py-3 font-medium text-right">Avg Price</th>
            <th className="px-5 py-3 font-medium text-right">Cur Price</th>
            <th className="px-5 py-3 font-medium text-right">Invested</th>
            <th className="px-5 py-3 font-medium text-right">Current</th>
            <th className="px-5 py-3 font-medium text-right">P&amp;L</th>
            <th className="px-5 py-3 font-medium">Exchange</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {holdings.map((h) => {
            const hasLivePrice = h.current_price_inr !== h.average_price_inr
            const isGain = h.gain_loss >= 0
            return (
              <tr key={h.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-semibold text-zinc-900">{h.coin_symbol}</div>
                  <div className="text-xs text-zinc-400">{h.coin_id}</div>
                </td>
                <td className="px-5 py-3 text-right text-zinc-700">
                  {h.quantity.toLocaleString('en-IN', { maximumSignificantDigits: 8 })}
                </td>
                <td className="px-5 py-3 text-right text-zinc-500">
                  {formatINR(h.average_price_inr)}
                </td>
                <td className="px-5 py-3 text-right">
                  {hasLivePrice ? (
                    <span className="font-medium text-zinc-900">{formatINR(h.current_price_inr)}</span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-zinc-500">
                  {formatINR(h.invested_value)}
                </td>
                <td className="px-5 py-3 text-right font-medium text-zinc-900">
                  {formatINR(h.current_value)}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className={isGain ? 'text-emerald-600' : 'text-red-500'}>
                    <div className="font-medium">{formatGain(h.gain_loss)}</div>
                    <div className="text-xs">{formatChange(h.gain_loss_pct)}</div>
                  </div>
                </td>
                <td className="px-5 py-3 text-zinc-500 capitalize">
                  {h.exchange_source?.replace('_', ' ') ?? '—'}
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
