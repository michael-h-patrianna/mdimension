/**
 * TSL Point Light Shadow Sampling
 *
 * Point lights use 6 cube faces packed into a 2D texture (4:2 aspect ratio).
 * This module provides cubeToUV() mapping and PCF sampling.
 *
 * @see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js
 *
 * @module rendering/tsl/shadows/point-shadow
 */

import {
  abs,
  dot,
  float,
  Fn,
  int,
  length,
  max,
  select,
  sign,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

import type { ShadowTSLUniforms } from './shadow-uniforms'
import { safeNormalize3, safeNormalizeUp } from '../utils/safe-math'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec2Node = ReturnType<typeof vec2>
type Vec3Node = ReturnType<typeof vec3>
type Vec4Node = ReturnType<typeof vec4>
type IntNode = ReturnType<typeof int>

/**
 * Unpack RGBA to depth value (Three.js packing format)
 * Three.js packs depth as RGBA for precision
 */
export const unpackRGBAToDepth = Fn(([rgba]: [Vec4Node]) => {
  // Dot product with unpacking constants
  const unpackFactors = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)
  return dot(rgba, unpackFactors)
})

/**
 * Convert 3D direction to 2D UV for packed cube shadow map
 *
 * Three.js packs 6 cube faces into a 2D texture with layout:
 * xzXZ (row 1), y Y (row 2)
 * lowercase = negative direction, uppercase = positive
 *
 * @returns TSL Fn that computes UV from 3D direction
 */
export const cubeToUV = Fn(([v, texelSizeY]: [Vec3Node, FloatNode]) => {
  const absV = abs(v)

  // Scale to unit cube intersection (guard against zero vector)
  const maxComponent = max(absV.x, max(absV.y, absV.z))
  const scaleToCube = float(1).div(max(maxComponent, float(0.0001)))
  const absVScaled = absV.mul(scaleToCube)

  // Apply scale to avoid seams (pull slightly inward from edges)
  const vScaled = v.mul(scaleToCube.mul(float(1).sub(texelSizeY.mul(2))))

  // Start with XY plane projection
  const planarX = vScaled.x.toVar('planarX')
  const planarY = vScaled.y.toVar('planarY')

  const almostATexel = texelSizeY.mul(1.5)
  const almostOne = float(1).sub(almostATexel)

  // Determine which face we're on and remap coordinates
  // Z faces
  // PARITY FIX: WebGL mutates v in place with scaling, so we must use vScaled.x
  // for the +Z face case (4.0 - v.x in WebGL becomes 4.0 - vScaled.x in TSL)
  const isZFace = absVScaled.z.greaterThanEqual(almostOne)
  const isPosZ = v.z.greaterThan(0)
  planarX.assign(
    select(
      isZFace,
      select(isPosZ, float(4).sub(vScaled.x), vScaled.x),
      planarX
    )
  )

  // X faces
  const isXFace = absVScaled.x.greaterThanEqual(almostOne).and(isZFace.not())
  const signX = sign(v.x)
  planarX.assign(
    select(isXFace, vScaled.z.mul(signX).add(signX.mul(2)), planarX)
  )

  // Y faces
  const isYFace = absVScaled.y.greaterThanEqual(almostOne).and(isZFace.not()).and(isXFace.not())
  const signY = sign(v.y)
  planarX.assign(select(isYFace, vScaled.x.add(signY.mul(2)).add(2), planarX))
  planarY.assign(select(isYFace, vScaled.z.mul(signY).sub(2), planarY))

  // Map from [-4,4] x [-2,2] to [0,1] x [0,1]
  const uv = vec2(planarX, planarY).mul(vec2(0.125, 0.25)).add(vec2(0.375, 0.75))
  return uv
})

/**
 * Sample point shadow map by index using select() chain
 *
 * @param uniforms - Shadow uniforms
 * @param lightIndex - Light index (0-3)
 * @param uv - UV coordinates
 * @returns RGBA sample from point shadow map
 */
export const samplePointShadowMapByIndex = (uniforms: ShadowTSLUniforms) =>
  Fn(([lightIndex, uv]: [IntNode, Vec2Node]) => {
    // TextureNode.sample(uv) samples the texture at given UV coordinates
    return select(
      lightIndex.equal(0),
      uniforms.uPointShadowMap0.sample(uv),
      select(
        lightIndex.equal(1),
        uniforms.uPointShadowMap1.sample(uv),
        select(
          lightIndex.equal(2),
          uniforms.uPointShadowMap2.sample(uv),
          select(
            lightIndex.equal(3),
            uniforms.uPointShadowMap3.sample(uv),
            vec4(1, 1, 1, 1) // Default: fully lit
          )
        )
      )
    )
  })

