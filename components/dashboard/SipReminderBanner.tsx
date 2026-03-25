'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw, X } from 'lucide-react'

export function SipReminderBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
        <RefreshCw className="h-4 w-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-900">Update your portfolio</p>
        <p className="text-xs text-blue-600 mt-0.5">
          Your SIP has added new units this month. Import your latest CAS from CAMS or KFintech to keep your holdings accurate.
        </p>
      </div>
      <Link href="/import" className="shrink-0 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors px-3 py-1.5 rounded-lg">
        Import CAS →
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-blue-400 hover:text-blue-700 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
