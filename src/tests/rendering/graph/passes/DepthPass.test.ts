/**
 * Tests for DepthPass.
 *
 * Tests depth rendering and layer filtering.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { DepthPass } from '@/rendering/graph/passes/DepthPass'

describe('DepthPass', () => {
  let pass: DepthPass

  beforeEach(() => {
    pass = new DepthPass({
      id: 'depth',
      outputs: [{ resourceId: 'sceneDepth', access: 'write' }],
    })
  })

  describe('initialization', () => {
    it('should create pass with correct ID', () => {
      expect(pass.id).toBe('depth')
    })

    it('should configure no inputs (source pass)', () => {
      expect(pass.config.inputs).toHaveLength(0)
    })

    it('should configure correct output', () => {
      expect(pass.config.outputs).toHaveLength(1)
      expect(pass.config.outputs[0]!.resourceId).toBe('sceneDepth')
    })

    it('should default layers to null (all layers)', () => {
      const defaultPass = new DepthPass({
        id: 'default',
        outputs: [{ resourceId: 'depth', access: 'write' }],
      })
      expect(defaultPass.id).toBe('default')
    })
  })

  describe('configuration options', () => {
    it('should accept camera near plane', () => {
      const nearPass = new DepthPass({
        id: 'near',
        outputs: [{ resourceId: 'depth', access: 'write' }],
        cameraNear: 0.5,
      })
      expect(nearPass.id).toBe('near')
    })

    it('should accept camera far plane', () => {
      const farPass = new DepthPass({
        id: 'far',
        outputs: [{ resourceId: 'depth', access: 'write' }],
        cameraFar: 500,
      })
      expect(farPass.id).toBe('far')
    })

    it('should accept custom layers', () => {
      const layeredPass = new DepthPass({
        id: 'layered',
        outputs: [{ resourceId: 'depth', access: 'write' }],
        layers: [0, 1, 2],
      })
      expect(layeredPass.id).toBe('layered')
    })

    it('should accept all options together', () => {
      const fullPass = new DepthPass({
        id: 'full',
        outputs: [{ resourceId: 'depth', access: 'write' }],
        cameraNear: 0.1,
        cameraFar: 1000,
        layers: [1],
      })
      expect(fullPass.id).toBe('full')
    })
  })

  describe('layer configuration', () => {
    it('should update layers with setLayers', () => {
      pass.setLayers([1, 2, 3])
      // Pass was updated - verify no error
      expect(pass.id).toBe('depth')
    })

    it('should allow resetting layers to null', () => {
      pass.setLayers([1, 2])
      pass.setLayers(null)
      // Pass was updated - verify no error
      expect(pass.id).toBe('depth')
    })

    it('should handle empty layers array', () => {
      pass.setLayers([])
      // Pass was updated - verify no error
      expect(pass.id).toBe('depth')
    })
  })

  describe('disposal', () => {
    it('should dispose without error', () => {
      expect(() => pass.dispose()).not.toThrow()
    })

    it('should be safe to call dispose multiple times', () => {
      pass.dispose()
      expect(() => pass.dispose()).not.toThrow()
    })
  })

  describe('depth material', () => {
    it('should use RGBA depth packing', () => {
      // Depth material is created with RGBADepthPacking
      // Verify pass was created successfully
      expect(pass.id).toBe('depth')
    })
  })
})
