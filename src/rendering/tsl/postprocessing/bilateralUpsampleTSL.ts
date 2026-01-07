/**
 * Bilateral Upsample TSL Node
 *
 * TSL port of BilateralUpsampleShader for WebGPU/WebGL compatibility.
 * Depth-aware upsampling for half-resolution effects.
 * Preserves edges by comparing depth values, preventing blur across depth discontinuities.
 *
 * Used for upsampling SSR, GTAO, and other effects rendered at half resolution.
 *
 * Algorithm:
 * 1. For each full-res pixel, identify which 2x2 half-res cell it belongs to
 * 2. Sample the 4 corners of that half-res cell
 * 3. Compute bilinear weights based on position within the cell
 * 4. Compute depth weights based on similarity to center pixel depth
 * 5. Combine weights and normalize to produce edge-preserving upsampled result
 *
 * References:
 * - Joint Bilateral Upsampling (Kopf et al., 2007)
 * - Edge-Aware Upsampling for Interactive Rendering
 *
 * @module rendering/tsl/postprocessing/bilateralUpsampleTSL
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
 * Linearize depth value from raw depth buffer.
 *
 * Converts perspective depth buffer value to linear eye-space distance.
 * Matches WebGL formula:
 * linearDepth = (2.0 * near * far) / (far + near - rawDepth * (far - near))
 *
 * @param rawDepth - Raw depth buffer value (0-1 range, NDC)
 * @param near - Camera near clip plane distance
 * @param far - Camera far clip plane distance
 * @returns Linear depth in world units
 */
const linearizeDepth = Fn(([rawDepth, near, far]: [Node, Node, Node]) => {
  // Numerator: 2 * near * far
  const numerator = near.mul(far).mul(2)

  // Denominator: far + near - rawDepth * (far - near)
  const farPlusNear = far.add(near)
  const farMinusNear = far.sub(near)
  const denominator = farPlusNear.sub(rawDepth.mul(farMinusNear))

  return numerator.div(denominator)
})

/**
 * Compute bilateral weight for a sample based on depth similarity.
 *
 * Uses exponential falloff: exp(-depthDiff / (threshold * centerDepth))
 * This ensures samples at similar depths get high weights,
 * while samples across depth discontinuities get low weights.
 *
 * @param sampleDepth - Linear depth of the sample
 * @param centerDepth - Linear depth of the center pixel
 * @param depthThreshold - Sensitivity threshold for depth differences
 * @returns Bilateral weight in range (0, 1]
 */
const computeDepthWeight = Fn(
  ([sampleDepth, centerDepth, depthThreshold]: [Node, Node, Node]) => {
    const depthDiff = sampleDepth.sub(centerDepth).abs()
    // Prevent division by zero with max(centerDepth, epsilon)
    const safeDepth = centerDepth.max(0.001)
    // Exponential falloff: closer depths get higher weights
    return depthDiff.div(depthThreshold.mul(safeDepth)).negate().exp()
  }
)

/**
 * Process a single corner sample in the bilateral upsampling.
 *
 * Samples the input and depth textures, computes combined bilateral weight,
 * and returns the weighted sample and weight for accumulation.
 *
 * @param inputTexture - Half-resolution input texture
 * @param depthTexture - Full-resolution depth texture
 * @param sampleUv - UV coordinates to sample at
 * @param bilinearWeight - Spatial bilinear interpolation weight
 * @param centerDepth - Linear depth at the center pixel
 * @param depthThreshold - Depth discontinuity threshold
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @returns Object containing weighted sample and total weight
 */
const processCornerSample = Fn(
  ([
    inputTexture,
    depthTexture,
    sampleUv,
    bilinearWeight,
    centerDepth,
    depthThreshold,
    near,
    far,
  ]: [TextureNode, TextureNode, Node, Node, Node, Node, Node, Node]) => {
    // Sample the half-res input at this corner
    const sample = inputTexture.sample(sampleUv)

    // Sample depth at the same location
    const rawSampleDepth = depthTexture.sample(sampleUv).x
    const sampleDepth = linearizeDepth(rawSampleDepth, near, far)

    // Compute depth-based bilateral weight
    const depthWeight = computeDepthWeight(sampleDepth, centerDepth, depthThreshold)

    // Combined weight = spatial * bilateral
    const weight = bilinearWeight.mul(depthWeight)

    // Return weighted sample (will be accumulated)
    return vec4(
      sample.x.mul(weight),
      sample.y.mul(weight),
      sample.z.mul(weight),
      weight // Store weight in alpha for accumulation
    )
  }
)

