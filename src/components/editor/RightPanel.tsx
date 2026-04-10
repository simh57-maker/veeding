'use client'

import { useState, useEffect, useRef } from 'react'
import { useEditorStore, QUALITY_MAP, Quality, MusicAsset } from '@/store/editorStore'
import { Settings2, Film, Download, Monitor, Music } from 'lucide-react'
import ExportModal from './ExportModal'

const SPEED_OPTIONS = [1.0, 0.8, 0.7, 0.6]

const BUILT_IN_MUSIC = [
  { name: 'Jarabe de Tequila - Inaban & Nabani', path: '/asset/music/Jarabe de Tequila - Inaban _ Nabani.mp3' },
  { name: 'Jumpy Pants - Freedom Trail Studio',  path: '/asset/music/Jumpy Pants - Freedom Trail Studio.mp3' },
]

/** Web Audio API로 영상 URL의 평균 RMS 볼륨(0~1)을 측정 */
async function measureVideoRMS(videoUrl: string): Promise<number> {
  try {
    const res = await fetch(videoUrl)
    const arrayBuffer = await res.arrayBuffer()
    const audioCtx = new AudioContext()
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    const data = decoded.getChannelData(0)
    let sum = 0
    const step = Math.max(1, Math.floor(data.length / 4000)) // 샘플 4000개
    let count = 0
    for (let i = 0; i < data.length; i += step) {
      sum += data[i] * data[i]
      count++
    }
    audioCtx.close()
    return Math.sqrt(sum / count)
  } catch {
    return 0.5 // 분석 실패 시 기본값
  }
}

