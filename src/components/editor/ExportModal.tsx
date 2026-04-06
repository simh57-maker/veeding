'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Download, Loader2, CheckCircle } from 'lucide-react'
import { useEditorStore, QUALITY_MAP, CompositionSet } from '@/store/editorStore'

interface Props {
  onClose: () => void
}

type ExportStatus = 'idle' | 'processing' | 'done' | 'error'

interface ExportJob {
  setId: string
  label: string
  status: ExportStatus
  progress: number
  error?: string
}

// 예상 시간 계산: 픽셀 수 × 길이 × crf 계수 (경험적 공식)
function estimateSeconds(widthPx: number, heightPx: number, durationSec: number, crf: number): number {
  const megapixels = (widthPx * heightPx) / 1_000_000
  // Basic(crf25) ≈ 0.8s/MP/s, Preview(crf40) ≈ 0.3s/MP/s (브라우저 wasm 기준 추정)
  const crfFactor = crf <= 28 ? 0.8 : 0.3
  return Math.round(megapixels * durationSec * crfFactor)
}

function fmtSec(s: number): string {
  if (s < 60) return `약 ${s}초`
  return `약 ${Math.ceil(s / 60)}분`
}

export default function ExportModal({ onClose }: Props) {
  const { activeVideo, activeBanner, videoAssets, bannerAssets, quality, sets } = useEditorStore()

  const activeBannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const resW = activeBannerAsset?.width  ?? 1920
  const resH = activeBannerAsset?.height ?? 1080

  // 모든 세트가 기본 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(sets.map((s) => s.id)))
  const [jobs, setJobs] = useState<ExportJob[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)

  const qualityCfg = QUALITY_MAP[quality]

  // 세트 목록이 바뀌면 선택 동기화
  useEffect(() => {
    setSelectedIds(new Set(sets.map((s) => s.id)))
  }, [sets])

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll()   { setSelectedIds(new Set(sets.map((s) => s.id))) }
  function deselectAll() { setSelectedIds(new Set()) }

  // 선택된 세트들의 예상 총 시간
  const totalEstSec = Array.from(selectedIds).reduce((acc, id) => {
    const s = sets.find((x) => x.id === id)
    if (!s) return acc
    const bAsset = bannerAssets.find((b) => b.id === s.banner.assetId)
    const w = bAsset?.width  ?? resW
    const h = bAsset?.height ?? resH
    return acc + estimateSeconds(w, h, s.projectDuration, qualityCfg.crf)
  }, 0)

  // ─── 단일 세트 렌더링 ───────────────────────────────────
  async function renderOne(
    ffmpeg: import('@ffmpeg/ffmpeg').FFmpeg,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchFile: (data: any) => Promise<Uint8Array>,
    banner: typeof activeBanner,
    video: typeof activeVideo,
    duration: number,
    filename: string,
    onProgress: (p: number) => void,
  ): Promise<Blob> {
    ffmpeg.on('progress', ({ progress: p }) => onProgress(Math.round(p * 100)))

    const videoAsset = videoAssets.find((v) => v.id === video!.assetId)!
    const videoData = await fetchFile(videoAsset.url)
    await ffmpeg.writeFile('input.mp4', videoData)

    const inPoint = video!.inPoint
    const speedFilter = video!.speed !== 1 ? `setpts=${(1 / video!.speed).toFixed(4)}*PTS,` : ''

    const bannerAsset = banner ? bannerAssets.find((b) => b.id === banner.assetId) : null
    const outW = bannerAsset?.width  ?? resW
    const outH = bannerAsset?.height ?? resH

    const vidW = Math.round(videoAsset.width  * video!.scaleX)
    const vidH = Math.round(videoAsset.height * video!.scaleY)
    const vidX = Math.round(video!.x - vidW / 2)
    const vidY = Math.round(video!.y - vidH / 2)

    let filterComplex =
      `[0:v]${speedFilter}scale=${vidW}:${vidH}[scaled];` +
      `color=black:size=${outW}x${outH}:rate=30[bg];` +
      `[bg][scaled]overlay=${vidX}:${vidY}[vid]`
    const inputs = ['-ss', String(inPoint), '-i', 'input.mp4']
    const maps = ['-map', '[vid]']

    if (bannerAsset) {
      const bannerData = await fetchFile(bannerAsset.dataUrl)
      await ffmpeg.writeFile('banner.png', bannerData)
      filterComplex =
        `[0:v]${speedFilter}scale=${vidW}:${vidH}[scaled];` +
        `color=black:size=${outW}x${outH}:rate=30[bg];` +
        `[bg][scaled]overlay=${vidX}:${vidY}[vid];` +
        `[1:v]scale=${outW}:${outH}[banner];` +
        `[vid][banner]overlay=0:0[out]`
      inputs.push('-i', 'banner.png')
      maps.length = 0
      maps.push('-map', '[out]')
    }

    await ffmpeg.exec([
      ...inputs,
      '-t', String(duration),
      '-filter_complex', filterComplex,
      ...maps,
      '-c:v', 'libx264',
      '-preset', qualityCfg.preset,
      '-crf', String(qualityCfg.crf),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      filename,
    ])

    const data = await ffmpeg.readFile(filename)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Blob([data as any], { type: 'video/mp4' })
  }

  // ─── 내보내기 실행 ──────────────────────────────────────
  async function handleExport() {
    if (selectedIds.size === 0) return
    setIsRunning(true)

    const jobList: ExportJob[] = Array.from(selectedIds).map((id) => ({
      setId: id,
      label: sets.find((s) => s.id === id)?.name ?? id,
      status: 'idle',
      progress: 0,
    }))
    setJobs(jobList)

    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

      const ffmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      for (let i = 0; i < jobList.length; i++) {
        updateJob(i, { status: 'processing' })

        try {
          const found = sets.find((s) => s.id === jobList[i].setId) as CompositionSet
          const banner = found.banner
          const video  = found.video
          const duration = found.projectDuration

          if (!video) throw new Error('영상이 없습니다')

          const setBannerAsset = bannerAssets.find((b) => b.id === banner?.assetId)
          const fileW = setBannerAsset?.width  ?? resW
          const fileH = setBannerAsset?.height ?? resH

          const filename = `out_${i}.mp4`
          const blob = await renderOne(
            ffmpeg, fetchFile, banner, video, duration, filename,
            (p) => updateJob(i, { progress: p }),
          )

          const url = URL.createObjectURL(blob)
          const a = downloadLinkRef.current!
          a.href = url
          a.download = `veeding_${jobList[i].label.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${fileW}x${fileH}_${Date.now()}.mp4`
          a.click()
          URL.revokeObjectURL(url)

          updateJob(i, { status: 'done', progress: 100 })
        } catch (err) {
          updateJob(i, { status: 'error', error: err instanceof Error ? err.message : 'Error' })
        }
      }

      playDing()
    } catch (err) {
      console.error(err)
    }

    setIsRunning(false)
  }

  function updateJob(idx: number, patch: Partial<ExportJob>) {
    setJobs((prev) => prev.map((j, i) => i === idx ? { ...j, ...patch } : j))
  }

  const hasSelection = selectedIds.size > 0
  const allDone = jobs.length > 0 && jobs.every((j) => j.status === 'done' || j.status === 'error')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2C2C2C] border border-[#444] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Export Video</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#E0E0E0] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 품질 / 해상도 요약 */}
        <div className="bg-[#1E1E1E] rounded-xl p-3 mb-4 flex gap-4 text-[11px]">
          <InfoRow label="크기" value={activeBannerAsset ? `${resW} × ${resH}` : '배너 미선택'} />
          <InfoRow label="품질" value={QUALITY_MAP[quality].label} />
          <InfoRow label="포맷" value="MP4 H.264" />
        </div>

        {/* 세트 선택 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#888] font-medium">출력할 세트 선택</span>
              <span className="bg-[#0D99FF]/20 text-[#0D99FF] text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {sets.length}개
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={selectAll}   className="text-[10px] text-[#0D99FF] hover:underline">전체 선택</button>
              <button onClick={deselectAll} className="text-[10px] text-[#666]    hover:underline">전체 해제</button>
            </div>
          </div>

          {sets.length === 0 ? (
            <div className="text-[11px] text-[#555] text-center py-4 border border-[#333] rounded-lg">
              등록된 세트가 없습니다
            </div>
          ) : (
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {sets.map((s) => {
                const bAsset = bannerAssets.find((b) => b.id === s.banner.assetId)
                const w = bAsset?.width  ?? resW
                const h = bAsset?.height ?? resH
                const est = estimateSeconds(w, h, s.projectDuration, qualityCfg.crf)
                return (
                  <SelectRow
                    key={s.id}
                    id={s.id}
                    label={s.name}
                    sub={`${s.projectDuration.toFixed(1)}s · ${w}×${h} · ${fmtSec(est)}`}
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleId(s.id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* 총 예상 시간 */}
        {selectedIds.size > 0 && jobs.length === 0 && (
          <div className="mb-4 bg-[#1E1E1E] rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] text-[#666]">총 예상 렌더 시간</span>
            <span className="text-[11px] text-[#E0E0E0] font-medium">{fmtSec(totalEstSec)}</span>
          </div>
        )}

        {/* 진행 상황 */}
        {jobs.length > 0 && (
          <div className="mb-4 space-y-2 max-h-36 overflow-y-auto">
            {jobs.map((job, i) => (
              <div key={i} className="bg-[#1E1E1E] rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#E0E0E0] truncate flex-1">{job.label}</span>
                  {job.status === 'done'       && <CheckCircle className="w-3.5 h-3.5 text-[#4dbb88] shrink-0" />}
                  {job.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-[#0D99FF] animate-spin shrink-0" />}
                  {job.status === 'error'      && <span className="text-[10px] text-red-400 shrink-0">오류</span>}
                </div>
                {job.status === 'processing' && (
                  <div className="h-1 bg-[#333] rounded-full overflow-hidden">
                    <div className="h-full bg-[#0D99FF] transition-all" style={{ width: `${job.progress}%` }} />
                  </div>
                )}
                {job.status === 'error' && (
                  <div className="text-[10px] text-red-400">{job.error}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {allDone && (
          <div className="mb-4 flex items-center gap-2 text-[#4dbb88] text-sm">
            <CheckCircle className="w-4 h-4" />
            모든 내보내기 완료!
          </div>
        )}

        {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
        <a ref={downloadLinkRef} className="hidden" />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#444] text-[#888] hover:text-[#E0E0E0] text-sm transition-colors"
          >
            닫기
          </button>
          <button
            onClick={handleExport}
            disabled={!hasSelection || isRunning || sets.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0D99FF] hover:bg-[#0b87e0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isRunning
              ? '렌더링 중...'
              : selectedIds.size > 1
                ? `${selectedIds.size}개 세트 출력`
                : 'Export MP4'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[#555]">{label}</span>
      <span className="text-[11px] text-[#E0E0E0] font-medium">{value}</span>
    </div>
  )
}

function SelectRow({ id, label, sub, checked, onChange }: {
  id: string; label: string; sub: string; checked: boolean; onChange: () => void
}) {
  return (
    <label
      htmlFor={`sel-${id}`}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
        checked ? 'border-[#0D99FF] bg-[#0D99FF]/10' : 'border-[#333] hover:border-[#555]'
      }`}
    >
      <input
        id={`sel-${id}`}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[#0D99FF] w-3.5 h-3.5 shrink-0"
      />
      <span className="flex-1 text-xs text-[#E0E0E0] truncate">{label}</span>
      <span className="text-[10px] text-[#555] shrink-0">{sub}</span>
    </label>
  )
}

function playDing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8)
  } catch { /* ignore */ }
}
