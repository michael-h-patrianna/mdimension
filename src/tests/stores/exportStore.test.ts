/**
 * Tests for exportStore
 */

import { useExportStore } from '@/stores/exportStore'
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

  describe('Initial State', () => {
    it('should have isExporting as false by default', () => {
      expect(useExportStore.getState().isExporting).toBe(false)
    })

    it('should have isModalOpen as false by default', () => {
      expect(useExportStore.getState().isModalOpen).toBe(false)
    })

    it('should have status as idle by default', () => {
      expect(useExportStore.getState().status).toBe('idle')
    })

    it('should have progress as 0 by default', () => {
      expect(useExportStore.getState().progress).toBe(0)
    })

    it('should have previewUrl as null by default', () => {
      expect(useExportStore.getState().previewUrl).toBeNull()
    })

    it('should have error as null by default', () => {
      expect(useExportStore.getState().error).toBeNull()
    })

    it('should have default settings', () => {
      const settings = useExportStore.getState().settings
      expect(settings.format).toBe('mp4')
      expect(settings.resolution).toBe('1080p')
      expect(settings.fps).toBe(60)
      expect(settings.duration).toBe(5)
      expect(settings.bitrate).toBe(12)
      expect(settings.warmupFrames).toBe(5)
    })
  })

  describe('setModalOpen', () => {
    it('should open modal', () => {
      useExportStore.getState().setModalOpen(true)
      expect(useExportStore.getState().isModalOpen).toBe(true)
    })

    it('should close modal', () => {
      useExportStore.getState().setModalOpen(true)
      useExportStore.getState().setModalOpen(false)
      expect(useExportStore.getState().isModalOpen).toBe(false)
    })
  })

  describe('setIsExporting', () => {
    it('should set exporting to true', () => {
      useExportStore.getState().setIsExporting(true)
      expect(useExportStore.getState().isExporting).toBe(true)
    })

    it('should set exporting to false', () => {
      useExportStore.getState().setIsExporting(true)
      useExportStore.getState().setIsExporting(false)
      expect(useExportStore.getState().isExporting).toBe(false)
    })
  })

  describe('setStatus', () => {
    it('should transition to rendering', () => {
      useExportStore.getState().setStatus('rendering')
      expect(useExportStore.getState().status).toBe('rendering')
    })

    it('should transition to encoding', () => {
      useExportStore.getState().setStatus('encoding')
      expect(useExportStore.getState().status).toBe('encoding')
    })

    it('should transition to completed', () => {
      useExportStore.getState().setStatus('completed')
      expect(useExportStore.getState().status).toBe('completed')
    })

    it('should transition to error', () => {
      useExportStore.getState().setStatus('error')
      expect(useExportStore.getState().status).toBe('error')
    })
  })

  describe('setProgress', () => {
    it('should set progress value', () => {
      useExportStore.getState().setProgress(0.5)
      expect(useExportStore.getState().progress).toBe(0.5)
    })

    it('should handle 0 progress', () => {
      useExportStore.getState().setProgress(0)
      expect(useExportStore.getState().progress).toBe(0)
    })

    it('should handle 1 progress', () => {
      useExportStore.getState().setProgress(1)
      expect(useExportStore.getState().progress).toBe(1)
    })
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
  })

  describe('reset', () => {
    it('should reset exporting state', () => {
      useExportStore.getState().setIsExporting(true)
      useExportStore.getState().reset()
      expect(useExportStore.getState().isExporting).toBe(false)
    })

    it('should reset status to idle', () => {
      useExportStore.getState().setStatus('completed')
      useExportStore.getState().reset()
      expect(useExportStore.getState().status).toBe('idle')
    })

    it('should reset progress to 0', () => {
      useExportStore.getState().setProgress(0.75)
      useExportStore.getState().reset()
      expect(useExportStore.getState().progress).toBe(0)
    })

    it('should reset previewUrl to null', () => {
      useExportStore.getState().setPreviewUrl('blob:test')
      useExportStore.getState().reset()
      expect(useExportStore.getState().previewUrl).toBeNull()
    })

    it('should reset error to null', () => {
      useExportStore.getState().setError('Test error')
      useExportStore.getState().reset()
      expect(useExportStore.getState().error).toBeNull()
    })

    it('should revoke previewUrl on reset', () => {
      useExportStore.getState().setPreviewUrl('blob:to-revoke')
      mockRevokeObjectURL.mockClear()
      useExportStore.getState().reset()

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:to-revoke')
    })

    it('should not revoke if previewUrl is null', () => {
      mockRevokeObjectURL.mockClear()
      useExportStore.getState().reset()
      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
    })

    it('should preserve settings on reset', () => {
      useExportStore.getState().updateSettings({ fps: 30, duration: 10 })
      useExportStore.getState().reset()

      // Settings should not change
      expect(useExportStore.getState().settings.fps).toBe(30)
      expect(useExportStore.getState().settings.duration).toBe(10)
    })
  })

  describe('State Transitions', () => {
    it('should support idle -> rendering -> encoding -> completed flow', () => {
      expect(useExportStore.getState().status).toBe('idle')

      useExportStore.getState().setIsExporting(true)
      useExportStore.getState().setStatus('rendering')
      expect(useExportStore.getState().status).toBe('rendering')

      useExportStore.getState().setProgress(0.5)
      useExportStore.getState().setStatus('encoding')
      expect(useExportStore.getState().status).toBe('encoding')

      useExportStore.getState().setPreviewUrl('blob:final')
      useExportStore.getState().setStatus('completed')
      expect(useExportStore.getState().status).toBe('completed')
    })

    it('should support idle -> rendering -> error flow', () => {
      expect(useExportStore.getState().status).toBe('idle')

      useExportStore.getState().setIsExporting(true)
      useExportStore.getState().setStatus('rendering')

      useExportStore.getState().setError('Something went wrong')
      useExportStore.getState().setStatus('error')

      expect(useExportStore.getState().status).toBe('error')
      expect(useExportStore.getState().error).toBe('Something went wrong')
    })
  })

  describe('Estimated Size Calculation', () => {
    // Settings are persisted, so we must set explicit known values before each test
    beforeEach(() => {
      // First set resolution and fps WITHOUT bitrate to trigger auto-calculation
      useExportStore.getState().updateSettings({
        resolution: '1080p',
        fps: 60,
        duration: 5,
      })
      // Now explicitly set bitrate to 12 for tests that expect that baseline
      // This ensures a known starting point (even if not the "recommended" value)
      useExportStore.getState().updateSettings({ bitrate: 12 })
    })

    it('should calculate size based on bitrate and duration', () => {
      // 12 Mbps * 5s / 8 = 7.5 MB
      useExportStore.getState().setModalOpen(true) // Trigger recalculateMode
      expect(useExportStore.getState().estimatedSizeMB).toBeCloseTo(7.5)
    })

    it('should update estimated size when bitrate changes', () => {
      useExportStore.getState().setModalOpen(true)

      // Change bitrate from 12 to 24 Mbps
      useExportStore.getState().updateSettings({ bitrate: 24 })

      // 24 Mbps * 5s / 8 = 15 MB
      expect(useExportStore.getState().estimatedSizeMB).toBeCloseTo(15)
    })

    it('should update estimated size when duration changes', () => {
      useExportStore.getState().setModalOpen(true)

      // Change duration from 5 to 10 seconds
      useExportStore.getState().updateSettings({ duration: 10 })

      // 12 Mbps * 10s / 8 = 15 MB
      expect(useExportStore.getState().estimatedSizeMB).toBeCloseTo(15)
    })

    it('should update estimated size when both bitrate and duration change', () => {
      useExportStore.getState().setModalOpen(true)

      useExportStore.getState().updateSettings({ bitrate: 25, duration: 60 })

      // 25 Mbps * 60s / 8 = 187.5 MB
      expect(useExportStore.getState().estimatedSizeMB).toBeCloseTo(187.5)
    })

    it('should auto-adjust bitrate and size when resolution changes', () => {
      useExportStore.getState().setModalOpen(true)
      const sizeAt1080p = useExportStore.getState().estimatedSizeMB
      const bitrateAt1080p = useExportStore.getState().settings.bitrate

      useExportStore.getState().updateSettings({ resolution: '4k' })
      const sizeAt4k = useExportStore.getState().estimatedSizeMB
      const bitrateAt4k = useExportStore.getState().settings.bitrate

      // 4K should have higher bitrate and larger file size
      expect(bitrateAt4k).toBeGreaterThan(bitrateAt1080p)
      expect(sizeAt4k).toBeGreaterThan(sizeAt1080p)
    })

    it('should auto-adjust bitrate and size when fps changes', () => {
      // First set to 30fps to ensure we have a known starting point
      useExportStore.getState().updateSettings({
        resolution: '1080p',
        fps: 30,
        duration: 5,
      })
      useExportStore.getState().setModalOpen(true)

      const sizeAt30fps = useExportStore.getState().estimatedSizeMB
      const bitrateAt30fps = useExportStore.getState().settings.bitrate

      // Expected: 1080p at 30fps = 12 * (30/30) = 12 Mbps
      expect(bitrateAt30fps).toBe(12)

      // Now change to 60fps - should auto-adjust
      useExportStore.getState().updateSettings({ fps: 60 })
      const sizeAt60fps = useExportStore.getState().estimatedSizeMB
      const bitrateAt60fps = useExportStore.getState().settings.bitrate

      // Expected: 1080p at 60fps = 12 * (60/30) = 24 Mbps
      expect(bitrateAt60fps).toBe(24)

      // 60fps should have higher bitrate and larger file size
      expect(bitrateAt60fps).toBeGreaterThan(bitrateAt30fps)
      expect(sizeAt60fps).toBeGreaterThan(sizeAt30fps)
    })

    it('should NOT auto-adjust bitrate when bitrate is explicitly set', () => {
      useExportStore.getState().setModalOpen(true)

      // Explicitly set bitrate to 50 Mbps
      useExportStore.getState().updateSettings({ bitrate: 50 })
      expect(useExportStore.getState().settings.bitrate).toBe(50)

      // Now change resolution - bitrate should still be 50 since we just set it
      // (This tests the case where both are changed in same call)
      useExportStore.getState().updateSettings({ resolution: '720p', bitrate: 50 })
      expect(useExportStore.getState().settings.bitrate).toBe(50)
    })
  })
})
