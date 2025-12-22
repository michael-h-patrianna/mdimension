/**
 * Tests for GTAOPass.
 *
 * Tests Ground Truth Ambient Occlusion pass that wraps Three.js GTAOPass.
 */

import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GTAOPass } from '@/rendering/graph/passes/GTAOPass'

// Mock the Three.js GTAOPass since it requires WebGL context
vi.mock('three/examples/jsm/postprocessing/GTAOPass.js', () => ({
  GTAOPass: class MockGTAOPass {
    public normalTexture: THREE.Texture | null = null
    public depthTexture: THREE.Texture | null = null
    public radius: number = 0.25
    public scale: number = 1.0

    constructor() {
      // Mock constructor
    }

    render() {
      // Mock render
    }

    setSize() {
      // Mock setSize
    }

    dispose() {
      // Mock dispose
    }
  },
}))

describe('GTAOPass', () => {
  let pass: GTAOPass

  beforeEach(() => {
    pass = new GTAOPass({
      id: 'gtao',
      colorInput: 'sceneColor',
      normalInput: 'normalBuffer',
      depthInput: 'sceneDepth',
      outputResource: 'gtaoOutput',
    })
  })

  describe('initialization', () => {
    it('should create pass with correct ID', () => {
      expect(pass.id).toBe('gtao')
    })

    it('should configure three inputs', () => {
      expect(pass.config.inputs).toHaveLength(3)
      expect(pass.config.inputs[0]!.resourceId).toBe('sceneColor')
      expect(pass.config.inputs[1]!.resourceId).toBe('normalBuffer')
      expect(pass.config.inputs[2]!.resourceId).toBe('sceneDepth')
    })

    it('should configure correct output', () => {
      expect(pass.config.outputs).toHaveLength(1)
      expect(pass.config.outputs[0]!.resourceId).toBe('gtaoOutput')
    })

    it('should accept custom config', () => {
      const customPass = new GTAOPass({
        id: 'gtao-custom',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        outputResource: 'gtaoOutput',
      })
      expect(customPass.id).toBe('gtao-custom')
    })
  })

  describe('parameter setters', () => {
    it('should set radius', () => {
      expect(() => pass.setRadius(0.5)).not.toThrow()
    })

    it('should set intensity', () => {
      expect(() => pass.setIntensity(0.8)).not.toThrow()
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
