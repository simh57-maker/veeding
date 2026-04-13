'use client'

import { useRef, useState, useCallback } from 'react'
import { ImageIcon, Film, Layers, Plus, Trash2, Check, Video } from 'lucide-react'
import NextImage from 'next/image'
import { useEditorStore } from '@/store/editorStore'
import { detectAlphaBounds } from '@/lib/alphaDetect'

type Tab = 'assets' | 'sets'

interface Props {
  user: { id: string; email: string; name: string; image: string }
}

export default function LeftSidebar({ user }: Props) {
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
    saveSet,
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
      const thumbnailUrl = await getVideoThumbnail(url)
      addVideoAsset({ id: crypto.randomUUID(), name: file.name, url, thumbnailUrl, duration, width, height })
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
  }

  function selectVideo(assetId: string) {
    if (!activeBanner) return
    const asset = videoAssets.find((v) => v.id === assetId)
    if (!asset) return
    setActiveVideo({ assetId, inPoint: 0, outPoint: asset.duration, speed: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 })
  }

  return (
    <aside className="w-[256px] h-full bg-[#161618] border border-[#252527] rounded-2xl flex flex-col shrink-0 overflow-hidden shadow-2xl shadow-black/60">

      {/* 로고 + 계정 */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#222224] border border-[#2e2e30] flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/asset/design/VEEDING_favicon.png" alt="Veeding" className="w-5 h-5 rounded-md" />
          </div>
          <span className="text-white/60 font-medium text-[13px] tracking-tight">Veeding</span>
        </div>
        <div title={user.email} className="cursor-default">
          {user.image ? (
            <NextImage src={user.image} alt={user.name} width={24} height={24} className="rounded-full opacity-40" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#222224] border border-[#2e2e30] flex items-center justify-center">
              <span className="text-[10px] text-white/30">{user.name?.[0] ?? '?'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="mx-4 mb-3 rounded-xl bg-[#1e1e20] p-1 flex gap-1 shrink-0 border border-[#252527]">
        <TabBtn active={tab === 'assets'} onClick={() => setTab('assets')}>
          <Layers className="w-3 h-3" /> Assets
        </TabBtn>
        <TabBtn active={tab === 'sets'} onClick={() => setTab('sets')}>
          <Check className="w-3 h-3" /> Sets
          {sets.length > 0 && (
            <span className="ml-1 bg-[#b780ff] text-[#0e0e10] text-[9px] rounded-full px-1.5 py-0.5 leading-none font-semibold">
              {sets.length}
            </span>
          )}
        </TabBtn>
      </div>

      {/* ═══ ASSETS 탭 ══════════════════════════════════════ */}
      {tab === 'assets' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Banner */}
          <div className="flex-1 flex flex-col overflow-hidden mx-4 mb-2 rounded-xl bg-[#1e1e20] border border-[#252527]">
            <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3 h-3 text-white/20" />
                <span className="text-[10px] font-medium text-white/25 uppercase tracking-widest">Banner</span>
              </div>
              <button onClick={() => bannerInputRef.current?.click()} className="text-white/20 hover:text-white/50 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <input ref={bannerInputRef} type="file" accept="image/png,image/*" multiple className="hidden"
                onChange={(e) => { processBannerFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            </div>

            <div
              className="flex-1 overflow-y-auto px-2 pb-2 relative"
              onDragOver={(e) => { e.preventDefault(); setBannerDragging(true) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setBannerDragging(false) }}
              onDrop={onBannerDrop}
            >
              {bannerDragging && (
                <div className="absolute inset-0 z-10 border-2 border-dashed border-[#b780ff]/40 bg-[#b780ff]/5 rounded-lg flex items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-white/50">드롭하여 추가</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {bannerAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => selectBanner(asset.id)}
                    className={`flex flex-col items-center rounded-lg overflow-hidden ring-2 transition-all ${
                      activeBanner?.assetId === asset.id ? 'ring-[#b780ff]/60' : 'ring-transparent hover:ring-white/15'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.dataUrl} alt={asset.name} className="w-full h-14 object-contain bg-black/30" />
                    <div className="w-full px-1.5 py-1 bg-[#161618] flex items-center justify-between">
                      <span className="text-[9px] text-white/30 truncate">{asset.name}</span>
                      {asset.alphaBounds && <span className="text-[9px] text-white/25 shrink-0 ml-1">α</span>}
                    </div>
                  </button>
                ))}
              </div>
              {bannerAssets.length === 0 && (
                <div onClick={() => bannerInputRef.current?.click()} className="flex items-center justify-center h-16 cursor-pointer text-white/15 hover:text-white/30 transition-colors">
                  <span className="text-[10px]">드래그 또는 클릭</span>
                </div>
              )}
            </div>
          </div>

          {/* Video */}
          <div className="flex-1 flex flex-col overflow-hidden mx-4 mb-3 rounded-xl bg-[#1e1e20] border border-[#252527] relative">
            <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <Film className="w-3 h-3 text-white/20" />
                <span className="text-[10px] font-medium text-white/25 uppercase tracking-widest">Video</span>
              </div>
              <button onClick={() => videoInputRef.current?.click()} className="text-white/20 hover:text-white/50 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden"
                onChange={(e) => { processVideoFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            </div>

            <div
              className="flex-1 overflow-y-auto px-2 pb-2 relative"
              onDragOver={(e) => { e.preventDefault(); setVideoDragging(true) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setVideoDragging(false) }}
              onDrop={onVideoDrop}
            >
              {videoDragging && (
                <div className="absolute inset-0 z-10 border-2 border-dashed border-[#b780ff]/40 bg-[#b780ff]/5 rounded-lg flex items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-white/50">드롭하여 추가</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {videoAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => selectVideo(asset.id)}
                    className={`flex flex-col items-center rounded-lg overflow-hidden ring-2 transition-all ${
                      activeVideo?.assetId === asset.id ? 'ring-[#b780ff]/60' : 'ring-transparent hover:ring-white/15'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-14 object-cover bg-black/30" />
                    <div className="w-full px-1.5 py-1 bg-[#161618] flex items-center justify-between">
                      <span className="text-[9px] text-white/30 truncate">{asset.name}</span>
                      <span className="text-[9px] text-white/25 shrink-0 ml-1">{asset.duration.toFixed(1)}s</span>
                    </div>
                  </button>
                ))}
              </div>
              {videoAssets.length === 0 && (
                <div onClick={() => videoInputRef.current?.click()} className="flex items-center justify-center h-16 cursor-pointer text-white/15 hover:text-white/30 transition-colors">
                  <span className="text-[10px]">드래그 또는 클릭</span>
                </div>
              )}
            </div>

            {!activeBanner && (
              <div className="absolute inset-0 rounded-xl bg-[#161618]/80 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] text-white/20 text-center px-4">배너를 먼저 선택하세요</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ SETS 탭 ════════════════════════════════════════ */}
      {tab === 'sets' && (
        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1.5">
          {sets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Layers className="w-6 h-6 text-white/10" />
              <span className="text-[11px] text-white/20 text-center leading-relaxed">세트가 없습니다<br/>배너+영상 선택 후<br/>아래 버튼으로 등록하세요</span>
            </div>
          )}
          {sets.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl cursor-pointer transition-all group ${
                activeSetId === s.id
                  ? 'bg-[#222224] ring-1 ring-[#b780ff]/30'
                  : 'bg-[#1e1e20] hover:bg-[#222224]'
              }`}
              onClick={() => loadSet(s.id)}
            >
              <div className="flex-1 overflow-hidden">
                <div className={`text-[12px] truncate font-medium ${activeSetId === s.id ? 'text-white/70' : 'text-white/45'}`}>{s.name}</div>
                <div className="text-[10px] text-white/20 mt-0.5">{s.projectDuration.toFixed(1)}s</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeSet(s.id) }}
                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="px-4 pb-4 shrink-0">
        <button
          onClick={saveSet}
          disabled={!activeBanner || !activeVideo}
          className="w-full flex items-center justify-center gap-2 bg-[#222224] hover:bg-[#2a2a2c] disabled:opacity-15 disabled:cursor-not-allowed text-white/35 text-[12px] rounded-xl transition-colors h-11 border border-[#2e2e30]"
        >
          <Plus className="w-3.5 h-3.5" />
          세트로 등록
        </button>
      </div>
    </aside>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] transition-all ${
        active ? 'bg-[#2a2a2c] text-white/70' : 'text-white/25 hover:text-white/45'
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

function getVideoThumbnail(url: string): Promise<string> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.src = url
    v.currentTime = 0
    v.muted = true
    v.playsInline = true
    const onSeeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = v.videoWidth  || 320
      canvas.height = v.videoHeight || 180
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
      v.removeEventListener('seeked', onSeeked)
    }
    v.addEventListener('seeked', onSeeked)
    v.addEventListener('loadedmetadata', () => { v.currentTime = 0 })
    v.onerror = () => resolve('')
  })
}
