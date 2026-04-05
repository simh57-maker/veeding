'use client'

import { Video, Download, LogOut } from 'lucide-react'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useEditorStore } from '@/store/editorStore'
import ExportModal from './ExportModal'
import Image from 'next/image'

interface Props {
  user: { id: string; email: string; name: string; image: string }
}

export default function TopBar({ user }: Props) {
  const [showExport, setShowExport] = useState(false)
  const { activeBanner, bannerAssets } = useEditorStore()

  // 현재 배너 크기를 표시
  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const sizeLabel = bannerAsset ? `${bannerAsset.width} × ${bannerAsset.height}` : null

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

        {/* Center: 현재 캔버스 크기 표시 */}
        {sizeLabel ? (
          <div className="flex items-center gap-2 bg-[#1E1E1E] border border-[#3a3a3a] rounded-lg px-3 py-1.5">
            <span className="text-[#888] text-xs">Canvas</span>
            <span className="text-[#E0E0E0] text-sm font-medium">{sizeLabel}</span>
          </div>
        ) : (
          <div className="text-[#555] text-xs">배너를 업로드하면 캔버스 크기가 설정됩니다</div>
        )}

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
