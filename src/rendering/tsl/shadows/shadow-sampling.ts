/**
 * TSL Shadow Map Sampling for Directional/Spot Lights
 *
 * Provides shadow map sampling with PCF (Percentage Closer Filtering).
 * Uses select() chains to handle sampler indexing (TSL limitation).
 *
 * @module rendering/tsl/shadows/shadow-sampling
 */

import { abs, clamp, float, Fn, int, max, select, vec2, vec3, vec4 } from 'three/tsl'

import type { ShadowTSLUniforms } from './shadow-uniforms'

// Type aliases
type Vec2Node = ReturnType<typeof vec2>
type Vec3Node = ReturnType<typeof vec3>
type IntNode = ReturnType<typeof int>

/**
 * Sample 2D shadow map by index using select() chain
 * TSL cannot dynamically index sampler arrays
 *
 * NOTE: Use texture(textureNode.value, uv) to sample at custom UV coordinates.
 *
 * @param uniforms - Shadow uniforms
 * @param lightIndex - Light index (0-3)
 * @param uv - UV coordinates
 * @returns Depth value from shadow map
 */
export const sampleShadowMapByIndex = (uniforms: ShadowTSLUniforms) =>
  Fn(([lightIndex, uv]: [IntNode, Vec2Node]) => {
    // Sample each shadow map at UV and select based on light index
    // TextureNode.sample(uv).r samples the red channel at given UV
    const depth = select(
      lightIndex.equal(0),
      uniforms.uShadowMap0.sample(uv).r,
      select(
        lightIndex.equal(1),
        uniforms.uShadowMap1.sample(uv).r,
        select(
          lightIndex.equal(2),
          uniforms.uShadowMap2.sample(uv).r,
          select(
            lightIndex.equal(3),
            uniforms.uShadowMap3.sample(uv).r,
            float(1) // Default: fully lit
          )
        )
      )
    )
    return depth
  })

/**
 * Get shadow matrix by index using select() chain
 *
 * @param uniforms - Shadow uniforms
 * @param lightIndex - Light index (0-3)
 * @param worldPos - World position to transform
 * @returns Shadow clip space position (vec4)
 */
export const getShadowCoordByIndex = (uniforms: ShadowTSLUniforms) =>
  Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const pos4 = vec4(worldPos, 1)

    // Select shadow matrix and transform
    const shadowCoord = select(
      lightIndex.equal(0),
      uniforms.uShadowMatrix0.mul(pos4),
      select(
        lightIndex.equal(1),
        uniforms.uShadowMatrix1.mul(pos4),
        select(
          lightIndex.equal(2),
          uniforms.uShadowMatrix2.mul(pos4),
          select(lightIndex.equal(3), uniforms.uShadowMatrix3.mul(pos4), pos4)
        )
      )
    )

    return shadowCoord
  })

