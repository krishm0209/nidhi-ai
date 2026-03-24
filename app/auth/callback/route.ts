import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const redirectUrl = new URL(next, process.env.NEXT_PUBLIC_APP_URL || origin)
      return NextResponse.redirect(redirectUrl.toString())
    }
  }

  const errorUrl = new URL('/login?error=auth_callback_failed', process.env.NEXT_PUBLIC_APP_URL || origin)
  return NextResponse.redirect(errorUrl.toString())
}
