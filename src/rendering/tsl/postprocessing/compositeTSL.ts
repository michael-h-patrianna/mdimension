/**
 * Composite TSL Nodes
 *
 * TSL ports of compositing shaders for WebGPU/WebGL compatibility.
 * Includes cloud, environment, and normal buffer compositing.
 *
 * @module rendering/tsl/postprocessing/compositeTSL
 */

import {
  Fn,
  float,
  screenUV,
  vec2,
  vec4,
  Loop,
  int,
  type Node,
  type TextureNode,
} from 'three/tsl'

// =============================================================================
// Cloud Composite
// =============================================================================

/**
 * Creates a cloud composite node.
 *
 * Composites premultiplied volumetric cloud color over the scene.
 * Uses premultiplied alpha compositing: out = cloud + scene * (1 - cloud.a)
 *
 * @param sceneColorTexture - Scene color texture
 * @param cloudTexture - Cloud color texture (premultiplied alpha)
 * @param cloudAvailable - Float node (>0.5 means cloud is available)
 * @returns Composited color (vec4)
 */
export const createCloudCompositeNode = (
  sceneColorTexture: TextureNode,
  cloudTexture: TextureNode,
  cloudAvailable: Node
): Node => {
  return Fn(() => {
    const sceneColor = sceneColorTexture.sample(screenUV)
    const cloudColor = cloudTexture.sample(screenUV)

    // Premultiplied alpha composite: out = cloud + scene * (1 - cloud.a)
    const combined = cloudColor.xyz.add(sceneColor.xyz.mul(float(1).sub(cloudColor.w)))

    // Return original scene if cloud not available
    return cloudAvailable.greaterThan(0.5).select(
      vec4(combined.x, combined.y, combined.z, sceneColor.w),
      sceneColor
    )
  })()
}

// =============================================================================
// Normal Composite
// =============================================================================

/**
 * Compute the magnitude of a normal vector from RGBA data.
 *
 * @param normalData - Normal data (vec4)
 * @returns Magnitude of the RGB components
 */
const normalMagnitude = Fn(([normalData]: [Node]) => {
  return normalData.xyz.length()
})

/**
 * Creates a normal composite node.
 *
 * Composites environment normals with main object MRT normals, and optionally
 * overlays volumetric normals from the temporal cloud buffer.
 *
 * Priority: cloud > main object > environment
 *
 * @param envNormalTexture - Environment normal texture
 * @param mainNormalTexture - Main object normal texture
 * @param cloudNormalTexture - Cloud normal texture
 * @param cloudAvailable - Float node (>0.5 means cloud is available)
 * @returns Composited normal (vec4)
 */
export const createNormalCompositeNode = (
  envNormalTexture: TextureNode,
  mainNormalTexture: TextureNode,
  cloudNormalTexture: TextureNode,
  cloudAvailable: Node
): Node => {
  return Fn(() => {
    const envNormal = envNormalTexture.sample(screenUV)
    const mainNormal = mainNormalTexture.sample(screenUV)

    // Check if main normal has valid data
    const hasMainNormal = normalMagnitude(mainNormal).greaterThan(0.001)

    // Start with env, overlay main if valid
    const baseNormal = hasMainNormal.select(mainNormal, envNormal)

    // Check for cloud normal if available
    const cloudNormal = cloudNormalTexture.sample(screenUV)
    const hasCloudNormal = normalMagnitude(cloudNormal).greaterThan(0.001)

    // Overlay cloud if available and valid
    const hasCloud = cloudAvailable.greaterThan(0.5).and(hasCloudNormal)
    return hasCloud.select(cloudNormal, baseNormal)
  })()
}

// =============================================================================
// Environment Composite
// =============================================================================

/**
 * Check if depth value represents the far plane (no object rendered).
 *
 * @param depth - Raw depth buffer value
 * @returns Boolean node (true if at far plane)
 */
const isAtFarPlane = Fn(([depth]: [Node]) => {
  return depth.greaterThanEqual(0.9999)
})

/**
 * Check if a pixel is part of the event horizon.
 * Horizon pixels have: depth ≈ 1.0 (far) AND alpha ≈ 1.0 (opaque).
 *
 * @param uv - UV coordinates
 * @param colorTexture - Main object color texture
 * @param depthTexture - Main object depth texture
 * @returns Boolean node (true if horizon pixel)
 */
const isHorizonPixel = Fn(
  ([uv, colorTexture, depthTexture]: [Node, TextureNode, TextureNode]) => {
    const color = colorTexture.sample(uv)
    const depth = depthTexture.sample(uv).x

    // Horizon = far plane + high alpha
    return depth.greaterThanEqual(0.999).and(color.w.greaterThan(0.9))
  }
)

/**
 * Detect the visual boundary of the event horizon.
 * Finds pixels that are NOT horizon but have horizon neighbors.
 *
 * @param uv - UV coordinates
 * @param colorTexture - Main object color texture
 * @param depthTexture - Main object depth texture
 * @param resolution - Screen resolution
 * @returns Edge intensity (0-1)
 */
