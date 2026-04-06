'use client'

import { useRef, useCallback } from 'react'
import { Play, Pause, SkipBack } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

const TRACK_HEIGHT = 28
const HEADER_HEIGHT = 24
const TIMELINE_PX_PER_SEC = 80

const LABEL_W = 72 // track label column width

export default function Timeline() {
  const {
    projectDuration, currentTime, setCurrentTime,
    isPlaying, setIsPlaying,
    activeBanner, activeVideo,
    bannerAssets, videoAssets,
    updateVideoClip, updateBannerClip,
  } = useEditorStore()

  const timelineRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{
    type: 'playhead' | 'videoIn' | 'videoOut' | 'bannerIn' | 'bannerOut'
    startX: number
    startValue: number
  } | null>(null)

  const timeToX = (t: number) => t * TIMELINE_PX_PER_SEC
  const xToTime = (x: number) => x / TIMELINE_PX_PER_SEC
  const totalWidth = Math.max(projectDuration * TIMELINE_PX_PER_SEC + 120, 600)

  const startDrag = useCallback((
    e: React.MouseEvent,
    type: 'playhead' | 'videoIn' | 'videoOut' | 'bannerIn' | 'bannerOut',
    startValue: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    dragState.current = { type, startX: e.clientX, startValue }

    const onMove = (me: MouseEvent) => {
      if (!dragState.current) return
      const dx = me.clientX - dragState.current.startX
      const dt = xToTime(dx)
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
  }, [activeVideo, activeBanner, updateVideoClip, updateBannerClip, setCurrentTime, projectDuration])

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft
    setCurrentTime(Math.max(0, Math.min(xToTime(x), projectDuration)))
  }

  const videoAsset  = activeVideo  ? videoAssets.find((v) => v.id === activeVideo.assetId)  : null
  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null

  // 1s 단위 고정, 마지막 틱은 반드시 projectDuration 끝값
  const ticks: number[] = []
  const end = Math.ceil(projectDuration)
  for (let t = 0; t <= end; t++) ticks.push(t)
  // 끝값이 정수가 아닌 경우 정확한 끝 틱 추가
  if (projectDuration % 1 !== 0 && !ticks.includes(projectDuration)) {
    ticks.push(parseFloat(projectDuration.toFixed(2)))
  }

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
        <span className="text-[10px] text-[#555] ml-auto">{TIMELINE_PX_PER_SEC}px/s</span>
      </div>

      {/* ── 트랙 영역 ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* 왼쪽 고정 레이블 열 */}
        <div className="shrink-0 flex flex-col border-r border-[#2a2a2a]" style={{ width: LABEL_W }}>
          {/* 헤더 눈금 자리 */}
          <div style={{ height: HEADER_HEIGHT }} className="bg-[#222] border-b border-[#333]" />
          {/* Banner 레이블 */}
          <div
            className="flex items-center px-3 border-b border-[#2a2a2a] bg-[#1A1A1A]"
            style={{ height: TRACK_HEIGHT }}
          >
            <div className="w-2 h-2 rounded-sm bg-[#4dbb88] mr-2 shrink-0" />
            <span className="text-[10px] text-[#666]">Banner</span>
          </div>
          {/* Video 레이블 */}
          <div
            className="flex items-center px-3 border-b border-[#2a2a2a] bg-[#1A1A1A]"
            style={{ height: TRACK_HEIGHT }}
          >
            <div className="w-2 h-2 rounded-sm bg-[#4d88ff] mr-2 shrink-0" />
            <span className="text-[10px] text-[#666]">Video</span>
          </div>
        </div>

        {/* 스크롤 가능한 트랙 본체 (CanvasArea 너비) */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative select-none"
          onClick={handleTimelineClick}
        >
          <div className="relative h-full" style={{ width: totalWidth, minWidth: '100%' }}>

            {/* 눈금 헤더 */}
            <div
              className="absolute top-0 left-0 right-0 bg-[#222] border-b border-[#333]"
              style={{ height: HEADER_HEIGHT }}
            >
              {ticks.map((t) => {
                const isEnd = t === ticks[ticks.length - 1]
                return (
                  <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: timeToX(t) }}>
                    <div className={`w-px bg-[#444] ${isEnd ? 'h-full' : 'h-3'}`} style={isEnd ? { height: HEADER_HEIGHT } : {}} />
                    <span className={`mt-0.5 font-mono ${isEnd ? 'text-[9px] text-[#FF4D4D]' : 'text-[9px] text-[#555]'}`}>
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
                  <div className="absolute top-1 timeline-clip" style={{ left: timeToX(activeBanner.inPoint) }}>
                    <div
                      className="relative flex items-center bg-[#1a4d3a] border border-[#2a7a5a] rounded overflow-hidden"
                      style={{ width: timeToX(activeBanner.outPoint - activeBanner.inPoint), height: TRACK_HEIGHT - 8 }}
                    >
                      <span className="text-[9px] text-[#4dbb88] px-2 truncate flex-1">{bannerAsset.name}</span>
                      <div className="timeline-handle absolute left-0 top-0 w-2 h-full bg-[#4dbb88] opacity-0 hover:opacity-100 cursor-ew-resize rounded-l"
                        onMouseDown={(e) => startDrag(e, 'bannerIn', activeBanner.inPoint)} />
                      <div className="timeline-handle absolute right-0 top-0 w-2 h-full bg-[#4dbb88] opacity-0 hover:opacity-100 cursor-ew-resize rounded-r"
                        onMouseDown={(e) => startDrag(e, 'bannerOut', activeBanner.outPoint)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Video 트랙 */}
              <div className="relative border-b border-[#2a2a2a]" style={{ height: TRACK_HEIGHT }}>
                {activeVideo && videoAsset && (
                  <div className="absolute top-1 timeline-clip" style={{ left: timeToX(activeVideo.inPoint / activeVideo.speed) }}>
                    <div
                      className="relative flex items-center bg-[#1a2d4d] border border-[#2a4d8a] rounded overflow-hidden"
                      style={{ width: timeToX((activeVideo.outPoint - activeVideo.inPoint) / activeVideo.speed), height: TRACK_HEIGHT - 8 }}
                    >
                      <span className="text-[9px] text-[#4d88ff] px-2 truncate flex-1">
                        {videoAsset.name} ({activeVideo.speed}x)
                      </span>
                      <div className="timeline-handle absolute left-0 top-0 w-2 h-full bg-[#4d88ff] opacity-0 hover:opacity-100 cursor-ew-resize rounded-l"
                        onMouseDown={(e) => startDrag(e, 'videoIn', activeVideo.inPoint)} />
                      <div className="timeline-handle absolute right-0 top-0 w-2 h-full bg-[#4d88ff] opacity-0 hover:opacity-100 cursor-ew-resize rounded-r"
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
