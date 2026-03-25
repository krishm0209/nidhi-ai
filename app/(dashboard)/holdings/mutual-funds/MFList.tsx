'use client'

import { useTransition, useState } from 'react'
import { deleteMF, updateMF } from './actions'
import { formatINR, formatUnits, formatChange, formatGain } from '@/lib/utils/format'
import { useMFNavs } from '@/lib/hooks/useMFNavs'
import type { MFHolding } from '@/types/portfolio'

function holdingDuration(purchaseDate: string): string {
  const days = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years}y`
}

interface AddInvestmentRowProps {
  holding: MFHolding
  onClose: () => void
}

function AddInvestmentRow({ holding, onClose }: AddInvestmentRowProps) {
  const [isPending, startTransition] = useTransition()
  const currentInvested = holding.units * (holding.purchase_nav ?? 0)

  const [unitsAdded, setUnitsAdded] = useState('')
  const [amountAdded, setAmountAdded] = useState(String(holding.sip_amount ?? ''))

  const unitsNum = parseFloat(unitsAdded) || 0
  const amountNum = parseFloat(amountAdded) || 0

  const newTotalUnits = holding.units + unitsNum
  const newTotalInvested = currentInvested + amountNum
  const newAvgNav = newTotalUnits > 0 ? newTotalInvested / newTotalUnits : 0

  function handleSave() {
    if (unitsNum <= 0 || amountNum <= 0) return
    startTransition(async () => {
      await updateMF(holding.id, newTotalUnits, newAvgNav)
      onClose()
    })
  }

  return (
    <tr className="bg-emerald-50/60 border-b border-emerald-100">
      <td colSpan={11} className="px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-600 mb-1">Units added this month</p>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={unitsAdded}
              onChange={e => setUnitsAdded(e.target.value)}
              placeholder="e.g. 12.345"
              className="w-36 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-600 mb-1">Amount invested (₹)</p>
            <input
              type="number"
              step="1"
              min="0"
              value={amountAdded}
              onChange={e => setAmountAdded(e.target.value)}
              placeholder="2500"
              className="w-36 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {unitsNum > 0 && amountNum > 0 && (
            <div className="text-xs text-zinc-500 space-y-0.5 pb-2">
              <p>Total units: <span className="font-semibold text-zinc-800">{newTotalUnits.toFixed(4)}</span></p>
              <p>Total invested: <span className="font-semibold text-zinc-800">{formatINR(newTotalInvested)}</span></p>
              <p>New avg NAV: <span className="font-semibold text-emerald-700">{formatINR(newAvgNav)}</span></p>
            </div>
          )}

          <div className="flex gap-2 pb-0.5">
            <button
              onClick={handleSave}
              disabled={isPending || unitsNum <= 0 || amountNum <= 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

export function MFList({ holdings }: { holdings: MFHolding[] }) {
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  const schemeCodes = holdings.map(h => h.scheme_code)
  const navs = useMFNavs(schemeCodes)

  const enriched = holdings.map(h => {
    const current_nav = navs[h.scheme_code] ?? h.purchase_nav ?? 0
    const invested_value = h.units * (h.purchase_nav ?? current_nav)
    const current_value = h.units * current_nav
    const gain_loss = current_value - invested_value
    const gain_loss_pct = invested_value > 0 ? (gain_loss / invested_value) * 100 : 0
    return { ...h, current_nav, current_value, invested_value, gain_loss, gain_loss_pct }
  })

  const totalInvested = enriched.reduce((s, h) => s + h.invested_value, 0)
  const totalCurrent = enriched.reduce((s, h) => s + h.current_value, 0)

  function handleDelete(id: string) {
    if (!confirm('Remove this mutual fund holding?')) return
    startTransition(async () => { await deleteMF(id) })
  }

  return (
    <>
      {/* ── Header with totals ─────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          Your mutual funds ({holdings.length})
        </h2>
        <div className="text-xs text-zinc-500">
          Current:{' '}
          <span className="font-medium text-zinc-800">
            ₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          {'  '}Invested:{' '}
          <span className="font-medium text-zinc-800">
            ₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

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
            {enriched.map((h) => {
              const hasLiveNav = h.current_nav > 0 && h.current_nav !== (h.purchase_nav ?? 0)
              const isGain = h.gain_loss >= 0
              return (
                <>
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
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setEditingId(editingId === h.id ? null : h.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 transition-colors font-medium"
                        >
                          {editingId === h.id ? 'Cancel' : '+ Add'}
                        </button>
                        <button
                          onClick={() => handleDelete(h.id)}
                          disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === h.id && (
                    <AddInvestmentRow
                      key={`edit-${h.id}`}
                      holding={h}
                      onClose={() => setEditingId(null)}
                    />
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
