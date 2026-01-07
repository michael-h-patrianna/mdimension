/**
 * GTAO Bilateral Upsample TSL Node
 *
 * TSL port of GTAOBilateralUpsampleShader for WebGPU/WebGL compatibility.
 * Depth-aware upsampling specifically optimized for GTAO (ambient occlusion).
 *
 * Key differences from generic bilateral upsample:
 * - Samples AO values (grayscale) instead of reflection colors
 * - Uses multiplicative blending (color * aoFactor) instead of alpha blending
 * - AO darkens the scene rather than adding reflections
 *
 * @module rendering/tsl/postprocessing/gtaoBilateralUpsampleTSL
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
 * @param rawDepth - Raw depth buffer value (0-1)
 * @param near - Near clip plane distance
 * @param far - Far clip plane distance
 * @returns Linear depth in world units
 */
const linearizeDepth = Fn(([rawDepth, near, far]: [Node, Node, Node]) => {
  const numerator = near.mul(far).mul(2)
  const denominator = far.add(near).sub(rawDepth.mul(far.sub(near)))
  return numerator.div(denominator)
})

/**
 * Compute bilateral weight based on depth similarity.
 *
 * @param sampleDepth - Linear depth of the sample
 * @param centerDepth - Linear depth of the center pixel
 * @param depthThreshold - Depth discontinuity threshold
 * @returns Bilateral weight (0-1)
 */
const computeDepthWeight = Fn(
  ([sampleDepth, centerDepth, depthThreshold]: [Node, Node, Node]) => {
    const depthDiff = sampleDepth.sub(centerDepth).abs()
    const safeDepth = centerDepth.max(0.001)
    return depthDiff.div(depthThreshold.mul(safeDepth)).negate().exp()
  }
)

/**
 * Process a single corner sample for GTAO bilateral upsampling.
 *
 * @param aoTexture - Half-resolution AO texture
 * @param depthTexture - Full-resolution depth texture
 * @param sampleUv - UV coordinates to sample
 * @param bilinearWeight - Spatial bilinear weight
 * @param centerDepth - Linear depth at center pixel
 * @param depthThreshold - Depth discontinuity threshold
 * @param near - Camera near clip
 * @param far - Camera far clip
 * @returns vec2(weighted AO value, weight)
 */
const processAOCornerSample = Fn(
  ([aoTexture, depthTexture, sampleUv, bilinearWeight, centerDepth, depthThreshold, near, far]: [
    TextureNode,
    TextureNode,
    Node,
    Node,
    Node,
    Node,
    Node,
    Node,
  ]) => {
    // Sample AO value (GTAOPass outputs vec4(ao, ao, ao, 1.0))
    const aoValue = aoTexture.sample(sampleUv).x

    // Sample and linearize depth
    const rawSampleDepth = depthTexture.sample(sampleUv).x
    const sampleDepth = linearizeDepth(rawSampleDepth, near, far)

    // Compute depth-based bilateral weight
    const depthWeight = computeDepthWeight(sampleDepth, centerDepth, depthThreshold)

    // Combined weight
    const weight = bilinearWeight.mul(depthWeight)

    // Return weighted AO and weight for accumulation
    return vec2(aoValue.mul(weight), weight)
  }
)

/**
 * Creates a GTAO bilateral upsample node.
 *
 * Upsamples half-resolution GTAO to full resolution while preserving
 * edges, then applies multiplicative blending to darken occluded areas.
 *
 * @param aoTexture - Half-resolution AO texture
 * @param colorTexture - Full-resolution scene color texture
 * @param depthTexture - Full-resolution depth texture
 * @param resolution - Full resolution (vec2)
 * @param depthThreshold - Depth discontinuity threshold (typical: 0.02)
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @param aoIntensity - AO blend intensity (0 = no effect, 1 = full effect)
 * @returns Scene color with AO applied (vec4)
 */
