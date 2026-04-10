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
  progress: number        // 0~100
  remainSec: number | null  // 남은 초 (렌더 중 실시간)
  totalSec: number | null   // 이 세트 실제 소요 (완료 후)
  error?: string
}

function fmtRemain(s: number): string {
  if (s < 5)  return '거의 완료'
  if (s < 60) return `${Math.ceil(s)}초 남음`
  const m = Math.floor(s / 60)
  const sec = Math.ceil(s % 60)
  return sec > 0 ? `${m}분 ${sec}초 남음` : `${m}분 남음`
}

export default function ExportModal({ onClose }: Props) {
  const { activeVideo, activeBanner, videoAssets, bannerAssets, musicAssets, musicTrack, quality, sets } = useEditorStore()

  const activeBannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const resW = activeBannerAsset?.width  ?? 1920
  const resH = activeBannerAsset?.height ?? 1080

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(sets.map((s) => s.id)))
  const [jobs, setJobs] = useState<ExportJob[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)
  const measuredFactorRef = useRef<number | null>(null)

  const qualityCfg = QUALITY_MAP[quality]

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

  function getSetDimensions(s: CompositionSet) {
    const bAsset = bannerAssets.find((b) => b.id === s.banner.assetId)
    return { w: bAsset?.width ?? resW, h: bAsset?.height ?? resH }
  }

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
    const audioSpeedFilter = video!.speed !== 1 ? `atempo=${video!.speed.toFixed(4)},` : ''

    const bannerAsset = banner ? bannerAssets.find((b) => b.id === banner.assetId) : null
    const outW = bannerAsset?.width  ?? resW
    const outH = bannerAsset?.height ?? resH

    const vidW = Math.round(videoAsset.width  * video!.scaleX)
    const vidH = Math.round(videoAsset.height * video!.scaleY)
    const vidX = Math.round(video!.x - vidW / 2)
    const vidY = Math.round(video!.y - vidH / 2)

    const musicAsset = musicTrack ? musicAssets.find((m) => m.id === musicTrack.assetId) : null
    const videoVol = musicTrack?.videoVolume ?? 1
    const musicVol = musicTrack?.volume ?? 0

    // 입력 파일 순서: [0]=input.mp4, [1]=banner.png(있으면), [2]=music(있으면)
    const inputs = ['-ss', String(inPoint), '-i', 'input.mp4']
    let bannerIdx = -1
    let musicIdx = -1

    if (bannerAsset) {
      const bannerData = await fetchFile(bannerAsset.dataUrl)
      await ffmpeg.writeFile('banner.png', bannerData)
      inputs.push('-i', 'banner.png')
      bannerIdx = 1
    }

    if (musicAsset) {
      const musicData = await fetchFile(musicAsset.url)
      await ffmpeg.writeFile('music_input', musicData)
      inputs.push('-stream_loop', '-1', '-i', 'music_input')
      musicIdx = bannerIdx >= 0 ? 2 : 1
    }

    // 비디오 필터
    let videoFilter = ''
    if (bannerIdx >= 0) {
      videoFilter =
        `[0:v]${speedFilter}scale=${vidW}:${vidH}[scaled];` +
        `color=black:size=${outW}x${outH}:rate=30[bg];` +
        `[bg][scaled]overlay=${vidX}:${vidY}[vid];` +
        `[${bannerIdx}:v]scale=${outW}:${outH}[banner];` +
        `[vid][banner]overlay=0:0[vout]`
    } else {
      videoFilter =
        `[0:v]${speedFilter}scale=${vidW}:${vidH}[scaled];` +
        `color=black:size=${outW}x${outH}:rate=30[bg];` +
        `[bg][scaled]overlay=${vidX}:${vidY}[vout]`
    }

    // 오디오 필터
    let audioFilter = ''
    const hasSrcAudio = true   // 영상에 오디오 트랙이 없어도 anullsrc로 처리
    if (musicIdx >= 0) {
      audioFilter =
        `[0:a]${audioSpeedFilter}volume=${videoVol.toFixed(3)}[va];` +
        `[${musicIdx}:a]volume=${musicVol.toFixed(3)}[ma];` +
        `[va][ma]amix=inputs=2:duration=first[aout]`
    } else if (hasSrcAudio) {
      audioFilter = `[0:a]${audioSpeedFilter}volume=${videoVol.toFixed(3)}[aout]`
    }

    const filterComplex = audioFilter ? `${videoFilter};${audioFilter}` : videoFilter
    const maps = ['-map', '[vout]']
    if (audioFilter) maps.push('-map', '[aout]')

    const cmd = [
      ...inputs,
      '-t', String(duration),
      '-filter_complex', filterComplex,
      ...maps,
      '-c:v', 'libx264',
      '-preset', qualityCfg.preset,
      '-crf', String(qualityCfg.crf),
      '-pix_fmt', 'yuv420p',
    ]
    if (audioFilter) cmd.push('-c:a', 'aac', '-b:a', '192k')
    cmd.push('-movflags', '+faststart', filename)

    await ffmpeg.exec(cmd)

    const data = await ffmpeg.readFile(filename)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Blob([data as any], { type: 'video/mp4' })
  }

  // ─── 내보내기 실행 ──────────────────────────────────────
  async function handleExport() {
    if (selectedIds.size === 0) return
    setIsRunning(true)
    measuredFactorRef.current = null

    const selectedSets = Array.from(selectedIds)
      .map((id) => sets.find((s) => s.id === id))
      .filter(Boolean) as CompositionSet[]

    const jobList: ExportJob[] = selectedSets.map((s) => ({
      setId: s.id,
      label: s.name,
      status: 'idle',
      progress: 0,
      remainSec: null,
      totalSec: null,
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
        const job = jobList[i]
        const found = selectedSets[i]
        const { w, h } = getSetDimensions(found)

        updateJob(i, jobList, { status: 'processing', remainSec: null })
        const startTs = performance.now()

        try {
          if (!found.video) throw new Error('영상이 없습니다')

          const filename = `out_${i}.mp4`

          const blob = await renderOne(
            ffmpeg, fetchFile, found.banner, found.video, found.projectDuration, filename,
            (p) => {
              if (p <= 0) return
              const elapsed = (performance.now() - startTs) / 1000
              const total = elapsed / (p / 100)
              const remain = Math.max(0, total - elapsed)
              updateJob(i, jobList, { progress: p, remainSec: remain })
            },
          )

          const elapsed = (performance.now() - startTs) / 1000

          // 실측 계수 갱신 (MP당 초당)
          const mp = (w * h) / 1_000_000
          const newFactor = elapsed / (mp * found.projectDuration)
          measuredFactorRef.current = measuredFactorRef.current === null
            ? newFactor
            : (measuredFactorRef.current + newFactor) / 2

          const setBannerAsset = bannerAssets.find((b) => b.id === found.banner?.assetId)
          const fileW = setBannerAsset?.width  ?? resW
          const fileH = setBannerAsset?.height ?? resH

          const url = URL.createObjectURL(blob)
          const a = downloadLinkRef.current!
          a.href = url
          a.download = `veeding_${job.label.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${fileW}x${fileH}_${Date.now()}.mp4`
          a.click()
          URL.revokeObjectURL(url)

          updateJob(i, jobList, { status: 'done', progress: 100, remainSec: null, totalSec: Math.round(elapsed) })
        } catch (err) {
          updateJob(i, jobList, { status: 'error', error: err instanceof Error ? err.message : 'Error' })
        }
      }

      playDing()
    } catch (err) {
      console.error(err)
    }

    setIsRunning(false)
  }

  function updateJob(idx: number, list: ExportJob[], patch: Partial<ExportJob>) {
    list[idx] = { ...list[idx], ...patch }
    setJobs([...list])
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
                const { w, h } = getSetDimensions(s)
                return (
                  <SelectRow
                    key={s.id}
                    id={s.id}
                    label={s.name}
                    sub={`${s.projectDuration.toFixed(1)}s · ${w}×${h}`}
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleId(s.id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* 진행 상황 */}
        {jobs.length > 0 && (
          <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
            {jobs.map((job, i) => (
              <div key={i} className="bg-[#1E1E1E] rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#E0E0E0] truncate flex-1 mr-2">{job.label}</span>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {job.status === 'done' && (
                      <>
                        <span className="text-[10px] text-[#4dbb88]">{job.totalSec}초 소요</span>
                        <CheckCircle className="w-3.5 h-3.5 text-[#4dbb88]" />
                      </>
                    )}
                    {job.status === 'processing' && (
                      <>
                        {job.remainSec !== null && (
                          <span className="text-[10px] text-[#0D99FF] font-mono">
                            {fmtRemain(job.remainSec)}
                          </span>
                        )}
                        <Loader2 className="w-3.5 h-3.5 text-[#0D99FF] animate-spin" />
                      </>
                    )}
                    {job.status === 'error' && (
                      <span className="text-[10px] text-red-400">오류</span>
                    )}
                  </div>
                </div>

                {job.status === 'processing' && (
                  <div className="h-1 bg-[#333] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0D99FF] transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
                {job.status === 'idle' && (
                  <div className="h-1 bg-[#2a2a2a] rounded-full" />
                )}
                {job.status === 'error' && (
                  <div className="text-[10px] text-red-400 mt-0.5">{job.error}</div>
                )}
              </div>
            ))}
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

      {/* 완료 모달 오버레이 */}
      {allDone && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl z-10">
          <div className="bg-[#2C2C2C] border border-[#444] rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#4dbb88]/20 flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-[#4dbb88]" />
            </div>
            <div className="text-center">
              <div className="text-white font-semibold text-lg mb-1">출력 완료!</div>
              <div className="text-[#888] text-sm">
                {jobs.filter((j) => j.status === 'done').length}개 영상이 다운로드되었습니다
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-2.5 rounded-xl bg-[#0D99FF] hover:bg-[#0b87e0] text-white text-sm font-medium transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
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
