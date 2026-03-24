'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  TrendingUp,
  Layers,
  Users,
  MessageSquare,
  FileText,
  Settings,
  Upload,
  GitMerge,
  FlaskConical,
  BarChart2,
  BarChart3,
  Sparkles,
  ClipboardList,
  ShieldAlert,
} from 'lucide-react'

type NavLeaf = { href: string; label: string; icon: React.ElementType; children?: never }
type NavGroup = { label: string; icon: React.ElementType; children: { href: string; label: string }[]; href?: never }
type NavItem = NavLeaf | NavGroup

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Holdings',
    icon: Layers,
    children: [
      { href: '/holdings/stocks', label: 'Stocks' },
      { href: '/holdings/mutual-funds', label: 'Mutual Funds' },
      { href: '/holdings/crypto', label: 'Crypto' },
      { href: '/holdings/fixed-income', label: 'Fixed Income' },
      { href: '/holdings/gold', label: 'Gold' },
    ],
  },
  { href: '/xray', label: 'Portfolio X-ray', icon: TrendingUp },
  { href: '/overlap', label: 'MF Overlap', icon: GitMerge },
  { href: '/sip', label: 'SIP Tracker', icon: BarChart2 },
  { href: '/simulator', label: 'What-If', icon: FlaskConical },
  { href: '/household', label: 'Family', icon: Users },
  { href: '/advisor', label: 'AI Advisor', icon: MessageSquare },
  {
    label: 'Tax',
    icon: FileText,
    children: [
      { href: '/tax', label: 'Capital Gains' },
      { href: '/tax/optimizer', label: '80C Optimizer' },
      { href: '/itr', label: 'File ITR (Guide)' },
    ],
  },
  { href: '/benchmark', label: 'Benchmark', icon: BarChart3 },
  { href: '/wrapped', label: 'Year Wrapped', icon: Sparkles },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-zinc-200 bg-white min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-900">NidhiAI</span>
          <span className="rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">
            BETA
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children != null) {
            const children = item.children
            const isActive = children.some((c) => pathname.startsWith(c.href))
            return (
              <div key={item.label}>
                <div
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                    isActive ? 'text-zinc-900' : 'text-zinc-500'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </div>
                <div className="ml-6 mt-0.5 space-y-0.5">
                  {children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={clsx(
                        'block px-3 py-1.5 rounded-lg text-sm transition-colors',
                        pathname === child.href || pathname.startsWith(child.href + '/')
                          ? 'bg-emerald-50 text-emerald-700 font-medium'
                          : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          }

          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Admin — only visible to krish.makhija2@gmail.com */}
      {isAdmin && (
        <Link
          href="/admin"
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname === '/admin'
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700'
          )}
        >
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Admin
        </Link>
      )}

      {/* Disclaimer */}
      <div className="px-4 py-4 border-t border-zinc-200">
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          Not a SEBI-registered advisor. All analysis is informational only.
        </p>
      </div>
    </aside>
  )
}
