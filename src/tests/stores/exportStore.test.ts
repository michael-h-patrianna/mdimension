/**
 * Tests for exportStore
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExportStore } from '@/stores/exportStore'

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
})
