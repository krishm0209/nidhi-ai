'use client'

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

interface Props {
  payload: {
    totalValue: number
    totalInvested: number
    totalGainLoss: number
    totalGainLossPct: number
    allocation: { name: string; value: number; pct: number }[]
    topHoldings: { name: string; assetClass: string; currentValue: number; pct: number; gainLossPct: number }[]
    concentrated: { name: string; pct: number }[]
  }
}

export function XRayInsights({ payload }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  async function fetchInsights() {
    setLoading(true)
    setText('')
    try {
      const res = await fetch('/api/ai/xray-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setText(prev => prev + decoder.decode(value))
      }
      setFetched(true)
    } catch {
      setText('Could not load insights. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInsights() }, [])

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      {loading && !text && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
          <span>Analysing your portfolio…</span>
        </div>
      )}

      {text && (
        <div className="flex items-start gap-3">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <div className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap flex-1">
            {text}
            {loading && <span className="inline-block w-1 h-4 ml-0.5 bg-amber-400 animate-pulse align-middle" />}
          </div>
          {fetched && !loading && (
            <button
              onClick={fetchInsights}
              className="shrink-0 text-amber-300 hover:text-amber-600 transition-colors mt-0.5"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
