'use client'

import { signOut } from 'next-auth/react'
import { Activity, Video, LogOut, Shield } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface LogRow {
  email: string
  name: string
  image: string
  loggedInAt: string
}

interface Props {
  logs: LogRow[]
  currentUser: { email: string; name: string }
}

export default function AdminDashboard({ logs, currentUser }: Props) {
  // Unique users from logs
  const uniqueUsers = Array.from(new Map(logs.map((l) => [l.email, l])).values())

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
          <Link href="/editor" className="text-[#888] hover:text-[#E0E0E0] text-sm transition-colors flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5" />
            Editor
          </Link>
          <span className="text-[#555] text-xs">{currentUser.email}</span>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-[#888] hover:text-[#E0E0E0] transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<Activity className="w-5 h-5 text-[#0D99FF]" />} label="Total Logins" value={logs.length} />
          <StatCard icon={<Activity className="w-5 h-5 text-[#4dbb88]" />} label="Unique Users" value={uniqueUsers.length} />
        </div>

        {/* Login Activity Table */}
        <div>
          <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-3">Login Activity</h2>
          <div className="bg-[#2C2C2C] border border-[#333] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333] bg-[#222]">
                  <Th>User</Th>
                  <Th>Email</Th>
                  <Th>Time</Th>
                </tr>
              </thead>
              <tbody>
                {logs.slice().reverse().map((log, i) => (
                  <tr key={i} className={`border-b border-[#2a2a2a] hover:bg-[#333] transition-colors ${i % 2 === 0 ? 'bg-[#2C2C2C]' : 'bg-[#282828]'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {log.image ? (
                          <Image src={log.image} alt={log.name} width={20} height={20} className="rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[#444]" />
                        )}
                        <span className="text-[#E0E0E0] text-xs">{log.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#888] text-xs">{log.email}</td>
                    <td className="px-4 py-3 text-[#555] text-xs">{new Date(log.loggedInAt).toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[#555] text-sm">아직 로그인 기록이 없습니다</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
  return <th className="text-left px-4 py-3 text-[11px] text-[#666] uppercase tracking-wider font-medium">{children}</th>
}
