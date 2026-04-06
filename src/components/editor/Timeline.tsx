'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { Play, Pause, SkipBack } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

const TRACK_HEIGHT = 28
const HEADER_HEIGHT = 24
const LABEL_W = 72

export default function Timeline() {
  const {
    projectDuration, currentTime, setCurrentTime,
    isPlaying, setIsPlaying,
    activeBanner, activeVideo,
    bannerAssets, videoAssets,
    updateVideoClip, updateBannerClip,
  } = useEditorStore()

  const timelineRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const dragState = useRef<{
    type: 'playhead' | 'videoIn' | 'videoOut' | 'bannerIn' | 'bannerOut'
    startX: number
    startValue: number
    pxPerSec: number
  } | null>(null)

  // 트랙 영역 너비 관찰 → pxPerSec 동적 계산
  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTrackWidth(el.clientWidth))
    ro.observe(el)
    setTrackWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // 마지막 틱이 오른쪽 끝에 오도록 pxPerSec 계산
  // ticks: 0, 1, 2, ..., ceil(duration) (+ 소수 끝값)
  const end = Math.ceil(projectDuration)
  const ticks: number[] = []
  for (let t = 0; t <= end; t++) ticks.push(t)
  if (projectDuration % 1 !== 0 && !ticks.includes(projectDuration)) {
    ticks.push(parseFloat(projectDuration.toFixed(2)))
  }
  const lastTick = ticks[ticks.length - 1]

  // trackWidth가 0이면 fallback
  const pxPerSec = trackWidth > 0 && lastTick > 0
    ? (trackWidth - 8) / lastTick   // -8: 마지막 틱 라벨이 잘리지 않게 여유
    : 80

  const timeToX = (t: number) => t * pxPerSec
  const xToTime = (x: number) => x / pxPerSec

  const startDrag = useCallback((
    e: React.MouseEvent,
    type: 'playhead' | 'videoIn' | 'videoOut' | 'bannerIn' | 'bannerOut',
    startValue: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const currentPxPerSec = timelineRef.current
      ? (timelineRef.current.clientWidth - 8) / lastTick
      : 80
    dragState.current = { type, startX: e.clientX, startValue, pxPerSec: currentPxPerSec }

    const onMove = (me: MouseEvent) => {
      if (!dragState.current) return
      const dx = me.clientX - dragState.current.startX
      const dt = dx / dragState.current.pxPerSec
      const newTime = Math.max(0, dragState.current.startValue + dt)
      const { type: t } = dragState.current

      if (t === 'playhead')   setCurrentTime(Math.min(newTime, projectDuration))
      else if (t === 'videoIn'   && activeVideo)   updateVideoClip({ inPoint: Math.min(newTime, activeVideo.outPoint - 0.1) })
      else if (t === 'videoOut'  && activeVideo)   updateVideoClip({ outPoint: Math.max(newTime, activeVideo.inPoint + 0.1) })
      else if (t === 'bannerIn'  && activeBanner)  updateBannerClip({ inPoint: Math.min(newTime, activeBanner.outPoint - 0.1) })
      else if (t === 'bannerOut' && activeBanner)  updateBannerClip({ outPoint: Math.max(newTime, activeBanner.inPoint + 0.1) })
    }

    const onUp = () => {
      dragState.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [activeVideo, activeBanner, updateVideoClip, updateBannerClip, setCurrentTime, projectDuration, lastTick])

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    setCurrentTime(Math.max(0, Math.min(xToTime(x), projectDuration)))
  }

  const videoAsset  = activeVideo  ? videoAssets.find((v) => v.id === activeVideo.assetId)  : null
  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null

  return (
    <div className="bg-[#1A1A1A] border-t border-[#333] flex flex-col shrink-0" style={{ height: 140 }}>

      {/* ── Transport bar ── */}
      <div className="h-9 bg-[#2C2C2C] border-b border-[#333] flex items-center gap-3 px-4 shrink-0">
        <button
          onClick={() => { setCurrentTime(0); setIsPlaying(false) }}
          className="text-[#888] hover:text-[#E0E0E0] transition-colors"
          title="처음으로"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-[#0D99FF] hover:bg-[#0b87e0] text-white rounded-lg p-1.5 transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <span className="text-[11px] text-[#888] font-mono">
          {formatTime(currentTime)} / {formatTime(projectDuration)}
        </span>
      </div>

      {/* ── 트랙 영역 ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* 왼쪽 고정 레이블 열 */}
        <div className="shrink-0 flex flex-col border-r border-[#2a2a2a]" style={{ width: LABEL_W }}>
          <div style={{ height: HEADER_HEIGHT }} className="bg-[#222] border-b border-[#333]" />
          <div
            className="flex items-center px-3 border-b border-[#2a2a2a] bg-[#1A1A1A]"
            style={{ height: TRACK_HEIGHT }}
          >
            <div className="w-2 h-2 rounded-sm bg-[#4dbb88] mr-2 shrink-0" />
            <span className="text-[10px] text-[#666]">Banner</span>
          </div>
          <div
            className="flex items-center px-3 border-b border-[#2a2a2a] bg-[#1A1A1A]"
            style={{ height: TRACK_HEIGHT }}
          >
            <div className="w-2 h-2 rounded-sm bg-[#4d88ff] mr-2 shrink-0" />
            <span className="text-[10px] text-[#666]">Video</span>
          </div>
        </div>

        {/* 트랙 본체 — 스크롤 없이 꽉 채움 */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-hidden relative select-none"
          onClick={handleTimelineClick}
        >
          <div className="relative h-full w-full">

            {/* 눈금 헤더 */}
            <div
              className="absolute top-0 left-0 right-0 bg-[#222] border-b border-[#333]"
              style={{ height: HEADER_HEIGHT }}
            >
              {ticks.map((t) => {
                const isEnd = t === ticks[ticks.length - 1]
                return (
                  <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: timeToX(t) }}>
                    <div className="w-px bg-[#444]" style={{ height: isEnd ? HEADER_HEIGHT : 10 }} />
                    <span className={`mt-0.5 font-mono text-[9px] ${isEnd ? 'text-[#FF4D4D]' : 'text-[#555]'}`}>
                      {Number.isInteger(t) ? `${t}s` : `${t.toFixed(2)}s`}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 트랙들 */}
            <div style={{ paddingTop: HEADER_HEIGHT }}>

              {/* Banner 트랙 */}
              <div className="relative border-b border-[#2a2a2a]" style={{ height: TRACK_HEIGHT }}>
                {activeBanner && bannerAsset && (
                  <div className="absolute top-1" style={{ left: timeToX(activeBanner.inPoint) }}>
                    <div
                      className="relative flex items-center bg-[#1a4d3a] border border-[#2a7a5a] rounded overflow-hidden"
                      style={{ width: timeToX(activeBanner.outPoint - activeBanner.inPoint), height: TRACK_HEIGHT - 8 }}
                    >
                      <span className="text-[9px] text-[#4dbb88] px-2 truncate flex-1">{bannerAsset.name}</span>
                      <div className="absolute left-0 top-0 w-2 h-full bg-[#4dbb88] opacity-0 hover:opacity-100 cursor-ew-resize rounded-l"
                        onMouseDown={(e) => startDrag(e, 'bannerIn', activeBanner.inPoint)} />
                      <div className="absolute right-0 top-0 w-2 h-full bg-[#4dbb88] opacity-0 hover:opacity-100 cursor-ew-resize rounded-r"
                        onMouseDown={(e) => startDrag(e, 'bannerOut', activeBanner.outPoint)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Video 트랙 */}
              <div className="relative border-b border-[#2a2a2a]" style={{ height: TRACK_HEIGHT }}>
                {activeVideo && videoAsset && (
                  <div className="absolute top-1" style={{ left: timeToX(activeVideo.inPoint / activeVideo.speed) }}>
                    <div
                      className="relative flex items-center bg-[#1a2d4d] border border-[#2a4d8a] rounded overflow-hidden"
                      style={{ width: timeToX((activeVideo.outPoint - activeVideo.inPoint) / activeVideo.speed), height: TRACK_HEIGHT - 8 }}
                    >
                      <span className="text-[9px] text-[#4d88ff] px-2 truncate flex-1">
                        {videoAsset.name} ({activeVideo.speed}x)
                      </span>
                      <div className="absolute left-0 top-0 w-2 h-full bg-[#4d88ff] opacity-0 hover:opacity-100 cursor-ew-resize rounded-l"
                        onMouseDown={(e) => startDrag(e, 'videoIn', activeVideo.inPoint)} />
                      <div className="absolute right-0 top-0 w-2 h-full bg-[#4d88ff] opacity-0 hover:opacity-100 cursor-ew-resize rounded-r"
                        onMouseDown={(e) => startDrag(e, 'videoOut', activeVideo.outPoint)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 플레이헤드 */}
            <div
              className="absolute top-0 z-20 pointer-events-none"
              style={{ left: timeToX(currentTime), height: '100%' }}
            >
              <div className="w-px h-full bg-[#FF4D4D]" />
              <div
                className="absolute -top-0 -left-2 w-4 h-4 flex items-center justify-center cursor-ew-resize pointer-events-auto"
                onMouseDown={(e) => startDrag(e, 'playhead', currentTime)}
              >
                <div className="w-3 h-3 bg-[#FF4D4D] rotate-45 -translate-y-1" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function formatTime(t: number) {
  const m = Math.floor(t / 60).toString().padStart(2, '0')
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}