const detectHorizonEdge = Fn(
  ([uv, colorTexture, depthTexture, resolution]: [Node, TextureNode, TextureNode, Node]) => {
    const texelSize = vec2(float(1), float(1)).div(resolution)

    // Check if current pixel is horizon (no glow inside horizon)
    const centerIsHorizon = isHorizonPixel(uv, colorTexture, depthTexture)

    // Count horizon neighbors weighted by distance
    const horizonCount = float(0).toVar()

    // Sample in a 5x5 grid (-2 to +2) using flat loop (25 iterations)
    // i = 0..24, x = (i % 5) - 2, y = (i / 5) - 2
    // WGSL: floor() only works with floats, so convert i to float first
    Loop(int(25), ({ i }) => {
      const xi = float(i).mod(5).sub(2)
      const yi = float(i).div(5).floor().sub(2)

      // Skip center pixel (xi=0, yi=0)
      const isCenter = xi.equal(0).and(yi.equal(0))
      const sampleUv = uv.add(vec2(xi, yi).mul(texelSize))
      const isHorizon = isHorizonPixel(sampleUv, colorTexture, depthTexture)

      // Weight by distance (closer = stronger)
      const dist = vec2(xi, yi).length()
      const weight = isHorizon.and(isCenter.not()).select(float(1).div(dist.add(0.5)), float(0))
      horizonCount.addAssign(weight)
    })

    // Return 0 if center is horizon, otherwise smoothstep edge value
    return centerIsHorizon.select(float(0), horizonCount.smoothstep(0, 3))
  }
)

/**
 * Creates an environment composite node.
 *
 * Composites the lensed environment layer behind the main object layer.
 * Uses alpha blending to allow transparent objects to show the lensed
 * environment through them. Includes optional photon shell edge glow.
 *
 * @param lensedEnvTexture - Lensed environment color texture
 * @param mainObjectTexture - Main object color texture (RGBA)
 * @param mainObjectDepthTexture - Main object depth texture
 * @param resolution - Screen resolution
 * @param shellEnabled - Whether photon shell is enabled
 * @param shellGlowColor - Photon shell glow color (vec3)
 * @param shellGlowStrength - Photon shell glow strength
 * @returns Composited color (vec4)
 */
export const createEnvironmentCompositeNode = (
  lensedEnvTexture: TextureNode,
  mainObjectTexture: TextureNode,
  mainObjectDepthTexture: TextureNode,
  resolution: Node,
  shellEnabled: Node,
  shellGlowColor: Node,
  shellGlowStrength: Node
): Node => {
  return Fn(() => {
    const envColor = lensedEnvTexture.sample(screenUV)
    const objColor = mainObjectTexture.sample(screenUV)
    const objDepth = mainObjectDepthTexture.sample(screenUV).x

    // Check if pixel is at far plane with zero alpha (background)
    const isBackground = isAtFarPlane(objDepth).and(objColor.w.lessThan(0.01))

    // Background: show environment only
    const bgColor = envColor.xyz
    const bgAlpha = envColor.w

    // Object exists: blend using PREMULTIPLIED alpha compositing
    // Industry standard: obj.rgb is already multiplied by alpha in the material shader
    // Formula: result = obj.rgb + env.rgb * (1 - obj.a)
    // This avoids the need for forceOpaque runtime material modification
    const blendedColor = objColor.xyz.add(envColor.xyz.mul(float(1).sub(objColor.w)))
    const blendedAlpha = envColor.w.max(objColor.w)

    // Select based on background check
    const finalColor = isBackground.select(bgColor, blendedColor).toVar()
    const finalAlpha = isBackground.select(bgAlpha, blendedAlpha)

    // Add photon shell edge glow if enabled
    const edge = detectHorizonEdge(screenUV, mainObjectTexture, mainObjectDepthTexture, resolution)
    const shellGlow = shellGlowColor.mul(edge).mul(shellGlowStrength)
    const withShell = shellEnabled.select(finalColor.add(shellGlow), finalColor)

    return vec4(withShell.x, withShell.y, withShell.z, finalAlpha)
  })()
}

// =============================================================================
// Frame Blending
// =============================================================================

/**
 * Creates a frame blending node.
 *
 * Blends current frame with previous frame for smoother motion at low frame rates.
 * Uses linear interpolation for temporal accumulation.
 *
 * @param currentFrameTexture - Current frame texture
 * @param previousFrameTexture - Previous frame texture
 * @param blendFactor - Blend factor (0 = fully current, 1 = fully previous)
 * @returns Blended frame (vec4)
 */
export const createFrameBlendingNode = (
  currentFrameTexture: TextureNode,
  previousFrameTexture: TextureNode,
  blendFactor: Node
): Node => {
  return Fn(() => {
    const current = currentFrameTexture.sample(screenUV)
    const previous = previousFrameTexture.sample(screenUV)

    // Clamp blend factor to valid range
    const clampedFactor = blendFactor.clamp(0, 1)

    // Linear blend between current and previous
    return current.mix(previous, clampedFactor)
  })()
}

