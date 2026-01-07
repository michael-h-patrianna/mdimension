/**
 * Screen-Space Lensing TSL Node
 *
 * TSL port of screenSpaceLensing shader for WebGPU/WebGL compatibility.
 * Hybrid lensing shader that uses screen-space distortion for nearby objects
 * and sky cubemap sampling for distant background.
 *
 * Features:
 * - Gravitational lensing with configurable falloff
 * - Chromatic aberration for realistic light dispersion
 * - Hybrid mode: screen-space for geometry, cubemap for sky
 * - Einstein ring brightness boost
 * - Depth-aware distortion strength
 *
 * @module rendering/tsl/postprocessing/screenSpaceLensingTSL
 */

import {
  Fn,
  float,
  screenUV,
  vec2,
  vec3,
  vec4,
  type Node,
  type TextureNode,
} from 'three/tsl'

/**
 * Compute radial distortion magnitude based on distance from center.
 * Uses gravitational lensing formula: deflection = strength / r^falloff
 *
 * @param r - Distance from center in UV space
 * @param intensity - Base lensing intensity
 * @param mass - Black hole mass (scaling factor)
 * @param distortionScale - Additional distortion scaling
 * @param falloff - Falloff exponent (higher = more concentrated near center)
 * @returns Deflection magnitude (clamped to 0.5)
 */
const lensingMagnitude = Fn(
  ([r, intensity, mass, distortionScale, falloff]: [Node, Node, Node, Node, Node]) => {
    const safeR = r.max(0.001)
    const strength = intensity.mul(mass).mul(distortionScale).mul(0.02)
    const deflection = strength.div(safeR.pow(falloff))
    return deflection.min(0.5)
  }
)

/**
 * Compute displacement vector for a UV coordinate.
 *
 * @param uv - Current UV coordinates
 * @param center - Black hole center in UV space
 * @param intensity - Lensing intensity
 * @param mass - Black hole mass
 * @param distortionScale - Distortion scale
 * @param falloff - Falloff exponent
 * @returns Displacement vector (vec2)
 */
const computeLensingDisplacement = Fn(
  ([uv, center, intensity, mass, distortionScale, falloff]: [
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
  ]) => {
    const toCenter = center.sub(uv)
    const r = toCenter.length()

    // Near center: no displacement
    const isNearCenter = r.lessThan(0.01)

    const dir = toCenter.div(r.max(0.001))
    const mag = lensingMagnitude(r, intensity, mass, distortionScale, falloff)

    return isNearCenter.select(vec2(0, 0), dir.mul(mag))
  }
)

/**
 * Reconstruct world ray direction from screen UV.
 * Exported for use in hybrid sky lensing mode.
 *
 * @param uv - Screen UV coordinates
 * @param invViewProj - Inverse view-projection matrix
 * @param cameraPosition - Camera position in world space
 * @returns Normalized world ray direction
 */
export const getWorldRayDirection = Fn(
  ([uv, invViewProj, cameraPosition]: [Node, Node, Node]) => {
    // Convert UV to NDC
    const ndc = uv.mul(2).sub(1)
    const farClip = vec4(ndc.x, ndc.y, float(1), float(1))

    // Transform by inverse view-projection
    // Note: TSL matrix multiplication uses element access
    const x = farClip.dot(
      vec4(
        invViewProj.element(0),
        invViewProj.element(1),
        invViewProj.element(2),
        invViewProj.element(3)
      )
    )
    const y = farClip.dot(
      vec4(
        invViewProj.element(4),
        invViewProj.element(5),
        invViewProj.element(6),
        invViewProj.element(7)
      )
    )
    const z = farClip.dot(
      vec4(
        invViewProj.element(8),
        invViewProj.element(9),
        invViewProj.element(10),
        invViewProj.element(11)
      )
    )
    const w = farClip.dot(
      vec4(
        invViewProj.element(12),
        invViewProj.element(13),
        invViewProj.element(14),
        invViewProj.element(15)
      )
    )

    // Perspective divide
    const worldPos = vec3(x, y, z).div(w.abs().max(0.0001))

    // Direction from camera to world position
    return worldPos.sub(cameraPosition).normalize()
  }
)

