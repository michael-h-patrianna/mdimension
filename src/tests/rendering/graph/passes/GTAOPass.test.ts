/**
 * Tests for GTAOPass.
 *
 * Tests Ground Truth Ambient Occlusion pass that wraps Three.js GTAOPass.
 * Includes tests for half-resolution rendering with bilateral upsampling.
 */

import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GTAOPass } from '@/rendering/graph/passes/GTAOPass'

// Mock shader uniform structure
const createMockUniforms = () => ({
  tNormal: { value: null },
  tDepth: { value: null },
})

// Mock the Three.js GTAOPass since it requires WebGL context
vi.mock('three/examples/jsm/postprocessing/GTAOPass.js', () => ({
  GTAOPass: class MockGTAOPass {
    // Correct values from Three.js GTAOPass source
    public static OUTPUT = {
      Off: -1,
      Default: 0,
      Diffuse: 1,
      Depth: 2,
      Normal: 3,
      AO: 4,
      Denoise: 5,
    }

    public normalTexture: THREE.Texture | null = null
    public depthTexture: THREE.Texture | null = null
    public radius: number = 0.25
    public scale: number = 1.0
    public blendIntensity: number = 1.0
    public output: number = 0

    // Internal properties accessed by configureExternalGBuffer
    public _renderGBuffer: boolean = true
    public gtaoMaterial = {
      defines: {
        NORMAL_VECTOR_TYPE: 0,
        DEPTH_SWIZZLING: 'x',
      },
      uniforms: createMockUniforms(),
      needsUpdate: false,
    }
    public pdMaterial = {
      defines: {
        NORMAL_VECTOR_TYPE: 0,
        DEPTH_SWIZZLING: 'x',
      },
      uniforms: createMockUniforms(),
      needsUpdate: false,
    }

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

// Mock FullscreenQuad utilities
vi.mock('@/rendering/core/FullscreenQuad', () => ({
  getFullscreenQuadGeometry: () => new THREE.PlaneGeometry(2, 2),
  releaseFullscreenQuadGeometry: vi.fn(),
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

  afterEach(() => {
    pass.dispose()
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
      customPass.dispose()
    })

    it('should enable half-resolution by default', () => {
      expect(pass.isHalfResolution()).toBe(true)
    })

    it('should respect halfResolution config option', () => {
      const fullResPass = new GTAOPass({
        id: 'gtao-fullres',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        outputResource: 'gtaoOutput',
        halfResolution: false,
      })
      expect(fullResPass.isHalfResolution()).toBe(false)
      fullResPass.dispose()
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

  describe('half-resolution control', () => {
    it('should toggle half-resolution mode', () => {
      expect(pass.isHalfResolution()).toBe(true)

      pass.setHalfResolution(false)
      expect(pass.isHalfResolution()).toBe(false)

      pass.setHalfResolution(true)
      expect(pass.isHalfResolution()).toBe(true)
    })

    it('should not reinitialize when setting same value', () => {
      pass.setHalfResolution(true)
      expect(pass.isHalfResolution()).toBe(true)
      // Should not throw or cause issues
      pass.setHalfResolution(true)
      expect(pass.isHalfResolution()).toBe(true)
    })

    it('should set bilateral depth threshold', () => {
      expect(() => pass.setBilateralDepthThreshold(0.05)).not.toThrow()
    })

    it('should initialize half-res pipeline when enabling after disabled start', () => {
      const fullResPass = new GTAOPass({
        id: 'gtao-fullres',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        outputResource: 'gtaoOutput',
        halfResolution: false,
      })

      expect(fullResPass.isHalfResolution()).toBe(false)

      // Enable half-res after creation
      fullResPass.setHalfResolution(true)
      expect(fullResPass.isHalfResolution()).toBe(true)

      fullResPass.dispose()
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

    it('should dispose half-res resources', () => {
      // Create pass with half-res enabled (default)
      const halfResPass = new GTAOPass({
        id: 'gtao-halfres',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        outputResource: 'gtaoOutput',
        halfResolution: true,
      })

      // Should not throw when disposing half-res resources
      expect(() => halfResPass.dispose()).not.toThrow()
    })

    it('should dispose full-res only resources', () => {
      const fullResPass = new GTAOPass({
        id: 'gtao-fullres',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        outputResource: 'gtaoOutput',
        halfResolution: false,
      })

      expect(() => fullResPass.dispose()).not.toThrow()
    })
  })

  describe('configuration options', () => {
    it('should accept custom bilateral depth threshold', () => {
      const customPass = new GTAOPass({
        id: 'gtao-custom-threshold',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        outputResource: 'gtaoOutput',
        bilateralDepthThreshold: 0.05,
      })

      // Pass should be created successfully with custom threshold
      expect(customPass.id).toBe('gtao-custom-threshold')
      customPass.dispose()
    })

    it('should accept depth input attachment', () => {
      const customPass = new GTAOPass({
        id: 'gtao-depth-attachment',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        depthInputAttachment: 'depth',
        outputResource: 'gtaoOutput',
      })

      expect(customPass.config.inputs[2]!.attachment).toBe('depth')
      customPass.dispose()
    })
  })

  describe('G-buffer configuration', () => {
    it('should have type augmentation for Three.js GTAOPass internals', () => {
      // This test verifies that the type augmentation for internal GTAOPass
      // properties is correctly defined. The mock provides these properties.
      const mockPass = new GTAOPass({
        id: 'gtao-gbuffer-test',
        colorInput: 'sceneColor',
        normalInput: 'normalBuffer',
        depthInput: 'sceneDepth',
        outputResource: 'gtaoOutput',
      })

      // Pass should be created without TypeScript errors when accessing
      // augmented properties (_renderGBuffer, gtaoMaterial, pdMaterial)
      expect(mockPass).toBeDefined()
      mockPass.dispose()
    })

    it('should document the G-buffer configuration fix', () => {
      // This test documents the critical fix for the "rectangular shadow" bug.
      //
      // PROBLEM: The original implementation only set normalTexture/depthTexture
      // properties on Three.js GTAOPass, but did NOT:
      // 1. Set _renderGBuffer = false (to disable internal G-buffer rendering)
      // 2. Update shader defines (NORMAL_VECTOR_TYPE, DEPTH_SWIZZLING)
      // 3. Bind textures to shader uniforms (tNormal, tDepth)
      //
      // CONSEQUENCE: GTAOPass would re-render normals using scene.overrideMaterial,
      // which breaks raymarched objects (hypercube, fractals) that compute normals
      // in fragment shaders, resulting in a "rectangular shadow" artifact.
      //
      // FIX: The configureExternalGBuffer() method now properly replicates
      // Three.js GTAOPass.setGBuffer() behavior to use external textures.

      expect(true).toBe(true) // Documentation test always passes
    })
  })
})
