/**
 * Tests for multi-light shader uniform helpers
 */

import { MAX_LIGHTS, type LightSource } from '@/rendering/lights/types'
import {
  createLightUniforms,
  getLightUniformDeclarations,
  mergeLightUniforms,
  updateLightUniforms,
} from '@/rendering/lights/uniforms'
import { Color, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

describe('Light Uniforms', () => {
  describe('createLightUniforms', () => {
    it('should create all required uniform properties', () => {
      const uniforms = createLightUniforms()

      expect(uniforms).toHaveProperty('uNumLights')
      expect(uniforms).toHaveProperty('uLightsEnabled')
      expect(uniforms).toHaveProperty('uLightTypes')
      expect(uniforms).toHaveProperty('uLightPositions')
      expect(uniforms).toHaveProperty('uLightDirections')
      expect(uniforms).toHaveProperty('uLightColors')
      expect(uniforms).toHaveProperty('uLightIntensities')
      expect(uniforms).toHaveProperty('uSpotAngles')
      expect(uniforms).toHaveProperty('uSpotPenumbras')
      expect(uniforms).toHaveProperty('uSpotCosInner')
      expect(uniforms).toHaveProperty('uSpotCosOuter')
      expect(uniforms).toHaveProperty('uLightRanges')
      expect(uniforms).toHaveProperty('uLightDecays')
    })

    it('should initialize uNumLights to 0', () => {
      const uniforms = createLightUniforms()
      expect(uniforms.uNumLights.value).toBe(0)
    })

    it('should create arrays of MAX_LIGHTS length', () => {
      const uniforms = createLightUniforms()

      expect(uniforms.uLightsEnabled.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uLightTypes.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uLightPositions.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uLightDirections.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uLightColors.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uLightIntensities.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uSpotAngles.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uSpotPenumbras.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uSpotCosInner.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uSpotCosOuter.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uLightRanges.value).toHaveLength(MAX_LIGHTS)
      expect(uniforms.uLightDecays.value).toHaveLength(MAX_LIGHTS)
    })

    it('should initialize precomputed cosines with correct default values', () => {
      const uniforms = createLightUniforms()
      // Default: 30° cone (π/6) with 0.5 penumbra → inner=15° (π/12), outer=30° (π/6)
      const expectedCosInner = Math.cos(Math.PI / 12) // cos(15°) ≈ 0.966
      const expectedCosOuter = Math.cos(Math.PI / 6) // cos(30°) ≈ 0.866

      uniforms.uSpotCosInner.value.forEach((cosInner) => {
        expect(cosInner).toBeCloseTo(expectedCosInner, 5)
      })
      uniforms.uSpotCosOuter.value.forEach((cosOuter) => {
        expect(cosOuter).toBeCloseTo(expectedCosOuter, 5)
      })
    })

    it('should initialize all lights as disabled', () => {
      const uniforms = createLightUniforms()

      uniforms.uLightsEnabled.value.forEach((enabled) => {
        expect(enabled).toBe(false)
      })
    })

    it('should initialize range to 0 (infinite) and decay to 2 (inverse square)', () => {
      const uniforms = createLightUniforms()

      uniforms.uLightRanges.value.forEach((range) => {
        expect(range).toBe(0) // 0 = infinite range
      })
      uniforms.uLightDecays.value.forEach((decay) => {
        expect(decay).toBe(2) // 2 = physically correct inverse square
      })
    })

    it('should initialize positions as Vector3 instances', () => {
      const uniforms = createLightUniforms()

      uniforms.uLightPositions.value.forEach((pos) => {
        expect(pos).toBeInstanceOf(Vector3)
      })
    })

    it('should initialize colors as Color instances', () => {
      const uniforms = createLightUniforms()

      uniforms.uLightColors.value.forEach((color) => {
        expect(color).toBeInstanceOf(Color)
      })
    })

    it('should initialize default direction as down', () => {
      const uniforms = createLightUniforms()

      uniforms.uLightDirections.value.forEach((dir) => {
        expect(dir).toBeInstanceOf(Vector3)
        expect(dir.y).toBe(-1)
      })
    })
  })

  describe('updateLightUniforms', () => {
    it('should update uNumLights based on lights array length', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [createTestLight('1'), createTestLight('2')]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uNumLights.value).toBe(2)
    })

    it('should cap uNumLights at MAX_LIGHTS', () => {
      const uniforms = createLightUniforms()
      const lights = Array(10)
        .fill(null)
        .map((_, i) => createTestLight(String(i)))

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uNumLights.value).toBe(MAX_LIGHTS)
    })

    it('should set enabled state for each light', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [
        { ...createTestLight('1'), enabled: true },
        { ...createTestLight('2'), enabled: false },
      ]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uLightsEnabled.value[0]).toBe(true)
      expect(uniforms.uLightsEnabled.value[1]).toBe(false)
    })

    it('should set light types correctly', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [
        { ...createTestLight('1'), type: 'point' },
        { ...createTestLight('2'), type: 'directional' },
        { ...createTestLight('3'), type: 'spot' },
      ]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uLightTypes.value[0]).toBe(0) // point
      expect(uniforms.uLightTypes.value[1]).toBe(1) // directional
      expect(uniforms.uLightTypes.value[2]).toBe(2) // spot
    })

    it('should update positions', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), position: [1, 2, 3] }]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uLightPositions.value[0]!.x).toBe(1)
      expect(uniforms.uLightPositions.value[0]!.y).toBe(2)
      expect(uniforms.uLightPositions.value[0]!.z).toBe(3)
    })

    it('should update colors', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), color: '#FF0000' }]

      updateLightUniforms(uniforms, lights)

      const color = uniforms.uLightColors.value[0]!
      expect(color.r).toBe(1)
      expect(color.g).toBe(0)
      expect(color.b).toBe(0)
    })

    it('should update intensities', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), intensity: 2.5 }]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uLightIntensities.value[0]).toBe(2.5)
    })

    it('should convert cone angle from degrees to radians', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [
        { ...createTestLight('1'), coneAngle: 90 }, // 90 degrees
      ]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uSpotAngles.value[0]).toBeCloseTo(Math.PI / 2, 5)
    })

    it('should update penumbra values', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), penumbra: 0.7 }]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uSpotPenumbras.value[0]).toBe(0.7)
    })

    it('should precompute spotlight cone cosines correctly', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), coneAngle: 60, penumbra: 0.5 }]

      updateLightUniforms(uniforms, lights)

      // outer angle = 60°, inner angle = 60° * (1 - 0.5) = 30°
      const expectedCosOuter = Math.cos((60 * Math.PI) / 180) // cos(60°) = 0.5
      const expectedCosInner = Math.cos((30 * Math.PI) / 180) // cos(30°) ≈ 0.866

      expect(uniforms.uSpotCosOuter.value[0]).toBeCloseTo(expectedCosOuter, 5)
      expect(uniforms.uSpotCosInner.value[0]).toBeCloseTo(expectedCosInner, 5)
    })

    it('should update range and decay values', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), range: 50, decay: 1 }]

      updateLightUniforms(uniforms, lights)

      expect(uniforms.uLightRanges.value[0]).toBe(50)
      expect(uniforms.uLightDecays.value[0]).toBe(1)
    })

    it('should handle penumbra=0 (hard edge spotlight)', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), coneAngle: 45, penumbra: 0 }]

      updateLightUniforms(uniforms, lights)

      // With penumbra=0, inner angle = outer angle = 45°
      const expectedCos = Math.cos((45 * Math.PI) / 180) // cos(45°) ≈ 0.707

      expect(uniforms.uSpotCosOuter.value[0]).toBeCloseTo(expectedCos, 5)
      expect(uniforms.uSpotCosInner.value[0]).toBeCloseTo(expectedCos, 5)
    })

    it('should handle penumbra=1 (fully soft spotlight)', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [{ ...createTestLight('1'), coneAngle: 90, penumbra: 1 }]

      updateLightUniforms(uniforms, lights)

      // With penumbra=1, inner angle = 0° (cos=1), outer angle = 90° (cos=0)
      expect(uniforms.uSpotCosOuter.value[0]).toBeCloseTo(0, 5)
      expect(uniforms.uSpotCosInner.value[0]).toBeCloseTo(1, 5)
    })

    it('should disable unused light slots', () => {
      const uniforms = createLightUniforms()
      // First add 3 lights
      const threeLights = [createTestLight('1'), createTestLight('2'), createTestLight('3')]
      updateLightUniforms(uniforms, threeLights)

      // Then update with only 1 light
      const oneLight = [createTestLight('1')]
      updateLightUniforms(uniforms, oneLight)

      expect(uniforms.uNumLights.value).toBe(1)
      expect(uniforms.uLightsEnabled.value[0]).toBe(true)
      expect(uniforms.uLightsEnabled.value[1]).toBe(false)
      expect(uniforms.uLightsEnabled.value[2]).toBe(false)
    })

    it('should calculate direction from rotation', () => {
      const uniforms = createLightUniforms()
      const lights: LightSource[] = [
        { ...createTestLight('1'), rotation: [0, 0, 0] }, // Forward (-Z)
      ]

      updateLightUniforms(uniforms, lights)

      const dir = uniforms.uLightDirections.value[0]!
      expect(dir.x).toBeCloseTo(0, 5)
      expect(dir.y).toBeCloseTo(0, 5)
      expect(dir.z).toBeCloseTo(-1, 5)
    })
  })

  describe('mergeLightUniforms', () => {
    it('should merge light uniforms with existing uniforms', () => {
      const existing = {
        uTime: { value: 1.0 },
        uResolution: { value: new Vector3(800, 600, 1) },
      }

      const merged = mergeLightUniforms(existing)

      expect(merged.uTime.value).toBe(1.0)
      expect(merged.uResolution.value).toBeInstanceOf(Vector3)
      expect(merged).toHaveProperty('uNumLights')
      expect(merged).toHaveProperty('uLightsEnabled')
    })

    it('should preserve existing uniform types', () => {
      const existing = {
        customUniform: { value: 'test' },
      }

      const merged = mergeLightUniforms(existing)

      expect(merged.customUniform.value).toBe('test')
    })
  })

  describe('GLSL generation functions', () => {
    describe('getLightUniformDeclarations', () => {
      it('should include MAX_LIGHTS definition', () => {
        const glsl = getLightUniformDeclarations()
        expect(glsl).toContain(`#define MAX_LIGHTS ${MAX_LIGHTS}`)
      })

      it('should include light type constants', () => {
        const glsl = getLightUniformDeclarations()
        expect(glsl).toContain('#define LIGHT_TYPE_POINT 0')
        expect(glsl).toContain('#define LIGHT_TYPE_DIRECTIONAL 1')
        expect(glsl).toContain('#define LIGHT_TYPE_SPOT 2')
      })

      it('should include all uniform declarations', () => {
        const glsl = getLightUniformDeclarations()
        expect(glsl).toContain('uniform int uNumLights')
        expect(glsl).toContain('uniform bool uLightsEnabled[MAX_LIGHTS]')
        expect(glsl).toContain('uniform int uLightTypes[MAX_LIGHTS]')
        expect(glsl).toContain('uniform vec3 uLightPositions[MAX_LIGHTS]')
        expect(glsl).toContain('uniform vec3 uLightDirections[MAX_LIGHTS]')
        expect(glsl).toContain('uniform vec3 uLightColors[MAX_LIGHTS]')
        expect(glsl).toContain('uniform float uLightIntensities[MAX_LIGHTS]')
        expect(glsl).toContain('uniform float uSpotAngles[MAX_LIGHTS]')
        expect(glsl).toContain('uniform float uSpotPenumbras[MAX_LIGHTS]')
        expect(glsl).toContain('uniform float uSpotCosInner[MAX_LIGHTS]')
        expect(glsl).toContain('uniform float uSpotCosOuter[MAX_LIGHTS]')
      })
    })

    // Note: getLightHelperFunctions and getMultiLightFunction tests removed.
    // These functions were superseded by multi-light.glsl.ts with GGX/Cook-Torrance lighting.
  })
})

// Helper function to create test lights
function createTestLight(id: string): LightSource {
  return {
    id,
    name: `Test Light ${id}`,
    type: 'point',
    enabled: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    color: '#FFFFFF',
    intensity: 1.0,
    coneAngle: 30,
    penumbra: 0.5,
    range: 0,
    decay: 2,
  }
}
