'use client'

import { useState, useRef } from 'react'
import { X, Download, Loader2, CheckCircle } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

interface Props {
  onClose: () => void
}

type ExportStatus = 'idle' | 'loading' | 'processing' | 'done' | 'error'

export default function ExportModal({ onClose }: Props) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)

  const { resolution, activeVideo, activeBanner, videoAssets, bannerAssets, projectDuration } = useEditorStore()

  const [resW, resH] = resolution.split('x').map(Number)

  async function handleExport() {
    if (!activeVideo) {
      setErrorMsg('Please add a video to the composition first.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setProgress(0)

    try {
      // Dynamic import for FFmpeg to avoid SSR issues
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

      const ffmpeg = new FFmpeg()

      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100))
      })

      setStatus('processing')

      // Load FFmpeg core
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      // Fetch video file
      const videoAsset = videoAssets.find((v) => v.id === activeVideo.assetId)!
      const videoData = await fetchFile(videoAsset.url)
      await ffmpeg.writeFile('input.mp4', videoData)

      // Build FFmpeg command
      const inPoint = activeVideo.inPoint
      const duration = (activeVideo.outPoint - activeVideo.inPoint) / activeVideo.speed
      const speedFilter = activeVideo.speed !== 1 ? `setpts=${(1 / activeVideo.speed).toFixed(4)}*PTS,` : ''

      let filterComplex = `[0:v]${speedFilter}scale=${resW}:${resH}:force_original_aspect_ratio=increase,crop=${resW}:${resH}[vid]`
      const inputs = ['-ss', String(inPoint), '-i', 'input.mp4']
      const maps = ['-map', '[vid]']

      // If banner, overlay it
      if (activeBanner) {
        const bannerAsset = bannerAssets.find((b) => b.id === activeBanner.assetId)
        if (bannerAsset) {
          const bannerData = await fetchFile(bannerAsset.dataUrl)
          await ffmpeg.writeFile('banner.png', bannerData)

          // Scale banner to resolution
          filterComplex = `[0:v]${speedFilter}scale=${resW}:${resH}:force_original_aspect_ratio=increase,crop=${resW}:${resH}[vid];[1:v]scale=${resW}:${resH}[banner];[vid][banner]overlay=0:0[out]`
          inputs.push('-i', 'banner.png')
          maps.length = 0
          maps.push('-map', '[out]')
        }
      }

      const outputFile = 'output.mp4'
      await ffmpeg.exec([
        ...inputs,
        '-t', String(duration),
        '-filter_complex', filterComplex,
        ...maps,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputFile,
      ])

      const data = await ffmpeg.readFile(outputFile)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = new Blob([data as any], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)

      // Trigger download
      const a = downloadLinkRef.current!
      a.href = url
      a.download = `veeding_export_${resolution}_${Date.now()}.mp4`
      a.click()

      setStatus('done')

      // Play ding sound
      playDing()

    } catch (err) {
      console.error('Export error:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Export failed')
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2C2C2C] border border-[#444] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Export Video</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#E0E0E0] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export info */}
        <div className="bg-[#1E1E1E] rounded-xl p-4 mb-5 space-y-2">
          <InfoRow label="Resolution" value={`${resW} × ${resH}`} />
          <InfoRow label="Duration" value={`${projectDuration.toFixed(2)}s`} />
          <InfoRow label="Format" value="MP4 (H.264)" />
          {activeVideo && (
            <InfoRow
              label="Speed"
              value={`${activeVideo.speed}x`}
            />
          )}
          <InfoRow label="Banner" value={activeBanner ? 'Yes (PNG overlay)' : 'No'} />
        </div>

        {/* Progress */}
        {(status === 'processing' || status === 'loading') && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#888]">
                {status === 'loading' ? 'Loading FFmpeg...' : `Rendering... ${progress}%`}
              </span>
              <Loader2 className="w-4 h-4 text-[#0D99FF] animate-spin" />
            </div>
            <div className="h-1.5 bg-[#1E1E1E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0D99FF] transition-all duration-300 rounded-full"
                style={{ width: `${status === 'loading' ? 10 : progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="mb-4 flex items-center gap-2 text-[#4dbb88] text-sm">
            <CheckCircle className="w-4 h-4" />
            Export complete! File downloaded.
          </div>
        )}

        {status === 'error' && (
          <div className="mb-4 bg-red-900/30 border border-red-800/50 rounded-lg p-3 text-red-400 text-xs">
            {errorMsg || 'An error occurred during export.'}
          </div>
        )}

        {/* Hidden download link */}
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
        <a ref={downloadLinkRef} className="hidden" />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#444] text-[#888] hover:text-[#E0E0E0] hover:border-[#666] text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={status === 'loading' || status === 'processing'}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0D99FF] hover:bg-[#0b87e0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {status === 'loading' || status === 'processing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {status === 'done' ? 'Export Again' : 'Export MP4'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[#666]">{label}</span>
      <span className="text-[11px] text-[#E0E0E0] font-medium">{value}</span>
    </div>
  )
}

function playDing() {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
    const ctx = new AudioContext()

    // Create a pleasant bell-like ding
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  } catch {
    // Audio not available
  }
}