/**
 * Bend a 3D ray direction toward black hole center.
 * Exported for use in hybrid sky lensing mode with cubemap sampling.
 *
 * @param rayDir - Original ray direction
 * @param center2D - Black hole center in UV space
 * @param invViewProj - Inverse view-projection matrix
 * @param cameraPosition - Camera position
 * @param intensity - Lensing intensity
 * @param mass - Black hole mass
 * @param distortionScale - Distortion scale
 * @param falloff - Falloff exponent
 * @returns Bent ray direction
 */
export const bendRay3D = Fn(
  ([rayDir, center2D, invViewProj, cameraPosition, intensity, mass, distortionScale, falloff]: [
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
  ]) => {
    // Get center direction in world space
    const centerNDC = center2D.mul(2).sub(1)
    const centerClip = vec4(centerNDC.x, centerNDC.y, float(0), float(1))

    const cx = centerClip.dot(
      vec4(
        invViewProj.element(0),
        invViewProj.element(1),
        invViewProj.element(2),
        invViewProj.element(3)
      )
    )
    const cy = centerClip.dot(
      vec4(
        invViewProj.element(4),
        invViewProj.element(5),
        invViewProj.element(6),
        invViewProj.element(7)
      )
    )
    const cz = centerClip.dot(
      vec4(
        invViewProj.element(8),
        invViewProj.element(9),
        invViewProj.element(10),
        invViewProj.element(11)
      )
    )
    const cw = centerClip.dot(
      vec4(
        invViewProj.element(12),
        invViewProj.element(13),
        invViewProj.element(14),
        invViewProj.element(15)
      )
    )

    const centerWorld = vec3(cx, cy, cz).div(cw.abs().max(0.0001))
    const centerDir = centerWorld.sub(cameraPosition).normalize()

    // Compute deflection based on angle
    const cosAngle = rayDir.dot(centerDir)
    const angle = cosAngle.clamp(-1, 1).acos()

    const strength = intensity.mul(mass).mul(distortionScale).mul(0.02)
    const safeAngle = angle.max(0.001)
    const deflection = strength.mul(10).div(safeAngle.mul(10).pow(falloff)).min(0.5)

    // Blend toward center
    return rayDir.mix(centerDir, deflection).normalize()
  }
)

/**
 * Compute Einstein ring brightness boost.
 *
 * @param r - Distance from center
 * @param ringRadius - Radius of Einstein ring
 * @param ringWidth - Width of the ring glow
 * @returns Boost multiplier (1.0 = no boost)
 */
const einsteinRingBoost = Fn(([r, ringRadius, ringWidth]: [Node, Node, Node]) => {
  const diff = r.sub(ringRadius).abs()
  const safeWidth = ringWidth.max(0.001)
  const falloff = diff.mul(diff).div(safeWidth.mul(safeWidth).mul(2)).negate().exp()
  return float(1).add(falloff.mul(0.5))
})

/**
 * Linearize depth from depth buffer.
 *
 * @param depth - Raw depth buffer value
 * @param near - Near clip plane
 * @param far - Far clip plane
 * @returns Linear depth value
 */
const linearizeDepth = Fn(([depth, near, far]: [Node, Node, Node]) => {
  const z = depth.mul(2).sub(1)
  const denominator = far.add(near).sub(z.mul(far.sub(near)))
  return near.mul(far).mul(2).div(denominator.max(0.0001))
})

/**
 * Apply chromatic aberration to lensing.
 *
 * @param uv - Base UV coordinates
 * @param displacement - Lensing displacement
 * @param chromaticAberration - Chromatic aberration strength
 * @param colorTexture - Scene color texture
 * @returns Color with chromatic aberration (vec3)
 */
const applyLensingChromatic = Fn(
  ([uv, displacement, chromaticAberration, colorTexture]: [Node, Node, Node, TextureNode]) => {
    const rScale = float(1).sub(chromaticAberration.mul(0.02))
    const gScale = float(1)
    const bScale = float(1).add(chromaticAberration.mul(0.02))

    const r = colorTexture.sample(uv.add(displacement.mul(rScale))).x
    const g = colorTexture.sample(uv.add(displacement.mul(gScale))).y
    const b = colorTexture.sample(uv.add(displacement.mul(bScale))).z

    return vec3(r, g, b)
  }
)

