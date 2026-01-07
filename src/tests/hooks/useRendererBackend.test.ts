/**
 * Tests for useRendererBackend hook
 *
 * Tests the WebGPU/WebGL detection and backend determination logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkWebGPUAvailable,
  isWebGLForced,
  isWebGPUForced,
  determineBackend,
  getRendererBackendInfo,
} from '@/hooks/useRendererBackend'

describe('useRendererBackend', () => {
  const originalNavigator = global.navigator
  const originalLocation = global.location

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks()
  })

  afterEach(() => {
    // Restore original values
    Object.defineProperty(global, 'navigator', { value: originalNavigator, writable: true })
    Object.defineProperty(global, 'location', { value: originalLocation, writable: true })
  })

  describe('checkWebGPUAvailable', () => {
    it('returns false when navigator.gpu is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })

      expect(checkWebGPUAvailable()).toBe(false)
    })

    it('returns true when navigator.gpu is defined', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {},
        },
        writable: true,
      })

      expect(checkWebGPUAvailable()).toBe(true)
    })
  })

  describe('isWebGLForced', () => {
    it('returns false when no URL parameters', () => {
      Object.defineProperty(global, 'location', {
        value: {
          search: '',
        },
        writable: true,
      })

      expect(isWebGLForced()).toBe(false)
    })

    it('returns true when forceWebGL=true', () => {
      Object.defineProperty(global, 'location', {
        value: {
          search: '?forceWebGL=true',
        },
        writable: true,
      })

      expect(isWebGLForced()).toBe(true)
    })

    it('returns true when backend=webgl', () => {
      Object.defineProperty(global, 'location', {
        value: {
          search: '?backend=webgl',
        },
        writable: true,
      })

      expect(isWebGLForced()).toBe(true)
    })

    it('returns false when backend=webgpu', () => {
      Object.defineProperty(global, 'location', {
        value: {
          search: '?backend=webgpu',
        },
        writable: true,
      })

      expect(isWebGLForced()).toBe(false)
    })
  })

  describe('isWebGPUForced', () => {
    it('returns false when no URL parameters', () => {
      Object.defineProperty(global, 'location', {
        value: {
          search: '',
        },
        writable: true,
      })

      expect(isWebGPUForced()).toBe(false)
    })

    it('returns true when backend=webgpu', () => {
      Object.defineProperty(global, 'location', {
        value: {
          search: '?backend=webgpu',
        },
        writable: true,
      })

      expect(isWebGPUForced()).toBe(true)
    })
  })

  describe('determineBackend', () => {
    it('returns webgl when WebGPU is not available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })
      Object.defineProperty(global, 'location', {
        value: { search: '' },
        writable: true,
      })

      expect(determineBackend()).toBe('webgl')
    })

    it('returns webgl when forced via URL', () => {
      Object.defineProperty(global, 'navigator', {
        value: { gpu: {} },
        writable: true,
      })
      Object.defineProperty(global, 'location', {
        value: { search: '?forceWebGL=true' },
        writable: true,
      })

      expect(determineBackend()).toBe('webgl')
    })

    it('returns webgpu when WebGPU is available and not forced', () => {
      Object.defineProperty(global, 'navigator', {
        value: { gpu: {} },
        writable: true,
      })
      Object.defineProperty(global, 'location', {
        value: { search: '' },
        writable: true,
      })

      expect(determineBackend()).toBe('webgpu')
    })
  })

  describe('getRendererBackendInfo', () => {
    beforeEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: { gpu: {} },
        writable: true,
      })
      Object.defineProperty(global, 'location', {
        value: { search: '' },
        writable: true,
      })
    })

    it('returns unknown when renderer is null', () => {
      const info = getRendererBackendInfo(null)

      expect(info.backend).toBe('unknown')
      expect(info.isWebGPUAvailable).toBe(true)
    })

    it('returns webgpu when renderer has WebGPU backend', () => {
      const mockRenderer = {
        backend: {
          isWebGPU: true,
          parameters: {
            adapterInfo: {
              description: 'Test GPU',
            } as unknown as GPUAdapterInfo,
          },
        },
        capabilities: {
          maxTextureSize: 16384,
        },
      }

      const info = getRendererBackendInfo(mockRenderer)

      expect(info.backend).toBe('webgpu')
      expect(info.gpuName).toBe('Test GPU')
      expect(info.maxTextureSize).toBe(16384)
    })

    it('returns webgl when renderer has WebGL backend', () => {
      const mockRenderer = {
        backend: {
          isWebGPU: false,
        },
        capabilities: {
          maxTextureSize: 8192,
        },
      }

      const info = getRendererBackendInfo(mockRenderer)

      expect(info.backend).toBe('webgl')
      expect(info.maxTextureSize).toBe(8192)
    })

    it('returns webgl when renderer has no backend property', () => {
      const mockRenderer = {
        capabilities: {
          maxTextureSize: 4096,
        },
      }

      const info = getRendererBackendInfo(mockRenderer)

      expect(info.backend).toBe('webgl')
    })
  })
})






