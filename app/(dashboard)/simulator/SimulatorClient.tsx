'use client'

import { useState, useCallback, useRef } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Search, TrendingUp, IndianRupee, BarChart2, Loader2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatINR } from '@/lib/utils/format'
import type { BacktestResult } from '@/lib/analysis/simulator'

interface MFSearchResult {
  schemeCode: number
  schemeName: string
}

const fmt = (v: number) => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <div className="font-medium text-zinc-600 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-500">{p.name}:</span>
          <span className="font-medium text-zinc-900">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function SimulatorClient() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MFSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFund, setSelectedFund] = useState<MFSearchResult | null>(null)
  const [amount, setAmount] = useState(5000)
  const [startDate, setStartDate] = useState('2020-01-01')
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchFunds = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setSearchResults([]); return }

    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error('search failed')
        const data = await res.json() as { schemeCode: number; schemeName: string }[]
        setSearchResults(data.slice(0, 8))
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  async function runBacktest() {
    if (!selectedFund) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/simulator/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeCode: selectedFund.schemeCode,
          monthlyAmount: amount,
          startDate,
          endDate,
        }),
      })
      if (!res.ok) throw new Error('Backtest failed')
      const data = await res.json() as BacktestResult
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run simulation')
    } finally {
      setLoading(false)
    }
  }

  // Determine tick interval based on data length
  const tickInterval = result
    ? Math.max(1, Math.floor(result.dataPoints.length / 8))
    : 1

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">What-If Simulator</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Backtest a SIP investment against real historical NAVs to see how it would have performed.
        </p>
      </div>

      {/* Config panel */}
      <Card>
        <div className="space-y-5">
          {/* Fund search */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Mutual Fund</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                {searching
                  ? <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
                  : <Search className="h-4 w-4 text-zinc-400" />
                }
              </div>
              <input
                type="text"
                value={selectedFund ? selectedFund.schemeName : query}
                onChange={(e) => {
                  setSelectedFund(null)
                  setQuery(e.target.value)
                  searchFunds(e.target.value)
                }}
                onFocus={() => { if (selectedFund) { setSelectedFund(null); setQuery('') } }}
                placeholder="Search by fund name, e.g. Nifty 50 Index..."
                className="w-full pl-9 pr-4 py-2.5 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {searchResults.length > 0 && !selectedFund && (
              <div className="mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden z-10">
                {searchResults.map((f) => (
                  <button
                    key={f.schemeCode}
                    onClick={() => { setSelectedFund(f); setSearchResults([]); setQuery('') }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 border-b border-zinc-50 last:border-0"
                  >
                    <div className="font-medium text-zinc-900 truncate">{f.schemeName}</div>
                    <div className="text-xs text-zinc-400">Code: {f.schemeCode}</div>
                  </button>
                ))}
              </div>
            )}

            {selectedFund && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-zinc-700 truncate">{selectedFund.schemeName}</span>
                <button onClick={() => setSelectedFund(null)} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600">
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Monthly SIP amount */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Monthly SIP Amount
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-sm text-zinc-400">₹</span>
                <input
                  type="number"
                  min={500}
                  max={500000}
                  step={500}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full pl-7 pr-4 py-2.5 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <input
                type="range"
                min={500}
                max={100000}
                step={500}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-2 w-full accent-emerald-500"
              />
            </div>

            {/* Start date */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* End date */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={runBacktest}
            disabled={!selectedFund || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Simulating…</>
            ) : (
              <><TrendingUp className="h-4 w-4" /> Run Simulation</>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card padding="sm">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Invested</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">{formatINR(result.totalInvested)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{result.installments} installments</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Current Value</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">{formatINR(result.finalValue)}</p>
              <p className={`text-xs mt-0.5 font-medium ${result.totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.totalGain >= 0 ? '+' : ''}{formatINR(result.totalGain)}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Absolute Return</p>
              <p className={`mt-1 text-xl font-semibold ${result.gainPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.gainPct >= 0 ? '+' : ''}{result.gainPct.toFixed(1)}%
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">XIRR (Annualised)</p>
              <p className={`mt-1 text-xl font-semibold ${(result.xirr ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.xirr !== null ? `${result.xirr >= 0 ? '+' : ''}${result.xirr.toFixed(1)}%` : '—'}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">Per annum</p>
            </Card>
          </div>

          {/* Chart */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">
                {result.schemeName}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                ₹{amount.toLocaleString('en-IN')}/month · {startDate} → {endDate}
              </p>
            </div>
            <div className="px-2 py-4" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.dataPoints} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                    interval={tickInterval}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                    tickFormatter={(v) => {
                      if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`
                      if (v >= 100_000) return `₹${(v / 100_000).toFixed(0)}L`
                      return `₹${(v / 1000).toFixed(0)}K`
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Line
                    type="monotone"
                    dataKey="invested"
                    name="Invested"
                    stroke="#a1a1aa"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Portfolio Value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
