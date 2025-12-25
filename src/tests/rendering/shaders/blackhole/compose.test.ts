/**
 * Tests for Black Hole Shader Composition
 *
 * Tests the composeBlackHoleShader function to ensure:
 * - Correct shader source generation
 * - Feature toggles work properly
 * - GLSL defines are applied correctly
 * - All required shader blocks are included
 */

import { describe, it, expect } from 'vitest'
import {
  composeBlackHoleShader,
  generateBlackHoleVertexShader,
  type BlackHoleShaderConfig,
} from '@/rendering/shaders/blackhole/compose'

describe('composeBlackHoleShader', () => {
  describe('basic composition', () => {
    it('should generate shader with required blocks', () => {
      const config: BlackHoleShaderConfig = {
        dimension: 4,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
      }

      const { fragmentShader, features } = composeBlackHoleShader(config)

      // Should include core blocks
      expect(fragmentShader).toContain('// === Precision ===')
      expect(fragmentShader).toContain('// === Constants ===')
      expect(fragmentShader).toContain('// === Shared Uniforms ===')
      expect(fragmentShader).toContain('// === Black Hole Uniforms ===')

      // Should include gravity modules
      expect(fragmentShader).toContain('// === Lensing ===')
      expect(fragmentShader).toContain('// === Horizon ===')
      expect(fragmentShader).toContain('// === Photon Shell ===')
      expect(fragmentShader).toContain('// === Manifold ===')

      // Should include main raymarching
      expect(fragmentShader).toContain('// === Main ===')

      // Features should include dimension
      expect(features).toContain('4D Black Hole')
    })

    it('should include dimension define', () => {
      const config: BlackHoleShaderConfig = {
        dimension: 5,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
      }

      const { fragmentShader } = composeBlackHoleShader(config)

      expect(fragmentShader).toContain('#define DIMENSION 5')
    })
  })

  describe('feature toggles', () => {
    it('should enable Doppler effect when configured', () => {
      const configWithDoppler: BlackHoleShaderConfig = {
        dimension: 4,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
        doppler: true,
      }

      const { fragmentShader, features } = composeBlackHoleShader(configWithDoppler)

      expect(fragmentShader).toContain('#define USE_DOPPLER')
      expect(features).toContain('Doppler Effect')
    })

    it('should enable temporal accumulation when configured', () => {
      const configWithTemporal: BlackHoleShaderConfig = {
        dimension: 4,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
        temporalAccumulation: true,
      }

      const { fragmentShader, features } = composeBlackHoleShader(configWithTemporal)

      expect(fragmentShader).toContain('#define USE_TEMPORAL_ACCUMULATION')
      expect(fragmentShader).toContain('// === Temporal ===')
      expect(features).toContain('Temporal Accumulation (1/4 res)')
    })

    // Note: shadows not implemented for black holes - no shader code exists yet
    // Test removed until volumetric shadow raymarching is implemented

    it('should enable environment map when configured', () => {
      const configWithEnvMap: BlackHoleShaderConfig = {
        dimension: 4,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
        envMap: true,
      }

      const { fragmentShader, features } = composeBlackHoleShader(configWithEnvMap)

      expect(fragmentShader).toContain('#define USE_ENVMAP')
      expect(features).toContain('Environment Map')
    })
  })

  describe('feature overrides', () => {
    it('should respect overrides for Doppler', () => {
      const config: BlackHoleShaderConfig = {
        dimension: 4,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
        doppler: true,
        overrides: ['Doppler'],
      }

      const { fragmentShader, features } = composeBlackHoleShader(config)

      expect(fragmentShader).not.toContain('#define USE_DOPPLER')
      expect(features).not.toContain('Doppler Effect')
    })
  })

  describe('dimension handling', () => {
    it('should work for 3D', () => {
      const config: BlackHoleShaderConfig = {
        dimension: 3,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
      }

      const { fragmentShader, features } = composeBlackHoleShader(config)

      expect(fragmentShader).toContain('#define DIMENSION 3')
      expect(features).toContain('3D Black Hole')
    })

    it('should work for high dimensions (8D)', () => {
      const config: BlackHoleShaderConfig = {
        dimension: 8,
        shadows: false,
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
      }

      const { fragmentShader, features } = composeBlackHoleShader(config)

      expect(fragmentShader).toContain('#define DIMENSION 8')
      expect(features).toContain('8D Black Hole')
      // Should have parameter values for extra dimensions
      expect(fragmentShader).toContain('uniform float uParamValues[5]')
    })
  })

  describe('combined features', () => {
    it('should handle multiple features enabled', () => {
      const config: BlackHoleShaderConfig = {
        dimension: 4,
        shadows: false, // shadows not implemented for black holes
        temporal: false,
        ambientOcclusion: false,
        opacityMode: 'solid',
        temporalAccumulation: true,
        doppler: true,
      }

      const { fragmentShader, features } = composeBlackHoleShader(config)

      // Note: shadows not tested - not implemented for black holes
      expect(fragmentShader).toContain('#define USE_TEMPORAL_ACCUMULATION')
      expect(fragmentShader).toContain('#define USE_DOPPLER')

      expect(features).toContain('Temporal Accumulation (1/4 res)')
      expect(features).toContain('Doppler Effect')
    })
  })
})

describe('generateBlackHoleVertexShader', () => {
  it('should generate valid vertex shader', () => {
    const vertexShader = generateBlackHoleVertexShader()

    // Should include precision
    expect(vertexShader).toContain('precision highp float')

    // Should output varyings
    expect(vertexShader).toContain('out vec3 vPosition')
    expect(vertexShader).toContain('out vec2 vUv')

    // Should have main function
    expect(vertexShader).toContain('void main()')

    // Should output to gl_Position
    expect(vertexShader).toContain('gl_Position')
  })

  it('should use world space raymarching approach', () => {
    const vertexShader = generateBlackHoleVertexShader()

    // Uses world space transformation for raymarching (like Mandelbulb/Schroedinger)
    // Transforms position to world space and outputs to vPosition
    expect(vertexShader).toContain('modelMatrix * vec4(position, 1.0)')
    expect(vertexShader).toContain('vPosition = worldPosition.xyz')
    expect(vertexShader).toContain('projectionMatrix * viewMatrix * worldPosition')
  })
})
