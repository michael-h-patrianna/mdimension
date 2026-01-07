/**
 * Flat TSL Shadow Sampling (WebGPU-Safe)
 *
 * CRITICAL: This module provides shadow sampling with ZERO nested Fn() calls.
 * WebGPU bind groups are fixed at material compilation time, so texture sampling
 * inside nested Fn() causes "Invalid PipelineLayout" errors.
 *
 * Pattern: Sample ALL textures at the TOP level, then use select() on float results.
 *
 * @module rendering/tsl/shadows/shadow-flat
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

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec2Node = ReturnType<typeof vec2>
type Vec3Node = ReturnType<typeof vec3>
type Vec4Node = ReturnType<typeof vec4>
type IntNode = ReturnType<typeof int>

// =============================================================================
// Helper: Unpack RGBA to depth (for point shadows)
// =============================================================================

/**
 * Unpack RGBA to depth value (Three.js packing format)
 * INLINE - not a separate Fn()
 */
function unpackRGBAToDepthInline(rgba: Vec4Node): FloatNode {
  const unpackFactors = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)
  return dot(rgba, unpackFactors)
}

/**
 * Convert 3D direction to 2D UV for packed cube shadow map
 * INLINE - not a separate Fn()
 */
function cubeToUVInline(v: Vec3Node, texelSizeY: FloatNode): Vec2Node {
  const absV = abs(v)

  // Scale to unit cube intersection
  const maxComponent = max(absV.x, max(absV.y, absV.z))
  const scaleToCube = float(1).div(max(maxComponent, float(0.0001)))
  const absVScaled = absV.mul(scaleToCube)

  // Apply scale to avoid seams
  const vScaled = v.mul(scaleToCube.mul(float(1).sub(texelSizeY.mul(2))))

  // Start with XY plane projection
  const planarX = vScaled.x.toVar('planarX')
  const planarY = vScaled.y.toVar('planarY')

  const almostATexel = texelSizeY.mul(1.5)
  const almostOne = float(1).sub(almostATexel)

  // Z faces
  const isZFace = absVScaled.z.greaterThanEqual(almostOne)
  const isPosZ = v.z.greaterThan(0)
  planarX.assign(
    select(isZFace, select(isPosZ, float(4).sub(vScaled.x), vScaled.x), planarX)
  )

  // X faces
  const isXFace = absVScaled.x.greaterThanEqual(almostOne).and(isZFace.not())
  const signX = sign(v.x)
  planarX.assign(select(isXFace, vScaled.z.mul(signX).add(signX.mul(2)), planarX))

  // Y faces
  const isYFace = absVScaled.y.greaterThanEqual(almostOne).and(isZFace.not()).and(isXFace.not())
  const signY = sign(v.y)
  planarX.assign(select(isYFace, vScaled.x.add(signY.mul(2)).add(2), planarX))
  planarY.assign(select(isYFace, vScaled.z.mul(signY).sub(2), planarY))

  // Map from [-4,4] x [-2,2] to [0,1] x [0,1]
  return vec2(planarX, planarY).mul(vec2(0.125, 0.25)).add(vec2(0.375, 0.75))
}

// =============================================================================
// Flat Directional/Spot Shadow Sampler
// =============================================================================

/**
 * Create a flat directional/spot shadow sampler.
 *
 * CRITICAL: Returns a SINGLE Fn() with NO nested Fn() calls.
 * All 4 shadow maps are sampled at the top level, then select() picks the right one.
 *
 * @param uniforms - Shadow TSL uniforms
 * @returns TSL Fn that computes shadow factor (0=shadow, 1=lit)
 */
