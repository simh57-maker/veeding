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
  remainSec: number | null
  totalSec: number | null
  error?: string
}

function fmtRemain(s: number): string {
  if (s < 5)  return '거의 완료'
  if (s < 60) return `${Math.ceil(s)}초 남음`
  const m = Math.floor(s / 60)
  const sec = Math.ceil(s % 60)
  return sec > 0 ? `${m}분 ${sec}초 남음` : `${m}분 남음`
}

/** blob: / http: / data: 모두 처리하는 → Uint8Array */
async function fetchToUint8Array(url: string): Promise<Uint8Array> {
  // data:... base64 URL — fetch가 실패하는 브라우저 대비
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch failed (${res.status}): ${url.slice(0, 80)}`)
  return new Uint8Array(await res.arrayBuffer())
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
    banner: typeof activeBanner,
    video: typeof activeVideo,
    filename: string,
    onProgress: (p: number) => void,
  ): Promise<Blob> {

    // progress 리스너 — 매 세트마다 새로 등록하기 위해 off 후 on
    const progressHandler = ({ progress: p }: { progress: number }) => {
      onProgress(Math.min(99, Math.round(p * 100)))
    }
    ffmpeg.off('progress', progressHandler)
    ffmpeg.on('progress', progressHandler)

    const videoAsset = videoAssets.find((v) => v.id === video!.assetId)!
    console.log('[export] videoAsset url:', videoAsset.url.slice(0, 60), 'w:', videoAsset.width, 'h:', videoAsset.height)

    console.log('[export] fetching video...')
    const videoData = await fetchToUint8Array(videoAsset.url)
    console.log('[export] video bytes:', videoData.byteLength)
    await ffmpeg.writeFile('input.mp4', videoData)
    console.log('[export] wrote input.mp4')

    const speed      = video!.speed
    const inPoint    = video!.inPoint
    const outPoint   = video!.outPoint
    const clipLen    = (outPoint - inPoint) / speed   // 실제 출력 길이(초)

    const bannerAsset = banner ? bannerAssets.find((b) => b.id === banner.assetId) : null
    const outW = bannerAsset?.width  ?? resW
    const outH = bannerAsset?.height ?? resH

    const vidW = Math.round(videoAsset.width  * video!.scaleX)
    const vidH = Math.round(videoAsset.height * video!.scaleY)
    // 짝수 보정 (libx264 요구사항)
    const safeW = vidW % 2 === 0 ? vidW : vidW + 1
    const safeH = vidH % 2 === 0 ? vidH : vidH + 1
    const vidX  = Math.round(video!.x - safeW / 2)
    const vidY  = Math.round(video!.y - safeH / 2)

    // 속도 필터
    const vSpeedFilter = speed !== 1 ? `setpts=${(1 / speed).toFixed(6)}*PTS,` : ''

    // ── 입력 구성 ─────────────────────────────────────────
    // index 0: 영상 (input seeking으로 클립)
    // index 1: 배너 이미지 (있을 때)
    // index 2(or 1): BGM (있을 때) — stream_loop -1로 무한 반복
    // index last: anullsrc (silent fallback — 영상에 오디오 없을 때 대비)
    const inputs: string[] = [
      '-ss', String(inPoint),
      '-to', String(outPoint),
      '-i', 'input.mp4',
    ]
    let bannerIdx = -1
    let musicIdx  = -1

    if (bannerAsset) {
      console.log('[export] fetching banner dataUrl length:', bannerAsset.dataUrl.length)
      const bannerData = await fetchToUint8Array(bannerAsset.dataUrl)
      console.log('[export] banner bytes:', bannerData.byteLength)
      await ffmpeg.writeFile('banner.png', bannerData)
      console.log('[export] wrote banner.png')
      inputs.push('-i', 'banner.png')
      bannerIdx = 1
    }

    const musicAsset = musicTrack ? musicAssets.find((m) => m.id === musicTrack.assetId) : null
    if (musicAsset) {
      console.log('[export] fetching music:', musicAsset.url.slice(0, 60))
      const musicData = await fetchToUint8Array(musicAsset.url)
      console.log('[export] music bytes:', musicData.byteLength)
      await ffmpeg.writeFile('bgm.mp3', musicData)
      console.log('[export] wrote bgm.mp3')
      inputs.push('-stream_loop', '-1', '-i', 'bgm.mp3')
      musicIdx = bannerIdx >= 0 ? 2 : 1
    }

    // anullsrc를 별도 입력으로 추가 — 영상 오디오 스트림 없을 때 대비
    const silenceIdx = inputs.filter((a) => a === '-i').length
    inputs.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${clipLen}`)

    // ── 비디오 필터 체인 ──────────────────────────────────
    let vf: string
    if (bannerIdx >= 0) {
      vf =
        `[0:v]${vSpeedFilter}scale=${safeW}:${safeH}[scaled];` +
        `color=black:size=${outW}x${outH}:rate=30[bg];` +
        `[bg][scaled]overlay=${vidX}:${vidY}[vid];` +
        `[${bannerIdx}:v]scale=${outW}:${outH}[banner];` +
        `[vid][banner]overlay=0:0[vout]`
    } else {
      vf =
        `[0:v]${vSpeedFilter}scale=${safeW}:${safeH}[scaled];` +
        `color=black:size=${outW}x${outH}:rate=30[bg];` +
        `[bg][scaled]overlay=${vidX}:${vidY}[vout]`
    }

    // ── 오디오 필터 체인 ──────────────────────────────────
    // 영상 오디오가 없을 수 있으므로 anullsrc와 amix해서 항상 유효한 스트림 확보
    // amix duration=shortest → 짧은 쪽 기준 (silence는 clipLen으로 고정됨)
    const musicVol = musicTrack?.volume ?? 0

    const maps: string[] = ['-map', '[vout]']
    let af: string

    // [0:a]는 영상에 오디오 스트림이 없으면 filter_complex 전체를 실패시킴
    // → anullsrc 입력을 항상 기본 오디오로 사용
    if (musicIdx >= 0) {
      af =
        `[${musicIdx}:a]volume=${musicVol.toFixed(3)}[aout]`
      maps.push('-map', '[aout]')
    } else {
      // BGM 없음 — anullsrc 무음
      af = `[${silenceIdx}:a]anull[aout]`
      maps.push('-map', '[aout]')
    }

    const filterComplex = `${vf};${af}`

    // -t는 output duration 제한 (input seeking 이후 추가 안전장치)
    const cmd: string[] = [
      ...inputs,
      '-filter_complex', filterComplex,
      ...maps,
      '-t', String(clipLen),
      '-c:v', 'libx264',
      '-preset', qualityCfg.preset,
      '-crf', String(qualityCfg.crf),
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      filename,
    ]

    console.log('[export] cmd:', cmd.join(' '))
    await ffmpeg.exec(cmd)
    ffmpeg.off('progress', progressHandler)

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
      const { toBlobURL } = await import('@ffmpeg/util')

      const ffmpeg = new FFmpeg()
      ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message))
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
            ffmpeg, found.banner, found.video, filename,
            (p) => {
              if (p <= 0) return
              const elapsed = (performance.now() - startTs) / 1000
              const total = elapsed / (p / 100)
              const remain = Math.max(0, total - elapsed)
              updateJob(i, jobList, { progress: p, remainSec: remain })
            },
          )

          const elapsed = (performance.now() - startTs) / 1000
          const mp = (w * h) / 1_000_000
          const newFactor = elapsed / (mp * found.projectDuration)
          measuredFactorRef.current = measuredFactorRef.current === null
            ? newFactor
            : (measuredFactorRef.current + newFactor) / 2

          const setBannerAsset = bannerAssets.find((b) => b.id === found.banner?.assetId)
          const fileW = setBannerAsset?.width  ?? resW
          const fileH = setBannerAsset?.height ?? resH

          // 다운로드 — revokeObjectURL은 click 후 충분한 시간 뒤에
          const url = URL.createObjectURL(blob)
          const a = downloadLinkRef.current!
          a.href = url
          a.download = `veeding_${job.label.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${fileW}x${fileH}_${Date.now()}.mp4`
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 5000)

          updateJob(i, jobList, { status: 'done', progress: 100, remainSec: null, totalSec: Math.round(elapsed) })

          // 다음 세트 전에 이전 출력 파일 삭제
          try { await ffmpeg.deleteFile(filename) } catch { /* ignore */ }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[export] set ${i} error:`, msg)
          updateJob(i, jobList, { status: 'error', error: msg })
        }
      }

      playDing()
    } catch (err) {
      console.error('[export] fatal:', err)
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
