/**
 * Pre-computed Shadow Sampling for TSL
 *
 * Optimized shadow sampling that mirrors WebGL's efficient pattern.
 * The key insight: TSL's select() evaluates ALL branches, so we must
 * sample each texture exactly ONCE, then select from pre-computed values.
 *
 * WebGL pattern (efficient - if-chains short-circuit):
 *   if (index == 0) return texture(uShadowMap0, uv).r;
 *   if (index == 1) return texture(uShadowMap1, uv).r;
 *
 * Naive TSL (broken - evaluates all branches):
 *   select(idx.equal(0), tex0.sample(uv).r, select(...))
 *
 * Optimized TSL (this file - sample once, select from results):
 *   const shadow0 = sampleShadowForLight0(worldPos)
 *   const shadow1 = sampleShadowForLight1(worldPos)
 *   ...
 *   return select(idx.equal(0), shadow0, select(idx.equal(1), shadow1, ...))
 *
 * @module rendering/tsl/shadows/shadow-precompute
 */

import {
  abs,
  clamp,
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
import { safeNormalizeUp } from '../utils/safe-math'
import { LIGHT_TYPE_POINT } from '../lighting/light-uniforms'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>
type Vec4Node = ReturnType<typeof vec4>
type IntNode = ReturnType<typeof int>

// =============================================================================
// CubeToUV - Point Light Direction to UV Mapping
// =============================================================================

/**
 * Convert 3D direction to 2D UV for packed cube shadow map
 * Three.js packs 6 cube faces into a 2D texture (4:2 layout)
 */
const cubeToUV = Fn(([v, texelSizeY]: [Vec3Node, FloatNode]) => {
  const absV = abs(v)
  const maxComponent = max(absV.x, max(absV.y, absV.z))
  const scaleToCube = float(1).div(max(maxComponent, float(0.0001)))
  const absVScaled = absV.mul(scaleToCube)
  const vScaled = v.mul(scaleToCube.mul(float(1).sub(texelSizeY.mul(2))))

  const planarX = vScaled.x.toVar('planarX')
  const planarY = vScaled.y.toVar('planarY')

  const almostATexel = texelSizeY.mul(1.5)
  const almostOne = float(1).sub(almostATexel)

  // Z faces
  const isZFace = absVScaled.z.greaterThanEqual(almostOne)
  const isPosZ = v.z.greaterThan(0)
  planarX.assign(select(isZFace, select(isPosZ, float(4).sub(vScaled.x), vScaled.x), planarX))

  // X faces
  const isXFace = absVScaled.x.greaterThanEqual(almostOne).and(isZFace.not())
  const signX = sign(v.x)
  planarX.assign(select(isXFace, vScaled.z.mul(signX).add(signX.mul(2)), planarX))

  // Y faces
  const isYFace = absVScaled.y.greaterThanEqual(almostOne).and(isZFace.not()).and(isXFace.not())
  const signY = sign(v.y)
  planarX.assign(select(isYFace, vScaled.x.add(signY.mul(2)).add(2), planarX))
  planarY.assign(select(isYFace, vScaled.z.mul(signY).sub(2), planarY))

  return vec2(planarX, planarY).mul(vec2(0.125, 0.25)).add(vec2(0.375, 0.75))
})

/**
 * Unpack RGBA to depth value (Three.js packing format)
 */
const unpackRGBAToDepth = Fn(([rgba]: [Vec4Node]) => {
  const unpackFactors = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)
  return dot(rgba, unpackFactors)
})

// =============================================================================
// Per-Light Shadow Samplers (Direct - No Select)
// =============================================================================

/**
 * Create a directional/spot shadow sampler for a SPECIFIC light index.
 * Samples the specific texture directly - NO select() chains.
 */
function createDirSpotShadowSamplerForLight(
  uniforms: ShadowTSLUniforms,
  lightIndex: 0 | 1 | 2 | 3
) {
  // Get the specific shadow map and matrix for this light
  const shadowMap = [
    uniforms.uShadowMap0,
    uniforms.uShadowMap1,
    uniforms.uShadowMap2,
    uniforms.uShadowMap3,
  ][lightIndex]!

  const shadowMatrix = [
    uniforms.uShadowMatrix0,
    uniforms.uShadowMatrix1,
    uniforms.uShadowMatrix2,
    uniforms.uShadowMatrix3,
  ][lightIndex]!

  return Fn(([worldPos]: [Vec3Node]) => {
    const pos4 = vec4(worldPos, 1)
    const shadowCoord = shadowMatrix.mul(pos4)

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

    // Sample THIS specific shadow map (direct, no select)
    const closestDepth = shadowMap.sample(texCoordXY).r
    const bias = uniforms.uShadowMapBias

    // Shadow comparison
    const inShadow = currentDepth.greaterThan(closestDepth.add(bias))

    return select(outside, float(1), select(inShadow, float(0), float(1)))
  })
}

/**
 * Create a point shadow sampler for a SPECIFIC light index.
 * Samples the specific texture directly - NO select() chains.
 */
