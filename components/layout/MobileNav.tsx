'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Layers,
  MessageSquare,
  FileText,
  MoreHorizontal,
  X,
  TrendingUp,
  BarChart2,
  FlaskConical,
  Users,
  GitMerge,
  Upload,
  Settings,
  BarChart3,
  Sparkles,
  ClipboardList,
} from 'lucide-react'

const PRIMARY_TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/holdings/stocks', label: 'Holdings', icon: Layers },
  { href: '/advisor', label: 'Advisor', icon: MessageSquare },
  { href: '/tax', label: 'Tax', icon: FileText },
]

const MORE_ITEMS = [
  { href: '/xray', label: 'Portfolio X-ray', icon: TrendingUp },
  { href: '/sip', label: 'SIP Tracker', icon: BarChart2 },
  { href: '/simulator', label: 'What-If', icon: FlaskConical },
  { href: '/overlap', label: 'MF Overlap', icon: GitMerge },
  { href: '/household', label: 'Family', icon: Users },
  { href: '/itr', label: 'File ITR', icon: ClipboardList },
  { href: '/benchmark', label: 'Benchmark', icon: BarChart3 },
  { href: '/wrapped', label: 'Year Wrapped', icon: Sparkles },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200 flex items-stretch h-16">
        {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-emerald-600' : 'text-zinc-400'
              )}
            >
              <Icon className={clsx('h-5 w-5', active ? 'text-emerald-600' : 'text-zinc-400')} />
              {label}
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className={clsx(
            'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
            moreOpen ? 'text-emerald-600' : 'text-zinc-400'
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* More drawer */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-2xl shadow-xl pb-8 pt-4">
            <div className="flex items-center justify-between px-5 pb-3 border-b border-zinc-100">
              <span className="text-sm font-semibold text-zinc-900">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 px-3 pt-3">
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={clsx(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl text-[11px] font-medium text-center transition-colors',
                      active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-zinc-600 hover:bg-zinc-50'
                    )}
                  >
                    <Icon className={clsx('h-5 w-5', active ? 'text-emerald-600' : 'text-zinc-500')} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
