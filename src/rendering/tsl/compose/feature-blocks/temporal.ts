/**
 * TSL Temporal Reprojection Feature Block
 *
 * Position-based temporal reprojection for raymarching acceleration.
 * Uses previous frame's gPosition buffer to skip empty space during raymarching.
 *
 * Exact port of WebGL temporal.glsl.ts
 *
 * @module rendering/tsl/compose/feature-blocks/temporal
 */

import {
  dot,
  float,
  Fn,
  If,
  length,
  max,
  texture,
  uniform,
  vec2,
  viewportCoordinate,
} from 'three/tsl'
import * as THREE from 'three'
import type { UniformNode, Node } from 'three/tsl'

// TextureNode type derived from texture() return type
type TextureNode = ReturnType<typeof texture>

// Type aliases for TSL nodes
type FloatNode = ReturnType<typeof float>
type Vec2Node = ReturnType<typeof vec2>
type Vec3Node = Node

/**
 * Uniforms required for temporal reprojection.
 * Matches WebGL uniforms from uniforms.glsl.ts
 *
 * NOTE: Uses texture() pattern for uPrevPositionTexture, matching
 * the shadow-uniforms.ts pattern where texture values can be updated
 * at runtime via node.value = textureInstance
 */
export interface TemporalUniforms {
  /** Previous frame's position texture (xyz=model-space pos, w=model-space ray distance) */
  uPrevPositionTexture: TextureNode
  /** Whether temporal reprojection is enabled and valid */
  uTemporalEnabled: UniformNode<boolean>
  /** Buffer resolution for UV calculation */
  uDepthBufferResolution: UniformNode<THREE.Vector2>
  /** Safety margin - how far back to step from temporal hint (0.95 = 5% back) */
  uTemporalSafetyMargin: UniformNode<number>
  /** Previous frame's view-projection matrix (for validation, not currently used in TSL) */
  uPrevViewProjectionMatrix?: UniformNode<THREE.Matrix4>
  /** Previous frame's inverse view-projection matrix (for validation, not currently used in TSL) */
  uPrevInverseViewProjectionMatrix?: UniformNode<THREE.Matrix4>
  /** Reference to the placeholder texture for cleanup */
  placeholderTexture: THREE.DataTexture
}

// Cached placeholder texture for temporal uniforms
let cachedPlaceholderTexture: THREE.DataTexture | null = null

/**
 * Get or create a placeholder texture for temporal uniforms.
 * Uses RGBA format for position data (xyz=position, w=distance).
 *
 * CRITICAL for WebGPU: Use size > 1x1 to avoid potential "Invalid PipelineLayout"
 * errors when bind group layouts are created. The actual temporal textures
 * come from MRT render targets at full resolution.
 */
function getPlaceholderTexture(): THREE.DataTexture {
  if (!cachedPlaceholderTexture) {
    // Use 4x4 RGBA texture with zeros (no valid temporal data)
    // Size > 1x1 for WebGPU bind group layout compatibility
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(0)

    cachedPlaceholderTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    cachedPlaceholderTexture.minFilter = THREE.LinearFilter
    cachedPlaceholderTexture.magFilter = THREE.LinearFilter
    cachedPlaceholderTexture.wrapS = THREE.ClampToEdgeWrapping
    cachedPlaceholderTexture.wrapT = THREE.ClampToEdgeWrapping
    cachedPlaceholderTexture.needsUpdate = true
  }
  return cachedPlaceholderTexture
}

/**
 * Create temporal reprojection uniforms.
 *
 * Creates all uniforms with proper defaults. The texture uniform uses
 * a placeholder that can be replaced at runtime.
 *
 * Usage in renderer:
 * ```ts
 * const temporalData = getTemporalUniforms()
 * if (temporalData?.uPrevPositionTexture) {
 *   (uniforms.temporal.uPrevPositionTexture as any).value = temporalData.uPrevPositionTexture
 *   uniforms.temporal.uTemporalEnabled.value = temporalData.uTemporalEnabled
 *   uniforms.temporal.uDepthBufferResolution.value.copy(temporalData.uDepthBufferResolution)
 * }
 * ```
 *
 * @returns Temporal uniform set matching WebGL
 */
