'use client'

import { useTransition } from 'react'
import { deleteStock } from './actions'
import { formatINR, formatChange, formatGain } from '@/lib/utils/format'
import { useStockPrices } from '@/lib/hooks/useStockPrices'
import { isMarketOpen } from '@/lib/utils/market-calendar'
import { clsx } from 'clsx'
import type { StockHoldingEnriched } from '@/types/portfolio'

export function StockList({ holdings }: { holdings: StockHoldingEnriched[] }) {
  const [isPending, startTransition] = useTransition()

  // Poll live prices during market hours — overrides server-rendered prices
  const tickers = holdings.map(h => `${h.exchange}:${h.symbol}`)
  const livePrices = useStockPrices(tickers)
  const marketOpen = isMarketOpen()

  // Merge live prices into holdings
  const live = holdings.map(h => {
    const quote = livePrices[`${h.exchange}:${h.symbol}`]
    if (!quote) return h
    const current_price = quote.ltp
    const current_value = current_price * h.quantity
    const gain_loss = current_value - h.invested_value
    const gain_loss_pct = h.invested_value > 0 ? (gain_loss / h.invested_value) * 100 : 0
    return { ...h, current_price, current_value, gain_loss, gain_loss_pct, day_change_pct: quote.day_change_pct }
  })

  function handleDelete(id: string) {
    if (!confirm('Remove this stock holding?')) return
    startTransition(async () => { await deleteStock(id) })
  }

  return (
    <>
      {/* ── Live indicator ────────────────────────────────────────────── */}
      {marketOpen && (
        <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-700">Live · updating every 5s</span>
        </div>
      )}

      {/* ── Mobile card list ──────────────────────────────────────────── */}
      <div className="lg:hidden divide-y divide-zinc-50">
        {live.map((h) => {
          const hasLivePrice = h.current_price !== h.average_price
          const isGain = h.gain_loss >= 0
          return (
            <div key={h.id} className="px-4 py-4 flex items-center gap-3">
              {/* Symbol badge */}
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-emerald-700 leading-tight text-center px-0.5">
                  {h.symbol.slice(0, 4)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900 text-sm">{h.symbol}</span>
                  <span className="font-semibold text-zinc-900 text-sm">{formatINR(h.current_value)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-zinc-400">
                    {h.quantity} × {hasLivePrice ? formatINR(h.current_price) : formatINR(h.average_price)}
                    {' · '}{h.exchange}
                  </span>
                  <span className={clsx(
                    'text-xs font-medium',
                    isGain ? 'text-emerald-600' : 'text-red-500'
                  )}>
                    {isGain ? '+' : ''}{formatGain(h.gain_loss)} ({formatChange(h.gain_loss_pct)})
                  </span>
                </div>
                {hasLivePrice && h.day_change_pct !== 0 && (
                  <div className={clsx(
                    'text-[10px] mt-0.5',
                    h.day_change_pct >= 0 ? 'text-emerald-500' : 'text-red-400'
                  )}>
                    Today {h.day_change_pct >= 0 ? '+' : ''}{formatChange(h.day_change_pct)}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDelete(h.id)}
                disabled={isPending}
                className="text-[10px] text-zinc-300 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0 ml-1"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table ─────────────────────────────────────────────── */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100">
              <th className="px-5 py-3 font-medium">Symbol</th>
              <th className="px-5 py-3 font-medium">Exch</th>
              <th className="px-5 py-3 font-medium text-right">Qty</th>
              <th className="px-5 py-3 font-medium text-right">Avg</th>
              <th className="px-5 py-3 font-medium text-right">LTP</th>
              <th className="px-5 py-3 font-medium text-right">Day</th>
              <th className="px-5 py-3 font-medium text-right">Invested</th>
              <th className="px-5 py-3 font-medium text-right">Current</th>
              <th className="px-5 py-3 font-medium text-right">P&amp;L</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {live.map((h) => {
              const hasLivePrice = h.current_price !== h.average_price
              const isGain = h.gain_loss >= 0
              const isDayGain = h.day_change_pct >= 0
              return (
                <tr key={h.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-zinc-900">{h.symbol}</div>
                    {h.purchase_date && (
                      <div className="text-xs text-zinc-400">
                        {new Date(h.purchase_date).toLocaleDateString('en-IN')}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{h.exchange}</td>
                  <td className="px-5 py-3 text-right text-zinc-700">{h.quantity}</td>
                  <td className="px-5 py-3 text-right text-zinc-400">{formatINR(h.average_price)}</td>
                  <td className="px-5 py-3 text-right">
                    {hasLivePrice
                      ? <span className="font-medium text-zinc-900">{formatINR(h.current_price)}</span>
                      : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {hasLivePrice
                      ? <span className={clsx('text-xs font-medium', isDayGain ? 'text-emerald-600' : 'text-red-500')}>
                          {formatChange(h.day_change_pct)}
                        </span>
                      : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-400">{formatINR(h.invested_value)}</td>
                  <td className="px-5 py-3 text-right font-medium text-zinc-900">{formatINR(h.current_value)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className={isGain ? 'text-emerald-600' : 'text-red-500'}>
                      <div className="font-medium">{formatGain(h.gain_loss)}</div>
                      <div className="text-xs">{formatChange(h.gain_loss_pct)}</div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(h.id)}
                      disabled={isPending}
                      className="text-xs text-zinc-300 hover:text-red-500 disabled:opacity-50 transition-colors"
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
    </>
  )
}
