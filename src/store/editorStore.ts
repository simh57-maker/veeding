import { create } from 'zustand'

export type Resolution = '1920x1080' | '1200x1200' | '1080x1920'
export type Quality = 'high' | 'medium' | 'low' | 'preview'

export const QUALITY_MAP: Record<Quality, { crf: number; preset: string; label: string }> = {
  high:    { crf: 18, preset: 'slow',   label: 'High (CRF 18)' },
  medium:  { crf: 23, preset: 'fast',   label: 'Medium (CRF 23)' },
  low:     { crf: 28, preset: 'faster', label: 'Low (CRF 28)' },
  preview: { crf: 35, preset: 'ultrafast', label: 'Preview (CRF 35)' },
}

export interface AlphaBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface BannerAsset {
  id: string
  name: string
  url: string
  dataUrl: string
  alphaBounds: AlphaBounds | null
  width: number
  height: number
}

export interface VideoAsset {
  id: string
  name: string
  url: string
  duration: number
  width: number
  height: number
}

export interface VideoClip {
  assetId: string
  inPoint: number
  outPoint: number
  speed: number
  x: number
  y: number
  scaleX: number
  scaleY: number
}

export interface BannerClip {
  assetId: string
  inPoint: number
  outPoint: number
  x: number
  y: number
  scaleX: number
  scaleY: number
}

// 하나의 배너 + 영상 세트
export interface CompositionSet {
  id: string
  name: string
  banner: BannerClip
  video: VideoClip
  projectDuration: number
}

export interface EditorState {
  resolution: Resolution
  quality: Quality
  projectDuration: number
  currentTime: number
  isPlaying: boolean

  bannerAssets: BannerAsset[]
  videoAssets: VideoAsset[]

  activeBanner: BannerClip | null
  activeVideo: VideoClip | null
  selectedLayer: 'banner' | 'video' | null

  // 등록된 세트 목록
  sets: CompositionSet[]
  activeSetId: string | null

  setResolution: (r: Resolution) => void
  setQuality: (q: Quality) => void
  setCurrentTime: (t: number) => void
  setIsPlaying: (v: boolean) => void
  setProjectDuration: (d: number) => void

  addBannerAsset: (asset: BannerAsset) => void
  addVideoAsset: (asset: VideoAsset) => void

  setActiveBanner: (clip: BannerClip | null) => void
  setActiveVideo: (clip: VideoClip | null) => void
  setSelectedLayer: (l: 'banner' | 'video' | null) => void

  updateVideoClip: (partial: Partial<VideoClip>) => void
  updateBannerClip: (partial: Partial<BannerClip>) => void

  autoCompose: () => void

  // 세트 관련
  saveSet: () => void
  loadSet: (id: string) => void
  removeSet: (id: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  resolution: '1920x1080',
  quality: 'medium',
  projectDuration: 10,
  currentTime: 0,
  isPlaying: false,

  bannerAssets: [],
  videoAssets: [],
  activeBanner: null,
  activeVideo: null,
  selectedLayer: null,

  sets: [],
  activeSetId: null,

  setResolution: (r) => set({ resolution: r }),
  setQuality: (q) => set({ quality: q }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setProjectDuration: (d) => set({ projectDuration: d }),

  addBannerAsset: (asset) =>
    set((s) => ({ bannerAssets: [...s.bannerAssets, asset] })),

  addVideoAsset: (asset) =>
    set((s) => ({ videoAssets: [...s.videoAssets, asset] })),

  setActiveBanner: (clip) => set({ activeBanner: clip }),
  setActiveVideo: (clip) => set({ activeVideo: clip }),
  setSelectedLayer: (l) => set({ selectedLayer: l }),

  updateVideoClip: (partial) =>
    set((s) => s.activeVideo ? { activeVideo: { ...s.activeVideo, ...partial } } : {}),

  updateBannerClip: (partial) =>
    set((s) => s.activeBanner ? { activeBanner: { ...s.activeBanner, ...partial } } : {}),

  autoCompose: () => {
    const { activeBanner, activeVideo, videoAssets, bannerAssets } = get()
    if (!activeBanner || !activeVideo) return

    const bannerAsset = bannerAssets.find((b) => b.id === activeBanner.assetId)
    const videoAsset = videoAssets.find((v) => v.id === activeVideo.assetId)
    if (!videoAsset || !bannerAsset) return

    const inPoint = activeVideo.inPoint
    const outPoint = Math.min(activeVideo.outPoint, videoAsset.duration)
    const clipDuration = (outPoint - inPoint) / activeVideo.speed

    set({
      projectDuration: clipDuration,
      activeBanner: { ...activeBanner, inPoint: 0, outPoint: clipDuration },
    })

    if (bannerAsset.alphaBounds) {
      const { x, y, width, height } = bannerAsset.alphaBounds
      const res = get().resolution
      const [canvasW, canvasH] = res.split('x').map(Number)

      const sx = canvasW / bannerAsset.width
      const sy = canvasH / bannerAsset.height
      const ax = x * sx
      const ay = y * sy
      const aw = width * sx
      const ah = height * sy

      const scale = Math.max(aw / videoAsset.width, ah / videoAsset.height)

      set({
        activeVideo: {
          ...get().activeVideo!,
          x: ax + aw / 2,
          y: ay + ah / 2,
          scaleX: scale,
          scaleY: scale,
        },
      })
    }
  },

  saveSet: () => {
    const { activeBanner, activeVideo, projectDuration, sets, bannerAssets, videoAssets } = get()
    if (!activeBanner || !activeVideo) return

    const bannerAsset = bannerAssets.find((b) => b.id === activeBanner.assetId)
    const videoAsset = videoAssets.find((v) => v.id === activeVideo.assetId)

    const name = `${bannerAsset?.name.replace(/\.[^.]+$/, '') ?? 'Banner'} + ${videoAsset?.name.replace(/\.[^.]+$/, '') ?? 'Video'}`

    const newSet: CompositionSet = {
      id: crypto.randomUUID(),
      name,
      banner: { ...activeBanner },
      video: { ...activeVideo },
      projectDuration,
    }

    set({ sets: [...sets, newSet], activeSetId: newSet.id })
  },

  loadSet: (id) => {
    const { sets } = get()
    const found = sets.find((s) => s.id === id)
    if (!found) return
    set({
      activeBanner: { ...found.banner },
      activeVideo: { ...found.video },
      projectDuration: found.projectDuration,
      currentTime: 0,
      activeSetId: id,
    })
  },

  removeSet: (id) => {
    set((s) => ({
      sets: s.sets.filter((x) => x.id !== id),
      activeSetId: s.activeSetId === id ? null : s.activeSetId,
    }))
  },
}))