export function createFlatDirectionalShadowSampler(uniforms: ShadowTSLUniforms) {
  return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    const pos4 = vec4(worldPos, 1)

    // =========================================================================
    // Step 1: Compute shadow coords for ALL lights (inline, no Fn calls)
    // =========================================================================
    const shadowCoord0 = uniforms.uShadowMatrix0.mul(pos4)
    const shadowCoord1 = uniforms.uShadowMatrix1.mul(pos4)
    const shadowCoord2 = uniforms.uShadowMatrix2.mul(pos4)
    const shadowCoord3 = uniforms.uShadowMatrix3.mul(pos4)

    // Select the right shadow coord based on light index
    const shadowCoord = select(
      lightIndex.equal(0),
      shadowCoord0,
      select(
        lightIndex.equal(1),
        shadowCoord1,
        select(lightIndex.equal(2), shadowCoord2, shadowCoord3)
      )
    )

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

    // =========================================================================
    // Step 2: Sample ALL shadow maps at their UVs (top-level, no nested Fn)
    // =========================================================================

    // Compute UV for each shadow map (each uses its own shadow coord)
    // XY: NDC [-1,1] to texture [0,1]. Z: WebGPU NDC is already [0,1]
    const w0 = max(abs(shadowCoord0.w), float(0.0001))
    const projCoord0 = shadowCoord0.xyz.div(w0)
    const texCoordXY0 = projCoord0.xy.mul(0.5).add(0.5)

    const w1 = max(abs(shadowCoord1.w), float(0.0001))
    const projCoord1 = shadowCoord1.xyz.div(w1)
    const texCoordXY1 = projCoord1.xy.mul(0.5).add(0.5)

    const w2 = max(abs(shadowCoord2.w), float(0.0001))
    const projCoord2 = shadowCoord2.xyz.div(w2)
    const texCoordXY2 = projCoord2.xy.mul(0.5).add(0.5)

    const w3 = max(abs(shadowCoord3.w), float(0.0001))
    const projCoord3 = shadowCoord3.xyz.div(w3)
    const texCoordXY3 = projCoord3.xy.mul(0.5).add(0.5)

    // Sample all 4 shadow maps (CRITICAL: direct sampling at top level)
    const depth0 = uniforms.uShadowMap0.sample(texCoordXY0).r
    const depth1 = uniforms.uShadowMap1.sample(texCoordXY1).r
    const depth2 = uniforms.uShadowMap2.sample(texCoordXY2).r
    const depth3 = uniforms.uShadowMap3.sample(texCoordXY3).r

    // =========================================================================
    // Step 3: Select the right sampled depth based on light index
    // =========================================================================
    const closestDepth = select(
      lightIndex.equal(0),
      depth0,
      select(lightIndex.equal(1), depth1, select(lightIndex.equal(2), depth2, depth3))
    )

    const bias = uniforms.uShadowMapBias

    // Shadow comparison
    const inShadow = currentDepth.greaterThan(closestDepth.add(bias))

    return select(outside, float(1), select(inShadow, float(0), float(1)))
  })
}

// =============================================================================
// Flat Point Shadow Sampler
// =============================================================================

/**
 * Create a flat point shadow sampler.
 *
 * CRITICAL: Returns a SINGLE Fn() with NO nested Fn() calls.
 * All 4 point shadow maps are sampled at the top level.
 *
 * @param uniforms - Shadow TSL uniforms
 * @param lightPositions - Array of light position vec3 nodes
 * @returns TSL Fn that computes shadow factor (0=shadow, 1=lit)
 */
