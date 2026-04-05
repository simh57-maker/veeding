'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'

const CANVAS_PADDING = 40

const RESOLUTION_MAP: Record<string, [number, number]> = {
  '1920x1080': [1920, 1080],
  '1200x1200': [1200, 1200],
  '1080x1920': [1080, 1920],
}

export default function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)

  const {
    resolution,
    activeBanner,
    activeVideo,
    bannerAssets,
    videoAssets,
    currentTime,
    isPlaying,
    setCurrentTime,
    setSelectedLayer,
  } = useEditorStore()

  const [canvasW, canvasH] = RESOLUTION_MAP[resolution] ?? [1920, 1080]

  // Compute scale to fit canvas in the container
  const getScale = useCallback(() => {
    const container = containerRef.current
    if (!container) return 1
    const availW = container.clientWidth - CANVAS_PADDING * 2
    const availH = container.clientHeight - CANVAS_PADDING * 2
    return Math.min(availW / canvasW, availH / canvasH, 1)
  }, [canvasW, canvasH])

  // Draw a single frame onto the canvas
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasW, canvasH)

    // Draw checkerboard (transparent area indicator)
    drawCheckerboard(ctx, canvasW, canvasH)

    // Draw video layer (behind)
    if (activeVideo && video && videoAssets.find((v) => v.id === activeVideo.assetId)) {
      ctx.save()
      const vw = videoAssets.find((v) => v.id === activeVideo.assetId)!.width
      const vh = videoAssets.find((v) => v.id === activeVideo.assetId)!.height
      const cx = activeVideo.x
      const cy = activeVideo.y
      const sw = vw * activeVideo.scaleX
      const sh = vh * activeVideo.scaleY
      ctx.drawImage(video, cx - sw / 2, cy - sh / 2, sw, sh)
      ctx.restore()
    }

    // Draw banner layer (on top)
    if (activeBanner) {
      const bannerAsset = bannerAssets.find((b) => b.id === activeBanner.assetId)
      if (bannerAsset) {
        const bw = bannerAsset.width * activeBanner.scaleX
        const bh = bannerAsset.height * activeBanner.scaleY
        const img = document.querySelector<HTMLImageElement>(`[data-asset="${bannerAsset.id}"]`)
        if (img) {
          ctx.drawImage(img, activeBanner.x - bw / 2, activeBanner.y - bh / 2, bw, bh)
        }
      }
    }
  }, [activeVideo, activeBanner, bannerAssets, videoAssets, canvasW, canvasH])

  // Animation loop
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    const asset = videoAssets.find((v) => v.id === activeVideo.assetId)
    if (!asset) return

    if (video.src !== asset.url) {
      video.src = asset.url
    }

    if (isPlaying) {
      video.play()
      const tick = () => {
        const newTime = video.currentTime / activeVideo.speed
        setCurrentTime(newTime)
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
  }, [isPlaying, activeVideo, videoAssets, currentTime, drawFrame, setCurrentTime])

  // Redraw when static things change
  useEffect(() => {
    drawFrame()
  }, [drawFrame, activeBanner, activeVideo, resolution])

  // Canvas click to select layer
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const scale = getScale()
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    // Check banner first (top layer)
    if (activeBanner) {
      const bannerAsset = bannerAssets.find((b) => b.id === activeBanner.assetId)
      if (bannerAsset) {
        const bw = bannerAsset.width * activeBanner.scaleX
        const bh = bannerAsset.height * activeBanner.scaleY
        const bx = activeBanner.x - bw / 2
        const by = activeBanner.y - bh / 2
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          setSelectedLayer('banner')
          return
        }
      }
    }

    if (activeVideo) {
      const videoAsset = videoAssets.find((v) => v.id === activeVideo.assetId)
      if (videoAsset) {
        const vw = videoAsset.width * activeVideo.scaleX
        const vh = videoAsset.height * activeVideo.scaleY
        const vx = activeVideo.x - vw / 2
        const vy = activeVideo.y - vh / 2
        if (x >= vx && x <= vx + vw && y >= vy && y <= vy + vh) {
          setSelectedLayer('video')
          return
        }
      }
    }

    setSelectedLayer(null)
  }

  const scale = getScale()

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-[#1E1E1E] overflow-hidden"
      style={{ background: 'radial-gradient(circle at center, #252525 0%, #1A1A1A 100%)' }}
    >
      {/* Hidden banner images for drawing */}
      <div className="hidden">
        {bannerAssets.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={a.dataUrl} alt="" data-asset={a.id} />
        ))}
      </div>

      {/* Hidden video element */}
      <video ref={videoRef} className="hidden" playsInline muted preload="auto" />

      {/* Canvas with zoom */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          onClick={handleCanvasClick}
          className="cursor-crosshair"
          style={{
            display: 'block',
            background: '#000',
          }}
        />
      </div>

      {/* No content placeholder */}
      {!activeBanner && !activeVideo && (
        <div className="absolute flex flex-col items-center justify-center text-[#444] pointer-events-none">
          <div className="text-4xl mb-2">🎬</div>
          <p className="text-sm">Upload and select a banner + video to start</p>
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