function createPointShadowSamplerForLight(
  uniforms: ShadowTSLUniforms,
  lightIndex: 0 | 1 | 2 | 3,
  lightPosition: Vec3Node
) {
  // Get the specific point shadow map for this light
  const pointShadowMap = [
    uniforms.uPointShadowMap0,
    uniforms.uPointShadowMap1,
    uniforms.uPointShadowMap2,
    uniforms.uPointShadowMap3,
  ][lightIndex]!

  return Fn(([worldPos]: [Vec3Node]) => {
    const lightToFrag = worldPos.sub(lightPosition)
    const lightDistance = length(lightToFrag)
    const tooClose = lightDistance.lessThan(0.0001)
    const lightDir = safeNormalizeUp(lightToFrag)

    // Range check
    const cameraNear = uniforms.uShadowCameraNear
    const cameraFar = uniforms.uShadowCameraFar
    const outsideRange = lightDistance.greaterThan(cameraFar).or(lightDistance.lessThan(cameraNear))

    // UV for packed cube map
    const texelSizeY = float(1).div(uniforms.uShadowMapSize.mul(2))
    const uv = cubeToUV(lightDir, texelSizeY)

    // Sample THIS specific point shadow map (direct, no select)
    const shadowSample = pointShadowMap.sample(uv)
    const closestDepth = unpackRGBAToDepth(shadowSample)

    // Depth comparison
    const depthRange = cameraFar.sub(cameraNear)
    const dp = lightDistance.sub(cameraNear).div(max(depthRange, float(0.0001)))
    const bias = uniforms.uShadowMapBias.mul(2) // Point lights need larger bias
    const inShadow = dp.add(bias).greaterThan(closestDepth)

    return select(tooClose.or(outsideRange), float(1), select(inShadow, float(0), float(1)))
  })
}

// =============================================================================
// Pre-computed Shadow System
// =============================================================================

/**
 * Create a pre-computed shadow system for all lights.
 *
 * This is the TSL equivalent of WebGL's efficient shadow sampling.
 * Each shadow map is sampled exactly ONCE, and results are stored
 * for selection by light index.
 *
 * @param uniforms - Shadow uniforms with all shadow maps
 * @param lightPositions - Array of 4 light position nodes
 * @param lightTypes - Light type uniform array
 * @param castsShadow - Per-light shadow enable flags
 * @returns Function that computes shadow for any light index
 */
export function createPrecomputedShadowSystem(
  uniforms: ShadowTSLUniforms,
  lightPositions: Vec3Node[],
  lightTypes: ReturnType<typeof int>[], // Array of light type nodes
  castsShadow: FloatNode[] // Per-light shadow enable flags (0 or 1)
) {
  // Create per-light samplers at material creation time (OUTSIDE Fn)
  // Each sampler samples its SPECIFIC texture - no select() chains

  // Directional/Spot shadow samplers (one per light)
  const dirSpotSampler0 = createDirSpotShadowSamplerForLight(uniforms, 0)
  const dirSpotSampler1 = createDirSpotShadowSamplerForLight(uniforms, 1)
  const dirSpotSampler2 = createDirSpotShadowSamplerForLight(uniforms, 2)
  const dirSpotSampler3 = createDirSpotShadowSamplerForLight(uniforms, 3)

  // Point shadow samplers (one per light, with specific light position)
  const pointSampler0 = createPointShadowSamplerForLight(uniforms, 0, lightPositions[0]!)
  const pointSampler1 = createPointShadowSamplerForLight(uniforms, 1, lightPositions[1]!)
  const pointSampler2 = createPointShadowSamplerForLight(uniforms, 2, lightPositions[2]!)
  const pointSampler3 = createPointShadowSamplerForLight(uniforms, 3, lightPositions[3]!)

  /**
   * Pre-compute all shadow values for a given world position.
   * Each texture is sampled exactly ONCE.
   * Returns a function that retrieves shadow by light index.
   */
  return Fn(([worldPos]: [Vec3Node]) => {
    // Sample all dir/spot shadows ONCE
    const ds0 = dirSpotSampler0(worldPos)
    const ds1 = dirSpotSampler1(worldPos)
    const ds2 = dirSpotSampler2(worldPos)
    const ds3 = dirSpotSampler3(worldPos)

    // Sample all point shadows ONCE
    const ps0 = pointSampler0(worldPos)
    const ps1 = pointSampler1(worldPos)
    const ps2 = pointSampler2(worldPos)
    const ps3 = pointSampler3(worldPos)

    // Select point vs dir/spot per light based on light type
    const shadow0 = select(lightTypes[0]!.equal(LIGHT_TYPE_POINT), ps0, ds0)
    const shadow1 = select(lightTypes[1]!.equal(LIGHT_TYPE_POINT), ps1, ds1)
    const shadow2 = select(lightTypes[2]!.equal(LIGHT_TYPE_POINT), ps2, ds2)
    const shadow3 = select(lightTypes[3]!.equal(LIGHT_TYPE_POINT), ps3, ds3)

    // Apply castsShadow flags (0 = no shadow, 1 = use computed shadow)
    const s0 = select(castsShadow[0]!.greaterThan(0.5), shadow0, float(1))
    const s1 = select(castsShadow[1]!.greaterThan(0.5), shadow1, float(1))
    const s2 = select(castsShadow[2]!.greaterThan(0.5), shadow2, float(1))
    const s3 = select(castsShadow[3]!.greaterThan(0.5), shadow3, float(1))

    // Return all 4 shadow values packed as vec4
    return vec4(s0, s1, s2, s3)
  })
}

/**
 * Get shadow for a specific light from pre-computed shadow values.
 * Uses select() only on pre-computed float values (cheap).
 */
export const getShadowFromPrecomputed = Fn(
  ([precomputedShadows, lightIndex]: [Vec4Node, IntNode]) => {
    return select(
      lightIndex.equal(0),
      precomputedShadows.x,
      select(
        lightIndex.equal(1),
        precomputedShadows.y,
        select(
          lightIndex.equal(2),
          precomputedShadows.z,
          select(lightIndex.equal(3), precomputedShadows.w, float(1))
        )
      )
    )
  }
)
