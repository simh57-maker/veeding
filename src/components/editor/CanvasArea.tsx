'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'

const CANVAS_PADDING = 40
const HANDLE_SIZE = 8

type DragMode =
  | { type: 'move' }
  | { type: 'resize'; corner: 'tl' | 'tr' | 'bl' | 'br' }

interface DragState {
  mode: DragMode
  startMouseX: number
  startMouseY: number
  startX: number
  startY: number
  startScaleX: number
  startScaleY: number
  startW: number
  startH: number
  shiftLock: 'none' | 'x' | 'y'  // shift 축 잠금
}

export default function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const dragRef = useRef<DragState | null>(null)
  const [cursor, setCursor] = useState<string>('default')

  const {
    activeBanner, activeVideo,
    bannerAssets, videoAssets,
    currentTime, isPlaying,
    setCurrentTime, setIsPlaying, setSelectedLayer, updateVideoClip,
    pushHistory, undo, redo,
  } = useEditorStore()

  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const videoAsset  = activeVideo  ? videoAssets.find((v)  => v.id === activeVideo.assetId)  : null

  const canvasW = bannerAsset?.width  ?? 1920
  const canvasH = bannerAsset?.height ?? 1080

  const getScale = useCallback(() => {
    const c = containerRef.current
    if (!c) return 1
    const availW = c.clientWidth  - CANVAS_PADDING * 2
    const availH = c.clientHeight - CANVAS_PADDING * 2
    return Math.min(availW / canvasW, availH / canvasH, 1)
  }, [canvasW, canvasH])

  const toCanvas = useCallback((ex: number, ey: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect  = canvas.getBoundingClientRect()
    const scale = getScale()
    return {
      x: (ex - rect.left)  / scale,
      y: (ey - rect.top)   / scale,
    }
  }, [getScale])

  const getVideoBox = useCallback(() => {
    if (!activeVideo || !videoAsset) return null
    const rw = videoAsset.width  * activeVideo.scaleX
    const rh = videoAsset.height * activeVideo.scaleY
    return {
      l: activeVideo.x - rw / 2,
      t: activeVideo.y - rh / 2,
      r: activeVideo.x + rw / 2,
      b: activeVideo.y + rh / 2,
      cx: activeVideo.x,
      cy: activeVideo.y,
      rw, rh,
    }
  }, [activeVideo, videoAsset])

  const getHandles = useCallback(() => {
    const box = getVideoBox()
    if (!box) return []
    return [
      { id: 'tl' as const, x: box.l, y: box.t },
      { id: 'tr' as const, x: box.r, y: box.t },
      { id: 'bl' as const, x: box.l, y: box.b },
      { id: 'br' as const, x: box.r, y: box.b },
    ]
  }, [getVideoBox])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasW, canvasH)
    drawCheckerboard(ctx, canvasW, canvasH)

    // 영상 레이어
    if (activeVideo && video && videoAsset) {
      const { rw, rh, l, t } = getVideoBox()!
      ctx.drawImage(video, l, t, rw, rh)
    }

    // 배너 레이어
    if (bannerAsset && activeBanner) {
      const bw = bannerAsset.width  * activeBanner.scaleX
      const bh = bannerAsset.height * activeBanner.scaleY
      const img = document.querySelector<HTMLImageElement>(`[data-asset="${bannerAsset.id}"]`)
      if (img) ctx.drawImage(img, activeBanner.x - bw / 2, activeBanner.y - bh / 2, bw, bh)
    }

    // 영상 선택 핸들 — 재생 중에는 숨김
    if (!isPlaying && activeVideo && videoAsset) {
      const box = getVideoBox()!
      ctx.strokeStyle = 'rgba(13, 153, 255, 0.8)'
      ctx.lineWidth   = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(box.l, box.t, box.rw, box.rh)
      ctx.setLineDash([])

      for (const h of getHandles()) {
        ctx.fillStyle   = '#fff'
        ctx.strokeStyle = '#0D99FF'
        ctx.lineWidth   = 1.5
        ctx.fillRect   (h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
        ctx.strokeRect (h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
      }
    }
  }, [isPlaying, activeVideo, activeBanner, bannerAsset, videoAsset, canvasW, canvasH, getVideoBox, getHandles])

  // 애니메이션 루프
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo || !videoAsset) return

    if (video.src !== videoAsset.url) video.src = videoAsset.url

    if (isPlaying) {
      video.play()
      const tick = () => {
        setCurrentTime(video.currentTime / activeVideo.speed)
        drawFrame()
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      video.pause()
      video.currentTime = currentTime * activeVideo.speed
      drawFrame()
      cancelAnimationFrame(animFrameRef.current)
    }
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, activeVideo, videoAsset, currentTime, drawFrame, setCurrentTime])

  useEffect(() => { drawFrame() }, [drawFrame, activeBanner, activeVideo])

  // 스페이스바 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const ctrl = e.ctrlKey || e.metaKey

      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
        return
      }

      // Cmd/Ctrl+Z → undo, Cmd/Ctrl+Shift+Z → redo
      if (ctrl && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, setIsPlaying, undo, redo])

  function hitHandle(cx: number, cy: number) {
    if (!activeVideo || isPlaying) return null
    for (const h of getHandles()) {
      if (Math.abs(cx - h.x) <= HANDLE_SIZE && Math.abs(cy - h.y) <= HANDLE_SIZE) return h.id
    }
    return null
  }

  function hitVideoBox(cx: number, cy: number) {
    const box = getVideoBox()
    if (!box) return false
    return cx >= box.l && cx <= box.r && cy >= box.t && cy <= box.b
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeVideo || !videoAsset) return
    const { x, y } = toCanvas(e.clientX, e.clientY)

    const corner = hitHandle(x, y)
    if (corner) {
      const box = getVideoBox()!
      dragRef.current = {
        mode: { type: 'resize', corner },
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX:      activeVideo.x,
        startY:      activeVideo.y,
        startScaleX: activeVideo.scaleX,
        startScaleY: activeVideo.scaleY,
        startW:      box.rw,
        startH:      box.rh,
        shiftLock:   'none',
      }
      setSelectedLayer('video')
      return
    }

    if (hitVideoBox(x, y)) {
      dragRef.current = {
        mode: { type: 'move' },
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX:      activeVideo.x,
        startY:      activeVideo.y,
        startScaleX: activeVideo.scaleX,
        startScaleY: activeVideo.scaleY,
        startW:      0,
        startH:      0,
        shiftLock:   'none',
      }
      setSelectedLayer('video')
      return
    }

    setSelectedLayer(null)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const scale = getScale()

    if (!dragRef.current) {
      if (activeVideo && !isPlaying) {
        const corner = hitHandle(x, y)
        if (corner === 'tl' || corner === 'br') { setCursor('nwse-resize'); return }
        if (corner === 'tr' || corner === 'bl') { setCursor('nesw-resize'); return }
        if (hitVideoBox(x, y)) { setCursor('move'); return }
      }
      setCursor('default')
      return
    }

    const drag = dragRef.current
    let dx = (e.clientX - drag.startMouseX) / scale
    let dy = (e.clientY - drag.startMouseY) / scale

    if (drag.mode.type === 'move') {
      // Shift 축 잠금: 처음 이동 방향으로 고정
      if (e.shiftKey) {
        if (drag.shiftLock === 'none') {
          if (Math.abs(dx) > Math.abs(dy)) drag.shiftLock = 'x'
          else if (Math.abs(dy) > Math.abs(dx)) drag.shiftLock = 'y'
        }
        if (drag.shiftLock === 'x') dy = 0
        if (drag.shiftLock === 'y') dx = 0
      } else {
        drag.shiftLock = 'none'
      }

      updateVideoClip({
        x: drag.startX + dx,
        y: drag.startY + dy,
      })
    } else {
      const corner = (drag.mode as { type: 'resize'; corner: string }).corner
      const aspect = drag.startW / drag.startH

      let delta = 0
      if (corner === 'br') delta = (dx + dy) / 2
      if (corner === 'bl') delta = (-dx + dy) / 2
      if (corner === 'tr') delta = (dx - dy) / 2
      if (corner === 'tl') delta = (-dx - dy) / 2

      const newH = Math.max(50, drag.startH + delta)
      const newW = newH * aspect
      const newScale = newH / (videoAsset?.height ?? 1)

      let newCx = drag.startX
      let newCy = drag.startY
      const dw = (newW - drag.startW) / 2
      const dh = (newH - drag.startH) / 2

      if (corner === 'br') { newCx = drag.startX + dw; newCy = drag.startY + dh }
      if (corner === 'bl') { newCx = drag.startX - dw; newCy = drag.startY + dh }
      if (corner === 'tr') { newCx = drag.startX + dw; newCy = drag.startY - dh }
      if (corner === 'tl') { newCx = drag.startX - dw; newCy = drag.startY - dh }

      updateVideoClip({ x: newCx, y: newCy, scaleX: newScale, scaleY: newScale })
    }

    drawFrame()
  }

  function handleMouseUp() {
    if (dragRef.current) {
      pushHistory()
    }
    dragRef.current = null
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center overflow-hidden relative"
      style={{ background: 'radial-gradient(circle at center, #252525 0%, #1A1A1A 100%)' }}
    >
      <div className="hidden">
        {bannerAssets.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={a.dataUrl} alt="" data-asset={a.id} />
        ))}
      </div>

      <video ref={videoRef} className="hidden" playsInline muted preload="auto" />

      <div
        style={{
          transform: `scale(${getScale()})`,
          transformOrigin: 'center center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{ display: 'block', background: '#000', cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {!activeBanner && !activeVideo && (
        <div className="absolute flex flex-col items-center justify-center text-[#444] pointer-events-none gap-2">
          <div className="text-4xl">🎬</div>
          <p className="text-sm">배너를 업로드하고 세트를 등록하세요</p>
        </div>
      )}
    </div>
  )
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 20
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#2a2a2a' : '#222'
      ctx.fillRect(x, y, size, size)
    }
  }
}
