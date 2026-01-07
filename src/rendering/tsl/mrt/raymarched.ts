/**
 * MRT Helper for Raymarched Objects
 *
 * Provides utilities for SDF-based raymarched objects that compute
 * custom normals and hit positions from the SDF gradient.
 *
 * @module rendering/tsl/mrt/raymarched
 */

import { vec3, vec4, dot, sqrt } from 'three/tsl'
import type { MRTStorageNodes, MRTDepthUniforms, RaymarchedMRTParams } from './types'
import { computeClipDepth } from './depth'

/**
 * Update MRT storage nodes for a raymarched surface hit.
 *
 * Call inside Fn() after computing hit position and normal from SDF.
 * Handles:
 * - Local to world position transform
 * - Local to view normal transform (with normalization)
 * - Clip-space depth calculation
 *
 * @param storage - MRT storage nodes (created outside Fn())
 * @param uniforms - View/projection matrices for transforms
 * @param params - Hit position, normal, and hit flag
 *
 * @example
 * ```typescript
 * const mrtStorage = createMRTStorage() // Outside Fn()
 *
 * const shader = Fn(() => {
 *   // ... raymarch to get hit position and normal ...
 *
 *   If(hitFlag.greaterThan(0.5), () => {
 *     updateMRTRaymarched(mrtStorage, uniforms, {
 *       hitPosLocal: p,
 *       normalLocal: n,
 *       hasHit: float(1),
 *     })
 *   })
 * })
 * ```
 */
export function updateMRTRaymarched(
  storage: MRTStorageNodes,
  uniforms: MRTDepthUniforms,
  params: RaymarchedMRTParams
): void {
  const { hitPosLocal, normalLocal, hasHit } = params

  // Transform local position to world space
  const worldHitPos = uniforms.uModelMatrix.mul(vec4(hitPosLocal, 1.0))
  storage.mrtWorldPos.assign(worldHitPos.xyz)
  storage.mrtHasHit.assign(hasHit)

  // Transform normal: local -> view (single step transform)
  // WebGL pattern: vec3 viewNormalRaw = (uViewMatrix * vec4(n, 0.0)).xyz;
  // Note: For raymarched fractals, we skip model matrix for normal since
  // the normal is already in the correct orientation from the SDF gradient.
  // This matches the WebGL fractal shader behavior.
  const viewNormalRaw = uniforms.uViewMatrix.mul(vec4(normalLocal, 0.0)).xyz

  // Safe normalization (guard against zero-length)
  const vnLen = sqrt(dot(viewNormalRaw, viewNormalRaw))
  const viewNormal = vnLen.greaterThan(0.0001).select(
    viewNormalRaw.div(vnLen),
    vec3(0, 0, 1)
  )
  storage.mrtNormalView.assign(viewNormal)

  // Compute clip-space depth
  storage.mrtClipDepth.assign(computeClipDepth(uniforms, worldHitPos))
}

/**
 * Set MRT storage to background/miss values.
 *
 * Call for pixels where the ray missed the surface.
 * Sets normal to (0,0,1), hit flag to 0, depth to far plane.
 *
 * @param storage - MRT storage nodes
 */
export function setMRTMiss(storage: MRTStorageNodes): void {
  storage.mrtNormalView.assign(vec3(0, 0, 1))
  storage.mrtHasHit.assign(0)
  storage.mrtClipDepth.assign(1) // Far plane
  storage.mrtWorldPos.assign(vec3(0, 0, 0))
}
