'use client'

import { useState } from 'react'
import { useEditorStore, QUALITY_MAP, Quality } from '@/store/editorStore'
import { Settings2, Film, Download, Monitor } from 'lucide-react'
import ExportModal from './ExportModal'

const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0]

export default function RightPanel() {
  const { activeVideo, updateVideoClip, quality, setQuality, activeBanner, bannerAssets } = useEditorStore()
  const [showExport, setShowExport] = useState(false)

  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const sizeLabel = bannerAsset ? `${bannerAsset.width} × ${bannerAsset.height}` : null

  return (
    <>
      <aside className="w-[240px] bg-[#2C2C2C] border-l border-[#333] flex flex-col shrink-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-[#333] flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#888]" />
          <span className="text-xs font-semibold text-[#E0E0E0] uppercase tracking-wider">Properties</span>
        </div>

        <div className="p-4 space-y-5 flex-1">

          {/* Canvas Size */}
          <Section title="Canvas Size" icon={<Monitor className="w-3.5 h-3.5" />}>
            {sizeLabel ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#3a3a3a]">
                <span className="text-[10px] text-[#555]">Canvas</span>
                <span className="text-xs text-[#E0E0E0] font-medium">{sizeLabel}</span>
              </div>
            ) : (
              <p className="text-[10px] text-[#444] px-1">배너를 업로드하면 설정됩니다</p>
            )}
          </Section>

          {/* Export Quality */}
          <Section title="Export Quality" icon={<Settings2 className="w-3.5 h-3.5" />}>
            <div className="space-y-1">
              {(Object.keys(QUALITY_MAP) as Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                    quality === q
                      ? 'border-[#0D99FF] bg-[#0D99FF]/10 text-[#0D99FF]'
                      : 'border-[#3a3a3a] text-[#888] hover:border-[#555] hover:text-[#E0E0E0]'
                  }`}
                >
                  <span className="capitalize">{q}</span>
                  <span className="text-[10px] opacity-70">
                    {QUALITY_MAP[q].label.split('(')[1]?.replace(')', '') ?? ''}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* Speed */}
          {activeVideo && (
            <Section title="Speed" icon={<Film className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-1">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateVideoClip({ speed: s })}
                    className={`py-1.5 rounded-lg text-xs border font-medium transition-all ${
                      activeVideo.speed === s
                        ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                        : 'border-[#444] text-[#888] hover:border-[#666] hover:text-[#E0E0E0]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </Section>
          )}

        </div>

        {/* Export 버튼 — 하단 고정 */}
        <div className="p-3 border-t border-[#333] shrink-0">
          <button
            onClick={() => setShowExport(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#0D99FF] hover:bg-[#0b87e0] text-white text-sm font-medium rounded-lg transition-colors"
            style={{ height: 44 }}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </aside>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </>
  )
}

function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[#888]">{icon}</span>
        <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}
