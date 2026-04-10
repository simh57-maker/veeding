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
  // 세트 간 에셋 재사용: 이미 FFmpeg FS에 쓴 파일 추적
  const writtenAssetsRef = useRef<Set<string>>(new Set())

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
  ): Promise<Blob> {

    const videoAsset = videoAssets.find((v) => v.id === video!.assetId)!
    const written = writtenAssetsRef.current

    // ── 파일 쓰기 (같은 에셋은 세트 간 재사용) ──────────────
    const videoKey = `video:${videoAsset.id}`
    if (!written.has(videoKey)) {
      const videoData = await fetchToUint8Array(videoAsset.url)
      await ffmpeg.writeFile('input.mp4', videoData)
      written.add(videoKey)
    }

    const speed    = video!.speed
    const inPoint  = video!.inPoint
    const outPoint = video!.outPoint
    const clipLen  = (outPoint - inPoint) / speed

    const bannerAsset = banner ? bannerAssets.find((b) => b.id === banner.assetId) : null
    const outW = bannerAsset?.width  ?? resW
    const outH = bannerAsset?.height ?? resH

    // 출력 해상도 기준으로 영상 스케일 계산
    // (4K 원본을 전부 디코딩하지 않고 출력 크기에 맞게만 처리)
    const vidW = Math.round(videoAsset.width  * video!.scaleX)
    const vidH = Math.round(videoAsset.height * video!.scaleY)
    const safeW = vidW % 2 === 0 ? vidW : vidW + 1
    const safeH = vidH % 2 === 0 ? vidH : vidH + 1
    const vidX  = Math.round(video!.x - safeW / 2)
    const vidY  = Math.round(video!.y - safeH / 2)

    // 속도 필터
    const vSpeedFilter = speed !== 1 ? `setpts=${(1 / speed).toFixed(6)}*PTS,` : ''

    // ── 입력 구성 ─────────────────────────────────────────
    const inputs: string[] = [
      '-ss', String(inPoint),
      '-to', String(outPoint),
      '-i', 'input.mp4',
    ]
    let bannerIdx = -1
    let musicIdx  = -1

    if (bannerAsset) {
      const bannerKey = `banner:${bannerAsset.id}`
      if (!written.has(bannerKey)) {
        const bannerData = await fetchToUint8Array(bannerAsset.dataUrl)
        await ffmpeg.writeFile('banner.png', bannerData)
        written.add(bannerKey)
      }
      inputs.push('-i', 'banner.png')
      bannerIdx = 1
    }

    const musicAsset = musicTrack ? musicAssets.find((m) => m.id === musicTrack.assetId) : null
    if (musicAsset) {
      const musicKey = `music:${musicAsset.id}`
      if (!written.has(musicKey)) {
        const musicData = await fetchToUint8Array(musicAsset.url)
        await ffmpeg.writeFile('bgm.mp3', musicData)
        written.add(musicKey)
      }
      inputs.push('-stream_loop', '-1', '-i', 'bgm.mp3')
      musicIdx = bannerIdx >= 0 ? 2 : 1
    }

    const silenceIdx = inputs.filter((a) => a === '-i').length
    inputs.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${clipLen}`)

    // ── 비디오 필터: color+overlay 대신 pad 사용 (더 빠름) ──
    // pad는 배경 생성+영상 배치를 1패스로 처리
    let vf: string
    const padX = Math.max(0, vidX)
    const padY = Math.max(0, vidY)

    if (bannerIdx >= 0) {
      vf =
        `[0:v]${vSpeedFilter}scale=${safeW}:${safeH}[scaled];` +
        `[scaled]pad=${outW}:${outH}:${padX}:${padY}:black[padded];` +
        `[${bannerIdx}:v]scale=${outW}:${outH}[banner];` +
        `[padded][banner]overlay=0:0[vout]`
    } else {
      vf =
        `[0:v]${vSpeedFilter}scale=${safeW}:${safeH}[scaled];` +
        `[scaled]pad=${outW}:${outH}:${padX}:${padY}:black[vout]`
    }

    // ── 오디오 필터 ────────────────────────────────────────
    const musicVol = musicTrack?.volume ?? 0
    const maps: string[] = ['-map', '[vout]']
    let af: string

    if (musicIdx >= 0) {
      af = `[${musicIdx}:a]volume=${musicVol.toFixed(3)}[aout]`
      maps.push('-map', '[aout]')
    } else {
      af = `[${silenceIdx}:a]anull[aout]`
      maps.push('-map', '[aout]')
    }

    const filterComplex = `${vf};${af}`

    const cmd: string[] = [
      ...inputs,
      '-filter_complex', filterComplex,
      ...maps,
      '-t', String(clipLen),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',   // fast → ultrafast: 싱글스레드 WASM에서 2~3배 빠름
      '-crf', String(qualityCfg.crf),
      '-tune', 'zerolatency',   // 추가 인코딩 최적화
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      filename,
    ]

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
    writtenAssetsRef.current = new Set()  // 세트 간 에셋 캐시 초기화

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

          // 예상 소요 시간: 이전 세트 실측값 or 영상 길이 × 경험적 배수(10)
          const estimatedSec = measuredFactorRef.current !== null
            ? measuredFactorRef.current * (w * h / 1_000_000) * found.projectDuration
            : found.projectDuration * 10

          // 시간 기반 폴링 — FFmpeg progress 이벤트 대신
          const pollInterval = setInterval(() => {
            const elapsed = (performance.now() - startTs) / 1000
            const p = Math.min(95, Math.round((elapsed / estimatedSec) * 100))
            const remain = Math.max(0, estimatedSec - elapsed)
            updateJob(i, jobList, { progress: p, remainSec: remain })
          }, 500)

          const blob = await renderOne(ffmpeg, found.banner, found.video, filename)
          clearInterval(pollInterval)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
      <div className="bg-[#16191D]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl w-full max-w-md p-6 shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[15px] font-semibold text-white/90 tracking-tight">Export Video</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 세트 선택 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">세트 선택</span>
              <span className="bg-[#3B82F6]/20 text-[#3B82F6] text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {sets.length}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={selectAll}   className="text-[10px] text-[#3B82F6] hover:text-[#60A5FA] transition-colors">전체 선택</button>
              <button onClick={deselectAll} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">전체 해제</button>
            </div>
          </div>

          {sets.length === 0 ? (
            <div className="text-[11px] text-white/25 text-center py-5 rounded-xl bg-[#1E2128]">
              등록된 세트가 없습니다
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
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
          <div className="mb-4 space-y-1.5 max-h-48 overflow-y-auto">
            {jobs.map((job, i) => (
              <div key={i} className="bg-[#1E2128] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-white/70 truncate flex-1 mr-2 font-medium">{job.label}</span>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {job.status === 'done' && (
                      <>
                        <span className="text-[10px] text-emerald-400/80 font-mono">{job.totalSec}s</span>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      </>
                    )}
                    {job.status === 'processing' && (
                      <>
                        {job.remainSec !== null && (
                          <span className="text-[10px] text-[#3B82F6] font-mono">
                            {fmtRemain(job.remainSec)}
                          </span>
                        )}
                        <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />
                      </>
                    )}
                    {job.status === 'error' && (
                      <span className="text-[10px] text-red-400/80">오류</span>
                    )}
                  </div>
                </div>

                <div className="h-1 rounded-full overflow-hidden bg-white/[0.06]">
                  {job.status === 'processing' && (
                    <div
                      className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
                      style={{ width: `${job.progress}%` }}
                    />
                  )}
                  {job.status === 'done' && <div className="h-full bg-emerald-400 rounded-full w-full" />}
                  {job.status === 'error' && <div className="h-full bg-red-400/60 rounded-full w-full" />}
                </div>
                {job.status === 'error' && (
                  <div className="text-[10px] text-red-400/70 mt-1.5">{job.error}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
        <a ref={downloadLinkRef} className="hidden" />

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-white/50 hover:text-white/70 text-[13px] font-medium transition-all"
          >
            닫기
          </button>
          <button
            onClick={handleExport}
            disabled={!hasSelection || isRunning || sets.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-all"
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

      {/* 완료 오버레이 */}
      {allDone && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
          <div className="bg-[#16191D]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-center">
              <div className="text-white/90 font-semibold text-[15px] tracking-tight mb-1">출력 완료</div>
              <div className="text-white/35 text-[12px]">
                {jobs.filter((j) => j.status === 'done').length}개 영상이 다운로드되었습니다
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-8 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[13px] font-semibold transition-all"
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
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
        checked ? 'bg-[#3B82F6]/15 ring-1 ring-[#3B82F6]/40' : 'bg-[#1E2128] hover:bg-[#252A33]'
      }`}
    >
      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
        checked ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-white/20 bg-transparent'
      }`}>
        {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <input id={`sel-${id}`} type="checkbox" checked={checked} onChange={onChange} className="hidden" />
      <span className="flex-1 text-[12px] text-white/70 truncate font-medium">{label}</span>
      <span className="text-[10px] text-white/25 shrink-0 font-mono">{sub}</span>
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
