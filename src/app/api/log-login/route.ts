import { auth } from '@/auth'
import { NextResponse } from 'next/server'

// In-memory store for Vercel serverless (resets on cold start)
// For persistent logs, connect Vercel Postgres or KV here
const loginLogs: { email: string; name: string; image: string; loggedInAt: string }[] = []

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  loginLogs.push({
    email: session.user.email,
    name: session.user.name ?? '',
    image: session.user.image ?? '',
    loggedInAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await auth()
  const adminEmail = process.env.ADMIN_EMAIL

  if (!session?.user?.email || session.user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ logs: loginLogs })
}
