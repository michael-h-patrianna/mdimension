/**
 * Depth Capture TSL Node
 *
 * TSL port of DepthCaptureShader for WebGPU/WebGL compatibility.
 * Copies depth from the scene's depth texture to a ray distance buffer
 * for use in temporal reprojection.
 *
 * Key features:
 * - Stores RAY DISTANCE, not view-space Z (critical for off-center pixels)
 * - Uses CONSERVATIVE MIN sampling when downsampling to prevent overshooting
 * - Supports half-resolution capture for performance
 *
 * Why ray distance matters:
 * - viewZ is distance along camera's Z axis
 * - rayDistance is distance along the actual ray direction
 * - For off-center pixels: rayDistance = viewZ / cos(angle)
 * - Using viewZ directly would cause systematic errors in ray marching
 *
 * @module rendering/tsl/postprocessing/depthCaptureTSL
 */

import {
  Fn,
  float,
  screenUV,
  vec2,
  vec4,
  type Node,
  type TextureNode,
} from 'three/tsl'

/**
 * Convert perspective depth buffer value to linear view-space Z.
 *
 * @param depth - Raw depth buffer value (0-1)
 * @param near - Near clip plane distance
 * @param far - Far clip plane distance
 * @returns Positive view-space Z distance (into screen)
 */
const perspectiveDepthToViewZ = Fn(([depth, near, far]: [Node, Node, Node]) => {
  // Standard perspective depth linearization
  // perspectiveDepthToViewZ returns negative Z, we want positive
  const numerator = near.mul(far)
  const denominator = far.sub(near).mul(depth).sub(far)
  return numerator.div(denominator).negate()
})

/**
 * Get the cosine of the angle between ray at UV and camera forward direction.
 *
 * For a perspective camera:
 * - Center of screen: cos(angle) = 1.0 (ray parallel to Z axis)
 * - Edge of screen: cos(angle) < 1.0 (ray angled outward)
 *
 * @param uv - Screen UV coordinates
 * @param invProjMatrix - Inverse projection matrix
 * @returns Cosine of angle (positive value)
 */
const getRayCosAngle = Fn(([uv, invProjMatrix]: [Node, Node]) => {
  // Convert UV to NDC
  const ndc = uv.mul(2).sub(1)

  // Unproject to view space (z = -1 is near plane)
  const nearPlane = vec4(ndc.x, ndc.y, float(-1), float(1))

  // Matrix-vector multiplication via element access
  const x = nearPlane.dot(
    vec4(
      invProjMatrix.element(0),
      invProjMatrix.element(1),
      invProjMatrix.element(2),
      invProjMatrix.element(3)
    )
  )
  const y = nearPlane.dot(
    vec4(
      invProjMatrix.element(4),
      invProjMatrix.element(5),
      invProjMatrix.element(6),
      invProjMatrix.element(7)
    )
  )
  const z = nearPlane.dot(
    vec4(
      invProjMatrix.element(8),
      invProjMatrix.element(9),
      invProjMatrix.element(10),
      invProjMatrix.element(11)
    )
  )
  const w = nearPlane.dot(
    vec4(
      invProjMatrix.element(12),
      invProjMatrix.element(13),
      invProjMatrix.element(14),
      invProjMatrix.element(15)
    )
  )

  // Perspective divide and normalize
  const safeW = w.abs().max(0.0001)
  const viewPos = vec4(x.div(safeW), y.div(safeW), z.div(safeW), float(1))
  const rayLen = viewPos.xyz.length()
  const rayDir = viewPos.xyz.div(rayLen.max(0.0001))

  // The z-component of normalized ray direction is the cosine
  return rayDir.z.abs()
})

/**
 * Creates a depth capture node for temporal reprojection.
 *
 * Converts depth buffer to ray distance with conservative MIN sampling
 * for half-resolution output. This ensures thin structures are preserved
 * during downsampling.
 *
 * @param depthTexture - Source depth texture
 * @param near - Near clip plane distance
 * @param far - Far clip plane distance
 * @param sourceResolution - Source resolution (for 2x2 sampling)
 * @param invProjMatrix - Inverse projection matrix
 * @returns Ray distance (vec4 with distance in R channel)
 */
export const createDepthCaptureNode = (
  depthTexture: TextureNode,
  near: Node,
  far: Node,
  sourceResolution: Node,
  invProjMatrix: Node
): Node => {
  return Fn(() => {
    // Calculate texel offset for 2x2 sampling
    const texelSize = vec2(float(1), float(1)).div(sourceResolution)
    const halfTexel = texelSize.mul(0.5)

    // Sample 2x2 grid centered on this output pixel
    const d00 = depthTexture.sample(screenUV.add(vec2(halfTexel.x.negate(), halfTexel.y.negate()))).x
    const d01 = depthTexture.sample(screenUV.add(vec2(halfTexel.x.negate(), halfTexel.y))).x
    const d10 = depthTexture.sample(screenUV.add(vec2(halfTexel.x, halfTexel.y.negate()))).x
    const d11 = depthTexture.sample(screenUV.add(vec2(halfTexel.x, halfTexel.y))).x

    // Take MINIMUM depth (closest surface) - conservative for ray marching
    const depth = d00.min(d01).min(d10).min(d11)

    // Convert to linear view-space Z
    const viewZ = perspectiveDepthToViewZ(depth, near, far)

    // Convert view-space Z to ray distance
    const cosAngle = getRayCosAngle(screenUV, invProjMatrix)
    const rayDistance = viewZ.div(cosAngle.max(0.001))

    // Store raw ray distance in R channel
    return vec4(rayDistance, float(0), float(0), float(1))
  })()
}

/**
 * Creates a simple depth capture node without downsampling.
 *
 * Single-sample version for when resolution matches or
 * conservative sampling is not needed.
 *
 * @param depthTexture - Source depth texture
 * @param near - Near clip plane distance
 * @param far - Far clip plane distance
 * @param invProjMatrix - Inverse projection matrix
 * @returns Ray distance (vec4 with distance in R channel)
 */
export const createDepthCaptureNodeSimple = (
  depthTexture: TextureNode,
  near: Node,
  far: Node,
  invProjMatrix: Node
): Node => {
  return Fn(() => {
    const depth = depthTexture.sample(screenUV).x
    const viewZ = perspectiveDepthToViewZ(depth, near, far)
    const cosAngle = getRayCosAngle(screenUV, invProjMatrix)
    const rayDistance = viewZ.div(cosAngle.max(0.001))

    return vec4(rayDistance, float(0), float(0), float(1))
  })()
}