export function createFlatPointShadowSampler(
  uniforms: ShadowTSLUniforms,
  lightPositions: ReturnType<typeof vec3>[]
) {
  return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    // =========================================================================
    // Step 1: Compute light directions for ALL lights (inline)
    // =========================================================================
    const lightToFrag0 = worldPos.sub(lightPositions[0]!)
    const lightToFrag1 = worldPos.sub(lightPositions[1]!)
    const lightToFrag2 = worldPos.sub(lightPositions[2]!)
    const lightToFrag3 = worldPos.sub(lightPositions[3]!)

    const lightDist0 = length(lightToFrag0)
    const lightDist1 = length(lightToFrag1)
    const lightDist2 = length(lightToFrag2)
    const lightDist3 = length(lightToFrag3)

    const lightDir0 = safeNormalizeUp(lightToFrag0)
    const lightDir1 = safeNormalizeUp(lightToFrag1)
    const lightDir2 = safeNormalizeUp(lightToFrag2)
    const lightDir3 = safeNormalizeUp(lightToFrag3)

    // Select the right values based on light index
    const lightDistance = select(
      lightIndex.equal(0),
      lightDist0,
      select(lightIndex.equal(1), lightDist1, select(lightIndex.equal(2), lightDist2, lightDist3))
    )

    const tooClose = lightDistance.lessThan(0.0001)

    // Range check
    const cameraNear = uniforms.uShadowCameraNear
    const cameraFar = uniforms.uShadowCameraFar
    const outsideRange = lightDistance.greaterThan(cameraFar).or(lightDistance.lessThan(cameraNear))

    // Texel size for packed texture
    const texelSizeY = float(1).div(uniforms.uShadowMapSize.mul(2))

    // =========================================================================
    // Step 2: Compute UVs and sample ALL point shadow maps (top-level)
    // =========================================================================
    const uv0 = cubeToUVInline(lightDir0, texelSizeY)
    const uv1 = cubeToUVInline(lightDir1, texelSizeY)
    const uv2 = cubeToUVInline(lightDir2, texelSizeY)
    const uv3 = cubeToUVInline(lightDir3, texelSizeY)

    // Sample all 4 point shadow maps (CRITICAL: direct sampling at top level)
    const sample0 = uniforms.uPointShadowMap0.sample(uv0)
    const sample1 = uniforms.uPointShadowMap1.sample(uv1)
    const sample2 = uniforms.uPointShadowMap2.sample(uv2)
    const sample3 = uniforms.uPointShadowMap3.sample(uv3)

    // Unpack RGBA to depth for each
    const closestDepth0 = unpackRGBAToDepthInline(sample0)
    const closestDepth1 = unpackRGBAToDepthInline(sample1)
    const closestDepth2 = unpackRGBAToDepthInline(sample2)
    const closestDepth3 = unpackRGBAToDepthInline(sample3)

    // =========================================================================
    // Step 3: Select the right depth based on light index
    // =========================================================================
    const closestDepth = select(
      lightIndex.equal(0),
      closestDepth0,
      select(
        lightIndex.equal(1),
        closestDepth1,
        select(lightIndex.equal(2), closestDepth2, closestDepth3)
      )
    )

    // Normalize fragment distance
    const depthRange = cameraFar.sub(cameraNear)
    const dp = lightDistance.sub(cameraNear).div(max(depthRange, float(0.0001)))

    // Point lights need larger bias
    const bias = uniforms.uShadowMapBias.mul(2)

    // Shadow comparison
    const inShadow = dp.add(bias).greaterThan(closestDepth)

    return select(tooClose.or(outsideRange), float(1), select(inShadow, float(0), float(1)))
  })
}

// =============================================================================
// Unified Flat Shadow Sampler (TRULY FLAT - NO NESTED Fn())
// =============================================================================

// Light type constants
const LIGHT_TYPE_POINT = 0

/**
 * Create unified flat shadow sampler for all light types.
 *
 * CRITICAL: This is the WebGPU-safe version of shadow sampling.
 * ALL texture sampling happens at the TOP level of a SINGLE Fn().
 * ABSOLUTELY NO nested Fn() calls - everything is inlined.
 *
 * This samples ALL 8 shadow textures (4 directional + 4 point) upfront,
 * then uses select() chains to pick the right results.
 *
 * @param uniforms - Shadow TSL uniforms
 * @param lightTypes - Array of light type int nodes
 * @param lightPositions - Array of light position vec3 nodes
 * @returns TSL Fn that computes shadow factor (0=shadow, 1=lit)
 */