export const createGTAOBilateralUpsampleNode = (
  aoTexture: TextureNode,
  colorTexture: TextureNode,
  depthTexture: TextureNode,
  resolution: Node,
  depthThreshold: Node,
  near: Node,
  far: Node,
  aoIntensity: Node
): Node => {
  return Fn(() => {
    // Calculate texel sizes
    const texelSize = vec2(float(1), float(1)).div(resolution)
    const halfResTexelSize = texelSize.mul(2)

    // Sample full-res depth at current pixel
    const rawCenterDepth = depthTexture.sample(screenUV).x
    const centerDepth = linearizeDepth(rawCenterDepth, near, far)

    // Calculate position within the 2x2 half-res cell (0-1)
    const cellPos = screenUV.div(halfResTexelSize).fract()

    // Align to half-res grid
    const baseUv = screenUV
      .div(halfResTexelSize)
      .floor()
      .mul(halfResTexelSize)
      .add(halfResTexelSize.mul(0.5))

    // Bilinear weights based on position within cell
    const wx0 = float(1).sub(cellPos.x)
    const wx1 = cellPos.x
    const wy0 = float(1).sub(cellPos.y)
    const wy1 = cellPos.y

    // Corner UVs
    const cornerOffset = halfResTexelSize.mul(0.5)
    const uv00 = baseUv.sub(cornerOffset)
    const uv10 = baseUv.sub(cornerOffset).add(vec2(halfResTexelSize.x, float(0)))
    const uv01 = baseUv.sub(cornerOffset).add(vec2(float(0), halfResTexelSize.y))
    const uv11 = baseUv.sub(cornerOffset).add(halfResTexelSize)

    // Process all 4 corners
    const sample00 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv00,
      wx0.mul(wy0),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample10 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv10,
      wx1.mul(wy0),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample01 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv01,
      wx0.mul(wy1),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample11 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv11,
      wx1.mul(wy1),
      centerDepth,
      depthThreshold,
      near,
      far
    )

    // Accumulate (x = weighted AO sum, y = weight sum)
    const accumulated = sample00.add(sample10).add(sample01).add(sample11)
    const totalWeight = accumulated.y.max(0.001)

    // Compute final AO value (normalized)
    const ao = accumulated.x.div(totalWeight)

    // Apply AO with intensity control
    // aoFactor = mix(1.0, ao, intensity)
    // result = color * aoFactor
    const aoFactor = float(1).mix(ao, aoIntensity)

    // Get scene color and apply multiplicative AO
    const sceneColor = colorTexture.sample(screenUV)
    return vec4(
      sceneColor.x.mul(aoFactor),
      sceneColor.y.mul(aoFactor),
      sceneColor.z.mul(aoFactor),
      sceneColor.w
    )
  })()
}

/**
 * Creates a simple GTAO bilateral upsample node that outputs AO only.
 *
 * Returns the upsampled AO value without scene color blending.
 * Useful when AO needs to be applied separately or stored for later use.
 *
 * @param aoTexture - Half-resolution AO texture
 * @param depthTexture - Full-resolution depth texture
 * @param resolution - Full resolution (vec2)
 * @param depthThreshold - Depth discontinuity threshold
 * @param near - Camera near clip plane
 * @param far - Camera far clip plane
 * @returns Upsampled AO value (vec4 with AO in all RGB channels)
 */
export const createGTAOBilateralUpsampleNodeSimple = (
  aoTexture: TextureNode,
  depthTexture: TextureNode,
  resolution: Node,
  depthThreshold: Node,
  near: Node,
  far: Node
): Node => {
  return Fn(() => {
    const texelSize = vec2(float(1), float(1)).div(resolution)
    const halfResTexelSize = texelSize.mul(2)

    const rawCenterDepth = depthTexture.sample(screenUV).x
    const centerDepth = linearizeDepth(rawCenterDepth, near, far)

    const cellPos = screenUV.div(halfResTexelSize).fract()
    const baseUv = screenUV
      .div(halfResTexelSize)
      .floor()
      .mul(halfResTexelSize)
      .add(halfResTexelSize.mul(0.5))

    const wx0 = float(1).sub(cellPos.x)
    const wx1 = cellPos.x
    const wy0 = float(1).sub(cellPos.y)
    const wy1 = cellPos.y

    const cornerOffset = halfResTexelSize.mul(0.5)
    const uv00 = baseUv.sub(cornerOffset)
    const uv10 = baseUv.sub(cornerOffset).add(vec2(halfResTexelSize.x, float(0)))
    const uv01 = baseUv.sub(cornerOffset).add(vec2(float(0), halfResTexelSize.y))
    const uv11 = baseUv.sub(cornerOffset).add(halfResTexelSize)

    const sample00 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv00,
      wx0.mul(wy0),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample10 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv10,
      wx1.mul(wy0),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample01 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv01,
      wx0.mul(wy1),
      centerDepth,
      depthThreshold,
      near,
      far
    )
    const sample11 = processAOCornerSample(
      aoTexture,
      depthTexture,
      uv11,
      wx1.mul(wy1),
      centerDepth,
      depthThreshold,
      near,
      far
    )

    const accumulated = sample00.add(sample10).add(sample01).add(sample11)
    const ao = accumulated.x.div(accumulated.y.max(0.001))

    return vec4(ao, ao, ao, float(1))
  })()
}

