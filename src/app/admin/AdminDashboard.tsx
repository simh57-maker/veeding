'use client'

import { useState } from 'react'
import { Users, Activity, Video, LogOut, Shield } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
}

interface LoginRow {
  id: string
  email: string
  provider: string
  logged_in_at: string
  user_id: string
}

interface Props {
  users: UserRow[]
  loginHistory: LoginRow[]
  currentUser: { id: string; email: string }
}

type Tab = 'users' | 'activity'

export default function AdminDashboard({ users, loginHistory, currentUser }: Props) {
  const [tab, setTab] = useState<Tab>('users')
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#1E1E1E] flex flex-col">
      {/* Header */}
      <header className="h-12 bg-[#2C2C2C] border-b border-[#333] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#0D99FF] rounded-lg p-1">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Veeding</span>
          <span className="text-[#444]">/</span>
          <div className="flex items-center gap-1.5 text-[#888] text-sm">
            <Shield className="w-3.5 h-3.5" />
            Admin
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/editor"
            className="text-[#888] hover:text-[#E0E0E0] text-sm transition-colors flex items-center gap-1.5"
          >
            <Video className="w-3.5 h-3.5" />
            Editor
          </Link>
          <span className="text-[#555] text-xs">{currentUser.email}</span>
          <button
            onClick={handleLogout}
            className="text-[#888] hover:text-[#E0E0E0] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={<Users className="w-5 h-5 text-[#0D99FF]" />}
            label="Total Users"
            value={users.length}
          />
          <StatCard
            icon={<Activity className="w-5 h-5 text-[#4dbb88]" />}
            label="Login Events"
            value={loginHistory.length}
          />
          <StatCard
            icon={<Shield className="w-5 h-5 text-[#ff9f4d]" />}
            label="Admins"
            value={users.filter((u) => u.role === 'admin').length}
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#333] mb-4">
          {(['users', 'activity'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'text-[#0D99FF] border-b-2 border-[#0D99FF]'
                  : 'text-[#888] hover:text-[#E0E0E0]'
              }`}
            >
              {t === 'users' ? 'Users' : 'Login Activity'}
            </button>
          ))}
        </div>

        {/* Users Table */}
        {tab === 'users' && (
          <div className="bg-[#2C2C2C] border border-[#333] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333] bg-[#222]">
                  <Th>Email</Th>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`border-b border-[#2a2a2a] hover:bg-[#333] transition-colors ${
                      i % 2 === 0 ? 'bg-[#2C2C2C]' : 'bg-[#282828]'
                    }`}
                  >
                    <td className="px-4 py-3 text-[#E0E0E0]">{user.email}</td>
                    <td className="px-4 py-3 text-[#888]">{user.full_name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-[#0D99FF]/20 text-[#0D99FF]'
                            : 'bg-[#333] text-[#888]'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#555] text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[#555] text-sm">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Login Activity Table */}
        {tab === 'activity' && (
          <div className="bg-[#2C2C2C] border border-[#333] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333] bg-[#222]">
                  <Th>Email</Th>
                  <Th>Provider</Th>
                  <Th>Timestamp</Th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-[#2a2a2a] hover:bg-[#333] transition-colors ${
                      i % 2 === 0 ? 'bg-[#2C2C2C]' : 'bg-[#282828]'
                    }`}
                  >
                    <td className="px-4 py-3 text-[#E0E0E0]">{log.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-[#1a3a1a] text-[#4dbb88] px-2 py-0.5 rounded-full">
                        {log.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#888] text-xs">
                      {new Date(log.logged_in_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {loginHistory.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[#555] text-sm">
                      No login events yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-[#2C2C2C] border border-[#333] rounded-xl p-4 flex items-center gap-4">
      <div className="bg-[#1E1E1E] rounded-lg p-2.5">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-[#888] text-xs">{label}</div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-[11px] text-[#666] uppercase tracking-wider font-medium">
      {children}
    </th>
  )
}
