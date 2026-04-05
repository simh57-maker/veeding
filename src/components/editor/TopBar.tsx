'use client'

import { Video, Download, LogOut } from 'lucide-react'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useEditorStore, Resolution } from '@/store/editorStore'
import ExportModal from './ExportModal'
import Image from 'next/image'

const RESOLUTIONS: { label: string; value: Resolution }[] = [
  { label: '1920 × 1080', value: '1920x1080' },
  { label: '1200 × 1200', value: '1200x1200' },
  { label: '1080 × 1920', value: '1080x1920' },
]

interface Props {
  user: { id: string; email: string; name: string; image: string }
}

export default function TopBar({ user }: Props) {
  const [showExport, setShowExport] = useState(false)
  const { resolution, setResolution } = useEditorStore()

  return (
    <>
      <header className="h-12 bg-[#2C2C2C] border-b border-[#333] flex items-center justify-between px-4 shrink-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="bg-[#0D99FF] rounded-lg p-1">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-wide">Veeding</span>
        </div>

        {/* Center: Resolution select */}
        <select
          value={resolution}
          onChange={(e) => setResolution(e.target.value as Resolution)}
          className="bg-[#1E1E1E] border border-[#444] text-[#E0E0E0] text-sm rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-[#666] transition-colors"
        >
          {RESOLUTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Right */}
        <div className="flex items-center gap-3">
          {user.image && (
            <Image src={user.image} alt={user.name} width={24} height={24} className="rounded-full" />
          )}
          <span className="text-[#555] text-xs hidden sm:block">{user.email}</span>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 bg-[#0D99FF] hover:bg-[#0b87e0] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 rounded-lg hover:bg-[#333] text-[#888] hover:text-[#E0E0E0] transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </>
  )
}
