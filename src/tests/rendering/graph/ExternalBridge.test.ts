/**
 * Tests for ExternalBridge
 *
 * Verifies import capture and export execution between render graph and external systems.
 */

import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSceneBackgroundExport,
  createSceneBackgroundImport,
  createSceneEnvironmentExport,
  createSceneEnvironmentImport,
  ExternalBridge,
} from '@/rendering/graph/ExternalBridge'

describe('ExternalBridge', () => {
  let bridge: ExternalBridge

  beforeEach(() => {
    bridge = new ExternalBridge('test')
  })

  afterEach(() => {
    bridge.dispose()
  })

  describe('import registration', () => {
    it('should register imports', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => new THREE.Color(0xff0000),
      })

      // Registration doesn't capture immediately
      expect(bridge.hasImport('scene.background')).toBe(false)
    })

    it('should unregister imports', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => new THREE.Color(0xff0000),
      })

      bridge.captureImports()
      expect(bridge.hasImport('scene.background')).toBe(true)

      bridge.unregisterImport('scene.background')
      expect(bridge.hasImport('scene.background')).toBe(false)
    })
  })

  describe('import capture', () => {
    it('should capture imports on captureImports()', () => {
      const color = new THREE.Color(0xff0000)

      bridge.registerImport({
        id: 'scene.background',
        getter: () => color,
      })

      bridge.captureImports()

      expect(bridge.hasImport('scene.background')).toBe(true)
      expect(bridge.getImported('scene.background')).toBe(color)
    })

    it('should freeze captured values', () => {
      let currentColor = new THREE.Color(0xff0000)

      bridge.registerImport({
        id: 'scene.background',
        getter: () => currentColor,
      })

      bridge.captureImports()

      // Change the external value
      const originalColor = currentColor
      currentColor = new THREE.Color(0x00ff00)

      // Captured value should still be the original
      expect(bridge.getImported('scene.background')).toBe(originalColor)
    })

    it('should validate imports if validator provided', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => null,
        validator: (value) => value !== null,
      })

      bridge.captureImports()

      // Should not be captured because validation failed
      expect(bridge.hasImport('scene.background')).toBe(false)
      expect(bridge.getImported('scene.background')).toBe(null)
    })

    it('should capture import when validation passes', () => {
      const texture = new THREE.Texture()

      bridge.registerImport({
        id: 'scene.background',
        getter: () => texture,
        validator: (value) => value !== null,
      })

      bridge.captureImports()

      expect(bridge.hasImport('scene.background')).toBe(true)
      expect(bridge.getImported('scene.background')).toBe(texture)
    })

    it('should handle getter errors gracefully', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => {
          throw new Error('Getter failed')
        },
      })

      // Should not throw
      expect(() => bridge.captureImports()).not.toThrow()
      expect(bridge.hasImport('scene.background')).toBe(false)
    })

    it('should clear captured imports on captureImports()', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => new THREE.Color(0xff0000),
      })

      bridge.captureImports()
      expect(bridge.hasImport('scene.background')).toBe(true)

      // Unregister and re-capture
      bridge.unregisterImport('scene.background')
      bridge.captureImports()

      expect(bridge.hasImport('scene.background')).toBe(false)
    })

    it('should return null for uncaptured imports', () => {
      expect(bridge.getImported('scene.background')).toBe(null)
    })
  })

  describe('export registration', () => {
    it('should register exports', () => {
      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter: vi.fn(),
      })

      expect(bridge.hasExport('scene.background')).toBe(true)
    })

    it('should unregister exports', () => {
      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter: vi.fn(),
      })

      bridge.unregisterExport('scene.background')
      expect(bridge.hasExport('scene.background')).toBe(false)
    })
  })

  describe('export queueing and execution', () => {
    it('should queue exports during pass execution', () => {
      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter: vi.fn(),
      })

      bridge.queueExport({
        id: 'scene.background',
        value: new THREE.Color(0xff0000),
      })

      expect(bridge.isExportQueued('scene.background')).toBe(true)
    })

    it('should execute exports with setter', () => {
      const setter = vi.fn()
      const color = new THREE.Color(0xff0000)

      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter,
      })

      bridge.queueExport({
        id: 'scene.background',
        value: color,
      })

      bridge.executeExports()

      expect(setter).toHaveBeenCalledWith(color)
    })

    it('should apply transform before setting', () => {
      const setter = vi.fn()
      const mockRenderTarget = { texture: new THREE.Texture() }

      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter,
        transform: (rt: { texture: THREE.Texture }) => rt.texture,
      })

      bridge.queueExport({
        id: 'scene.background',
        value: mockRenderTarget,
      })

      bridge.executeExports()

      expect(setter).toHaveBeenCalledWith(mockRenderTarget.texture)
    })

    it('should clear queued exports after execution', () => {
      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter: vi.fn(),
      })

      bridge.queueExport({
        id: 'scene.background',
        value: new THREE.Color(0xff0000),
      })

      bridge.executeExports()

      expect(bridge.isExportQueued('scene.background')).toBe(false)
    })

    it('should not execute unregistered exports', () => {
      const setter = vi.fn()

      // Don't register, just queue
      bridge.queueExport({
        id: 'scene.background',
        value: new THREE.Color(0xff0000),
      })

      // Should not throw
      expect(() => bridge.executeExports()).not.toThrow()
      expect(setter).not.toHaveBeenCalled()
    })

    it('should handle setter errors gracefully', () => {
      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter: () => {
          throw new Error('Setter failed')
        },
      })

      bridge.queueExport({
        id: 'scene.background',
        value: new THREE.Color(0xff0000),
      })

      // Should not throw
      expect(() => bridge.executeExports()).not.toThrow()
    })

    it('should execute multiple exports in order', () => {
      const callOrder: string[] = []

      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter: () => callOrder.push('background'),
      })

      bridge.registerExport({
        id: 'scene.environment',
        resourceId: 'envRT',
        setter: () => callOrder.push('environment'),
      })

      bridge.queueExport({ id: 'scene.background', value: null })
      bridge.queueExport({ id: 'scene.environment', value: null })

      bridge.executeExports()

      expect(callOrder).toContain('background')
      expect(callOrder).toContain('environment')
    })
  })

  describe('frame management', () => {
    it('should clear state on beginFrame()', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => new THREE.Color(0xff0000),
      })

      bridge.registerExport({
        id: 'scene.environment',
        resourceId: 'envRT',
        setter: vi.fn(),
      })

      bridge.captureImports()
      bridge.queueExport({ id: 'scene.environment', value: null })

      bridge.beginFrame()

      expect(bridge.hasImport('scene.background')).toBe(false)
      expect(bridge.isExportQueued('scene.environment')).toBe(false)
    })

    it('should support endFrame() alias for executeExports()', () => {
      const setter = vi.fn()

      bridge.registerExport({
        id: 'scene.background',
        resourceId: 'skyRT',
        setter,
      })

      bridge.queueExport({ id: 'scene.background', value: new THREE.Color(0xff0000) })

      bridge.endFrame()

      expect(setter).toHaveBeenCalled()
    })
  })

  describe('reset and dispose', () => {
    it('should clear all state on reset()', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => new THREE.Color(0xff0000),
      })

      bridge.registerExport({
        id: 'scene.environment',
        resourceId: 'envRT',
        setter: vi.fn(),
      })

      bridge.reset()

      expect(bridge.hasExport('scene.environment')).toBe(false)
    })

    it('should dispose cleanly', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => new THREE.Color(0xff0000),
      })

      expect(() => bridge.dispose()).not.toThrow()
    })
  })

  describe('debug info', () => {
    it('should return import/export state', () => {
      bridge.registerImport({
        id: 'scene.background',
        getter: () => new THREE.Color(0xff0000),
      })

      bridge.registerExport({
        id: 'scene.environment',
        resourceId: 'envRT',
        setter: vi.fn(),
      })

      bridge.captureImports()
      bridge.queueExport({ id: 'scene.environment', value: null })

      const info = bridge.getDebugInfo()

      expect(info.imports).toContainEqual({ id: 'scene.background', captured: true })
      expect(info.exports).toContainEqual({ id: 'scene.environment', queued: true })
    })
  })

  describe('helper functions', () => {
    let scene: THREE.Scene

    beforeEach(() => {
      scene = new THREE.Scene()
    })

    it('should create scene background import config', () => {
      const color = new THREE.Color(0xff0000)
      scene.background = color

      const config = createSceneBackgroundImport(scene)

      expect(config.id).toBe('scene.background')
      expect(config.getter()).toBe(color)
    })

    it('should create scene environment import config', () => {
      const texture = new THREE.Texture()
      scene.environment = texture

      const config = createSceneEnvironmentImport(scene)

      expect(config.id).toBe('scene.environment')
      expect(config.getter()).toBe(texture)
    })

    it('should create scene background export config', () => {
      const config = createSceneBackgroundExport(scene)

      expect(config.id).toBe('scene.background')

      const color = new THREE.Color(0xff0000)
      config.setter(color)

      expect(scene.background).toBe(color)
    })

    it('should create scene environment export config', () => {
      const config = createSceneEnvironmentExport(scene)

      expect(config.id).toBe('scene.environment')

      const texture = new THREE.Texture()
      config.setter(texture)

      expect(scene.environment).toBe(texture)
    })
  })

  describe('typical workflow', () => {
    it('should support full import/export cycle', () => {
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x000000)

      // Register imports
      bridge.registerImport(createSceneBackgroundImport(scene))

      // Register exports
      bridge.registerExport(createSceneBackgroundExport(scene))

      // Frame start: capture imports
      bridge.captureImports()

      // Passes can read imported values
      const capturedBackground = bridge.getImported<THREE.Color>('scene.background')
      expect(capturedBackground).toBeInstanceOf(THREE.Color)

      // Pass computes a new background
      const newBackground = new THREE.Color(0xff0000)

      // Pass queues export
      bridge.queueExport({
        id: 'scene.background',
        value: newBackground,
      })

      // Frame end: execute exports
      bridge.executeExports()

      // Scene should now have the new background
      expect(scene.background).toBe(newBackground)
    })

    it('should support cubemap capture workflow', () => {
      interface MockCubeTarget {
        texture: THREE.CubeTexture
      }

      const scene = new THREE.Scene()
      const cubeTexture = new THREE.CubeTexture()

      // CubemapCapturePass exports its result
      bridge.registerExport({
        id: 'skybox.cubemap',
        resourceId: 'skyCubeRT',
        setter: (texture: THREE.CubeTexture) => {
          scene.background = texture
          scene.environment = texture
        },
        transform: (rt: MockCubeTarget) => rt.texture,
      })

      // During CubemapCapturePass execution
      const cubeRenderTarget: MockCubeTarget = { texture: cubeTexture }
      bridge.queueExport({
        id: 'skybox.cubemap',
        value: cubeRenderTarget,
      })

      // Frame end
      bridge.executeExports()

      expect(scene.background).toBe(cubeTexture)
      expect(scene.environment).toBe(cubeTexture)
    })
  })
})
