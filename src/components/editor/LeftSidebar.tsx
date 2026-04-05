'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Film, Upload, Layers } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { detectAlphaBounds } from '@/lib/alphaDetect'

type Tab = 'banners' | 'videos'

export default function LeftSidebar() {
  const [tab, setTab] = useState<Tab>('banners')
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const {
    bannerAssets, videoAssets,
    addBannerAsset, addVideoAsset,
    setActiveBanner, setActiveVideo,
    activeBanner, activeVideo,
    autoCompose,
  } = useEditorStore()

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const url = URL.createObjectURL(file)
      const dataUrl = await fileToDataUrl(file)

      const img = await loadImage(dataUrl)
      const alphaBounds = await detectAlphaBounds(dataUrl)

      addBannerAsset({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        dataUrl,
        alphaBounds,
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }
    e.target.value = ''
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const url = URL.createObjectURL(file)
      const duration = await getVideoDuration(url)
      const { width, height } = await getVideoSize(url)

      addVideoAsset({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        duration,
        width,
        height,
      })
    }
    e.target.value = ''
  }

  function selectBanner(assetId: string) {
    setActiveBanner({ assetId, inPoint: 0, outPoint: 99999, x: 0, y: 0, scaleX: 1, scaleY: 1 })
    if (activeVideo) autoCompose()
  }

  function selectVideo(assetId: string) {
    const asset = videoAssets.find((v) => v.id === assetId)
    if (!asset) return
    setActiveVideo({
      assetId,
      inPoint: 0,
      outPoint: asset.duration,
      speed: 1,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    })
    if (activeBanner) autoCompose()
  }

  return (
    <aside className="w-56 bg-[#2C2C2C] border-r border-[#333] flex flex-col shrink-0">
      {/* Tabs */}
      <div className="flex border-b border-[#333]">
        <button
          onClick={() => setTab('banners')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
            tab === 'banners' ? 'text-[#0D99FF] border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#E0E0E0]'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Banners
        </button>
        <button
          onClick={() => setTab('videos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
            tab === 'videos' ? 'text-[#0D99FF] border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#E0E0E0]'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          Videos
        </button>
      </div>

      {/* Upload button */}
      <div className="p-3">
        {tab === 'banners' ? (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png"
              multiple
              className="hidden"
              onChange={handleBannerUpload}
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-[#1E1E1E] hover:bg-[#333] border border-dashed border-[#444] rounded-lg py-2 text-xs text-[#888] hover:text-[#E0E0E0] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload PNG Banner
            </button>
          </>
        ) : (
          <>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={handleVideoUpload}
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-[#1E1E1E] hover:bg-[#333] border border-dashed border-[#444] rounded-lg py-2 text-xs text-[#888] hover:text-[#E0E0E0] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Video
            </button>
          </>
        )}
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {tab === 'banners' && bannerAssets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => selectBanner(asset.id)}
            className={`w-full flex flex-col items-center gap-1 rounded-lg overflow-hidden border transition-all ${
              activeBanner?.assetId === asset.id
                ? 'border-[#0D99FF]'
                : 'border-transparent hover:border-[#444]'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.dataUrl}
              alt={asset.name}
              className="w-full h-24 object-contain bg-[#1E1E1E]"
              style={{ imageRendering: 'pixelated' }}
            />
            <span className="text-[10px] text-[#888] pb-1 px-1 truncate w-full text-center">{asset.name}</span>
            {asset.alphaBounds && (
              <span className="text-[9px] text-[#0D99FF] pb-1">Alpha detected</span>
            )}
          </button>
        ))}

        {tab === 'videos' && videoAssets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => selectVideo(asset.id)}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg border transition-all ${
              activeVideo?.assetId === asset.id
                ? 'border-[#0D99FF] bg-[#1E1E1E]'
                : 'border-transparent hover:border-[#444] hover:bg-[#1E1E1E]'
            }`}
          >
            <Film className="w-4 h-4 text-[#888] shrink-0" />
            <div className="text-left overflow-hidden">
              <div className="text-xs text-[#E0E0E0] truncate">{asset.name}</div>
              <div className="text-[10px] text-[#888]">{asset.duration.toFixed(1)}s</div>
            </div>
          </button>
        ))}

        {tab === 'banners' && bannerAssets.length === 0 && (
          <EmptyState icon={<ImageIcon className="w-6 h-6" />} label="No banners yet" />
        )}
        {tab === 'videos' && videoAssets.length === 0 && (
          <EmptyState icon={<Film className="w-6 h-6" />} label="No videos yet" />
        )}
      </div>

      {/* Compose button */}
      {activeBanner && activeVideo && (
        <div className="p-3 border-t border-[#333]">
          <button
            onClick={autoCompose}
            className="w-full flex items-center justify-center gap-2 bg-[#0D99FF] hover:bg-[#0b87e0] text-white text-xs font-medium py-2 rounded-lg transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            Set Composition
          </button>
        </div>
      )}
    </aside>
  )
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-[#555] gap-2">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
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
    const video = document.createElement('video')
    video.src = url
    video.onloadedmetadata = () => resolve(video.duration)
    video.onerror = () => resolve(0)
  })
}

function getVideoSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = url
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight })
    video.onerror = () => resolve({ width: 1920, height: 1080 })
  })
}
