import { create } from 'zustand'

export type Resolution = '1920x1080' | '1200x1200' | '1080x1920'

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
  duration: number // seconds
  width: number
  height: number
}

export interface VideoClip {
  assetId: string
  inPoint: number   // seconds
  outPoint: number  // seconds
  speed: number     // 0.5 | 1.0 | 1.5 | 2.0
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

export interface EditorState {
  resolution: Resolution
  projectDuration: number // seconds
  currentTime: number
  isPlaying: boolean

  bannerAssets: BannerAsset[]
  videoAssets: VideoAsset[]

  activeBanner: BannerClip | null
  activeVideo: VideoClip | null

  selectedLayer: 'banner' | 'video' | null

  setResolution: (r: Resolution) => void
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
}

export const useEditorStore = create<EditorState>((set, get) => ({
  resolution: '1920x1080',
  projectDuration: 10,
  currentTime: 0,
  isPlaying: false,

  bannerAssets: [],
  videoAssets: [],
  activeBanner: null,
  activeVideo: null,
  selectedLayer: null,

  setResolution: (r) => set({ resolution: r }),
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

    // Set project duration to video duration (adjusted by speed)
    const effectiveDuration = videoAsset.duration / activeVideo.speed
    const inPoint = activeVideo.inPoint
    const outPoint = Math.min(activeVideo.outPoint, videoAsset.duration)
    const clipDuration = (outPoint - inPoint) / activeVideo.speed

    set({
      projectDuration: clipDuration,
      activeBanner: {
        ...activeBanner,
        inPoint: 0,
        outPoint: clipDuration,
      },
    })

    // Auto-fit video to alpha bounds
    if (bannerAsset.alphaBounds) {
      const { x, y, width, height } = bannerAsset.alphaBounds
      const res = get().resolution
      const [canvasW, canvasH] = res.split('x').map(Number)

      // Normalize alpha bounds to canvas coords (banner fills canvas)
      const sx = canvasW / bannerAsset.width
      const sy = canvasH / bannerAsset.height
      const ax = x * sx
      const ay = y * sy
      const aw = width * sx
      const ah = height * sy

      const videoScaleX = aw / videoAsset.width
      const videoScaleY = ah / videoAsset.height
      const scale = Math.max(videoScaleX, videoScaleY)

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

    void effectiveDuration
  },
}))