export function createFlatUnifiedShadowSampler(
  uniforms: ShadowTSLUniforms,
  lightTypes: ReturnType<typeof int>[],
  lightPositions: ReturnType<typeof vec3>[]
) {
  // Return a SINGLE Fn() - no nested Fn() calls inside
  return Fn(([lightIndex, worldPos]: [IntNode, Vec3Node]) => {
    // =========================================================================
    // DIRECTIONAL/SPOT SHADOW CALCULATIONS (all inline)
    // =========================================================================
    const pos4 = vec4(worldPos, 1)

    // Compute shadow coords for ALL lights
    const shadowCoord0 = uniforms.uShadowMatrix0.mul(pos4)
    const shadowCoord1 = uniforms.uShadowMatrix1.mul(pos4)
    const shadowCoord2 = uniforms.uShadowMatrix2.mul(pos4)
    const shadowCoord3 = uniforms.uShadowMatrix3.mul(pos4)

    // Perspective divide and UV compute for each
    // XY: NDC [-1,1] to texture [0,1]. Z: WebGPU NDC is already [0,1]
    const w0 = max(abs(shadowCoord0.w), float(0.0001))
    const dirProjCoord0 = shadowCoord0.xyz.div(w0)
    const dirTexCoordXY0 = dirProjCoord0.xy.mul(0.5).add(0.5)

    const w1 = max(abs(shadowCoord1.w), float(0.0001))
    const dirProjCoord1 = shadowCoord1.xyz.div(w1)
    const dirTexCoordXY1 = dirProjCoord1.xy.mul(0.5).add(0.5)

    const w2 = max(abs(shadowCoord2.w), float(0.0001))
    const dirProjCoord2 = shadowCoord2.xyz.div(w2)
    const dirTexCoordXY2 = dirProjCoord2.xy.mul(0.5).add(0.5)

    const w3 = max(abs(shadowCoord3.w), float(0.0001))
    const dirProjCoord3 = shadowCoord3.xyz.div(w3)
    const dirTexCoordXY3 = dirProjCoord3.xy.mul(0.5).add(0.5)

    // Sample ALL directional shadow maps (CRITICAL: top-level sampling)
    const dirDepth0 = uniforms.uShadowMap0.sample(dirTexCoordXY0).r
    const dirDepth1 = uniforms.uShadowMap1.sample(dirTexCoordXY1).r
    const dirDepth2 = uniforms.uShadowMap2.sample(dirTexCoordXY2).r
    const dirDepth3 = uniforms.uShadowMap3.sample(dirTexCoordXY3).r

    // =========================================================================
    // POINT SHADOW CALCULATIONS (all inline)
    // =========================================================================
    const lightToFrag0 = worldPos.sub(lightPositions[0]!)
    const lightToFrag1 = worldPos.sub(lightPositions[1]!)
    const lightToFrag2 = worldPos.sub(lightPositions[2]!)
    const lightToFrag3 = worldPos.sub(lightPositions[3]!)

    const lightDist0 = length(lightToFrag0)
    const lightDist1 = length(lightToFrag1)
    const lightDist2 = length(lightToFrag2)
    const lightDist3 = length(lightToFrag3)

    const lightDir0 = safeNormalizeUp(lightToFrag0)
    const lightDir1 = safeNormalizeUp(lightToFrag1)
    const lightDir2 = safeNormalizeUp(lightToFrag2)
    const lightDir3 = safeNormalizeUp(lightToFrag3)

    // Texel size for packed texture
    const texelSizeY = float(1).div(uniforms.uShadowMapSize.mul(2))

    // Compute UVs for point shadow maps
    const pointUV0 = cubeToUVInline(lightDir0, texelSizeY)
    const pointUV1 = cubeToUVInline(lightDir1, texelSizeY)
    const pointUV2 = cubeToUVInline(lightDir2, texelSizeY)
    const pointUV3 = cubeToUVInline(lightDir3, texelSizeY)

    // Sample ALL point shadow maps (CRITICAL: top-level sampling)
    const pointSample0 = uniforms.uPointShadowMap0.sample(pointUV0)
    const pointSample1 = uniforms.uPointShadowMap1.sample(pointUV1)
    const pointSample2 = uniforms.uPointShadowMap2.sample(pointUV2)
    const pointSample3 = uniforms.uPointShadowMap3.sample(pointUV3)

    // Unpack RGBA to depth
    const pointDepth0 = unpackRGBAToDepthInline(pointSample0)
    const pointDepth1 = unpackRGBAToDepthInline(pointSample1)
    const pointDepth2 = unpackRGBAToDepthInline(pointSample2)
    const pointDepth3 = unpackRGBAToDepthInline(pointSample3)

    // =========================================================================
    // SELECT BASED ON LIGHT INDEX
    // =========================================================================

    // Get light type
    const lightType = select(
      lightIndex.equal(0),
      lightTypes[0]!,
      select(
        lightIndex.equal(1),
        lightTypes[1]!,
        select(lightIndex.equal(2), lightTypes[2]!, lightTypes[3]!)
      )
    )
    const isPointLight = lightType.equal(LIGHT_TYPE_POINT)

    // Select the right shadow coord for directional
    const selectedShadowCoord = select(
      lightIndex.equal(0),
      shadowCoord0,
      select(
        lightIndex.equal(1),
        shadowCoord1,
        select(lightIndex.equal(2), shadowCoord2, shadowCoord3)
      )
    )

    // Directional: frustum check
    // XY: NDC [-1,1] to texture [0,1]. Z: WebGPU NDC is already [0,1]
    const wSelected = max(abs(selectedShadowCoord.w), float(0.0001))
    const dirProjCoord = selectedShadowCoord.xyz.div(wSelected)
    const dirTexCoordXY = dirProjCoord.xy.mul(0.5).add(0.5)
    const dirCurrentDepth = clamp(dirProjCoord.z, float(0), float(1))
    const outsideX = dirTexCoordXY.x.lessThan(0).or(dirTexCoordXY.x.greaterThan(1))
    const outsideY = dirTexCoordXY.y.lessThan(0).or(dirTexCoordXY.y.greaterThan(1))
    const outsideZ = dirCurrentDepth.lessThan(0).or(dirCurrentDepth.greaterThan(1))
    const dirOutside = outsideX.or(outsideY).or(outsideZ)

    // Select directional depth
    const dirClosestDepth = select(
      lightIndex.equal(0),
      dirDepth0,
      select(lightIndex.equal(1), dirDepth1, select(lightIndex.equal(2), dirDepth2, dirDepth3))
    )

    // Directional shadow comparison
    const dirBias = uniforms.uShadowMapBias
    const dirInShadow = dirCurrentDepth.greaterThan(dirClosestDepth.add(dirBias))
    const dirShadowFactor = select(dirOutside, float(1), select(dirInShadow, float(0), float(1)))

    // Point: select distance and depth
    const selectedLightDist = select(
      lightIndex.equal(0),
      lightDist0,
      select(lightIndex.equal(1), lightDist1, select(lightIndex.equal(2), lightDist2, lightDist3))
    )

    const pointClosestDepth = select(
      lightIndex.equal(0),
      pointDepth0,
      select(
        lightIndex.equal(1),
        pointDepth1,
        select(lightIndex.equal(2), pointDepth2, pointDepth3)
      )
    )

    // Point: range check
    const cameraNear = uniforms.uShadowCameraNear
    const cameraFar = uniforms.uShadowCameraFar
    const tooClose = selectedLightDist.lessThan(0.0001)
    const outsideRange = selectedLightDist
      .greaterThan(cameraFar)
      .or(selectedLightDist.lessThan(cameraNear))

    // Point shadow comparison
    const depthRange = cameraFar.sub(cameraNear)
    const pointDp = selectedLightDist.sub(cameraNear).div(max(depthRange, float(0.0001)))
    const pointBias = uniforms.uShadowMapBias.mul(2)
    const pointInShadow = pointDp.add(pointBias).greaterThan(pointClosestDepth)
    const pointShadowFactor = select(
      tooClose.or(outsideRange),
      float(1),
      select(pointInShadow, float(0), float(1))
    )

    // =========================================================================
    // FINAL: Select based on light type and shadow casting
    // =========================================================================
    // Check if this light casts shadows using vec4 components via select chain
    // NOTE: Using vec4.x/y/z/w instead of uniformArray.element() because
    // uniformArray.element() causes "Invalid PipelineLayout" errors in WebGPU
    const castsShadowValue = select(
      lightIndex.equal(0),
      uniforms.uLightCastsShadow.x,
      select(
        lightIndex.equal(1),
        uniforms.uLightCastsShadow.y,
        select(
          lightIndex.equal(2),
          uniforms.uLightCastsShadow.z,
          uniforms.uLightCastsShadow.w
        )
      )
    )
    const castsShadow = castsShadowValue.greaterThan(0.5)
    const shadowFactor = select(isPointLight, pointShadowFactor, dirShadowFactor)

    return select(castsShadow, shadowFactor, float(1))
  })
}
