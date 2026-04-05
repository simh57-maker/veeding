'use client'

import { useRef, useCallback } from 'react'
import { Play, Pause, SkipBack } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

const TRACK_HEIGHT = 28
const HEADER_HEIGHT = 24
const TIMELINE_PX_PER_SEC = 80

export default function Timeline() {
  const {
    projectDuration,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    activeBanner,
    activeVideo,
    bannerAssets,
    videoAssets,
    updateVideoClip,
    updateBannerClip,
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
    type: typeof dragState.current extends null ? never : NonNullable<typeof dragState.current>['type'],
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
      if (t === 'playhead') {
        setCurrentTime(Math.min(newTime, projectDuration))
      } else if (t === 'videoIn' && activeVideo) {
        updateVideoClip({ inPoint: Math.min(newTime, activeVideo.outPoint - 0.1) })
      } else if (t === 'videoOut' && activeVideo) {
        updateVideoClip({ outPoint: Math.max(newTime, activeVideo.inPoint + 0.1) })
      } else if (t === 'bannerIn' && activeBanner) {
        updateBannerClip({ inPoint: Math.min(newTime, activeBanner.outPoint - 0.1) })
      } else if (t === 'bannerOut' && activeBanner) {
        updateBannerClip({ outPoint: Math.max(newTime, activeBanner.inPoint + 0.1) })
      }
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

  const videoAsset = activeVideo ? videoAssets.find((v) => v.id === activeVideo.assetId) : null
  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null

  // Time ticks
  const ticks: number[] = []
  const tickInterval = projectDuration > 30 ? 5 : projectDuration > 10 ? 2 : 1
  for (let t = 0; t <= projectDuration + tickInterval; t += tickInterval) {
    ticks.push(t)
  }

  return (
    <div className="h-[140px] bg-[#1A1A1A] border-t border-[#333] flex flex-col shrink-0">
      {/* Transport Controls */}
      <div className="h-9 bg-[#2C2C2C] border-b border-[#333] flex items-center px-4 gap-3">
        <button
          onClick={() => { setCurrentTime(0); setIsPlaying(false) }}
          className="text-[#888] hover:text-[#E0E0E0] transition-colors"
          title="Go to start"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-[#0D99FF] hover:bg-[#0b87e0] text-white rounded-lg p-1.5 transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <div className="text-[11px] text-[#888] font-mono ml-2">
          {formatTime(currentTime)} / {formatTime(projectDuration)}
        </div>

        <div className="ml-auto text-[10px] text-[#555]">
          {TIMELINE_PX_PER_SEC}px/s · Drag handles to trim
        </div>
      </div>

      {/* Timeline tracks */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative select-none"
        onClick={handleTimelineClick}
      >
        <div
          className="relative h-full"
          style={{ width: totalWidth, minWidth: '100%' }}
        >
          {/* Time ruler */}
          <div
            className="absolute top-0 left-0 right-0 bg-[#222] border-b border-[#333]"
            style={{ height: HEADER_HEIGHT }}
          >
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: timeToX(t) }}
              >
                <div className="w-px h-3 bg-[#444]" />
                <span className="text-[9px] text-[#555] mt-0.5">{t}s</span>
              </div>
            ))}
          </div>

          {/* Track rows */}
          <div style={{ paddingTop: HEADER_HEIGHT }}>
            {/* Banner track */}
            <div
              className="relative border-b border-[#2a2a2a]"
              style={{ height: TRACK_HEIGHT }}
            >
              <div className="absolute left-0 top-0 h-full flex items-center px-2 z-10 bg-[#1A1A1A] w-16 border-r border-[#2a2a2a]">
                <span className="text-[9px] text-[#555]">Banner</span>
              </div>

              {activeBanner && bannerAsset && (
                <div className="absolute top-1 timeline-clip" style={{ left: 64 + timeToX(activeBanner.inPoint) }}>
                  <div
                    className="relative flex items-center bg-[#1a4d3a] border border-[#2a7a5a] rounded overflow-hidden"
                    style={{
                      width: timeToX(activeBanner.outPoint - activeBanner.inPoint),
                      height: TRACK_HEIGHT - 8,
                    }}
                  >
                    <span className="text-[9px] text-[#4dbb88] px-2 truncate flex-1">{bannerAsset.name}</span>
                    {/* In handle */}
                    <div
                      className="timeline-handle absolute left-0 top-0 w-2 h-full bg-[#4dbb88] opacity-0 hover:opacity-100 cursor-ew-resize rounded-l"
                      onMouseDown={(e) => startDrag(e, 'bannerIn', activeBanner.inPoint)}
                    />
                    {/* Out handle */}
                    <div
                      className="timeline-handle absolute right-0 top-0 w-2 h-full bg-[#4dbb88] opacity-0 hover:opacity-100 cursor-ew-resize rounded-r"
                      onMouseDown={(e) => startDrag(e, 'bannerOut', activeBanner.outPoint)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Video track */}
            <div
              className="relative border-b border-[#2a2a2a]"
              style={{ height: TRACK_HEIGHT }}
            >
              <div className="absolute left-0 top-0 h-full flex items-center px-2 z-10 bg-[#1A1A1A] w-16 border-r border-[#2a2a2a]">
                <span className="text-[9px] text-[#555]">Video</span>
              </div>

              {activeVideo && videoAsset && (
                <div className="absolute top-1 timeline-clip" style={{ left: 64 + timeToX(activeVideo.inPoint / activeVideo.speed) }}>
                  <div
                    className="relative flex items-center bg-[#1a2d4d] border border-[#2a4d8a] rounded overflow-hidden"
                    style={{
                      width: timeToX((activeVideo.outPoint - activeVideo.inPoint) / activeVideo.speed),
                      height: TRACK_HEIGHT - 8,
                    }}
                  >
                    <span className="text-[9px] text-[#4d88ff] px-2 truncate flex-1">
                      {videoAsset.name} ({activeVideo.speed}x)
                    </span>
                    {/* In handle */}
                    <div
                      className="timeline-handle absolute left-0 top-0 w-2 h-full bg-[#4d88ff] opacity-0 hover:opacity-100 cursor-ew-resize rounded-l"
                      onMouseDown={(e) => startDrag(e, 'videoIn', activeVideo.inPoint)}
                    />
                    {/* Out handle */}
                    <div
                      className="timeline-handle absolute right-0 top-0 w-2 h-full bg-[#4d88ff] opacity-0 hover:opacity-100 cursor-ew-resize rounded-r"
                      onMouseDown={(e) => startDrag(e, 'videoOut', activeVideo.outPoint)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 z-20 pointer-events-none"
            style={{ left: 64 + timeToX(currentTime), height: '100%' }}
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
  )
}

function formatTime(t: number) {
  const m = Math.floor(t / 60).toString().padStart(2, '0')
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}
