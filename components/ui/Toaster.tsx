'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

// Module-level dispatcher — call toast() from anywhere without hooks
let _dispatch: ((t: Toast) => void) | null = null

export function toast(message: string, type: ToastType = 'success') {
  if (_dispatch) {
    _dispatch({ id: Date.now() + Math.random(), message, type })
  }
}

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const STYLES = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-zinc-800 text-white',
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    _dispatch = (t) => {
      setToasts((prev) => [...prev, t])
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, 3500)
    }
    return () => { _dispatch = null }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 lg:bottom-6 lg:left-auto lg:right-5 lg:translate-x-0 z-[100] flex flex-col gap-2 items-center lg:items-end">
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            className={clsx(
              'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[240px] max-w-xs',
              'animate-in slide-in-from-bottom-2 duration-200',
              STYLES[t.type]
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-70 hover:opacity-100 transition-opacity ml-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
