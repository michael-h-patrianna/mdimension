/**
 * Screen-Space Refraction TSL Node
 *
 * TSL port of RefractionShader for WebGPU/WebGL compatibility.
 * Distorts the image based on surface normals to simulate refraction.
 *
 * Algorithm:
 * 1. Sample normal from G-buffer (or reconstruct from depth)
 * 2. Calculate UV offset based on normal and Index of Refraction (IOR)
 * 3. Optional: chromatic aberration (sample R/G/B at different offsets)
 * 4. Sample color at offset UV
 *
 * Physical basis:
 * - Normal deviation from camera-facing direction causes light to bend
 * - IOR determines the amount of bending (Snell's law approximation)
 * - Chromatic aberration simulates wavelength-dependent refraction
 *
 * @module rendering/tsl/postprocessing/refractionTSL
 */

import {
  Fn,
  float,
  max,
  screenUV,
  vec2,
  vec3,
  vec4,
  type Node,
  type TextureNode,
} from 'three/tsl'

/**
 * Get view-space position from UV and depth.
 *
 * Reconstructs the 3D position in view space from screen coordinates
 * and the inverse projection matrix.
 *
 * @param uv - Screen UV coordinates (0-1)
 * @param depth - Raw depth buffer value (0-1)
 * @param invProjMatrix - Inverse projection matrix
 * @returns View-space position (vec3)
 */
const getViewPosition = Fn(
  ([uv, depth, invProjMatrix]: [Node, Node, Node]) => {
    // Convert UV and depth to clip space (-1 to 1)
    const clipPos = vec4(
      uv.x.mul(2).sub(1),
      uv.y.mul(2).sub(1),
      depth.mul(2).sub(1),
      float(1)
    )

    // Transform by inverse projection matrix
    // Note: TSL matrices use row-major multiplication
    const x = clipPos.dot(
      vec4(
        invProjMatrix.element(0),
        invProjMatrix.element(1),
        invProjMatrix.element(2),
        invProjMatrix.element(3)
      )
    )
    const y = clipPos.dot(
      vec4(
        invProjMatrix.element(4),
        invProjMatrix.element(5),
        invProjMatrix.element(6),
        invProjMatrix.element(7)
      )
    )
    const z = clipPos.dot(
      vec4(
        invProjMatrix.element(8),
        invProjMatrix.element(9),
        invProjMatrix.element(10),
        invProjMatrix.element(11)
      )
    )
    const w = clipPos.dot(
      vec4(
        invProjMatrix.element(12),
        invProjMatrix.element(13),
        invProjMatrix.element(14),
        invProjMatrix.element(15)
      )
    )

    // Perspective divide (guard against w=0)
    const safeW = w.abs().max(0.0001)
    return vec3(x.div(safeW), y.div(safeW), z.div(safeW))
  }
)

/**
 * Reconstruct view-space normal from depth buffer.
 *
 * Uses neighboring depth samples to compute view-space positions,
 * then calculates the surface normal from the cross product of tangent vectors.
 * Employs central differences with depth discontinuity handling for accuracy.
 *
 * @param coord - UV coordinates
 * @param depthTexture - Depth texture
 * @param resolution - Screen resolution (width, height)
 * @param invProjMatrix - Inverse projection matrix
 * @returns View-space normal (vec3, normalized)
 */
const reconstructNormal = Fn(
  ([coord, depthTexture, resolution, invProjMatrix]: [Node, TextureNode, Node, Node]) => {
    const texelSize = vec2(float(1), float(1)).div(resolution)

    // Sample depth at center and neighboring pixels
    const depthC = depthTexture.sample(coord).x
    const depthL = depthTexture.sample(coord.sub(vec2(texelSize.x, float(0)))).x
    const depthR = depthTexture.sample(coord.add(vec2(texelSize.x, float(0)))).x
    const depthB = depthTexture.sample(coord.sub(vec2(float(0), texelSize.y))).x
    const depthT = depthTexture.sample(coord.add(vec2(float(0), texelSize.y))).x

    // Reconstruct view-space positions
    const posC = getViewPosition(coord, depthC, invProjMatrix)
    const posL = getViewPosition(coord.sub(vec2(texelSize.x, float(0))), depthL, invProjMatrix)
    const posR = getViewPosition(coord.add(vec2(texelSize.x, float(0))), depthR, invProjMatrix)
    const posB = getViewPosition(coord.sub(vec2(float(0), texelSize.y)), depthB, invProjMatrix)
    const posT = getViewPosition(coord.add(vec2(float(0), texelSize.y)), depthT, invProjMatrix)

    // Calculate tangent vectors using central differences
    // Use the smaller difference to avoid artifacts at depth discontinuities
    const rightDiff = posR.z.sub(posC.z).abs()
    const leftDiff = posC.z.sub(posL.z).abs()
    const ddx = rightDiff.lessThan(leftDiff).select(posR.sub(posC), posC.sub(posL))

    const topDiff = posT.z.sub(posC.z).abs()
    const bottomDiff = posC.z.sub(posB.z).abs()
    const ddy = topDiff.lessThan(bottomDiff).select(posT.sub(posC), posC.sub(posB))

    // Cross product gives surface normal
    // cross(ddy, ddx) = +Z toward camera for camera-facing surfaces
    const crossProd = ddy.cross(ddx)
    const crossLen = crossProd.length()

    // Normalize (guard against zero length)
    // CRITICAL: Guard division BEFORE select() - GPU evaluates both branches
    const safeCrossLen = max(crossLen, float(0.0001))
    return crossLen.greaterThan(0.0001).select(crossProd.div(safeCrossLen), vec3(0, 0, 1))
  }
)

