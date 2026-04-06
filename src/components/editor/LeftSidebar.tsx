'use client'

import { useRef, useState, useCallback } from 'react'
import { ImageIcon, Film, Layers, Plus, Trash2, Check } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { detectAlphaBounds } from '@/lib/alphaDetect'

type Tab = 'assets' | 'sets'

export default function LeftSidebar() {
  const [tab, setTab] = useState<Tab>('assets')
  const [bannerDragging, setBannerDragging] = useState(false)
  const [videoDragging, setVideoDragging] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const {
    bannerAssets, videoAssets,
    addBannerAsset, addVideoAsset,
    setActiveBanner, setActiveVideo,
    activeBanner, activeVideo,
    autoCompose, saveSet,
    sets, activeSetId, loadSet, removeSet,
  } = useEditorStore()

  async function processBannerFiles(files: File[]) {
    for (const file of files) {
      if (!file.type.includes('png') && !file.type.includes('image')) continue
      const dataUrl = await fileToDataUrl(file)
      const img = await loadImage(dataUrl)
      const alphaBounds = await detectAlphaBounds(dataUrl)
      addBannerAsset({
        id: crypto.randomUUID(), name: file.name,
        url: URL.createObjectURL(file), dataUrl, alphaBounds,
        width: img.naturalWidth, height: img.naturalHeight,
      })
    }
  }

  async function processVideoFiles(files: File[]) {
    for (const file of files) {
      if (!file.type.includes('video')) continue
      const url = URL.createObjectURL(file)
      const duration = await getVideoDuration(url)
      const { width, height } = await getVideoSize(url)
      addVideoAsset({ id: crypto.randomUUID(), name: file.name, url, duration, width, height })
    }
  }

  const onBannerDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setBannerDragging(false)
    await processBannerFiles(Array.from(e.dataTransfer.files))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onVideoDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setVideoDragging(false)
    await processVideoFiles(Array.from(e.dataTransfer.files))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectBanner(assetId: string) {
    setActiveBanner({ assetId, inPoint: 0, outPoint: 99999, x: 0, y: 0, scaleX: 1, scaleY: 1 })
    if (activeVideo) autoCompose()
  }

  function selectVideo(assetId: string) {
    const asset = videoAssets.find((v) => v.id === assetId)
    if (!asset) return
    setActiveVideo({ assetId, inPoint: 0, outPoint: asset.duration, speed: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 })
    if (activeBanner) autoCompose()
  }

  // w-60의 2배 = w-[480px]
  return (
    <aside className="w-[480px] bg-[#2C2C2C] border-r border-[#333] flex flex-col shrink-0">
      {/* 탭 */}
      <div className="flex border-b border-[#333] shrink-0">
        <TabBtn active={tab === 'assets'} onClick={() => setTab('assets')}>
          <Layers className="w-3.5 h-3.5" /> Assets
        </TabBtn>
        <TabBtn active={tab === 'sets'} onClick={() => setTab('sets')}>
          <Check className="w-3.5 h-3.5" /> Sets
          {sets.length > 0 && (
            <span className="ml-1 bg-[#0D99FF] text-white text-[9px] rounded-full px-1.5 py-0.5 leading-none">
              {sets.length}
            </span>
          )}
        </TabBtn>
      </div>

      {/* ═══ ASSETS 탭 — 가로 2열 ══════════════════════════ */}
      {tab === 'assets' && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── 왼쪽 열: Banner (파란 라인) ── */}
          <div className="flex-1 flex flex-col border-r border-[#333] overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#0D99FF]/10 border-b border-[#0D99FF]/20 border-l-2 border-l-[#0D99FF] shrink-0">
              <div className="flex items-center gap-1.5 text-[#0D99FF] text-[11px] font-semibold">
                <ImageIcon className="w-3 h-3" /> Banner
              </div>
              <button onClick={() => bannerInputRef.current?.click()} className="text-[#0D99FF] hover:text-white transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <input ref={bannerInputRef} type="file" accept="image/png,image/*" multiple className="hidden"
                onChange={(e) => { processBannerFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            </div>

            {/* 에셋 그리드 + 드롭존 overlay */}
            <div
              className="flex-1 overflow-y-auto p-2 relative"
              onDragOver={(e) => { e.preventDefault(); setBannerDragging(true) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setBannerDragging(false) }}
              onDrop={onBannerDrop}
            >
              {/* 드래그 중 overlay */}
              {bannerDragging && (
                <div className="absolute inset-0 z-10 border-2 border-dashed border-[#0D99FF] bg-[#0D99FF]/10 rounded-lg flex items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-[#0D99FF] font-medium">드롭하여 추가</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                {bannerAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => selectBanner(asset.id)}
                    className={`flex flex-col items-center rounded-lg overflow-hidden border-2 transition-all ${
                      activeBanner?.assetId === asset.id ? 'border-[#0D99FF]' : 'border-transparent hover:border-[#0D99FF]/40'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.dataUrl} alt={asset.name} className="w-full h-16 object-contain bg-[#1E1E1E]" />
                    <div className="w-full px-1 py-0.5 bg-[#222] flex items-center justify-between">
                      <span className="text-[9px] text-[#888] truncate">{asset.name}</span>
                      {asset.alphaBounds && <span className="text-[9px] text-[#0D99FF] shrink-0 ml-1">α</span>}
                    </div>
                  </button>
                ))}
              </div>
              {bannerAssets.length === 0 && (
                <div
                  onClick={() => bannerInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-full min-h-[80px] cursor-pointer text-[#444] hover:text-[#555] transition-colors"
                >
                  <span className="text-[10px]">드래그 또는 클릭</span>
                </div>
              )}
            </div>
          </div>

          {/* ── 오른쪽 열: Video (보라 라인) ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#8B5CF6]/10 border-b border-[#8B5CF6]/20 border-l-2 border-l-[#8B5CF6] shrink-0">
              <div className="flex items-center gap-1.5 text-[#8B5CF6] text-[11px] font-semibold">
                <Film className="w-3 h-3" /> Video
              </div>
              <button onClick={() => videoInputRef.current?.click()} className="text-[#8B5CF6] hover:text-white transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden"
                onChange={(e) => { processVideoFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            </div>

            {/* 영상 목록 + 드롭존 overlay */}
            <div
              className="flex-1 overflow-y-auto p-2 space-y-1 relative"
              onDragOver={(e) => { e.preventDefault(); setVideoDragging(true) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setVideoDragging(false) }}
              onDrop={onVideoDrop}
            >
              {/* 드래그 중 overlay */}
              {videoDragging && (
                <div className="absolute inset-0 z-10 border-2 border-dashed border-[#8B5CF6] bg-[#8B5CF6]/10 rounded-lg flex items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-[#8B5CF6] font-medium">드롭하여 추가</span>
                </div>
              )}

              {videoAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => selectVideo(asset.id)}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg border-2 transition-all ${
                    activeVideo?.assetId === asset.id
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                      : 'border-transparent hover:border-[#8B5CF6]/40 hover:bg-[#1E1E1E]'
                  }`}
                >
                  <Film className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                  <div className="text-left overflow-hidden">
                    <div className="text-xs text-[#E0E0E0] truncate">{asset.name}</div>
                    <div className="text-[10px] text-[#888]">{asset.duration.toFixed(1)}s · {asset.width}×{asset.height}</div>
                  </div>
                </button>
              ))}
              {videoAssets.length === 0 && (
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-full min-h-[80px] cursor-pointer text-[#444] hover:text-[#555] transition-colors"
                >
                  <span className="text-[10px]">드래그 또는 클릭</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETS 탭 ═══════════════════════════════════════ */}
      {tab === 'sets' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-[#444] gap-2">
              <Layers className="w-6 h-6" />
              <span className="text-xs text-center">세트가 없습니다<br/>Asset 탭에서 배너+영상 선택 후<br/>아래 버튼으로 등록하세요</span>
            </div>
          )}
          {sets.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all group ${
                activeSetId === s.id ? 'border-[#0D99FF] bg-[#0D99FF]/10' : 'border-transparent hover:border-[#444] hover:bg-[#1E1E1E]'
              }`}
              onClick={() => loadSet(s.id)}
            >
              <div className="flex-1 overflow-hidden">
                <div className="text-xs text-[#E0E0E0] truncate font-medium">{s.name}</div>
                <div className="text-[10px] text-[#555]">{s.projectDuration.toFixed(1)}s</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeSet(s.id) }}
                className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 하단 버튼 */}
      {activeBanner && activeVideo && (
        <div className="p-3 border-t border-[#333] flex flex-col gap-2 shrink-0">
          <button
            onClick={autoCompose}
            className="w-full flex items-center justify-center gap-2 bg-[#1E1E1E] hover:bg-[#333] border border-[#444] text-[#E0E0E0] text-xs font-medium py-1.5 rounded-lg transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-[#0D99FF]" />
            Set Composition
          </button>
          <button
            onClick={saveSet}
            className="w-full flex items-center justify-center gap-2 bg-[#0D99FF] hover:bg-[#0b87e0] text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            세트로 등록
          </button>
        </div>
      )}
    </aside>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
        active ? 'text-[#0D99FF] border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#E0E0E0]'
      }`}
    >
      {children}
    </button>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.src = url; v.onloadedmetadata = () => resolve(v.duration); v.onerror = () => resolve(0)
  })
}

function getVideoSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.src = url; v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight }); v.onerror = () => resolve({ width: 1920, height: 1080 })
  })
}
