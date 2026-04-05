import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const session = await auth()

  if (!session?.user?.email) redirect('/login')

  const adminEmail = process.env.ADMIN_EMAIL
  if (session.user.email !== adminEmail) redirect('/editor')

  // Fetch login logs from API
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  let logs: { email: string; name: string; image: string; loggedInAt: string }[] = []
  try {
    const res = await fetch(`${baseUrl}/api/log-login`, { cache: 'no-store' })
    const data = await res.json()
    logs = data.logs ?? []
  } catch {
    logs = []
  }

  return (
    <AdminDashboard
      logs={logs}
      currentUser={{ email: session.user.email, name: session.user.name ?? '' }}
    />
  )
}
