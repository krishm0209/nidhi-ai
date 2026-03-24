'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { User, Settings, LogOut } from 'lucide-react'

export function TopbarUserMenu({
  displayName,
  email,
  initials,
}: {
  displayName: string
  email: string
  initials: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full hover:bg-zinc-50 px-2 py-1 transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
          {initials}
        </div>
        <span className="hidden sm:block text-sm text-zinc-700 max-w-[120px] truncate">
          {displayName}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 bg-white rounded-xl border border-zinc-200 shadow-lg z-50 py-1.5 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-2.5 border-b border-zinc-100">
            <p className="text-sm font-medium text-zinc-900 truncate">{displayName}</p>
            <p className="text-xs text-zinc-400 truncate">{email}</p>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <User className="h-4 w-4 text-zinc-400" />
            Profile & Settings
          </Link>

          <Link
            href="/settings#security"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Settings className="h-4 w-4 text-zinc-400" />
            Security
          </Link>

          <div className="border-t border-zinc-100 mt-1 pt-1">
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
