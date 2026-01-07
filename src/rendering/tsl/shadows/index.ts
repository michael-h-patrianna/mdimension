/**
 * TSL Shadow System
 *
 * Complete shadow map sampling for mesh-based objects.
 * Provides 100% parity with WebGL shadowMaps.glsl.ts implementation.
 *
 * @module rendering/tsl/shadows
 */

import { float, Fn, int, select, vec3 } from 'three/tsl'

import type { ShadowTSLUniforms } from './shadow-uniforms'
import { sampleDirectionalSpotShadow } from './shadow-sampling'
import { samplePointShadow } from './point-shadow'

// Re-export all shadow modules
export * from './shadow-uniforms'
export * from './shadow-sampling'
export * from './point-shadow'
export * from './shadow-precompute'
export * from './shadow-flat'

// Type aliases
type IntNode = ReturnType<typeof int>
type Vec3Node = ReturnType<typeof vec3>

// Light type constants (match WebGL)
const LIGHT_TYPE_POINT = 0
const LIGHT_TYPE_DIRECTIONAL = 1
// LIGHT_TYPE_SPOT = 2 - defined for reference, used via LIGHT_TYPE_DIRECTIONAL fallback

/**
 * Unified shadow sampling function
 * Matches WebGL getShadow() from shadowMaps.glsl.ts
 *
 * Dispatches to correct shadow type based on light type:
 * - Point lights: Use packed 2D cube shadow map
 * - Directional/Spot: Use 2D shadow map with matrix transform
 *
 * CRITICAL TSL PATTERN: Shadow sampler Fn() nodes are created OUTSIDE the
 * returned Fn() at material creation scope, then referenced inside via closure.
 * Creating them inside Fn() causes "Invalid PipelineLayout" WebGPU errors.
 *
 * @param uniforms - Shadow TSL uniforms
 * @param lightTypes - Array of light type values (from lighting uniforms)
 * @param lightPositions - Array of light position vec3 nodes
 * @returns TSL Fn that computes shadow factor (0=shadow, 1=lit)
 */
export const createUnifiedShadowNode = (
  uniforms: ShadowTSLUniforms,
  lightTypes: ReturnType<typeof int>[],
  lightPositions: ReturnType<typeof vec3>[]
) => {
  // CRITICAL: Create shadow samplers OUTSIDE Fn() at material creation scope
  // This follows the pattern documented in docs/tsl.md section "Complex Node Compositions"
  const pointShadowFn = samplePointShadow(uniforms, lightPositions)
  const dirSpotShadowFn = sampleDirectionalSpotShadow(uniforms)

  return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    // Check if this light casts shadows using vec4 components via select chain
    // NOTE: Using vec4.x/y/z/w instead of uniformArray.element() because
    // uniformArray.element() causes "Invalid PipelineLayout" errors in WebGPU
    const castsShadowValue = select(
      lightIndex.equal(0),
      uniforms.uLightCastsShadow.x,
      select(
        lightIndex.equal(1),
        uniforms.uLightCastsShadow.y,
        select(
          lightIndex.equal(2),
          uniforms.uLightCastsShadow.z,
          uniforms.uLightCastsShadow.w
        )
      )
    )
    const castsShadow = castsShadowValue.greaterThan(0.5)

    // Get light type by index
    const lightType = select(
      lightIndex.equal(0),
      lightTypes[0]!,
      select(
        lightIndex.equal(1),
        lightTypes[1]!,
        select(
          lightIndex.equal(2),
          lightTypes[2]!,
          select(lightIndex.equal(3), lightTypes[3]!, int(LIGHT_TYPE_DIRECTIONAL))
        )
      )
    )

    // Dispatch to correct shadow sampler (uses pre-created samplers via closure)
    const isPointLight = lightType.equal(LIGHT_TYPE_POINT)

    const shadowFactor = select(
      isPointLight,
      pointShadowFn(lightIndex, worldPos),
      dirSpotShadowFn(lightIndex, worldPos)
    )

    // Return 1.0 (fully lit) if light doesn't cast shadows
    return select(castsShadow, shadowFactor, float(1))
  })
}
