'use client'

import { useState, useEffect, useRef } from 'react'
import { useEditorStore, QUALITY_MAP, Quality, MusicAsset } from '@/store/editorStore'
import { Download, Monitor, Music, Gauge, Zap, Volume2 } from 'lucide-react'
import ExportModal from './ExportModal'

const SPEED_OPTIONS = [1.0, 1.2, 1.3, 1.5]

const BUILT_IN_MUSIC = [
  { name: 'Jarabe de Tequila - Inaban & Nabani', path: '/asset/music/Jarabe de Tequila - Inaban _ Nabani.mp3' },
  { name: 'Jumpy Pants - Freedom Trail Studio',  path: '/asset/music/Jumpy Pants - Freedom Trail Studio.mp3' },
]

async function measureVideoRMS(videoUrl: string): Promise<number> {
  try {
    const res = await fetch(videoUrl)
    const arrayBuffer = await res.arrayBuffer()
    const audioCtx = new AudioContext()
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    const data = decoded.getChannelData(0)
    let sum = 0
    const step = Math.max(1, Math.floor(data.length / 4000))
    let count = 0
    for (let i = 0; i < data.length; i += step) { sum += data[i] * data[i]; count++ }
    audioCtx.close()
    return Math.sqrt(sum / count)
  } catch { return 0.5 }
}

export default function RightPanel() {
  const {
    activeVideo, updateVideoClip, quality, setQuality, activeBanner, bannerAssets,
    musicAssets, musicTrack, addMusicAsset, setMusicTrack, updateMusicTrack, videoAssets, activeSetId,
  } = useEditorStore()
  const [showExport, setShowExport] = useState(false)
  const prevSetId = useRef<string | null>(null)

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

  useEffect(() => {
    if (!activeSetId || activeSetId === prevSetId.current) return
    prevSetId.current = activeSetId
    if (!musicTrack) return
    const videoAsset = activeVideo ? videoAssets.find((v) => v.id === activeVideo.assetId) : null
    if (!videoAsset) return
    measureVideoRMS(videoAsset.url).then((rms) => {
      const bgmVol = Math.min(1, Math.max(0.05, rms * 0.2))
      setMusicTrack({ ...musicTrack, volume: parseFloat(bgmVol.toFixed(2)) })
    })
  }, [activeSetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null
  const sizeLabel = bannerAsset ? `${bannerAsset.width} × ${bannerAsset.height}` : null

  function selectMusic(asset: MusicAsset) {
    if (!activeSetId) return
    if (musicTrack?.assetId === asset.id) { setMusicTrack(null); return }
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
      <aside className="w-[256px] h-full bg-[#16191D]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col shrink-0 overflow-hidden shadow-2xl">

        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <span className="text-[13px] font-semibold text-white/90 tracking-tight">Properties</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6 scrollbar-none">

          {/* Canvas Size */}
          <Section title="Canvas Size" icon={<Monitor className="w-3.5 h-3.5" />}>
            <div className="rounded-xl bg-[#1E2128] px-4 py-3">
              {sizeLabel ? (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/30">Size</span>
                  <span className="text-[12px] text-white/80 font-medium">{sizeLabel}</span>
                </div>
              ) : (
                <span className="text-[11px] text-white/25">배너를 업로드하면 설정됩니다</span>
              )}
            </div>
          </Section>

          {/* Export Quality */}
          <Section title="Quality" icon={<Zap className="w-3.5 h-3.5" />}>
            <div className="rounded-xl bg-[#1E2128] p-1 flex gap-1">
              {(Object.keys(QUALITY_MAP) as Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${
                    quality === q
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
          </Section>

          {/* Speed */}
          <Section title="Speed" icon={<Gauge className="w-3.5 h-3.5" />}>
            <div className={`rounded-xl bg-[#1E2128] p-1 grid grid-cols-4 gap-1 ${!activeVideo ? 'opacity-25 pointer-events-none' : ''}`}>
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => updateVideoClip({ speed: s })}
                  className={`py-2 rounded-lg text-[11px] font-medium transition-all ${
                    activeVideo?.speed === s
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </Section>

          {/* BGM */}
          <Section title="BGM" icon={<Music className="w-3.5 h-3.5" />}>
            <div className={`space-y-3 ${!activeSetId ? 'opacity-25 pointer-events-none' : ''}`}>
              <select
                value={musicTrack?.assetId ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) { setMusicTrack(null); return }
                  const asset = musicAssets.find((m) => m.id === id)
                  if (asset) selectMusic(asset)
                }}
                disabled={!activeSetId}
                className="w-full px-3 py-2.5 rounded-xl bg-[#1E2128] text-[11px] text-white/70 border-none outline-none cursor-pointer appearance-none"
                style={{ backgroundImage: 'none' }}
              >
                <option value="" style={{ background: '#1E2128' }}>— BGM 없음 —</option>
                {musicAssets.map((asset) => (
                  <option key={asset.id} value={asset.id} style={{ background: '#1E2128' }}>
                    {asset.name}
                  </option>
                ))}
              </select>

              {musicTrack && (
                <VolumeSlider
                  label="BGM"
                  value={musicTrack.volume}
                  color="#F59E0B"
                  onChange={(v) => updateMusicTrack({ volume: v })}
                />
              )}
            </div>
            {!activeSetId && (
              <p className="text-[10px] text-white/20 mt-2">세트를 선택하면 BGM을 등록할 수 있습니다</p>
            )}
          </Section>

          {/* Video Volume */}
          <Section title="Video Volume" icon={<Volume2 className="w-3.5 h-3.5" />}>
            <div className={!activeSetId || !musicTrack ? 'opacity-25 pointer-events-none' : ''}>
              <VolumeSlider
                label="영상 음향"
                value={musicTrack?.videoVolume ?? 1}
                color="#3B82F6"
                onChange={(v) => updateMusicTrack({ videoVolume: v })}
              />
            </div>
            {activeSetId && !musicTrack && (
              <p className="text-[10px] text-white/20 mt-2">BGM을 선택하면 조절할 수 있습니다</p>
            )}
          </Section>

        </div>

        {/* Export 버튼 */}
        <div className="px-4 pb-4 shrink-0">
          <button
            onClick={() => setShowExport(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[13px] font-semibold rounded-xl transition-colors h-11"
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
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-white/30">{icon}</span>
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">{title}</span>
      </div>
      {children}
    </div>
  )
}

function VolumeSlider({ label, value, color, onChange }: {
  label: string; value: number; color: string; onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl bg-[#1E2128] px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40">{label}</span>
        <span className="text-[11px] font-mono" style={{ color }}>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 cursor-pointer rounded-full appearance-none"
        style={{ accentColor: color }}
      />
    </div>
  )
}
