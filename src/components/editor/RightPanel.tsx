'use client'

import { useEditorStore } from '@/store/editorStore'
import { Settings2, Layers, Film, ImageIcon } from 'lucide-react'

const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0]

export default function RightPanel() {
  const {
    selectedLayer,
    activeBanner,
    activeVideo,
    bannerAssets,
    videoAssets,
    updateVideoClip,
    updateBannerClip,
    projectDuration,
    setProjectDuration,
  } = useEditorStore()

  const videoAsset = activeVideo ? videoAssets.find((v) => v.id === activeVideo.assetId) : null
  const bannerAsset = activeBanner ? bannerAssets.find((b) => b.id === activeBanner.assetId) : null

  return (
    <aside className="w-60 bg-[#2C2C2C] border-l border-[#333] flex flex-col shrink-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-[#333] flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-[#888]" />
        <span className="text-xs font-semibold text-[#E0E0E0] uppercase tracking-wider">Properties</span>
      </div>

      <div className="p-4 space-y-5">
        {/* Project Duration */}
        <Section title="Project" icon={<Layers className="w-3.5 h-3.5" />}>
          <PropRow label="Duration">
            <NumInput
              value={parseFloat(projectDuration.toFixed(2))}
              onChange={(v) => setProjectDuration(v)}
              min={0.1}
              max={3600}
              step={0.1}
              unit="s"
            />
          </PropRow>
        </Section>

        {/* Video Properties */}
        {activeVideo && videoAsset && (
          <Section title="Video Layer" icon={<Film className="w-3.5 h-3.5" />}>
            <PropRow label="X">
              <NumInput
                value={Math.round(activeVideo.x)}
                onChange={(v) => updateVideoClip({ x: v })}
                unit="px"
              />
            </PropRow>
            <PropRow label="Y">
              <NumInput
                value={Math.round(activeVideo.y)}
                onChange={(v) => updateVideoClip({ y: v })}
                unit="px"
              />
            </PropRow>
            <PropRow label="Scale X">
              <NumInput
                value={parseFloat(activeVideo.scaleX.toFixed(3))}
                onChange={(v) => updateVideoClip({ scaleX: v })}
                min={0.01}
                step={0.01}
              />
            </PropRow>
            <PropRow label="Scale Y">
              <NumInput
                value={parseFloat(activeVideo.scaleY.toFixed(3))}
                onChange={(v) => updateVideoClip({ scaleY: v })}
                min={0.01}
                step={0.01}
              />
            </PropRow>
            <PropRow label="Speed">
              <div className="flex gap-1 flex-wrap">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateVideoClip({ speed: s })}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                      activeVideo.speed === s
                        ? 'bg-[#0D99FF] border-[#0D99FF] text-white'
                        : 'border-[#444] text-[#888] hover:border-[#666] hover:text-[#E0E0E0]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </PropRow>
            <PropRow label="In Point">
              <NumInput
                value={parseFloat(activeVideo.inPoint.toFixed(2))}
                onChange={(v) => updateVideoClip({ inPoint: v })}
                min={0}
                max={activeVideo.outPoint - 0.1}
                step={0.01}
                unit="s"
              />
            </PropRow>
            <PropRow label="Out Point">
              <NumInput
                value={parseFloat(activeVideo.outPoint.toFixed(2))}
                onChange={(v) => updateVideoClip({ outPoint: v })}
                min={activeVideo.inPoint + 0.1}
                max={videoAsset.duration}
                step={0.01}
                unit="s"
              />
            </PropRow>
            <div className="text-[10px] text-[#555] mt-1">
              Source: {videoAsset.width}×{videoAsset.height} · {videoAsset.duration.toFixed(1)}s
            </div>
          </Section>
        )}

        {/* Banner Properties */}
        {activeBanner && bannerAsset && (
          <Section title="Banner Layer" icon={<ImageIcon className="w-3.5 h-3.5" />}>
            <PropRow label="X">
              <NumInput
                value={Math.round(activeBanner.x)}
                onChange={(v) => updateBannerClip({ x: v })}
                unit="px"
              />
            </PropRow>
            <PropRow label="Y">
              <NumInput
                value={Math.round(activeBanner.y)}
                onChange={(v) => updateBannerClip({ y: v })}
                unit="px"
              />
            </PropRow>
            <PropRow label="Scale X">
              <NumInput
                value={parseFloat(activeBanner.scaleX.toFixed(3))}
                onChange={(v) => updateBannerClip({ scaleX: v })}
                min={0.01}
                step={0.01}
              />
            </PropRow>
            <PropRow label="Scale Y">
              <NumInput
                value={parseFloat(activeBanner.scaleY.toFixed(3))}
                onChange={(v) => updateBannerClip({ scaleY: v })}
                min={0.01}
                step={0.01}
              />
            </PropRow>
            {bannerAsset.alphaBounds && (
              <div className="mt-2 p-2 bg-[#1E1E1E] rounded-lg text-[10px] text-[#0D99FF] space-y-0.5">
                <div className="font-medium mb-1">Alpha Region</div>
                <div>X: {bannerAsset.alphaBounds.x}px</div>
                <div>Y: {bannerAsset.alphaBounds.y}px</div>
                <div>W: {bannerAsset.alphaBounds.width}px</div>
                <div>H: {bannerAsset.alphaBounds.height}px</div>
              </div>
            )}
          </Section>
        )}

        {!activeVideo && !activeBanner && (
          <div className="text-[#555] text-xs text-center py-8">
            Select a layer to edit properties
          </div>
        )}
      </div>
    </aside>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[#888]">{icon}</span>
        <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#666] w-16 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function NumInput({
  value, onChange, min, max, step = 1, unit,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}) {
  return (
    <div className="flex items-center bg-[#1E1E1E] border border-[#3a3a3a] rounded-md overflow-hidden">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="flex-1 bg-transparent text-[#E0E0E0] text-xs px-2 py-1 outline-none w-0"
      />
      {unit && <span className="text-[10px] text-[#555] pr-2">{unit}</span>}
    </div>
  )
}
