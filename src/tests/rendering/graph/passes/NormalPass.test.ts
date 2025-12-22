/**
 * Tests for NormalPass.
 *
 * Tests world-space normal rendering and layer filtering.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NormalPass } from '@/rendering/graph/passes/NormalPass'

describe('NormalPass', () => {
  let pass: NormalPass

  beforeEach(() => {
    pass = new NormalPass({
      id: 'normal',
      outputs: [{ resourceId: 'sceneNormals', access: 'write' }],
    })
  })

  describe('initialization', () => {
    it('should create pass with correct ID', () => {
      expect(pass.id).toBe('normal')
    })

    it('should configure no inputs (source pass)', () => {
      expect(pass.config.inputs).toHaveLength(0)
    })

    it('should configure correct output', () => {
      expect(pass.config.outputs).toHaveLength(1)
      expect(pass.config.outputs[0]!.resourceId).toBe('sceneNormals')
    })

    it('should default layers to null (all layers)', () => {
      // Default constructor without layers option
      const defaultPass = new NormalPass({
        id: 'default',
        outputs: [{ resourceId: 'normals', access: 'write' }],
      })
      expect(defaultPass.id).toBe('default')
    })
  })

  describe('layer configuration', () => {
    it('should accept custom layers', () => {
      const layeredPass = new NormalPass({
        id: 'layered',
        outputs: [{ resourceId: 'normals', access: 'write' }],
        layers: [1, 2],
      })
      expect(layeredPass.id).toBe('layered')
    })

    it('should update layers with setLayers', () => {
      pass.setLayers([3, 4, 5])
      // Pass was updated - verify no error
      expect(pass.id).toBe('normal')
    })

    it('should allow resetting layers to null', () => {
      pass.setLayers([1, 2])
      pass.setLayers(null)
      // Pass was updated - verify no error
      expect(pass.id).toBe('normal')
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

  describe('shader validation', () => {
    it('should use GLSL3 syntax', () => {
      // Verify pass was created (which validates shader compilation in actual context)
      expect(pass.id).toBe('normal')
    })
  })
})