/**
 * Creates a bilateral upsample node for depth-aware upsampling.
 *
 * This is the main entry point for bilateral upsampling. Takes a half-resolution
 * effect texture (e.g., SSR, GTAO) and upsamples it to full resolution while
 * preserving sharp edges at depth discontinuities.
 *
 * @param inputTexture - Half-resolution effect texture (e.g., SSR output)
 * @param colorTexture - Full-resolution scene color texture for blending
 * @param depthTexture - Full-resolution depth texture
 * @param resolution - Full resolution as vec2 node (width, height)
 * @param depthThreshold - Depth discontinuity threshold (typical: 0.01)
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @returns TSL node with upsampled and blended result (vec4)
 */
export const createBilateralUpsampleNode = (
  inputTexture: TextureNode,
  colorTexture: TextureNode,
  depthTexture: TextureNode,
  resolution: Node,
  depthThreshold: Node,
  near: Node,
  far: Node
): Node => {
  return Fn(() => {
    // Calculate texel sizes in UV space
    const texelSize = vec2(float(1), float(1)).div(resolution)
    // Half-res texel is 2x the size of full-res texel in UV space
    const halfResTexelSize = texelSize.mul(2)

    // Sample full-res depth at current pixel for comparison
    const rawCenterDepth = depthTexture.sample(screenUV).x
    const centerDepth = linearizeDepth(rawCenterDepth, near, far)

    // Calculate position within the 2x2 half-res cell (0-1 range in each dimension)
    // This determines bilinear interpolation weights
    const cellPos = screenUV.div(halfResTexelSize).fract()

    // Align to half-res grid by snapping to cell boundaries
    // baseUv is the center of the half-res cell
    const baseUv = screenUV
      .div(halfResTexelSize)
      .floor()
      .mul(halfResTexelSize)
      .add(halfResTexelSize.mul(0.5))

    // Compute bilinear weights based on position within the 2x2 cell
    // wx0/wy0 = weight for left/bottom samples, wx1/wy1 = weight for right/top samples
    const wx0 = float(1).sub(cellPos.x)
    const wx1 = cellPos.x
    const wy0 = float(1).sub(cellPos.y)
    const wy1 = cellPos.y

    // Corner sample UVs (offset from baseUv)
    const cornerOffset = halfResTexelSize.mul(0.5)
    const uv00 = baseUv.sub(cornerOffset) // Bottom-left
    const uv10 = baseUv.sub(cornerOffset).add(vec2(halfResTexelSize.x, float(0))) // Bottom-right
    const uv01 = baseUv.sub(cornerOffset).add(vec2(float(0), halfResTexelSize.y)) // Top-left
    const uv11 = baseUv.sub(cornerOffset).add(halfResTexelSize) // Top-right

    // Bilinear weights for each corner
    const weight00 = wx0.mul(wy0)
    const weight10 = wx1.mul(wy0)
    const weight01 = wx0.mul(wy1)
    const weight11 = wx1.mul(wy1)

    // Process all 4 corner samples with combined bilinear + depth weights
    const sample00 = processCornerSample(
      inputTexture,
      depthTexture,
      uv00,
      weight00,
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample10 = processCornerSample(
      inputTexture,
      depthTexture,
      uv10,
      weight10,
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample01 = processCornerSample(
      inputTexture,
      depthTexture,
      uv01,
      weight01,
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample11 = processCornerSample(
      inputTexture,
      depthTexture,
      uv11,
      weight11,
      centerDepth,
      depthThreshold,
      near,
      far
    )

    // Accumulate weighted samples (RGB in xyz, weight in w)
    const accumulated = sample00.add(sample10).add(sample01).add(sample11)

    // Total weight is sum of all individual weights (stored in w components)
    const totalWeight = accumulated.w.max(0.001) // Prevent division by zero

    // Normalize the accumulated color by total weight
    const normalizedResult = vec4(
      accumulated.x.div(totalWeight),
      accumulated.y.div(totalWeight),
      accumulated.z.div(totalWeight),
      // Reconstruct alpha from input samples (average)
      inputTexture.sample(screenUV).w
    )

    // Get scene color for compositing
    const sceneColor = colorTexture.sample(screenUV)

    // SSR/effect outputs: RGB = effect color, A = blend strength
    // Alpha-blend: mix(sceneColor, effectColor, effectAlpha)
    const blendedRgb = sceneColor.xyz.mix(normalizedResult.xyz, normalizedResult.w)

    // Return blended result with original scene alpha
    return vec4(blendedRgb.x, blendedRgb.y, blendedRgb.z, sceneColor.w)
  })()
}

/**
 * Creates a simple bilateral upsample node without scene color blending.
 *
 * Use this when you only need the upsampled effect without compositing onto
 * a base color. Useful for intermediate processing or when blending is handled
 * separately.
 *
 * @param inputTexture - Half-resolution effect texture
 * @param depthTexture - Full-resolution depth texture
 * @param resolution - Full resolution as vec2 node (width, height)
 * @param depthThreshold - Depth discontinuity threshold (typical: 0.01)
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @returns TSL node with upsampled result (vec4)
 */
export const createBilateralUpsampleNodeSimple = (
  inputTexture: TextureNode,
  depthTexture: TextureNode,
  resolution: Node,
  depthThreshold: Node,
  near: Node,
  far: Node
): Node => {
  return Fn(() => {
    // Calculate texel sizes in UV space
    const texelSize = vec2(float(1), float(1)).div(resolution)
    const halfResTexelSize = texelSize.mul(2)

    // Sample full-res depth at current pixel
    const rawCenterDepth = depthTexture.sample(screenUV).x
    const centerDepth = linearizeDepth(rawCenterDepth, near, far)

    // Calculate position within the 2x2 half-res cell
    const cellPos = screenUV.div(halfResTexelSize).fract()

    // Align to half-res grid
    const baseUv = screenUV
      .div(halfResTexelSize)
      .floor()
      .mul(halfResTexelSize)
      .add(halfResTexelSize.mul(0.5))

    // Compute bilinear weights
    const wx0 = float(1).sub(cellPos.x)
    const wx1 = cellPos.x
    const wy0 = float(1).sub(cellPos.y)
    const wy1 = cellPos.y

    // Corner sample UVs
    const cornerOffset = halfResTexelSize.mul(0.5)
    const uv00 = baseUv.sub(cornerOffset)
    const uv10 = baseUv.sub(cornerOffset).add(vec2(halfResTexelSize.x, float(0)))
    const uv01 = baseUv.sub(cornerOffset).add(vec2(float(0), halfResTexelSize.y))
    const uv11 = baseUv.sub(cornerOffset).add(halfResTexelSize)

    // Process all 4 corners
    const sample00 = processCornerSample(
      inputTexture,
      depthTexture,
      uv00,
      wx0.mul(wy0),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample10 = processCornerSample(
      inputTexture,
      depthTexture,
      uv10,
      wx1.mul(wy0),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample01 = processCornerSample(
      inputTexture,
      depthTexture,
      uv01,
      wx0.mul(wy1),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample11 = processCornerSample(
      inputTexture,
      depthTexture,
      uv11,
      wx1.mul(wy1),
      centerDepth,
      depthThreshold,
      near,
      far
    )

    // Accumulate and normalize
    const accumulated = sample00.add(sample10).add(sample01).add(sample11)
    const totalWeight = accumulated.w.max(0.001)

    return vec4(
      accumulated.x.div(totalWeight),
      accumulated.y.div(totalWeight),
      accumulated.z.div(totalWeight),
      inputTexture.sample(screenUV).w
    )
  })()
}
