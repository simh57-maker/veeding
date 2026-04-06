import { create } from 'zustand'

export type Quality = 'basic' | 'preview'

export const QUALITY_MAP: Record<Quality, { crf: number; preset: string; label: string }> = {
  basic:   { crf: 25, preset: 'fast',      label: 'Basic (CRF 25)' },
  preview: { crf: 40, preset: 'ultrafast', label: 'Preview (CRF 40)' },
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

interface HistoryEntry {
  activeVideo: VideoClip | null
  activeBanner: BannerClip | null
}

export interface EditorState {
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

  // undo/redo
  _history: HistoryEntry[]
  _historyIndex: number

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

  // undo/redo에 스냅샷 저장 (드래그 끝날 때 호출)
  pushHistory: () => void
  undo: () => void
  redo: () => void

  autoCompose: (overrideBanner?: BannerClip, overrideVideo?: VideoClip) => void

  // 세트 관련
  saveSet: () => void
  loadSet: (id: string) => void
  removeSet: (id: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  quality: 'basic',
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

  _history: [],
  _historyIndex: -1,

  setQuality: (q) => set({ quality: q }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setProjectDuration: (d) => set({ projectDuration: d }),

  addBannerAsset: (asset) =>
    set((s) => ({ bannerAssets: [...s.bannerAssets, asset] })),

  addVideoAsset: (asset) =>
    set((s) => ({ videoAssets: [...s.videoAssets, asset] })),

  setActiveBanner: (clip) => {
    if (!clip) { set({ activeBanner: null }); return }
    const { bannerAssets } = get()
    const asset = bannerAssets.find((b) => b.id === clip.assetId)
    const centered: BannerClip = asset
      ? { ...clip, x: asset.width / 2, y: asset.height / 2, scaleX: 1, scaleY: 1 }
      : clip
    set({ activeBanner: centered })
  },
  setActiveVideo: (clip) => set({ activeVideo: clip }),
  setSelectedLayer: (l) => set({ selectedLayer: l }),

  updateVideoClip: (partial) =>
    set((s) => s.activeVideo ? { activeVideo: { ...s.activeVideo, ...partial } } : {}),

  updateBannerClip: (partial) =>
    set((s) => s.activeBanner ? { activeBanner: { ...s.activeBanner, ...partial } } : {}),

  pushHistory: () => {
    const { activeVideo, activeBanner, _history, _historyIndex } = get()
    const entry: HistoryEntry = {
      activeVideo: activeVideo ? { ...activeVideo } : null,
      activeBanner: activeBanner ? { ...activeBanner } : null,
    }
    // 현재 인덱스 이후의 히스토리는 버림
    const newHistory = [..._history.slice(0, _historyIndex + 1), entry]
    // 최대 50개 유지
    const trimmed = newHistory.length > 50 ? newHistory.slice(newHistory.length - 50) : newHistory
    set({ _history: trimmed, _historyIndex: trimmed.length - 1 })
  },

  undo: () => {
    const { _history, _historyIndex } = get()
    if (_historyIndex <= 0) return
    const prev = _history[_historyIndex - 1]
    set({
      activeVideo: prev.activeVideo ? { ...prev.activeVideo } : null,
      activeBanner: prev.activeBanner ? { ...prev.activeBanner } : null,
      _historyIndex: _historyIndex - 1,
    })
  },

  redo: () => {
    const { _history, _historyIndex } = get()
    if (_historyIndex >= _history.length - 1) return
    const next = _history[_historyIndex + 1]
    set({
      activeVideo: next.activeVideo ? { ...next.activeVideo } : null,
      activeBanner: next.activeBanner ? { ...next.activeBanner } : null,
      _historyIndex: _historyIndex + 1,
    })
  },

  autoCompose: (overrideBanner?: BannerClip, overrideVideo?: VideoClip) => {
    const { videoAssets, bannerAssets } = get()
    const activeBanner = overrideBanner ?? get().activeBanner
    const activeVideo  = overrideVideo  ?? get().activeVideo
    if (!activeBanner || !activeVideo) return

    const bannerAsset = bannerAssets.find((b) => b.id === activeBanner.assetId)
    const videoAsset  = videoAssets.find((v)  => v.id  === activeVideo.assetId)
    if (!videoAsset || !bannerAsset) return

    const inPoint = activeVideo.inPoint
    const outPoint = Math.min(activeVideo.outPoint, videoAsset.duration)
    const clipDuration = (outPoint - inPoint) / activeVideo.speed

    let newVideo: VideoClip = { ...activeVideo }

    if (bannerAsset.alphaBounds) {
      const { x, y, width, height } = bannerAsset.alphaBounds
      const scale = (height / videoAsset.height) * 1.01
      newVideo = {
        ...newVideo,
        x: x + width / 2,
        y: y + height / 2,
        scaleX: scale,
        scaleY: scale,
      }
    }

    set({
      projectDuration: clipDuration,
      activeBanner: { ...activeBanner, inPoint: 0, outPoint: clipDuration },
      activeVideo: newVideo,
    })
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
