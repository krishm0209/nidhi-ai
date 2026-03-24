import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { TopbarUserMenu } from './TopbarUserMenu'

export async function Topbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    : { data: null }

  const displayName = profile?.full_name ?? user?.email ?? 'User'
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-4 lg:px-6 shrink-0">
      {/* Mobile logo */}
      <Link href="/dashboard" className="lg:hidden text-base font-bold text-zinc-900">
        NidhiAI
      </Link>

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <Link
          href="/import"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          + Import holdings
        </Link>

        <TopbarUserMenu
          displayName={displayName}
          email={user?.email ?? ''}
          initials={initials}
        />
      </div>
    </header>
  )
}
