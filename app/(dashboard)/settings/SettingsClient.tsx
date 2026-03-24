'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Lock, Trash2, CheckCircle, AlertCircle, LogOut } from 'lucide-react'
import { clsx } from 'clsx'

export function SettingsClient({
  userId,
  email,
  fullName: initialName,
  createdAt,
}: {
  userId: string
  email: string
  fullName: string
  createdAt: string
}) {
  const supabase = createClient()

  const [name, setName] = useState(initialName)
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdStatus, setPwdStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [pwdError, setPwdError] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState('')

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || email[0].toUpperCase()

  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '—'

  async function saveName() {
    if (!name.trim()) return
    setNameStatus('saving')
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', userId)
    setNameStatus(error ? 'error' : 'ok')
    setTimeout(() => setNameStatus('idle'), 3000)
  }

  async function changePassword() {
    setPwdError('')
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match'); return }
    if (newPwd.length < 8) { setPwdError('Password must be at least 8 characters'); return }
    setPwdStatus('saving')
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (error) { setPwdError(error.message); setPwdStatus('error') }
    else {
      setPwdStatus('ok')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      setTimeout(() => setPwdStatus('idle'), 3000)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your profile and account.</p>
      </div>

      {/* ── Profile ── */}
      <section className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-900">{name || email}</p>
            <p className="text-sm text-zinc-400">Member since {memberSince}</p>
          </div>
        </div>

        <div className="h-px bg-zinc-100" />

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Full name</span>
          </label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => { setName(e.target.value); setNameStatus('idle') }}
              placeholder="Your name"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={saveName}
              disabled={nameStatus === 'saving' || !name.trim()}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {nameStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
          {nameStatus === 'ok' && (
            <p className="flex items-center gap-1 text-xs text-emerald-600 mt-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Name updated
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</span>
          </label>
          <input
            value={email}
            readOnly
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
          />
          <p className="text-xs text-zinc-400 mt-1">Email cannot be changed.</p>
        </div>
      </section>

      {/* ── Security ── */}
      <section id="security" className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Change Password</h2>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={newPwd}
            onChange={e => { setNewPwd(e.target.value); setPwdStatus('idle') }}
            placeholder="New password"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="password"
            value={confirmPwd}
            onChange={e => { setConfirmPwd(e.target.value); setPwdStatus('idle') }}
            placeholder="Confirm new password"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {pwdError && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> {pwdError}
          </p>
        )}
        {pwdStatus === 'ok' && (
          <p className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle className="h-3.5 w-3.5" /> Password updated successfully
          </p>
        )}

        <button
          onClick={changePassword}
          disabled={!newPwd || !confirmPwd || pwdStatus === 'saving'}
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pwdStatus === 'saving' ? 'Updating…' : 'Update password'}
        </button>
      </section>

      {/* ── Sign out ── */}
      <section className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">Sign out</p>
            <p className="text-xs text-zinc-400 mt-0.5">Sign out of NidhiAI on this device.</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-300 text-sm font-medium text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </section>

      {/* ── Danger zone ── */}
      <section className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold text-red-600">Danger Zone</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Deleting your account permanently removes all your holdings, tax data, and portfolio history. This cannot be undone.
        </p>
        <div className="space-y-2">
          <input
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={`Type "${email}" to confirm`}
            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <button
            disabled={deleteConfirm !== email}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              deleteConfirm === email
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
            )}
            onClick={async () => {
              if (deleteConfirm !== email) return
              const res = await fetch('/api/account/delete', { method: 'DELETE' })
              if (res.ok) {
                window.location.href = '/login'
              } else {
                const data = await res.json()
                alert('Failed to delete account: ' + data.error)
              }
            }}
          >
            Delete my account
          </button>
        </div>
      </section>
    </div>
  )
}
