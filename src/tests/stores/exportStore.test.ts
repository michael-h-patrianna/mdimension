/**
 * Tests for exportStore
 */

import { getRecommendedBitrate, useExportStore } from '@/stores/exportStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
const mockRevokeObjectURL = vi.fn()

vi.stubGlobal('URL', {
  ...URL,
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

describe('exportStore', () => {
  beforeEach(() => {
    // Reset store first (this may call revokeObjectURL)
    useExportStore.getState().reset()
    // Then clear mocks so tests start fresh
    vi.clearAllMocks()
  })

  describe('setPreviewUrl', () => {
    it('should set preview URL', () => {
      useExportStore.getState().setPreviewUrl('blob:test-url')
      expect(useExportStore.getState().previewUrl).toBe('blob:test-url')
    })

    it('should revoke previous URL when setting new one', () => {
      useExportStore.getState().setPreviewUrl('blob:first-url')
      useExportStore.getState().setPreviewUrl('blob:second-url')

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:first-url')
    })

    it('should not revoke if setting same URL', () => {
      useExportStore.getState().setPreviewUrl('blob:same-url')
      mockRevokeObjectURL.mockClear()
      useExportStore.getState().setPreviewUrl('blob:same-url')

      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
    })

    it('should not revoke if previous URL was null', () => {
      useExportStore.getState().setPreviewUrl('blob:new-url')
      // First call shouldn't revoke anything
      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      useExportStore.getState().setError('Test error')
      expect(useExportStore.getState().error).toBe('Test error')
    })

    it('should clear error when set to null', () => {
      useExportStore.getState().setError('Test error')
      useExportStore.getState().setError(null)
      expect(useExportStore.getState().error).toBeNull()
    })
  })

  describe('updateSettings', () => {
    it('should update single setting', () => {
      useExportStore.getState().updateSettings({ fps: 30 })
      expect(useExportStore.getState().settings.fps).toBe(30)
    })

    it('should update multiple settings', () => {
      useExportStore.getState().updateSettings({
        fps: 24,
        resolution: '4k',
        bitrate: 50,
      })

      const settings = useExportStore.getState().settings
      expect(settings.fps).toBe(24)
      expect(settings.resolution).toBe('4k')
      expect(settings.bitrate).toBe(50)
    })

    it('should preserve other settings', () => {
      const originalDuration = useExportStore.getState().settings.duration
      useExportStore.getState().updateSettings({ fps: 30 })
      expect(useExportStore.getState().settings.duration).toBe(originalDuration)
    })

    it('should update custom dimensions', () => {
      useExportStore.getState().updateSettings({
        resolution: 'custom',
        customWidth: 2560,
        customHeight: 1440,
      })

      const settings = useExportStore.getState().settings
      expect(settings.resolution).toBe('custom')
      expect(settings.customWidth).toBe(2560)
      expect(settings.customHeight).toBe(1440)
    })

    it('auto-adjusts bitrate when resolution or fps changes (unless bitrate is explicitly set)', () => {
      // Establish a known base
      useExportStore.getState().updateSettings({ resolution: '1080p', fps: 30 })
      const bitrate30 = useExportStore.getState().settings.bitrate
      expect(bitrate30).toBe(getRecommendedBitrate('1080p', 30))

      // Changing fps should change bitrate (auto)
      useExportStore.getState().updateSettings({ fps: 60 })
      expect(useExportStore.getState().settings.bitrate).toBe(getRecommendedBitrate('1080p', 60))

      // Explicit bitrate disables auto adjustment for that update
      useExportStore.getState().updateSettings({ resolution: '4k', bitrate: 50 })
      expect(useExportStore.getState().settings.bitrate).toBe(50)
    })
  })

  describe('reset', () => {
    it('should revoke previewUrl on reset', () => {
      useExportStore.getState().setPreviewUrl('blob:to-revoke')
      mockRevokeObjectURL.mockClear()
      useExportStore.getState().reset()

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:to-revoke')
    })

    it('should preserve settings on reset', () => {
      useExportStore.getState().updateSettings({ fps: 30, duration: 10 })
      useExportStore.getState().reset()

      // Settings should not change
      expect(useExportStore.getState().settings.fps).toBe(30)
      expect(useExportStore.getState().settings.duration).toBe(10)
    })
  })

  describe('Mode/tier selection (recalculateMode)', () => {
    it('computes estimatedSizeMB and selects tier/mode based on size and browser type', () => {
      // Force a known browser type for deterministic mode selection
      useExportStore.setState({ browserType: 'standard' })

      // sizeMB = (bitrate * duration)/8. Choose bitrate/duration that produces medium/large tiers.
      useExportStore.getState().updateSettings({ bitrate: 80, duration: 10 }) // 100MB
      useExportStore.getState().setModalOpen(true) // triggers recalculateMode
      expect(useExportStore.getState().estimatedSizeMB).toBeCloseTo(100)
      // Standard browser => segmented for >=100MB
      expect(useExportStore.getState().exportMode).toBe('segmented')
      // 100MB => medium tier
      expect(useExportStore.getState().exportTier).toBe('medium')

      useExportStore.setState({ browserType: 'chromium-capable' })
      useExportStore.getState().recalculateMode()
      expect(useExportStore.getState().exportMode).toBe('stream')

      // Large tier
      useExportStore.getState().updateSettings({ bitrate: 120, duration: 12.5 }) // 187.5MB
      expect(useExportStore.getState().exportTier).toBe('large')
    })

    it('exportModeOverride wins over auto selection', () => {
      useExportStore.setState({ browserType: 'chromium-capable' })
      useExportStore.getState().updateSettings({ bitrate: 120, duration: 12.5 }) // would choose stream
      expect(useExportStore.getState().exportMode).toBe('stream')

      useExportStore.getState().setExportModeOverride('segmented')
      expect(useExportStore.getState().exportMode).toBe('segmented')
    })
  })

  describe('getRecommendedBitrate', () => {
    it('scales bitrate by resolution and fps and clamps to [4, 100]', () => {
      expect(getRecommendedBitrate('720p', 30)).toBe(8)
      expect(getRecommendedBitrate('1080p', 60)).toBe(24) // 12 * 2
      expect(getRecommendedBitrate('4k', 60)).toBe(70) // 35 * 2
      expect(getRecommendedBitrate('1080p', 1)).toBe(4) // clamps low
      expect(getRecommendedBitrate('4k', 999)).toBe(100) // clamps high
    })

    it('scales custom resolution bitrate by pixel ratio vs 1080p', () => {
      // 2560x1440 is ~1.777... of 1080p pixels => base 12*ratio ~ 21.33 => round 21 at 30fps
      expect(getRecommendedBitrate('custom', 30, 2560, 1440)).toBe(21)
    })
  })
})