/**
 * Get normal from G-buffer with fallback to depth reconstruction.
 *
 * Decodes normal from G-buffer (encoded as RGB = normal * 0.5 + 0.5).
 * Falls back to depth-based reconstruction if normal buffer is invalid.
 *
 * @param coord - UV coordinates
 * @param normalTexture - Normal G-buffer texture
 * @param depthTexture - Depth texture (for fallback reconstruction)
 * @param resolution - Screen resolution
 * @param invProjMatrix - Inverse projection matrix
 * @returns View-space normal (vec3, normalized)
 */
const getNormal = Fn(
  ([coord, normalTexture, depthTexture, resolution, invProjMatrix]: [
    Node,
    TextureNode,
    TextureNode,
    Node,
    Node,
  ]) => {
    const normalData = normalTexture.sample(coord)

    // Check if we have valid normal data (non-zero length)
    const normalRgbLen = normalData.xyz.length()
    const hasValidNormal = normalRgbLen.greaterThan(0.01)

    // Decode from G-buffer: RGB = normal * 0.5 + 0.5 → normal = RGB * 2 - 1
    const decoded = normalData.xyz.mul(2).sub(1)
    const decodedLen = decoded.length()
    // CRITICAL: Guard division BEFORE select() - GPU evaluates both branches
    const safeDecodedLen = max(decodedLen, float(0.0001))
    const decodedNormal = decodedLen.greaterThan(0.0001).select(decoded.div(safeDecodedLen), vec3(0, 0, 1))

    // Fallback: reconstruct from depth
    const reconstructedNormal = reconstructNormal(coord, depthTexture, resolution, invProjMatrix)

    // Use G-buffer normal if valid, otherwise reconstructed
    return hasValidNormal.select(decodedNormal, reconstructedNormal)
  }
)

/**
 * Check if pixel has valid G-buffer data (not background).
 *
 * @param coord - UV coordinates
 * @param depthTexture - Depth texture
 * @returns Boolean node (true if valid geometry)
 */
const hasGBufferData = Fn(([coord, depthTexture]: [Node, TextureNode]) => {
  const depth = depthTexture.sample(coord).x
  return depth.lessThan(0.9999)
})

/**
 * Creates a screen-space refraction node.
 *
 * Applies refraction distortion to the scene based on surface normals.
 * Supports optional chromatic aberration for physically-based dispersion.
 *
 * @param colorTexture - Scene color texture to distort
 * @param normalTexture - Normal G-buffer texture
 * @param depthTexture - Depth texture
 * @param invProjMatrix - Inverse projection matrix uniform
 * @param resolution - Screen resolution as vec2 (width, height)
 * @param ior - Index of Refraction (typical: 1.33 for water, 1.5 for glass)
 * @param strength - Distortion strength (typical: 0.05-0.2)
 * @param chromaticAberration - Chromatic aberration amount (0 = none, 0.1 = subtle)
 * @returns TSL node with refracted color (vec4)
 */