/**
 * Creates a screen-space lensing node.
 *
 * Full-featured gravitational lensing with depth-aware distortion,
 * chromatic aberration, and Einstein ring boost.
 *
 * @param colorTexture - Scene color texture
 * @param depthTexture - Depth texture
 * @param blackHoleCenter - Black hole center in UV space (vec2)
 * @param horizonRadius - Visual horizon radius in UV space
 * @param intensity - Lensing intensity
 * @param mass - Black hole mass
 * @param distortionScale - Distortion scale factor
 * @param falloff - Falloff exponent
 * @param chromaticAberration - Chromatic aberration strength
 * @param near - Camera near clip
 * @param far - Camera far clip
 * @param depthAvailable - Whether depth buffer is available
 * @returns Lensed color (vec4)
 */
export const createScreenSpaceLensingNode = (
  colorTexture: TextureNode,
  depthTexture: TextureNode,
  blackHoleCenter: Node,
  horizonRadius: Node,
  intensity: Node,
  mass: Node,
  distortionScale: Node,
  falloff: Node,
  chromaticAberration: Node,
  near: Node,
  far: Node,
  depthAvailable: Node
): Node => {
  return Fn(() => {
    // Compute lensing displacement
    const displacement = computeLensingDisplacement(
      screenUV,
      blackHoleCenter,
      intensity,
      mass,
      distortionScale,
      falloff
    )

    const r = screenUV.sub(blackHoleCenter).length()

    // Sample and linearize depth
    const depth = depthTexture.sample(screenUV).x
    const linearDepth = linearizeDepth(depth, near, far)

    // Depth-based distortion factor
    const depthFactor = depthAvailable.select(linearDepth.smoothstep(1, 10), float(1))

    // Disable SSL in inner region to avoid artifacts
    const innerRadius = horizonRadius.mul(2.5)
    const outerRadius = horizonRadius.mul(3.5)
    const distFromCenter = screenUV.sub(blackHoleCenter).length()
    const sslFactor = distFromCenter.smoothstep(innerRadius, outerRadius)

    // Final displacement with depth and SSL factors
    const finalFactor = depthFactor.mul(sslFactor)
    const finalDisplacement = displacement.mul(finalFactor)

    // Apply distortion with optional chromatic aberration
    const hasCA = chromaticAberration.greaterThan(0.01)
    const withCA = applyLensingChromatic(screenUV, finalDisplacement, chromaticAberration, colorTexture)
    const withoutCA = colorTexture.sample(screenUV.add(finalDisplacement).clamp(0, 1)).xyz
    const color = hasCA.select(withCA, withoutCA).toVar()

    // Apply Einstein ring boost
    const ringRadius = horizonRadius.mul(1.5)
    const boost = einsteinRingBoost(r, ringRadius, horizonRadius.mul(0.3))
    const boostedColor = color.mul(boost)

    return vec4(boostedColor.x, boostedColor.y, boostedColor.z, float(1))
  })()
}

/**
 * Creates a simplified screen-space lensing node without depth awareness.
 *
 * Lighter weight version for when depth buffer is not available
 * or performance is a concern.
 *
 * @param colorTexture - Scene color texture
 * @param blackHoleCenter - Black hole center in UV space
 * @param intensity - Lensing intensity
 * @param mass - Black hole mass
 * @param distortionScale - Distortion scale
 * @param falloff - Falloff exponent
 * @param chromaticAberration - Chromatic aberration strength
 * @returns Lensed color (vec4)
 */
export const createScreenSpaceLensingNodeSimple = (
  colorTexture: TextureNode,
  blackHoleCenter: Node,
  intensity: Node,
  mass: Node,
  distortionScale: Node,
  falloff: Node,
  chromaticAberration: Node
): Node => {
  return Fn(() => {
    const displacement = computeLensingDisplacement(
      screenUV,
      blackHoleCenter,
      intensity,
      mass,
      distortionScale,
      falloff
    )

    const r = screenUV.sub(blackHoleCenter).length()

    // Apply distortion with optional chromatic aberration
    const hasCA = chromaticAberration.greaterThan(0.01)
    const withCA = applyLensingChromatic(screenUV, displacement, chromaticAberration, colorTexture)
    const withoutCA = colorTexture.sample(screenUV.add(displacement).clamp(0, 1)).xyz
    const color = hasCA.select(withCA, withoutCA).toVar()

    // Apply Einstein ring boost (using default radius estimation)
    const ringRadius = float(0.1)
    const boost = einsteinRingBoost(r, ringRadius, float(0.03))
    const boostedColor = color.mul(boost)

    return vec4(boostedColor.x, boostedColor.y, boostedColor.z, float(1))
  })()
}

