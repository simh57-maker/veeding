'use client'

import { Video, Download, LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef } from 'react'
import { useEditorStore, Resolution } from '@/store/editorStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ExportModal from './ExportModal'

const RESOLUTIONS: { label: string; value: Resolution }[] = [
  { label: '1920 × 1080 (Landscape)', value: '1920x1080' },
  { label: '1200 × 1200 (Square)', value: '1200x1200' },
  { label: '1080 × 1920 (Portrait)', value: '1080x1920' },
]

interface Props {
  user: { id: string; email: string }
}

export default function TopBar({ user }: Props) {
  const [resOpen, setResOpen] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const { resolution, setResolution } = useEditorStore()
  const router = useRouter()
  const dropRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const currentRes = RESOLUTIONS.find((r) => r.value === resolution)

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

        {/* Center: Resolution Switcher */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setResOpen((v) => !v)}
            className="flex items-center gap-2 bg-[#1E1E1E] hover:bg-[#333] border border-[#444] rounded-lg px-3 py-1.5 text-sm text-[#E0E0E0] transition-colors"
          >
            <span>{currentRes?.label ?? resolution}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#888]" />
          </button>

          {resOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-[#2C2C2C] border border-[#444] rounded-xl shadow-2xl overflow-hidden z-50">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setResolution(r.value); setResOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[#333] ${
                    r.value === resolution ? 'text-[#0D99FF]' : 'text-[#E0E0E0]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Export + Logout */}
        <div className="flex items-center gap-3">
          <span className="text-[#555] text-xs hidden sm:block">{user.email}</span>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 bg-[#0D99FF] hover:bg-[#0b87e0] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleLogout}
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