/**
 * Hard point shadow sampling
 *
 * @param uniforms - Shadow uniforms
 * @param lightPositions - Flat array of light positions (vec3 x MAX_LIGHTS)
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const samplePointShadowHard = (
  uniforms: ShadowTSLUniforms,
  lightPositions: ReturnType<typeof vec3>[]
) =>
  Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const samplePointMap = samplePointShadowMapByIndex(uniforms)

    // Get light position by index
    const lightPos = select(
      lightIndex.equal(0),
      lightPositions[0]!,
      select(
        lightIndex.equal(1),
        lightPositions[1]!,
        select(
          lightIndex.equal(2),
          lightPositions[2]!,
          select(lightIndex.equal(3), lightPositions[3]!, vec3(0, 0, 0))
        )
      )
    )

    // Light to fragment direction
    const lightToFrag = worldPos.sub(lightPos)
    const lightDistance = length(lightToFrag)

    // Guard against zero distance
    const tooClose = lightDistance.lessThan(0.0001)

    // CRITICAL: Use safe normalize - lightToFrag can be zero when tooClose is true
    // GPU evaluates this even before tooClose check returns
    const lightDir = safeNormalizeUp(lightToFrag)

    // Range check
    const cameraNear = uniforms.uShadowCameraNear
    const cameraFar = uniforms.uShadowCameraFar
    const outsideRange = lightDistance
      .greaterThan(cameraFar)
      .or(lightDistance.lessThan(cameraNear))

    // Calculate texel size for packed texture (4:2 aspect)
    const texelSizeY = float(1).div(uniforms.uShadowMapSize.mul(2))

    // Convert 3D direction to 2D UV
    const uv = cubeToUV(lightDir, texelSizeY)

    // Sample packed shadow map
    const shadowSample = samplePointMap(lightIndex, uv)
    const closestDepth = unpackRGBAToDepth(shadowSample)

    // Normalize fragment distance (matches MeshDistanceMaterial encoding)
    const depthRange = cameraFar.sub(cameraNear)
    const dp = lightDistance.sub(cameraNear).div(max(depthRange, float(0.0001)))

    // Point lights need larger bias (2x) due to cube map edge discontinuities
    const bias = uniforms.uShadowMapBias.mul(2)

    // Shadow comparison
    const inShadow = dp.add(bias).greaterThan(closestDepth)

    return select(
      tooClose.or(outsideRange),
      float(1),
      select(inShadow, float(0), float(1))
    )
  })

/**
 * PCF point shadow sampling (3x3 kernel with angular offsets)
 *
 * @param uniforms - Shadow uniforms
 * @param lightPositions - Array of light position nodes
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const samplePointShadowPCF = (
  uniforms: ShadowTSLUniforms,
  lightPositions: ReturnType<typeof vec3>[]
) =>
  Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const samplePointMap = samplePointShadowMapByIndex(uniforms)

    // Get light position
    const lightPos = select(
      lightIndex.equal(0),
      lightPositions[0]!,
      select(
        lightIndex.equal(1),
        lightPositions[1]!,
        select(
          lightIndex.equal(2),
          lightPositions[2]!,
          select(lightIndex.equal(3), lightPositions[3]!, vec3(0, 0, 0))
        )
      )
    )

    const lightToFrag = worldPos.sub(lightPos)
    const lightDistance = length(lightToFrag)
    const tooClose = lightDistance.lessThan(0.0001)
    // CRITICAL: Use safe normalize - lightToFrag can be zero when tooClose is true
    const lightDir = safeNormalizeUp(lightToFrag)

    // Range check
    const cameraNear = uniforms.uShadowCameraNear
    const cameraFar = uniforms.uShadowCameraFar
    const outsideRange = lightDistance
      .greaterThan(cameraFar)
      .or(lightDistance.lessThan(cameraNear))

    const texelSizeY = float(1).div(uniforms.uShadowMapSize.mul(2))

    // Normalize depth
    const depthRange = cameraFar.sub(cameraNear)
    const dp = lightDistance.sub(cameraNear).div(max(depthRange, float(0.0001)))
    const bias = uniforms.uShadowMapBias.mul(2)

    // Create perpendicular vectors for PCF offset sampling
    // When lightDir is nearly vertical, use X-axis as alternative
    const isVertical = abs(lightDir.y).greaterThan(0.999)
    const up = select(isVertical, vec3(1, 0, 0), vec3(0, 1, 0))
    // CRITICAL: Use safe normalize - cross product can be zero if parallel
    const perpX = safeNormalize3(lightDir.cross(up), vec3(1, 0, 0))
    const perpY = safeNormalize3(lightDir.cross(perpX), vec3(0, 0, 1))

    // PCF with 9 samples (3x3) - unrolled for TSL compatibility
    // TSL Loop indices don't support .toFloat(), so use manual offsets
    const shadow = float(0).toVar('shadowSum')
    const radius = float(0.002) // Angular offset

    // 3x3 offsets: [-1,-1], [0,-1], [1,-1], [-1,0], [0,0], [1,0], [-1,1], [0,1], [1,1]
    const offsets: [number, number][] = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [0, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1],
    ]

    for (const [ox, oy] of offsets) {
      // Offset direction for PCF sampling
      // CRITICAL: Use safe normalize - offset could theoretically cancel direction
      const offsetDir = safeNormalize3(
        lightDir.add(perpX.mul(float(ox).mul(radius))).add(perpY.mul(float(oy).mul(radius))),
        lightDir
      )

      const uv = cubeToUV(offsetDir, texelSizeY)
      const shadowSample = samplePointMap(lightIndex, uv)
      const closestDepth = unpackRGBAToDepth(shadowSample)

      // Compare in normalized space
      const lit = dp.add(bias).lessThanEqual(closestDepth)
      shadow.addAssign(select(lit, float(1), float(0)))
    }

    const shadowFactor = shadow.div(9)

    return select(tooClose.or(outsideRange), float(1), shadowFactor)
  })

/**
 * Unified point shadow sampling
 * Selects hard or PCF based on uShadowPCFSamples
 *
 * @param uniforms - Shadow uniforms
 * @param lightPositions - Array of light position nodes
 * @returns TSL Fn that computes shadow factor (0-1)
 */
export const samplePointShadow = (
  uniforms: ShadowTSLUniforms,
  lightPositions: ReturnType<typeof vec3>[]
) =>
  Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const usePCF = uniforms.uShadowPCFSamples.greaterThan(0)

    const hardShadow = samplePointShadowHard(uniforms, lightPositions)
    const pcfShadow = samplePointShadowPCF(uniforms, lightPositions)

    return select(usePCF, pcfShadow(lightIndex, worldPos), hardShadow(lightIndex, worldPos))
  })
