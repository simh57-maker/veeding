'use client'

import { useState, useEffect, useRef } from 'react'
import { useEditorStore, QUALITY_MAP, Quality, MusicAsset } from '@/store/editorStore'
import { Download, Monitor, Music, Gauge, Zap, Volume2 } from 'lucide-react'
import ExportModal from './ExportModal'

const SPEED_OPTIONS = [1.0, 1.2, 1.3, 1.5]

const BUILT_IN_MUSIC: { category: 'Chill' | 'Cool'; name: string; path: string }[] = [
  // Chill
  { category: 'Chill', name: 'Aves - Coffee Stop',                           path: '/asset/music/Chill/Aves - Coffee Stop.mp3' },
  { category: 'Chill', name: 'Aves - Velvet',                                path: '/asset/music/Chill/Aves - Velvet.mp3' },
  { category: 'Chill', name: 'Eden Barel - Cutting Cookies',                 path: '/asset/music/Chill/Eden Barel - Cutting Cookies.mp3' },
  { category: 'Chill', name: 'Heron Vale - Mistletoe Glow',                  path: '/asset/music/Chill/Heron Vale - Mistletoe Glow.mp3' },
  { category: 'Chill', name: 'Jim Swim - Tornadoes (Instrumental)',          path: '/asset/music/Chill/Jim Swim - Tornadoes - Instrumental version.mp3' },
  { category: 'Chill', name: 'Jimit - Honey',                                path: '/asset/music/Chill/Jimit - Honey.mp3' },
  { category: 'Chill', name: 'Magiksolo - Shoujo',                           path: '/asset/music/Chill/Magiksolo - Shoujo.mp3' },
  { category: 'Chill', name: 'Skipp Whitman - Closing Doors (Instrumental)', path: '/asset/music/Chill/Skipp Whitman - Closing Doors - Instrumental version.mp3' },
  { category: 'Chill', name: 'Skygaze - Kissing the Moon',                   path: '/asset/music/Chill/Skygaze - Kissing the Moon.mp3' },
  { category: 'Chill', name: 'Ziv Moran - Dance (Short)',                    path: '/asset/music/Chill/Ziv Moran - Dance - Short version a.mp3' },
  // Cool
  { category: 'Cool', name: 'BalloonPlanet - Breaking Sweat (Short)',        path: '/asset/music/Cool/BalloonPlanet - Breaking Sweat - Short version.mp3' },
  { category: 'Cool', name: 'BalloonPlanet - Cool My Bass',                  path: '/asset/music/Cool/BalloonPlanet - Cool My Bass.mp3' },
  { category: 'Cool', name: 'Ben Fox - The Bounce (Instrumental)',            path: '/asset/music/Cool/Ben Fox - The Bounce - Instrumental version.mp3' },
  { category: 'Cool', name: 'Captain Joz - Ima B Da Baddest (Instrumental)', path: '/asset/music/Cool/Captain Joz - Ima B Da Baddest - Instrumental - Short version.mp3' },
  { category: 'Cool', name: 'Damon Power - All the Way',                     path: '/asset/music/Cool/Damon Power - All the Way.mp3' },
  { category: 'Cool', name: 'Jimit - Move It',                               path: '/asset/music/Cool/Jimit - Move It.mp3' },
  { category: 'Cool', name: 'MooveKa - Play It Cool',                        path: '/asset/music/Cool/MooveKa - Play It Cool.mp3' },
  { category: 'Cool', name: 'Out of Flux - BAM BAM',                         path: '/asset/music/Cool/Out of Flux - BAM BAM.mp3' },
  { category: 'Cool', name: 'Randy Sharp - Milo My',                         path: '/asset/music/Cool/Randy Sharp - Milo My.mp3' },
  { category: 'Cool', name: 'Roie Shpigler - Milky Way (Short)',              path: '/asset/music/Cool/Roie Shpigler - Milky Way - Alternative - Short version b.mp3' },
  { category: 'Cool', name: 'feinsmecker - Come Again',                       path: '/asset/music/Cool/feinsmecker - Come Again.mp3' },
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
  const [bgmTab, setBgmTab] = useState<'Chill' | 'Cool'>('Chill')
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
      <aside className="w-[256px] h-full bg-[#202022] rounded-2xl flex flex-col shrink-0 overflow-hidden">

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-5 scrollbar-none">

          {/* Canvas Size */}
          <Section title="Canvas Size" icon={<Monitor className="w-3.5 h-3.5" />}>
            <div className="rounded-xl bg-[#28282a] px-4 py-3 border border-[#2f2f31]">
              {sizeLabel ? (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/25">Size</span>
                  <span className="text-[12px] text-white/55 font-medium">{sizeLabel}</span>
                </div>
              ) : (
                <span className="text-[11px] text-white/20">배너를 업로드하면 설정됩니다</span>
              )}
            </div>
          </Section>

          {/* Export Quality */}
          <Section title="Quality" icon={<Zap className="w-3.5 h-3.5" />}>
            <div className="flex gap-1.5">
              {(Object.keys(QUALITY_MAP) as Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] transition-all border ${
                    quality === q
                      ? 'border-[#b780ff]/50 bg-[#b780ff]/10 text-[#b780ff]'
                      : 'border-[#2f2f31] text-white/25 hover:text-white/45 hover:border-[#333335]'
                  }`}
                >
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
          </Section>

          {/* Speed */}
          <Section title="Speed" icon={<Gauge className="w-3.5 h-3.5" />}>
            <div className={`grid grid-cols-4 gap-1.5 ${!activeVideo ? 'opacity-20 pointer-events-none' : ''}`}>
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => updateVideoClip({ speed: s })}
                  className={`py-1.5 rounded-lg text-[11px] transition-all border ${
                    activeVideo?.speed === s
                      ? 'border-[#b780ff]/50 bg-[#b780ff]/10 text-[#b780ff]'
                      : 'border-[#2f2f31] text-white/25 hover:text-white/45 hover:border-[#333335]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </Section>

          {/* BGM */}
          <Section title="BGM" icon={<Music className="w-3.5 h-3.5" />} sub={!activeSetId ? '세트 선택 후 등록 가능' : undefined}>
            <div className={`space-y-2 ${!activeSetId ? 'opacity-20 pointer-events-none' : ''}`}>
              {/* Chill / Cool 탭 */}
              <div className="flex gap-1.5">
                {(['Chill', 'Cool'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setBgmTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] transition-all border ${
                      bgmTab === tab
                        ? 'border-[#b780ff]/50 bg-[#b780ff]/10 text-[#b780ff]'
                        : 'border-[#2f2f31] text-white/25 hover:text-white/45 hover:border-[#333335]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* 곡 목록 */}
              <div className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-none">
                {/* BGM 없음 버튼 */}
                <button
                  onClick={() => setMusicTrack(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all border ${
                    !musicTrack
                      ? 'border-[#b780ff]/40 bg-[#b780ff]/10 text-[#b780ff]'
                      : 'border-transparent text-white/25 hover:text-white/45 hover:bg-[#28282a]'
                  }`}
                >
                  — BGM 없음 —
                </button>
                {musicAssets
                  .filter((a) => {
                    const meta = BUILT_IN_MUSIC.find((m) => m.path === a.id)
                    return meta?.category === bgmTab
                  })
                  .map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => selectMusic(asset)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all border truncate ${
                        musicTrack?.assetId === asset.id
                          ? 'border-[#b780ff]/40 bg-[#b780ff]/10 text-[#b780ff]'
                          : 'border-transparent text-white/40 hover:text-white/60 hover:bg-[#28282a]'
                      }`}
                    >
                      {asset.name}
                    </button>
                  ))}
              </div>

              {musicTrack && (
                <VolumeSlider
                  label="BGM"
                  value={musicTrack.volume}
                  onChange={(v) => updateMusicTrack({ volume: v })}
                />
              )}
            </div>
          </Section>

          {/* Video Volume */}
          <Section title="Video Volume" icon={<Volume2 className="w-3.5 h-3.5" />}>
            <div className={!activeSetId || !musicTrack ? 'opacity-20 pointer-events-none' : ''}>
              <VolumeSlider
                label="영상 음향"
                value={musicTrack?.videoVolume ?? 1}
                onChange={(v) => updateMusicTrack({ videoVolume: v })}
              />
            </div>
            {activeSetId && !musicTrack && (
              <p className="text-[10px] text-white/15 mt-2">BGM을 선택하면 조절할 수 있습니다</p>
            )}
          </Section>

        </div>

        {/* Export 버튼 */}
        <div className="px-4 pb-4 shrink-0">
          <button
            onClick={() => setShowExport(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#b780ff] hover:bg-[#c99aff] active:bg-[#a066ee] text-[#181819] text-[13px] font-semibold rounded-xl transition-colors h-11 shadow-lg shadow-black/30"
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

function Section({ title, icon, sub, children }: {
  title: string; icon: React.ReactNode; sub?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-white/20">{icon}</span>
        <span className="text-[10px] font-medium text-white/20 uppercase tracking-widest">{title}</span>
        {sub && <span className="text-[9px] text-white/15 ml-auto">{sub}</span>}
      </div>
      {children}
    </div>
  )
}

function VolumeSlider({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl bg-[#28282a] px-4 py-3 space-y-2 border border-[#2f2f31]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/30">{label}</span>
        <span className="text-[11px] font-mono text-white/40">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 cursor-pointer rounded-full"
        style={{ accentColor: '#b780ff' }}
      />
    </div>
  )
}
