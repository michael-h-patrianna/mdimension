/**
 * Tests for rendererStore
 *
 * Tests the renderer backend state management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useRendererStore } from '@/stores/rendererStore'

describe('rendererStore', () => {
  const originalLocation = global.location

  beforeEach(() => {
    // Reset store state before each test
    useRendererStore.getState().reset()

    // Mock location
    Object.defineProperty(global, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(global, 'location', { value: originalLocation, writable: true })
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useRendererStore.getState()

      expect(state.backend).toBe('unknown')
      expect(state.isInitialized).toBe(false)
      expect(state.gpuName).toBe(null)
      expect(state.maxTextureSize).toBe(4096)
    })
  })

  describe('setBackend', () => {
    it('updates the backend', () => {
      useRendererStore.getState().setBackend('webgpu')

      expect(useRendererStore.getState().backend).toBe('webgpu')
    })

    it('can set to webgl', () => {
      useRendererStore.getState().setBackend('webgl')

      expect(useRendererStore.getState().backend).toBe('webgl')
    })
  })

  describe('setWebGPUAvailable', () => {
    it('updates the isWebGPUAvailable flag', () => {
      useRendererStore.getState().setWebGPUAvailable(true)

      expect(useRendererStore.getState().isWebGPUAvailable).toBe(true)

      useRendererStore.getState().setWebGPUAvailable(false)

      expect(useRendererStore.getState().isWebGPUAvailable).toBe(false)
    })
  })

  describe('initialize', () => {
    it('sets all renderer info at once', () => {
      useRendererStore.getState().initialize({
        backend: 'webgpu',
        gpuName: 'Apple M1',
        maxTextureSize: 16384,
        isWebGLForced: false,
      })

      const state = useRendererStore.getState()

      expect(state.backend).toBe('webgpu')
      expect(state.gpuName).toBe('Apple M1')
      expect(state.maxTextureSize).toBe(16384)
      expect(state.isWebGLForced).toBe(false)
      expect(state.isInitialized).toBe(true)
    })

    it('uses defaults for optional values', () => {
      useRendererStore.getState().initialize({
        backend: 'webgl',
      })

      const state = useRendererStore.getState()

      expect(state.backend).toBe('webgl')
      expect(state.gpuName).toBe(null)
      expect(state.maxTextureSize).toBe(4096)
      expect(state.isWebGLForced).toBe(false)
      expect(state.isInitialized).toBe(true)
    })
  })

  describe('reset', () => {
    it('resets to initial state', () => {
      // First, initialize with some values
      useRendererStore.getState().initialize({
        backend: 'webgpu',
        gpuName: 'Test GPU',
        maxTextureSize: 16384,
      })

      // Verify it was set
      expect(useRendererStore.getState().backend).toBe('webgpu')

      // Reset
      useRendererStore.getState().reset()

      // Verify reset
      const state = useRendererStore.getState()
      expect(state.backend).toBe('unknown')
      expect(state.isInitialized).toBe(false)
      expect(state.gpuName).toBe(null)
    })
  })

  describe('URL parameter detection via initialize', () => {
    it('stores isWebGLForced when set via initialize', () => {
      useRendererStore.getState().initialize({
        backend: 'webgl',
        isWebGLForced: true,
      })

      expect(useRendererStore.getState().isWebGLForced).toBe(true)
    })

    it('stores isWebGLForced as false by default', () => {
      useRendererStore.getState().initialize({
        backend: 'webgpu',
      })

      expect(useRendererStore.getState().isWebGLForced).toBe(false)
    })
  })
})

