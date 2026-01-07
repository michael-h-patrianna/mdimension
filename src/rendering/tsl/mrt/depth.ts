/**
 * Shared Clip-Space Depth Calculation
 *
 * Provides consistent depth calculation for both raymarched and mesh objects.
 * This ensures depthNode works correctly for WebGPU/TSL materials.
 *
 * CRITICAL: WebGPU vs WebGL NDC z-range difference:
 * - WebGL:  NDC z is [-1, 1], requires `z * 0.5 + 0.5` to map to [0, 1] depth buffer
 * - WebGPU: NDC z is [0, 1], NO conversion needed - z/w is already in [0, 1]
 *
 * Three.js r182+ handles this difference internally through the projection matrix.
 * For TSL depthNode, we use z/w directly since WebGPU projection outputs [0, 1] z.
 *
 * @module rendering/tsl/mrt/depth
 */

import { float, abs, clamp } from 'three/tsl'
import type { ShaderNodeObject, Node } from 'three/tsl'
import type { MRTDepthUniforms } from './types'

/**
 * Compute clip-space depth from world position.
 *
 * For WebGPU/TSL materials, the projection matrix already outputs NDC z in [0, 1] range.
 * This function returns the perspective-divided z directly, clamped to [0, 1].
 *
 * NOTE: This differs from WebGL's gl_FragDepth which requires `z * 0.5 + 0.5`.
 * The WebGL shader code has that conversion, but TSL materials run on WebGPU
 * where the projection matrix convention is different.
 *
 * Includes guards against near-zero clipPos.w to prevent division issues.
 *
 * @param uniforms - View and projection matrices
 * @param worldPos - World-space position as vec4 (w=1 for points)
 * @returns Clip-space depth in [0,1] range
 */
export function computeClipDepth(
  uniforms: MRTDepthUniforms,
  worldPos: ShaderNodeObject<Node>
): ShaderNodeObject<Node> {
  const clipPos = uniforms.uProjectionMatrix.mul(uniforms.uViewMatrix.mul(worldPos))

  // Guard against near-zero w (perspective division singularity)
  // Use small epsilon with correct sign to avoid flipping
  const clipW = abs(clipPos.w).lessThan(0.0001).select(
    clipPos.w.greaterThanEqual(0).select(float(0.0001), float(-0.0001)),
    clipPos.w
  )

  // WebGPU: NDC z is already in [0,1] - use z/w directly (no conversion needed)
  // The projection matrix in Three.js WebGPU mode outputs z in [0,1] range
  return clamp(clipPos.z.div(clipW), float(0), float(1))
}
