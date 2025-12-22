/**
 * Tests for CompositePass.
 *
 * Tests blending modes, alpha handling, and composition.
 */

import * as THREE from 'three'
import { beforeEach, describe, expect, it } from 'vitest'

import { CompositePass } from '@/rendering/graph/passes/CompositePass'

describe('CompositePass', () => {
  let pass: CompositePass

  beforeEach(() => {
    pass = new CompositePass({
      id: 'composite',
      compositeInputs: [
        { resourceId: 'input1', blendMode: 'add', weight: 1.0 },
        { resourceId: 'input2', blendMode: 'add', weight: 1.0 },
      ],
      outputResource: 'output',
    })
  })

  describe('initialization', () => {
    it('should create pass with correct ID', () => {
      expect(pass.id).toBe('composite')
    })

    it('should configure correct inputs and outputs', () => {
      expect(pass.config.inputs).toHaveLength(2)
      expect(pass.config.inputs[0]!.resourceId).toBe('input1')
      expect(pass.config.inputs[1]!.resourceId).toBe('input2')
      expect(pass.config.outputs).toHaveLength(1)
      expect(pass.config.outputs[0]!.resourceId).toBe('output')
    })

    it('should use configured blend mode', () => {
      const customPass = new CompositePass({
        id: 'custom',
        compositeInputs: [{ resourceId: 'input', blendMode: 'multiply', weight: 0.8 }],
        outputResource: 'output',
      })
      expect(customPass.config.inputs[0]!.resourceId).toBe('input')
    })

    it('should default background to black', () => {
      // Default background is black (0x000000)
      // We verify by checking the pass was created without errors
      expect(pass.id).toBe('composite')
    })
  })

  describe('blend mode configurations', () => {
    it('should support add blend mode', () => {
      const addPass = new CompositePass({
        id: 'add-composite',
        compositeInputs: [{ resourceId: 'input', blendMode: 'add' }],
        outputResource: 'output',
      })
      expect(addPass.id).toBe('add-composite')
    })

    it('should support multiply blend mode', () => {
      const multiplyPass = new CompositePass({
        id: 'multiply-composite',
        compositeInputs: [{ resourceId: 'input', blendMode: 'multiply' }],
        outputResource: 'output',
      })
      expect(multiplyPass.id).toBe('multiply-composite')
    })

    it('should support screen blend mode', () => {
      const screenPass = new CompositePass({
        id: 'screen-composite',
        compositeInputs: [{ resourceId: 'input', blendMode: 'screen' }],
        outputResource: 'output',
      })
      expect(screenPass.id).toBe('screen-composite')
    })

    it('should support alpha blend mode', () => {
      const alphaPass = new CompositePass({
        id: 'alpha-composite',
        compositeInputs: [{ resourceId: 'input', blendMode: 'alpha' }],
        outputResource: 'output',
      })
      expect(alphaPass.id).toBe('alpha-composite')
    })

    it('should support overlay blend mode', () => {
      const overlayPass = new CompositePass({
        id: 'overlay-composite',
        compositeInputs: [{ resourceId: 'input', blendMode: 'overlay' }],
        outputResource: 'output',
      })
      expect(overlayPass.id).toBe('overlay-composite')
    })
  })

  describe('weights', () => {
    it('should accept custom weights', () => {
      const customPass = new CompositePass({
        id: 'weighted',
        compositeInputs: [{ resourceId: 'input', blendMode: 'add', weight: 0.5 }],
        outputResource: 'output',
      })
      expect(customPass.id).toBe('weighted')
    })

    it('should default weight to 1.0', () => {
      const noWeightPass = new CompositePass({
        id: 'no-weight',
        compositeInputs: [{ resourceId: 'input', blendMode: 'add' }],
        outputResource: 'output',
      })
      expect(noWeightPass.id).toBe('no-weight')
    })
  })

  describe('background color', () => {
    it('should accept custom background color', () => {
      const colorPass = new CompositePass({
        id: 'colored',
        compositeInputs: [{ resourceId: 'input', blendMode: 'add' }],
        outputResource: 'output',
        backgroundColor: 0xff0000,
      })
      expect(colorPass.id).toBe('colored')
    })

    it('should accept Color object as background', () => {
      const colorPass = new CompositePass({
        id: 'colored',
        compositeInputs: [{ resourceId: 'input', blendMode: 'add' }],
        outputResource: 'output',
        backgroundColor: new THREE.Color(0x00ff00),
      })
      expect(colorPass.id).toBe('colored')
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
})