/**
 * Hard shadow sampling for directional/spot lights
 * Single sample, no filtering
 *
 * @param uniforms - Shadow uniforms
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const sampleShadowHard = (uniforms: ShadowTSLUniforms) =>
  // CRITICAL (docs/tsl.md §5): Fn-producing helpers must be created OUTSIDE Fn()
  // to avoid WebGPU pipeline layout issues.
  (() => {
    const getShadowCoord = getShadowCoordByIndex(uniforms)
    const sampleShadow = sampleShadowMapByIndex(uniforms)

    return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const shadowCoord = getShadowCoord(lightIndex, worldPos)

    // Perspective divide (guard against w=0)
    const w = max(abs(shadowCoord.w), float(0.0001))
    const projCoord = shadowCoord.xyz.div(w)

    // Transform XY from NDC [-1,1] to texture space [0,1]
    // NOTE: Z is NOT converted - WebGPU NDC z is already [0,1] (unlike WebGL's [-1,1])
    const texCoordXY = projCoord.xy.mul(0.5).add(0.5)
    // WebGPU NDC z is [0,1], just clamp for safety
    const currentDepth = clamp(projCoord.z, float(0), float(1))

    // Frustum check: outside = fully lit
    const outsideX = texCoordXY.x.lessThan(0).or(texCoordXY.x.greaterThan(1))
    const outsideY = texCoordXY.y.lessThan(0).or(texCoordXY.y.greaterThan(1))
    const outsideZ = currentDepth.lessThan(0).or(currentDepth.greaterThan(1))
    const outside = outsideX.or(outsideY).or(outsideZ)

    // Sample shadow map depth
    const closestDepth = sampleShadow(lightIndex, texCoordXY)

    // Shadow comparison: in shadow if currentDepth > closestDepth + bias
    const bias = uniforms.uShadowMapBias
    const inShadow = currentDepth.greaterThan(closestDepth.add(bias))

    // Return 0.0 for shadow, 1.0 for lit
    return select(outside, float(1), select(inShadow, float(0), float(1)))
    })
  })()

/**
 * PCF 3x3 shadow sampling for directional/spot lights
 *
 * @param uniforms - Shadow uniforms
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const sampleShadowPCF3x3 = (uniforms: ShadowTSLUniforms) =>
  // CRITICAL (docs/tsl.md §5): Fn-producing helpers must be created OUTSIDE Fn().
  (() => {
    const getShadowCoord = getShadowCoordByIndex(uniforms)
    const sampleShadow = sampleShadowMapByIndex(uniforms)

    return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const shadowCoord = getShadowCoord(lightIndex, worldPos)

    // Perspective divide
    const w = max(abs(shadowCoord.w), float(0.0001))
    const projCoord = shadowCoord.xyz.div(w)
    // XY: NDC [-1,1] to texture [0,1]. Z: WebGPU NDC is already [0,1]
    const texCoordXY = projCoord.xy.mul(0.5).add(0.5)
    const currentDepth = clamp(projCoord.z, float(0), float(1))

    // Frustum check
    const outsideX = texCoordXY.x.lessThan(0).or(texCoordXY.x.greaterThan(1))
    const outsideY = texCoordXY.y.lessThan(0).or(texCoordXY.y.greaterThan(1))
    const outsideZ = currentDepth.lessThan(0).or(currentDepth.greaterThan(1))
    const outside = outsideX.or(outsideY).or(outsideZ)

    const bias = uniforms.uShadowMapBias
    const texelSize = float(1).div(max(uniforms.uShadowMapSize, float(1)))

    // PCF accumulator
    const shadow = float(0).toVar('shadowAccum3x3')

    // 3x3 PCF kernel - unrolled for TSL compatibility
    // TSL Loop indices don't support .toFloat(), so use manual offsets
    const offsets3x3 = [
      vec2(-1, -1), vec2(0, -1), vec2(1, -1),
      vec2(-1, 0), vec2(0, 0), vec2(1, 0),
      vec2(-1, 1), vec2(0, 1), vec2(1, 1),
    ]
    for (const off of offsets3x3) {
      const offset = off.mul(texelSize)
      const depth = sampleShadow(lightIndex, texCoordXY.add(offset))
      const lit = currentDepth.lessThanEqual(depth.add(bias))
      shadow.addAssign(select(lit, float(1), float(0)))
    }

    // Normalize by sample count (3x3 = 9 samples)
    const shadowFactor = shadow.div(float(9))

    return select(outside, float(1), shadowFactor)
    })
  })()

/**
 * PCF 5x5 shadow sampling for directional/spot lights
 * Higher quality with 25 samples
 *
 * @param uniforms - Shadow uniforms
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const sampleShadowPCF5x5 = (uniforms: ShadowTSLUniforms) =>
  // CRITICAL (docs/tsl.md §5): Fn-producing helpers must be created OUTSIDE Fn().
  (() => {
    const getShadowCoord = getShadowCoordByIndex(uniforms)
    const sampleShadow = sampleShadowMapByIndex(uniforms)

    return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const shadowCoord = getShadowCoord(lightIndex, worldPos)

    // Perspective divide
    const w = max(abs(shadowCoord.w), float(0.0001))
    const projCoord = shadowCoord.xyz.div(w)
    // XY: NDC [-1,1] to texture [0,1]. Z: WebGPU NDC is already [0,1]
    const texCoordXY = projCoord.xy.mul(0.5).add(0.5)
    const currentDepth = clamp(projCoord.z, float(0), float(1))

    // Frustum check
    const outsideX = texCoordXY.x.lessThan(0).or(texCoordXY.x.greaterThan(1))
    const outsideY = texCoordXY.y.lessThan(0).or(texCoordXY.y.greaterThan(1))
    const outsideZ = currentDepth.lessThan(0).or(currentDepth.greaterThan(1))
    const outside = outsideX.or(outsideY).or(outsideZ)

    const bias = uniforms.uShadowMapBias
    const texelSize = float(1).div(max(uniforms.uShadowMapSize, float(1)))

    // PCF accumulator
    const shadow = float(0).toVar('shadowAccum5x5')

    // 5x5 PCF kernel - unrolled for TSL compatibility
    const offsets5x5 = [
      vec2(-2, -2), vec2(-1, -2), vec2(0, -2), vec2(1, -2), vec2(2, -2),
      vec2(-2, -1), vec2(-1, -1), vec2(0, -1), vec2(1, -1), vec2(2, -1),
      vec2(-2, 0), vec2(-1, 0), vec2(0, 0), vec2(1, 0), vec2(2, 0),
      vec2(-2, 1), vec2(-1, 1), vec2(0, 1), vec2(1, 1), vec2(2, 1),
      vec2(-2, 2), vec2(-1, 2), vec2(0, 2), vec2(1, 2), vec2(2, 2),
    ]
    for (const off of offsets5x5) {
      const offset = off.mul(texelSize)
      const depth = sampleShadow(lightIndex, texCoordXY.add(offset))
      const lit = currentDepth.lessThanEqual(depth.add(bias))
      shadow.addAssign(select(lit, float(1), float(0)))
    }

    // Normalize by sample count (5x5 = 25 samples)
    const shadowFactor = shadow.div(float(25))

    return select(outside, float(1), shadowFactor)
    })
  })()

/**
 * PCF shadow sampling for directional/spot lights
 * Selects 3x3 or 5x5 kernel based on uShadowPCFSamples
 *
 * @param uniforms - Shadow uniforms
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const sampleShadowPCF = (uniforms: ShadowTSLUniforms) =>
  // CRITICAL (docs/tsl.md §5): create Fn nodes outside Fn().
  (() => {
    // Select kernel based on PCF samples setting (0=hard, 1=3x3, 2+=5x5)
    const use5x5 = uniforms.uShadowPCFSamples.greaterThan(1)

    const pcf3x3 = sampleShadowPCF3x3(uniforms)
    const pcf5x5 = sampleShadowPCF5x5(uniforms)

    return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
      return select(use5x5, pcf5x5(lightIndex, worldPos), pcf3x3(lightIndex, worldPos))
    })
  })()

/**
 * Unified directional/spot shadow sampling
 * Selects hard or PCF based on uShadowPCFSamples
 *
 * @param uniforms - Shadow uniforms
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const sampleDirectionalSpotShadow = (uniforms: ShadowTSLUniforms) =>
  // CRITICAL (docs/tsl.md §5): create Fn nodes outside Fn().
  (() => {
    const pcfSamples = uniforms.uShadowPCFSamples

    // Check if PCF is enabled
    const usePCF = pcfSamples.greaterThan(0)

    // Sample with appropriate method
    const hardShadow = sampleShadowHard(uniforms)
    const pcfShadow = sampleShadowPCF(uniforms)

    return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
      return select(usePCF, pcfShadow(lightIndex, worldPos), hardShadow(lightIndex, worldPos))
    })
  })()
