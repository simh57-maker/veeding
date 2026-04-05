import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Log the login
      await supabase.from('login_history').insert({
        user_id: data.user.id,
        email: data.user.email!,
        provider: data.user.app_metadata.provider ?? 'google',
      })

      return NextResponse.redirect(`${origin}/editor`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