export default function RightPanel() {
  const {
    activeVideo, updateVideoClip, quality, setQuality, activeBanner, bannerAssets,
    musicAssets, musicTrack, addMusicAsset, setMusicTrack, videoAssets, activeSetId,
  } = useEditorStore()
  const [showExport, setShowExport] = useState(false)
  const prevSetId = useRef<string | null>(null)

  // 내장 음악을 최초 한 번만 musicAssets에 등록
  useEffect(() => {
    if (musicAssets.length > 0) return
    BUILT_IN_MUSIC.forEach(({ name, path }) => {
      const audio = new Audio()
      audio.src = path
      audio.onloadedmetadata = () => {
        const asset: MusicAsset = { id: path, name, url: path, duration: audio.duration }
        addMusicAsset(asset)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 세트 클릭 시 BGM 자동 볼륨 설정 (이전 선택된 BGM 유지, 볼륨만 재계산)
  useEffect(() => {
    if (!activeSetId || activeSetId === prevSetId.current) return
    prevSetId.current = activeSetId
    if (!musicTrack) return  // BGM이 선택된 상태일 때만

    const videoAsset = activeVideo ? videoAssets.find((v) => v.id === activeVideo.assetId) : null
    if (!videoAsset) return

    measureVideoRMS(videoAsset.url).then((rms) => {
      // 영상 RMS의 20%를 BGM 볼륨으로 설정 (최소 0.05, 최대 1)
      const bgmVol = Math.min(1, Math.max(0.05, rms * 0.2))
      setMusicTrack({ ...musicTrack, volume: parseFloat(bgmVol.toFixed(2)) })
    })
  }, [activeSetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const sizeLabel = bannerAsset ? `${bannerAsset.width} × ${bannerAsset.height}` : null

  function selectMusic(asset: MusicAsset) {
    // BGM 선택은 세트가 로드된 상태에서만 허용
    if (!activeSetId) return
    if (musicTrack?.assetId === asset.id) {
      setMusicTrack(null)
      return
    }
    // 선택 즉시 영상 볼륨 측정 후 20% 적용
    const videoAsset = activeVideo ? videoAssets.find((v) => v.id === activeVideo.assetId) : null
    if (videoAsset) {
      measureVideoRMS(videoAsset.url).then((rms) => {
        const bgmVol = Math.min(1, Math.max(0.05, rms * 0.2))
        setMusicTrack({ assetId: asset.id, volume: parseFloat(bgmVol.toFixed(2)), videoVolume: 1 })
      })
    } else {
      setMusicTrack({ assetId: asset.id, volume: 0.2, videoVolume: 1 })
    }
  }

  return (
    <>
      <aside className="w-[240px] bg-[#2C2C2C] border-l border-[#333] flex flex-col shrink-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-[#333] flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#888]" />
          <span className="text-xs font-semibold text-[#E0E0E0] uppercase tracking-wider">Properties</span>
        </div>

        <div className="p-4 space-y-5 flex-1">

          {/* Canvas Size */}
          <Section title="Canvas Size" icon={<Monitor className="w-3.5 h-3.5" />}>
            {sizeLabel ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1E1E1E] border border-[#3a3a3a]">
                <span className="text-[10px] text-[#555]">Canvas</span>
                <span className="text-xs text-[#E0E0E0] font-medium">{sizeLabel}</span>
              </div>
            ) : (
              <p className="text-[10px] text-[#444] px-1">배너를 업로드하면 설정됩니다</p>
            )}
          </Section>

          {/* Export Quality */}
          <Section title="Export Quality" icon={<Settings2 className="w-3.5 h-3.5" />}>
            <div className="space-y-1">
              {(Object.keys(QUALITY_MAP) as Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                    quality === q
                      ? 'border-[#0D99FF] bg-[#0D99FF]/10 text-[#0D99FF]'
                      : 'border-[#3a3a3a] text-[#888] hover:border-[#555] hover:text-[#E0E0E0]'
                  }`}
                >
                  <span className="capitalize">{q}</span>
                  <span className="text-[10px] opacity-70">
                    {QUALITY_MAP[q].label.split('(')[1]?.replace(')', '') ?? ''}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* Speed */}
          {activeVideo && (
            <Section title="Speed" icon={<Film className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-1">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateVideoClip({ speed: s })}
                    className={`py-1.5 rounded-lg text-xs border font-medium transition-all ${
                      activeVideo.speed === s
                        ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                        : 'border-[#444] text-[#888] hover:border-[#666] hover:text-[#E0E0E0]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Background Music */}
          <Section title="BGM" icon={<Music className="w-3.5 h-3.5" />}>
            <div className="space-y-1">
              {musicAssets.map((asset) => {
                const selected = musicTrack?.assetId === asset.id
                return (
                  <button
                    key={asset.id}
                    onClick={() => selectMusic(asset)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${
                      selected
                        ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                        : 'border-[#3a3a3a] hover:border-[#555]'
                    }`}
                  >
                    <Music className={`w-3 h-3 shrink-0 ${selected ? 'text-[#F59E0B]' : 'text-[#555]'}`} />
                    <span className={`text-[10px] truncate flex-1 ${selected ? 'text-[#F59E0B]' : 'text-[#888]'}`}>
                      {asset.name}
                    </span>
                    <span className="text-[9px] text-[#555] shrink-0">{asset.duration.toFixed(0)}s</span>
                  </button>
                )
              })}
            </div>

            {/* 선택된 BGM 볼륨 표시 (읽기 전용) */}
            {musicTrack && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-[#1E1E1E] border border-[#3a3a3a] flex items-center justify-between">
                <span className="text-[10px] text-[#555]">auto volume</span>
                <span className="text-[10px] text-[#F59E0B] font-mono">{Math.round(musicTrack.volume * 100)}%</span>
              </div>
            )}

            {/* 세트 미선택 안내 */}
            {!activeSetId && (
              <p className="text-[10px] text-[#444] px-1 mt-1">세트를 선택하면 BGM을 등록할 수 있습니다</p>
            )}
          </Section>

        </div>

        {/* Export 버튼 — 하단 고정 */}
        <div className="p-3 border-t border-[#333] shrink-0">
          <button
            onClick={() => setShowExport(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#0D99FF] hover:bg-[#0b87e0] text-white text-sm font-medium rounded-lg transition-colors"
            style={{ height: 44 }}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </aside>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </>
  )
}

function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[#888]">{icon}</span>
        <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}
