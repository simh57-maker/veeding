'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'

const CANVAS_PADDING = 40
const CORNER_SIZE = 8   // 코너 핸들 크기
const EDGE_SIZE   = 6   // 엣지 핸들 크기
const SNAP_DIST   = 10  // 중앙 스냅 가이드 표시 임계값 (캔버스 px)

type CornerHandle = 'tl' | 'tr' | 'bl' | 'br'
type EdgeHandle   = 'tc' | 'bc' | 'lc' | 'rc'   // top/bottom/left/right center
type HandleId     = CornerHandle | EdgeHandle

type DragMode =
  | { type: 'move' }
  | { type: 'resize'; handle: HandleId }

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
  shiftLock: 'none' | 'x' | 'y'
}

// 드래그 중 캔버스 중앙 근접 여부 (ref로 공유)
interface SnapState {
  snapX: boolean  // 영상 cx ≈ canvasW/2
  snapY: boolean  // 영상 cy ≈ canvasH/2
}

export default function CanvasArea() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const dragRef      = useRef<DragState | null>(null)
  const snapRef      = useRef<SnapState>({ snapX: false, snapY: false })
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
    return { x: (ex - rect.left) / scale, y: (ey - rect.top) / scale }
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

  // 코너 4 + 엣지 4 = 핸들 8개
  const getHandles = useCallback((): { id: HandleId; x: number; y: number }[] => {
    const box = getVideoBox()
    if (!box) return []
    const mx = (box.l + box.r) / 2
    const my = (box.t + box.b) / 2
    return [
      { id: 'tl', x: box.l, y: box.t },
      { id: 'tr', x: box.r, y: box.t },
      { id: 'bl', x: box.l, y: box.b },
      { id: 'br', x: box.r, y: box.b },
      { id: 'tc', x: mx,    y: box.t },
      { id: 'bc', x: mx,    y: box.b },
      { id: 'lc', x: box.l, y: my    },
      { id: 'rc', x: box.r, y: my    },
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

    // 영상 선택 핸들 — 재생 중 숨김
    if (!isPlaying && activeVideo && videoAsset) {
      const box = getVideoBox()!

      // ── 중앙 스냅 가이드라인 ──────────────────────────
      const { snapX, snapY } = snapRef.current
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.85)'
      ctx.lineWidth   = 1
      ctx.setLineDash([6, 5])
      if (snapX) {
        ctx.beginPath()
        ctx.moveTo(canvasW / 2, 0)
        ctx.lineTo(canvasW / 2, canvasH)
        ctx.stroke()
      }
      if (snapY) {
        ctx.beginPath()
        ctx.moveTo(0, canvasH / 2)
        ctx.lineTo(canvasW, canvasH / 2)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.restore()

      // 선택 테두리
      ctx.strokeStyle = 'rgba(13, 153, 255, 0.8)'
      ctx.lineWidth   = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(box.l, box.t, box.rw, box.rh)
      ctx.setLineDash([])

      // 핸들 그리기
      for (const h of getHandles()) {
        const isEdge = ['tc','bc','lc','rc'].includes(h.id)
        const sz = isEdge ? EDGE_SIZE : CORNER_SIZE
        ctx.fillStyle   = '#fff'
        ctx.strokeStyle = '#0D99FF'
        ctx.lineWidth   = 1.5
        if (isEdge) {
          // 엣지 핸들: 타원형
          ctx.beginPath()
          const rx = (h.id === 'tc' || h.id === 'bc') ? sz / 2 : sz * 0.35
          const ry = (h.id === 'lc' || h.id === 'rc') ? sz / 2 : sz * 0.35
          ctx.ellipse(h.x, h.y, rx, ry, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillRect  (h.x - sz / 2, h.y - sz / 2, sz, sz)
          ctx.strokeRect(h.x - sz / 2, h.y - sz / 2, sz, sz)
        }
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

  // 스페이스바 / undo / redo 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const ctrl = e.ctrlKey || e.metaKey
      if (e.code === 'Space') { e.preventDefault(); setIsPlaying(!isPlaying); return }
      if (ctrl && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, setIsPlaying, undo, redo])

  // ── 히트 테스트 ─────────────────────────────────────────
  function hitHandle(cx: number, cy: number): HandleId | null {
    if (!activeVideo || isPlaying) return null
    for (const h of getHandles()) {
      const sz = ['tc','bc','lc','rc'].includes(h.id) ? EDGE_SIZE : CORNER_SIZE
      if (Math.abs(cx - h.x) <= sz && Math.abs(cy - h.y) <= sz) return h.id
    }
    return null
  }

  function hitVideoBox(cx: number, cy: number) {
    const box = getVideoBox()
    if (!box) return false
    return cx >= box.l && cx <= box.r && cy >= box.t && cy <= box.b
  }

  // 핸들 id → 커서 모양
  function handleCursor(id: HandleId): string {
    if (id === 'tl' || id === 'br') return 'nwse-resize'
    if (id === 'tr' || id === 'bl') return 'nesw-resize'
    if (id === 'tc' || id === 'bc') return 'ns-resize'
    if (id === 'lc' || id === 'rc') return 'ew-resize'
    return 'default'
  }

  // ── 마우스 이벤트 ────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeVideo || !videoAsset) return
    const { x, y } = toCanvas(e.clientX, e.clientY)

    const h = hitHandle(x, y)
    if (h) {
      const box = getVideoBox()!
      dragRef.current = {
        mode: { type: 'resize', handle: h },
        startMouseX: e.clientX, startMouseY: e.clientY,
        startX: activeVideo.x,  startY: activeVideo.y,
        startScaleX: activeVideo.scaleX, startScaleY: activeVideo.scaleY,
        startW: box.rw, startH: box.rh,
        shiftLock: 'none',
      }
      setSelectedLayer('video')
      return
    }

    if (hitVideoBox(x, y)) {
      dragRef.current = {
        mode: { type: 'move' },
        startMouseX: e.clientX, startMouseY: e.clientY,
        startX: activeVideo.x,  startY: activeVideo.y,
        startScaleX: activeVideo.scaleX, startScaleY: activeVideo.scaleY,
        startW: 0, startH: 0,
        shiftLock: 'none',
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
        const h = hitHandle(x, y)
        if (h) { setCursor(handleCursor(h)); return }
        if (hitVideoBox(x, y)) { setCursor('move'); return }
      }
      setCursor('default')
      return
    }

    const drag = dragRef.current
    let dx = (e.clientX - drag.startMouseX) / scale
    let dy = (e.clientY - drag.startMouseY) / scale

    if (drag.mode.type === 'move') {
      // Shift 축 잠금
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

      const newX = drag.startX + dx
      const newY = drag.startY + dy

      // 중앙 스냅 가이드 계산
      snapRef.current = {
        snapX: Math.abs(newX - canvasW / 2) < SNAP_DIST,
        snapY: Math.abs(newY - canvasH / 2) < SNAP_DIST,
      }

      updateVideoClip({ x: newX, y: newY })

    } else {
      // 리사이즈
      snapRef.current = { snapX: false, snapY: false }

      const handle = (drag.mode as { type: 'resize'; handle: HandleId }).handle
      const aspect = drag.startW / drag.startH

      // 코너: Shift = 비율 유지, 기본 = 자유 변형
      if (['tl','tr','bl','br'].includes(handle)) {
        let newW = drag.startW
        let newH = drag.startH
        let newCx = drag.startX
        let newCy = drag.startY

        if (e.shiftKey) {
          // 비율 유지: 대각선 델타로 균일 스케일
          let delta = 0
          if (handle === 'br') delta = (dx + dy) / 2
          if (handle === 'bl') delta = (-dx + dy) / 2
          if (handle === 'tr') delta = (dx - dy) / 2
          if (handle === 'tl') delta = (-dx - dy) / 2

          newH = Math.max(50, drag.startH + delta)
          newW = newH * aspect
        } else {
          // 자유 변형
          if (handle === 'br') { newW = Math.max(50, drag.startW + dx); newH = Math.max(50, drag.startH + dy) }
          if (handle === 'bl') { newW = Math.max(50, drag.startW - dx); newH = Math.max(50, drag.startH + dy) }
          if (handle === 'tr') { newW = Math.max(50, drag.startW + dx); newH = Math.max(50, drag.startH - dy) }
          if (handle === 'tl') { newW = Math.max(50, drag.startW - dx); newH = Math.max(50, drag.startH - dy) }
        }

        const dw = (newW - drag.startW) / 2
        const dh = (newH - drag.startH) / 2
        if (handle === 'br') { newCx = drag.startX + dw; newCy = drag.startY + dh }
        if (handle === 'bl') { newCx = drag.startX - dw; newCy = drag.startY + dh }
        if (handle === 'tr') { newCx = drag.startX + dw; newCy = drag.startY - dh }
        if (handle === 'tl') { newCx = drag.startX - dw; newCy = drag.startY - dh }

        const newScaleX = newW / (videoAsset?.width  ?? 1)
        const newScaleY = newH / (videoAsset?.height ?? 1)
        updateVideoClip({ x: newCx, y: newCy, scaleX: newScaleX, scaleY: newScaleY })

      } else {
        // 엣지: 한 축만 리사이즈 (비율 유지 없음)
        let newW = drag.startW
        let newH = drag.startH
        let newCx = drag.startX
        let newCy = drag.startY

        if (handle === 'rc') { newW = Math.max(50, drag.startW + dx);  newCx = drag.startX + dx / 2 }
        if (handle === 'lc') { newW = Math.max(50, drag.startW - dx);  newCx = drag.startX + dx / 2 }
        if (handle === 'bc') { newH = Math.max(50, drag.startH + dy);  newCy = drag.startY + dy / 2 }
        if (handle === 'tc') { newH = Math.max(50, drag.startH - dy);  newCy = drag.startY + dy / 2 }

        const newScaleX = newW / (videoAsset?.width  ?? 1)
        const newScaleY = newH / (videoAsset?.height ?? 1)
        updateVideoClip({ x: newCx, y: newCy, scaleX: newScaleX, scaleY: newScaleY })
      }
    }

    drawFrame()
  }

  function handleMouseUp() {
    if (dragRef.current) {
      snapRef.current = { snapX: false, snapY: false }
      pushHistory()
      drawFrame()
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
