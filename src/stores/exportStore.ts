import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ExportFormat = 'mp4' | 'webm'
export type ExportResolution = '720p' | '1080p' | '4k' | 'custom'
export type ExportMode = 'auto' | 'in-memory' | 'stream' | 'segmented'
export type ExportTier = 'small' | 'medium' | 'large'
export type BrowserType = 'chromium-capable' | 'standard'

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

export interface CompletionDetails {
    type: ExportMode
    segmentCount?: number
    filename?: string
}

interface ExportStore {
  isExporting: boolean
  isModalOpen: boolean
  status: 'idle' | 'rendering' | 'previewing' | 'encoding' | 'completed' | 'error'
  progress: number // 0 to 1
  previewUrl: string | null
  eta: string | null
  error: string | null
  settings: ExportSettings
  
  // New State
  browserType: BrowserType
  exportMode: ExportMode
  exportModeOverride: ExportMode | null
  exportTier: ExportTier
  estimatedSizeMB: number
  completionDetails: CompletionDetails | null

  // Actions
  setModalOpen: (isOpen: boolean) => void
  setIsExporting: (isExporting: boolean) => void
  setStatus: (status: ExportStore['status']) => void
  setProgress: (progress: number) => void
  setPreviewUrl: (url: string | null) => void
  setEta: (eta: string | null) => void
  setError: (error: string | null) => void
  updateSettings: (settings: Partial<ExportSettings>) => void
  setExportModeOverride: (mode: ExportMode | null) => void
  setCompletionDetails: (details: CompletionDetails | null) => void
  reset: () => void
  
  // Computed helpers
  recalculateMode: () => void
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

const detectBrowser = (): BrowserType => {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    return 'chromium-capable'
  }
  return 'standard'
}

export const useExportStore = create<ExportStore>()(
  persist(
    (set, get) => ({
      isExporting: false,
      isModalOpen: false,
      status: 'idle',
      progress: 0,
      previewUrl: null,
      eta: null,
      error: null,
      settings: DEFAULT_SETTINGS,
      
      browserType: detectBrowser(),
      exportMode: 'in-memory', // Default, updated by recalculateMode
      exportModeOverride: null,
      exportTier: 'small',
      estimatedSizeMB: 0,
      completionDetails: null,

      setModalOpen: (isOpen) => {
        set({ isModalOpen: isOpen })
        // Recalculate on open to ensure fresh state
        if (isOpen) {
            get().recalculateMode()
        }
      },
      setIsExporting: (isExporting) => set({ isExporting }),
      setStatus: (status) => set({ status }),
      setProgress: (progress) => set({ progress }),
      setPreviewUrl: (url) => set((state) => {
        if (state.previewUrl && state.previewUrl !== url) {
          URL.revokeObjectURL(state.previewUrl)
        }
        return { previewUrl: url }
      }),
      setEta: (eta) => set({ eta }),
      setError: (error) => set({ error }),
      updateSettings: (newSettings) => {
        set((state) => ({ settings: { ...state.settings, ...newSettings } }))
        get().recalculateMode()
      },
      setExportModeOverride: (mode) => {
        set({ exportModeOverride: mode })
        get().recalculateMode()
      },
      setCompletionDetails: (details) => set({ completionDetails: details }),
      
      recalculateMode: () => {
        const state = get()
        const s = state.settings
        
        // Calculate Size: bitrate (Mbps) * duration (s) / 8 = MB
        const sizeMB = (s.bitrate * s.duration) / 8
        
        // Determine Tier
        let tier: ExportTier = 'small'
        if (sizeMB >= 150) tier = 'large'
        else if (sizeMB >= 50) tier = 'medium'
        
        // Determine Mode
        let mode: ExportMode = 'in-memory'
        
        if (state.exportModeOverride) {
            mode = state.exportModeOverride
        } else {
            // Auto selection logic
            if (sizeMB < 100) {
                mode = 'in-memory'
            } else {
                if (state.browserType === 'chromium-capable') {
                    mode = 'stream'
                } else {
                    mode = 'segmented'
                }
            }
        }
        
        set({
            estimatedSizeMB: sizeMB,
            exportTier: tier,
            exportMode: mode
        })
      },

      reset: () => set((state) => {
        if (state.previewUrl) {
          URL.revokeObjectURL(state.previewUrl)
        }
        return {
          isExporting: false,
          status: 'idle',
          progress: 0,
          previewUrl: null,
          eta: null,
          error: null,
          // We don't reset settings as they are persisted
          // We don't reset exportModeOverride as per PRD it resets on modal close? 
          // PRD says: "Override preference is NOT persisted (resets to automatic on modal close)"
          // So we should reset it here if reset() is called on close.
          exportModeOverride: null,
          completionDetails: null
        }
      }),
    }),
    {
      name: 'mdimension-export-settings',
      partialize: (state) => ({ settings: state.settings }), // Only persist settings
    }
  )
)