export const createRefractionNode = (
  colorTexture: TextureNode,
  normalTexture: TextureNode,
  depthTexture: TextureNode,
  invProjMatrix: Node,
  resolution: Node,
  ior: Node,
  strength: Node,
  chromaticAberration: Node
): Node => {
  return Fn(() => {
    // Check for valid G-buffer data (skip background pixels)
    const hasData = hasGBufferData(screenUV, depthTexture)

    // Get surface normal
    const normal = getNormal(screenUV, normalTexture, depthTexture, resolution, invProjMatrix)

    // Calculate refraction offset based on normal deviation from camera-facing
    // Normal facing camera = (0, 0, 1) in view space, deviation causes distortion
    const normalXY = vec2(normal.x, normal.y)

    // IOR affects the amount of bending
    // IOR > 1 means light bends toward the normal when entering the material
    const iorEffect = ior.sub(1).mul(2)

    // Base offset from normal
    const baseOffset = normalXY.mul(strength).mul(iorEffect)

    // Adjust for aspect ratio
    const aspectRatio = resolution.y.div(resolution.x)
    const offset = vec2(baseOffset.x.mul(aspectRatio), baseOffset.y)

    // Chromatic aberration: sample R, G, B at different offsets
    // Red bends less, blue bends more (matches real-world dispersion)
    const caOffset = chromaticAberration.mul(0.3)

    const offsetR = offset.mul(float(1).sub(caOffset))
    const offsetG = offset
    const offsetB = offset.mul(float(1).add(caOffset))

    // Calculate refracted UVs (clamped to prevent sampling outside texture)
    const uvR = screenUV.add(offsetR).clamp(0, 1)
    const uvG = screenUV.add(offsetG).clamp(0, 1)
    const uvB = screenUV.add(offsetB).clamp(0, 1)

    // Sample each channel at its offset UV
    const r = colorTexture.sample(uvR).x
    const g = colorTexture.sample(uvG).y
    const b = colorTexture.sample(uvB).z

    // Combine into final color
    const refractedColor = vec4(r, g, b, float(1))

    // Original color (for background fallback)
    const originalColor = colorTexture.sample(screenUV)

    // Return refracted color if valid G-buffer data, otherwise original
    return hasData.select(refractedColor, originalColor)
  })()
}

/**
 * Creates a simplified refraction node without chromatic aberration.
 *
 * More efficient when dispersion effect is not needed.
 *
 * @param colorTexture - Scene color texture to distort
 * @param normalTexture - Normal G-buffer texture
 * @param depthTexture - Depth texture
 * @param invProjMatrix - Inverse projection matrix uniform
 * @param resolution - Screen resolution as vec2 (width, height)
 * @param ior - Index of Refraction
 * @param strength - Distortion strength
 * @returns TSL node with refracted color (vec4)
 */
export const createRefractionNodeSimple = (
  colorTexture: TextureNode,
  normalTexture: TextureNode,
  depthTexture: TextureNode,
  invProjMatrix: Node,
  resolution: Node,
  ior: Node,
  strength: Node
): Node => {
  return Fn(() => {
    // Check for valid G-buffer data
    const hasData = hasGBufferData(screenUV, depthTexture)

    // Get surface normal
    const normal = getNormal(screenUV, normalTexture, depthTexture, resolution, invProjMatrix)

    // Calculate refraction offset
    const normalXY = vec2(normal.x, normal.y)
    const iorEffect = ior.sub(1).mul(2)
    const baseOffset = normalXY.mul(strength).mul(iorEffect)

    // Adjust for aspect ratio
    const aspectRatio = resolution.y.div(resolution.x)
    const offset = vec2(baseOffset.x.mul(aspectRatio), baseOffset.y)

    // Calculate refracted UV (clamped)
    const refractedUV = screenUV.add(offset).clamp(0, 1)

    // Sample at offset
    const refractedColor = colorTexture.sample(refractedUV)
    const originalColor = colorTexture.sample(screenUV)

    // Return refracted color if valid G-buffer data
    return hasData.select(refractedColor, originalColor)
  })()
}

/**
 * Creates a pure normal-based distortion node.
 *
 * Simpler version that only uses normal buffer for distortion,
 * without depth-based normal reconstruction fallback.
 * Useful when normal buffer is guaranteed to be valid.
 *
 * @param colorTexture - Scene color texture to distort
 * @param normalTexture - Normal G-buffer texture
 * @param resolution - Screen resolution as vec2 (width, height)
 * @param strength - Distortion strength
 * @returns TSL node with distorted color (vec4)
 */
export const createNormalDistortionNode = (
  colorTexture: TextureNode,
  normalTexture: TextureNode,
  resolution: Node,
  strength: Node
): Node => {
  return Fn(() => {
    // Sample and decode normal
    const normalData = normalTexture.sample(screenUV)
    const normal = normalData.xyz.mul(2).sub(1)

    // Calculate distortion offset from normal XY
    const baseOffset = vec2(normal.x, normal.y).mul(strength)

    // Adjust for aspect ratio
    const aspectRatio = resolution.y.div(resolution.x)
    const offset = vec2(baseOffset.x.mul(aspectRatio), baseOffset.y)

    // Sample at offset UV
    const distortedUV = screenUV.add(offset).clamp(0, 1)
    return colorTexture.sample(distortedUV)
  })()
}

