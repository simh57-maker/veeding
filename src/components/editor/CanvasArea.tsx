'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'

const CANVAS_PADDING = 40

export default function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)

  const {
    activeBanner,
    activeVideo,
    bannerAssets,
    videoAssets,
    currentTime,
    isPlaying,
    setCurrentTime,
    setSelectedLayer,
  } = useEditorStore()

  // 캔버스 크기 = 배너 이미지의 실제 크기
  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const canvasW = bannerAsset?.width ?? 1920
  const canvasH = bannerAsset?.height ?? 1080

  const getScale = useCallback(() => {
    const container = containerRef.current
    if (!container) return 1
    const availW = container.clientWidth - CANVAS_PADDING * 2
    const availH = container.clientHeight - CANVAS_PADDING * 2
    return Math.min(availW / canvasW, availH / canvasH, 1)
  }, [canvasW, canvasH])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasW, canvasH)
    drawCheckerboard(ctx, canvasW, canvasH)

    // 영상 레이어 (뒤)
    if (activeVideo && video && videoAssets.find((v) => v.id === activeVideo.assetId)) {
      const vAsset = videoAssets.find((v) => v.id === activeVideo.assetId)!
      const sw = vAsset.width * activeVideo.scaleX
      const sh = vAsset.height * activeVideo.scaleY
      ctx.drawImage(video, activeVideo.x - sw / 2, activeVideo.y - sh / 2, sw, sh)
    }

    // 배너 레이어 (앞)
    if (bannerAsset) {
      const bw = bannerAsset.width * activeBanner!.scaleX
      const bh = bannerAsset.height * activeBanner!.scaleY
      const img = document.querySelector<HTMLImageElement>(`[data-asset="${bannerAsset.id}"]`)
      if (img) {
        ctx.drawImage(img, activeBanner!.x - bw / 2, activeBanner!.y - bh / 2, bw, bh)
      }
    }
  }, [activeVideo, activeBanner, bannerAsset, videoAssets, canvasW, canvasH])

  // 애니메이션 루프
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    const asset = videoAssets.find((v) => v.id === activeVideo.assetId)
    if (!asset) return

    if (video.src !== asset.url) video.src = asset.url

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
  }, [isPlaying, activeVideo, videoAssets, currentTime, drawFrame, setCurrentTime])

  useEffect(() => {
    drawFrame()
  }, [drawFrame, activeBanner, activeVideo])

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const scale = getScale()
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    if (bannerAsset) {
      const bw = bannerAsset.width * activeBanner!.scaleX
      const bh = bannerAsset.height * activeBanner!.scaleY
      if (x >= activeBanner!.x - bw / 2 && x <= activeBanner!.x + bw / 2 &&
          y >= activeBanner!.y - bh / 2 && y <= activeBanner!.y + bh / 2) {
        setSelectedLayer('banner')
        return
      }
    }

    if (activeVideo) {
      const vAsset = videoAssets.find((v) => v.id === activeVideo.assetId)
      if (vAsset) {
        const vw = vAsset.width * activeVideo.scaleX
        const vh = vAsset.height * activeVideo.scaleY
        if (x >= activeVideo.x - vw / 2 && x <= activeVideo.x + vw / 2 &&
            y >= activeVideo.y - vh / 2 && y <= activeVideo.y + vh / 2) {
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
      className="flex-1 flex items-center justify-center overflow-hidden relative"
      style={{ background: 'radial-gradient(circle at center, #252525 0%, #1A1A1A 100%)' }}
    >
      {/* 히든 배너 이미지 */}
      <div className="hidden">
        {bannerAssets.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={a.dataUrl} alt="" data-asset={a.id} />
        ))}
      </div>

      {/* 히든 비디오 */}
      <video ref={videoRef} className="hidden" playsInline muted preload="auto" />

      {/* 캔버스 */}
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
          className="cursor-crosshair block"
          style={{ background: '#000' }}
        />
      </div>

      {!activeBanner && !activeVideo && (
        <div className="absolute flex flex-col items-center justify-center text-[#444] pointer-events-none">
          <div className="text-4xl mb-2">🎬</div>
          <p className="text-sm">배너를 업로드하면 캔버스 크기가 자동으로 설정됩니다</p>
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
