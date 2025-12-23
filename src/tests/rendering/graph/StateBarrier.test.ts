/**
 * Tests for StateBarrier
 *
 * Verifies that Three.js state is properly saved and restored around pass execution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'

import { StateBarrier } from '@/rendering/graph/StateBarrier'

describe('StateBarrier', () => {
  let barrier: StateBarrier
  let mockRenderer: THREE.WebGLRenderer
  let mockScene: THREE.Scene
  let mockCamera: THREE.PerspectiveCamera

  beforeEach(() => {
    barrier = new StateBarrier()

    // Create mock renderer with necessary methods
    mockRenderer = {
      getRenderTarget: vi.fn().mockReturnValue(null),
      setRenderTarget: vi.fn(),
      getClearColor: vi.fn().mockImplementation((target: THREE.Color) => {
        target.setRGB(0.1, 0.2, 0.3)
        return target
      }),
      getClearAlpha: vi.fn().mockReturnValue(1.0),
      setClearColor: vi.fn(),
      autoClear: true,
      autoClearColor: true,
      autoClearDepth: true,
      autoClearStencil: false,
    } as unknown as THREE.WebGLRenderer

    mockScene = new THREE.Scene()
    mockScene.background = new THREE.Color(0x000000)
    mockScene.environment = null
    mockScene.overrideMaterial = null

    mockCamera = new THREE.PerspectiveCamera()
    mockCamera.layers.mask = 1
  })

  describe('capture', () => {
    it('should capture renderer state', () => {
      barrier.capture(mockRenderer, mockScene, mockCamera)

      const state = barrier.getRendererState()
      expect(state).not.toBeNull()
      expect(state?.renderTarget).toBeNull()
      expect(state?.clearAlpha).toBe(1.0)
      expect(state?.autoClear).toBe(true)
      expect(state?.autoClearColor).toBe(true)
      expect(state?.autoClearDepth).toBe(true)
      expect(state?.autoClearStencil).toBe(false)
    })

    it('should capture scene state', () => {
      mockScene.background = new THREE.Color(0xff0000)
      mockScene.environment = new THREE.Texture()
      mockScene.overrideMaterial = new THREE.MeshBasicMaterial()

      barrier.capture(mockRenderer, mockScene, mockCamera)

      const state = barrier.getSceneState()
      expect(state).not.toBeNull()
      expect(state?.background).toBeInstanceOf(THREE.Color)
      expect(state?.environment).toBeInstanceOf(THREE.Texture)
      expect(state?.overrideMaterial).toBeInstanceOf(THREE.MeshBasicMaterial)
    })

    it('should capture camera state', () => {
      mockCamera.layers.mask = 0b1010

      barrier.capture(mockRenderer, mockScene, mockCamera)

      const state = barrier.getCameraState()
      expect(state).not.toBeNull()
      expect(state?.layersMask).toBe(0b1010)
    })

    it('should mark state as captured', () => {
      expect(barrier.hasCapturedState()).toBe(false)

      barrier.capture(mockRenderer, mockScene, mockCamera)

      expect(barrier.hasCapturedState()).toBe(true)
    })
  })

  describe('restore', () => {
    it('should restore renderer state', () => {
      barrier.capture(mockRenderer, mockScene, mockCamera)

      // Modify renderer state
      mockRenderer.autoClear = false
      mockRenderer.autoClearColor = false

      barrier.restore(mockRenderer, mockScene, mockCamera)

      expect(mockRenderer.setRenderTarget).toHaveBeenCalledWith(null)
      expect(mockRenderer.setClearColor).toHaveBeenCalled()
      expect(mockRenderer.autoClear).toBe(true)
      expect(mockRenderer.autoClearColor).toBe(true)
    })

    it('should restore scene state', () => {
      const originalBackground = new THREE.Color(0xff0000)
      mockScene.background = originalBackground

      barrier.capture(mockRenderer, mockScene, mockCamera)

      // Modify scene state
      mockScene.background = null
      mockScene.environment = new THREE.Texture()
      mockScene.overrideMaterial = new THREE.MeshBasicMaterial()

      barrier.restore(mockRenderer, mockScene, mockCamera)

      expect(mockScene.background).toBe(originalBackground)
      expect(mockScene.environment).toBeNull()
      expect(mockScene.overrideMaterial).toBeNull()
    })

    it('should restore camera layers', () => {
      mockCamera.layers.mask = 1

      barrier.capture(mockRenderer, mockScene, mockCamera)

      // Modify camera layers
      mockCamera.layers.mask = 0xffffffff

      barrier.restore(mockRenderer, mockScene, mockCamera)

      expect(mockCamera.layers.mask).toBe(1)
    })

    it('should do nothing if not captured', () => {
      // Don't capture, just restore
      barrier.restore(mockRenderer, mockScene, mockCamera)

      // Should not throw and not modify state
      expect(mockRenderer.setRenderTarget).not.toHaveBeenCalled()
    })
  })

  describe('state isolation', () => {
    it('should isolate scene.background changes between captures', () => {
      // First capture with red background
      mockScene.background = new THREE.Color(0xff0000)
      barrier.capture(mockRenderer, mockScene, mockCamera)
      const firstState = barrier.getSceneState()

      // Modify background
      mockScene.background = new THREE.Color(0x00ff00)

      // First state should still reference red
      expect(firstState?.background).toEqual(new THREE.Color(0xff0000))
    })

    it('should handle render target restoration', () => {
      const mockTarget = { isWebGLRenderTarget: true } as THREE.WebGLRenderTarget
      ;(mockRenderer.getRenderTarget as ReturnType<typeof vi.fn>).mockReturnValue(mockTarget)

      barrier.capture(mockRenderer, mockScene, mockCamera)

      // Modify target
      ;(mockRenderer.getRenderTarget as ReturnType<typeof vi.fn>).mockReturnValue(null)

      barrier.restore(mockRenderer, mockScene, mockCamera)

      expect(mockRenderer.setRenderTarget).toHaveBeenCalledWith(mockTarget)
    })
  })

  describe('clear', () => {
    it('should clear captured state', () => {
      barrier.capture(mockRenderer, mockScene, mockCamera)
      expect(barrier.hasCapturedState()).toBe(true)

      barrier.clear()

      expect(barrier.hasCapturedState()).toBe(false)
      expect(barrier.getRendererState()).toBeNull()
      expect(barrier.getSceneState()).toBeNull()
      expect(barrier.getCameraState()).toBeNull()
    })
  })

  describe('multiple capture/restore cycles', () => {
    it('should support multiple sequential cycles', () => {
      // First cycle
      mockScene.background = new THREE.Color(0xff0000)
      barrier.capture(mockRenderer, mockScene, mockCamera)
      mockScene.background = null
      barrier.restore(mockRenderer, mockScene, mockCamera)
      expect(mockScene.background).toEqual(new THREE.Color(0xff0000))

      // Second cycle with different state
      mockScene.background = new THREE.Color(0x00ff00)
      barrier.capture(mockRenderer, mockScene, mockCamera)
      mockScene.background = null
      barrier.restore(mockRenderer, mockScene, mockCamera)
      expect(mockScene.background).toEqual(new THREE.Color(0x00ff00))
    })
  })
})
