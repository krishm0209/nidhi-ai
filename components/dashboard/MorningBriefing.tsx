'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, AlertCircle, CalendarClock, TrendingUp } from 'lucide-react'
import { formatINR } from '@/lib/utils/format'
import type { Briefing } from '@/lib/ai/briefing'

export function MorningBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/ai/briefing')
      if (!res.ok) throw new Error()
      const data = await res.json() as Briefing
      setBriefing(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-violet-500">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span>Preparing your daily briefing…</span>
        </div>
      </div>
    )
  }

  if (error || !briefing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-zinc-400 shrink-0" />
        <span className="text-sm text-zinc-500">Could not load your daily briefing.</span>
        <button onClick={load} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600">
          Retry
        </button>
      </div>
    )
  }

  const { stats } = briefing
  const changePositive = (stats.portfolioChangePct ?? 0) >= 0

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-violet-100">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-violet-900">Morning Nidhi</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick stats */}
          {stats.portfolioChangePct !== null && (
            <div className={`flex items-center gap-1 text-xs font-medium ${changePositive ? 'text-emerald-600' : 'text-red-500'}`}>
              <TrendingUp className="h-3 w-3" />
              {changePositive ? '+' : ''}{stats.portfolioChangePct.toFixed(2)}%
            </div>
          )}
          {stats.daysToFYEnd <= 10 && (
            <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              <CalendarClock className="h-3 w-3" />
              {stats.daysToFYEnd}d to Mar 31
            </div>
          )}
          <button
            onClick={load}
            className="text-violet-400 hover:text-violet-600 transition-colors"
            title="Refresh briefing"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-sm text-violet-900 leading-relaxed">
          {briefing.body}
        </p>

        {/* Alert pills */}
        {(stats.sipsDueToday.length > 0 || stats.ltcgCrossings.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.sipsDueToday.slice(0, 2).map((name, i) => (
              <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                SIP today: {name.split('-')[0].trim()}
              </span>
            ))}
            {stats.ltcgCrossings.slice(0, 2).map((name, i) => (
              <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                LTCG soon: {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
