'use client'

import { useState } from 'react'
import { KeyRound, CheckCircle, XCircle } from 'lucide-react'

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSave() {
    if (!token.trim()) return
    setStatus('saving')
    setError('')

    const res = await fetch('/api/admin/groww-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim() }),
    })

    if (res.ok) {
      setStatus('ok')
      setToken('')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save token')
      setStatus('error')
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Internal tools — not visible to users.</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Update Groww Access Token</h2>
        </div>

        <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
          <li>Go to groww.in/trade-api</li>
          <li>Dropdown on your key → Generate Access Token</li>
          <li>Copy the token and paste below</li>
        </ol>

        <textarea
          value={token}
          onChange={e => { setToken(e.target.value); setStatus('idle') }}
          placeholder="Paste new Groww access token here…"
          rows={4}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-xs font-mono text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />

        {status === 'ok' && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle className="h-4 w-4" /> Token saved — live prices will use it immediately.
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <XCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!token.trim() || status === 'saving'}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {status === 'saving' ? 'Saving…' : 'Save Token'}
        </button>
      </div>
    </div>
  )
}
