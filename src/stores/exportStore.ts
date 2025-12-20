import { create } from 'zustand'

export type ExportFormat = 'mp4' | 'webm'
export type ExportResolution = '720p' | '1080p' | '4k' | 'custom'

export interface ExportSettings {
  format: ExportFormat
  resolution: ExportResolution
  customWidth: number
  customHeight: number
  fps: number
  duration: number // in seconds
  bitrate: number // in Mbps
  warmupFrames: number
}

interface ExportStore {
  isExporting: boolean
  isModalOpen: boolean
  status: 'idle' | 'rendering' | 'encoding' | 'completed' | 'error'
  progress: number // 0 to 1
  previewUrl: string | null
  error: string | null
  settings: ExportSettings
  
  // Actions
  setModalOpen: (isOpen: boolean) => void
  setIsExporting: (isExporting: boolean) => void
  setStatus: (status: ExportStore['status']) => void
  setProgress: (progress: number) => void
  setPreviewUrl: (url: string | null) => void
  setError: (error: string | null) => void
  updateSettings: (settings: Partial<ExportSettings>) => void
  reset: () => void
}

const DEFAULT_SETTINGS: ExportSettings = {
  format: 'mp4',
  resolution: '1080p',
  customWidth: 1920,
  customHeight: 1080,
  fps: 60,
  duration: 5,
  bitrate: 12,
  warmupFrames: 5,
}

export const useExportStore = create<ExportStore>((set) => ({
  isExporting: false,
  isModalOpen: false,
  status: 'idle',
  progress: 0,
  previewUrl: null,
  error: null,
  settings: DEFAULT_SETTINGS,

  setModalOpen: (isOpen) => set({ isModalOpen: isOpen }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setPreviewUrl: (url) => set((state) => {
    if (state.previewUrl && state.previewUrl !== url) {
      URL.revokeObjectURL(state.previewUrl)
    }
    return { previewUrl: url }
  }),
  setError: (error) => set({ error }),
  updateSettings: (newSettings) => 
    set((state) => ({ settings: { ...state.settings, ...newSettings } })),
  reset: () => set((state) => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl)
    }
    return {
      isExporting: false,
      status: 'idle',
      progress: 0,
      previewUrl: null,
      error: null,
    }
  }),
}))
