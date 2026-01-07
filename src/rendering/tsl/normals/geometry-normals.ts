/**
 * TSL Geometry-Based Normal Computation
 *
 * For dimensions < SCREEN_SPACE_NORMAL_MIN_DIMENSION (default 7),
 * normals are computed from triangle geometry after N-D transformation.
 *
 * This requires all 3 triangle vertices to be transformed through
 * the N-D pipeline in the vertex shader.
 *
 * 100% parity with WebGL transform-nd.glsl.ts computeFaceNormal()
 *
 * @module rendering/tsl/normals/geometry-normals
 */

import { cross, dot, float, Fn, length, max, vec3 } from 'three/tsl'
import { safeNormalize3, safeNormalizeUp } from '../utils/safe-math'

// Type aliases
type Vec3Node = ReturnType<typeof vec3>

/**
 * Compute face normal from 3 triangle vertices.
 * Exact port of WebGL computeFaceNormal()
 *
 * Note: In TSL/WebGPU, this would typically be done in the vertex shader
 * and passed via a flat varying. This function provides the algorithm
 * for reference and for custom material implementations.
 *
 * @returns TSL Fn that computes face normal from 3 vertex positions
 */
export const computeFaceNormal = Fn(([v0, v1, v2]: [Vec3Node, Vec3Node, Vec3Node]) => {
  // Compute edges
  const edge1 = v1.sub(v0)
  const edge2 = v2.sub(v0)

  // Cross product gives face normal
  const rawNormal = cross(edge1, edge2)
  const normalLen = length(rawNormal)

  // Guard against degenerate triangles (zero-area)
  const safeNormal = rawNormal.div(max(normalLen, float(0.0001)))
  const fallback = vec3(0, 0, 1)

  return normalLen.greaterThan(0.0001).select(safeNormal, fallback)
})

/**
 * Compute vertex normal by averaging adjacent face normals.
 * This creates smooth normals for curved surfaces.
 *
 * For polytopes, we typically use flat face normals instead,
 * but this is available for smooth mesh rendering.
 *
 * @param faceNormals - Array of adjacent face normals
 * @returns Averaged and normalized vertex normal
 */
export const computeVertexNormal = Fn(([n0, n1, n2, n3]: [Vec3Node, Vec3Node, Vec3Node, Vec3Node]) => {
  // Average the adjacent face normals
  // CRITICAL: Use safe normalize - normals could cancel if opposite
  const sum = n0.add(n1).add(n2).add(n3)
  return safeNormalizeUp(sum)
})

/**
 * Flip normal to face the viewer for two-sided lighting.
 * Exact port of WebGL two-sided lighting logic.
 *
 * @returns TSL Fn that returns normal facing viewer
 */
export const ensureNormalFacingViewer = Fn(([normal, _viewDir, isFrontFace]: [Vec3Node, Vec3Node, ReturnType<typeof float>]) => {
  // Note: viewDir could be used for NdotV checks but we use gl_FrontFacing instead
  // Flip if back-facing (considering gl_FrontFacing)
  return isFrontFace.greaterThan(0.5).select(normal, normal.negate())
})

/**
 * Transform normal from model space to world space.
 * Uses the inverse-transpose of the model matrix for correct scaling.
 *
 * For uniform scaling, this simplifies to just applying the rotation part.
 *
 * Note: In TSL materials, use normalMatrix or mat3(modelMatrix) for this.
 *
 * @param normal - Normal in model space
 * @param normalMatrix - The 3x3 normal matrix (inverse-transpose of upper-left 3x3 of model matrix)
 * @returns Normal in world space
 */
export const transformNormalToWorld = Fn(([normal, _normalMatrix]: [Vec3Node, Vec3Node]) => {
  // Transform normal using the normal matrix (inverse-transpose of model matrix)
  // For non-uniform scaling, this is essential for correct normals
  // normalMatrix is typically passed as 3 vec3 columns
  // In TSL, we use normalWorld from the material which handles this automatically
  //
  // Manual implementation would be:
  // const transformedNormal = vec3(
  //   dot(normal, normalMatrixCol0),
  //   dot(normal, normalMatrixCol1),
  //   dot(normal, normalMatrixCol2)
  // )
  //
  // For now, we normalize the input which works for uniform scaling
  // Full implementation should use Three.js normalMatrix built-in
  // CRITICAL: Use safe normalize - input normal could be degenerate
  return safeNormalizeUp(normal)
})

/**
 * Transform normal using a 3x3 rotation matrix (mat3)
 * For use when you have the upper-left 3x3 of the model matrix
 *
 * @param normal - Normal in model space
 * @param m0 - First column of rotation matrix
 * @param m1 - Second column of rotation matrix
 * @param m2 - Third column of rotation matrix
 * @returns Normal in world space (for uniform scaling)
 */
export const transformNormalByMat3 = Fn(
  ([normal, m0, m1, m2]: [Vec3Node, Vec3Node, Vec3Node, Vec3Node]) => {
    // Matrix-vector multiplication: M * n
    const x = dot(vec3(m0.x, m1.x, m2.x), normal)
    const y = dot(vec3(m0.y, m1.y, m2.y), normal)
    const z = dot(vec3(m0.z, m1.z, m2.z), normal)

    // CRITICAL: Use safe normalize - matrix could have zero scale
    return safeNormalize3(vec3(x, y, z), vec3(0, 0, 1))
  }
)
