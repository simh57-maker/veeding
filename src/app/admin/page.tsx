import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/editor')
  }

  // Fetch all users
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })

  // Fetch login history
  const { data: loginHistory } = await supabase
    .from('login_history')
    .select('id, email, provider, logged_in_at, user_id')
    .order('logged_in_at', { ascending: false })
    .limit(100)

  return (
    <AdminDashboard
      users={users ?? []}
      loginHistory={loginHistory ?? []}
      currentUser={{ id: user.id, email: user.email ?? '' }}
    />
  )
}