export function createTemporalUniforms(): TemporalUniforms {
  const placeholder = getPlaceholderTexture()

  return {
    // TextureNode created with texture() - value can be updated at runtime
    uPrevPositionTexture: texture(placeholder),
    uTemporalEnabled: uniform(false),
    uDepthBufferResolution: uniform(new THREE.Vector2(1920, 1080)),
    uTemporalSafetyMargin: uniform(0.95), // WebGL default: 5% back
    uPrevViewProjectionMatrix: uniform(new THREE.Matrix4()),
    uPrevInverseViewProjectionMatrix: uniform(new THREE.Matrix4()),
    placeholderTexture: placeholder,
  }
}

/**
 * Create temporal depth hint calculation node.
 *
 * Algorithm (exact port of WebGL getTemporalDepth):
 * 1. Sample previous frame's gPosition at current screen UV
 * 2. Get model-space position + stored ray distance
 * 3. Project hit point onto CURRENT ray to calculate skip distance
 * 4. Validate point is on current ray (perpendicular distance check)
 * 5. Detect disocclusion via 4-neighbor sampling
 * 6. Return model-space ray distance, or -1 if invalid
 *
 * NOTE: Uses sequential If blocks instead of .Else() chains since TSL If
 * doesn't support .Else() method. Uses "valid" flag pattern for early exit.
 *
 * @param uniforms - Temporal uniforms
 * @returns TSL Fn that returns temporal depth hint (float, -1 if invalid)
 */
export const createGetTemporalDepthNode = (
  uniforms: TemporalUniforms
) => {
  return Fn(([ro, rd]: [Vec3Node, Vec3Node]) => {
    const result = float(-1).toVar('temporalDepth')
    const valid = float(1).toVar('valid')

    // WebGL: if (!uTemporalEnabled) return -1.0;
    // If temporal disabled, mark as invalid
    If(uniforms.uTemporalEnabled.not(), () => {
      valid.assign(0)
    })

    // Only proceed if still valid
    If(valid.greaterThan(0.5), () => {
      // CRITICAL: Use screen coordinates for sampling the previous frame's MRT
      // WebGL: vec2 screenUV = gl_FragCoord.xy / uDepthBufferResolution;
      // TSL: viewportCoordinate gives pixel coords (like gl_FragCoord.xy)
      const screenUV = viewportCoordinate.xy.div(uniforms.uDepthBufferResolution).toVar('screenUV')

      // Sample previous frame's position buffer at current screen position
      // WebGL: vec4 prevPositionData = texture(uPrevPositionTexture, screenUV);
      // gPosition.xyz = model-space position, gPosition.w = model-space ray distance
      const prevPositionData = uniforms.uPrevPositionTexture.sample(screenUV as Vec2Node)

      // Check if we have valid position data (.w > 0 indicates valid hit)
      // WebGL: float storedDist = prevPositionData.w;
      const storedDist = prevPositionData.w.toVar('storedDist')

      // WebGL: if (storedDist <= 0.01) return -1.0;
      If(storedDist.lessThanEqual(0.01), () => {
        valid.assign(0)
      })

      If(valid.greaterThan(0.5), () => {
        // Get the MODEL-SPACE position from previous frame
        // WebGL: vec3 prevModelPos = prevPositionData.xyz;
        const prevModelPos = prevPositionData.xyz.toVar('prevModelPos')

        // Calculate distance along CURRENT ray to the previous hit point
        // WebGL: vec3 toHit = prevModelPos - ro;
        // WebGL: float projDistance = dot(toHit, rd);
        const toHit = prevModelPos.sub(ro)
        const projDistance = dot(toHit, rd).toVar('projDistance')

        // Early rejection: point is behind the camera
        // WebGL: if (projDistance <= 0.0) return -1.0;
        If(projDistance.lessThanEqual(0), () => {
          valid.assign(0)
        })

        If(valid.greaterThan(0.5), () => {
          // Validation: Is the previous hit actually ON the current ray?
          // Calculate perpendicular distance from hit point to ray
          // WebGL: vec3 closestOnRay = ro + rd * projDistance;
          // WebGL: float perpDist = length(prevModelPos - closestOnRay);
          const closestOnRay = ro.add(rd.mul(projDistance))
          const perpDist = length(prevModelPos.sub(closestOnRay)).toVar('perpDist')

          // Reject if perpendicular distance is too large
          // WebGL: float threshold = max(0.1, projDistance * 0.05);
          const threshold = max(float(0.1), projDistance.mul(0.05))

          // WebGL: if (perpDist > threshold) return -1.0;
          If(perpDist.greaterThan(threshold), () => {
            valid.assign(0)
          })

          If(valid.greaterThan(0.5), () => {
            // Disocclusion detection: check for depth discontinuities
            // WebGL: vec2 texelSize = 1.0 / uDepthBufferResolution;
            const texelSize = vec2(1, 1).div(uniforms.uDepthBufferResolution)

            // Sample 4 neighbors
            // WebGL: float distLeft = texture(uPrevPositionTexture, screenUV - vec2(texelSize.x, 0.0)).w;
            const distLeft = uniforms.uPrevPositionTexture.sample(
              screenUV.sub(vec2(texelSize.x, 0)) as Vec2Node
            ).w
            const distRight = uniforms.uPrevPositionTexture.sample(
              screenUV.add(vec2(texelSize.x, 0)) as Vec2Node
            ).w
            const distUp = uniforms.uPrevPositionTexture.sample(
              screenUV.add(vec2(0, texelSize.y)) as Vec2Node
            ).w
            const distDown = uniforms.uPrevPositionTexture.sample(
              screenUV.sub(vec2(0, texelSize.y)) as Vec2Node
            ).w

            // Use relative threshold for discontinuity detection
            // WebGL: float avgDist = (distLeft + distRight + distUp + distDown) * 0.25;
            const avgDist = distLeft.add(distRight).add(distUp).add(distDown).mul(0.25)

            // WebGL: max of absolute differences
            const diffL = storedDist.sub(distLeft).abs()
            const diffR = storedDist.sub(distRight).abs()
            const diffU = storedDist.sub(distUp).abs()
            const diffD = storedDist.sub(distDown).abs()
            const maxNeighborDiff = max(max(diffL, diffR), max(diffU, diffD))

            // WebGL: float relativeThreshold = max(0.20 * avgDist, 0.05);
            const relativeThreshold = max(avgDist.mul(0.20), float(0.05))

            // WebGL: if (maxNeighborDiff > relativeThreshold) return -1.0;
            If(maxNeighborDiff.greaterThan(relativeThreshold), () => {
              valid.assign(0)
            })

            // If still valid, set result to stored distance
            If(valid.greaterThan(0.5), () => {
              // WebGL: return max(0.0, storedDist);
              result.assign(max(float(0), storedDist))
            })
          })
        })
      })
    })

    return result
  })
}

