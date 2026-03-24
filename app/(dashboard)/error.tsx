'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-zinc-900">Something went wrong</h2>
        <p className="text-sm text-zinc-500 max-w-xs">
          We couldn't load this page. This might be a temporary network issue.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  )
}
