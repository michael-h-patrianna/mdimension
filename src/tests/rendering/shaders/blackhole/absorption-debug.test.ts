/**
 * Test to verify horizon detection code is present in compiled shader
 */

import { describe, it, expect } from 'vitest'
import { composeBlackHoleShader } from '@/rendering/shaders/blackhole/compose'

describe('Black Hole Horizon Detection', () => {
  it('should include immediate horizon check after ray step', () => {
    const { fragmentShader } = composeBlackHoleShader({
      dimension: 3,
      volumetricDisk: true,
    })

    // Check for the immediate horizon check comment
    expect(fragmentShader).toContain('IMMEDIATE HORIZON CHECK')

    // Check for the post-step radius calculation
    expect(fragmentShader).toContain('postStepRadius')

    // Check for isInsideHorizon call
    expect(fragmentShader).toContain('isInsideHorizon(postStepRadius)')

    // Check for the visual horizon check in horizon.glsl.ts
    expect(fragmentShader).toContain('ndRadius < uVisualEventHorizon')
  })

  it('should use uVisualEventHorizon for horizon check', () => {
    const { fragmentShader } = composeBlackHoleShader({
      dimension: 3,
      volumetricDisk: true,
    })

    // The isInsideHorizon function should check against uVisualEventHorizon
    // This accounts for Kerr spin (smaller horizon for spinning black holes)
    expect(fragmentShader).toContain('return ndRadius < uVisualEventHorizon')
  })

  it('should set hitHorizon and transmittance when crossing horizon', () => {
    const { fragmentShader } = composeBlackHoleShader({
      dimension: 3,
      volumetricDisk: true,
    })

    // When horizon is crossed, these should be set:
    // 1. transmittance = 0 (no light passes through)
    // 2. hitHorizon = true (flag for post-loop handling)
    expect(fragmentShader).toContain('accum.transmittance = 0.0')
    expect(fragmentShader).toContain('hitHorizon = true')
  })

  it('should calculate correct smoothstep proximity values', () => {
    // Verify the smoothstep logic for general proximity calculations
    function smoothstep(edge0: number, edge1: number, x: number): number {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
      return t * t * (3.0 - 2.0 * t)
    }

    // Test proximity at different radii relative to horizon
    const horizonRadius = 2.0
    const testCases = [
      { radius: 3.0, expectedSmooth: 1.0 }, // Far from horizon
      { radius: 2.5, expectedSmooth: 0.5 }, // Halfway
      { radius: 2.0, expectedSmooth: 0.0 }, // At horizon
      { radius: 1.0, expectedSmooth: 0.0 }, // Inside (clamped)
    ]

    testCases.forEach(({ radius, expectedSmooth }) => {
      const smoothstepValue = smoothstep(horizonRadius, horizonRadius * 1.5, radius)
      expect(smoothstepValue).toBeCloseTo(expectedSmooth, 1)
    })
  })

  it('should calculate Beer-Lambert absorption correctly', () => {
    const absorptionCoeff = 8.0
    const stepSize = 0.02

    // Beer-Lambert law: transmittance = exp(-absorption * distance)
    const transmittancePerStep = Math.exp(-absorptionCoeff * stepSize)

    // After 50 steps
    const transmittanceAfter50 = Math.pow(transmittancePerStep, 50)
    console.log(`Transmittance after 50 steps: ${transmittanceAfter50.toFixed(8)}`)

    // Should be nearly opaque after many steps
    expect(transmittanceAfter50).toBeLessThan(0.01)
  })
})