/**
 * Temporal depth result interface.
 * Matches WebGL RayMarch output: usedTemporal flag + potentially modified start distance.
 */
export interface TemporalDepthResult {
  /** Starting distance for raymarching (may be advanced by temporal hint) */
  startDist: FloatNode
  /** Whether temporal reprojection was used */
  usedTemporal: FloatNode
}

/**
 * Apply temporal depth hint to raymarching start distance.
 *
 * This is the integration point for raymarch-core.ts:
 * - Gets temporal depth hint
 * - If valid and closer than max distance, use it as start point
 * - Apply safety margin
 *
 * WebGL equivalent (from core.glsl.ts RayMarch):
 * ```glsl
 * #ifdef USE_TEMPORAL
 * float temporalDepth = getTemporalDepth(ro, rd, worldRayDir);
 * if (temporalDepth > 0.0 && temporalDepth < maxT) {
 *     dO = max(dO, temporalDepth * uTemporalSafetyMargin);
 *     usedTemporal = true;
 * }
 * #endif
 * ```
 *
 * @param uniforms - Temporal uniforms
 * @returns TSL Fn that takes (ro, rd, sphereEntry, maxT) and returns vec2(startDist, usedTemporal)
 */
export const createApplyTemporalHint = (
  uniforms: TemporalUniforms
) => {
  const getTemporalDepth = createGetTemporalDepthNode(uniforms)

  return Fn(([ro, rd, sphereEntry, maxT]: [Vec3Node, Vec3Node, FloatNode, FloatNode]) => {
    const startDist = float(sphereEntry).toVar('startDist')
    const usedTemporal = float(0).toVar('usedTemporal')

    // Get temporal depth hint
    const temporalDepth = getTemporalDepth(ro, rd)

    // Apply if valid and within range
    // WebGL: if (temporalDepth > 0.0 && temporalDepth < maxT)
    If(temporalDepth.greaterThan(0).and(temporalDepth.lessThan(maxT)), () => {
      // WebGL: dO = max(dO, temporalDepth * uTemporalSafetyMargin);
      startDist.assign(max(startDist, temporalDepth.mul(uniforms.uTemporalSafetyMargin)))
      usedTemporal.assign(1)
    })

    // Return as vec2 for easier unpacking (x=startDist, y=usedTemporal)
    return vec2(startDist, usedTemporal)
  })
}
