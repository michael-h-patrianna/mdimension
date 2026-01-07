/**
 * TSL IBL (Image-Based Lighting) Module
 *
 * Provides PMREM environment map sampling for specular and diffuse IBL.
 * 100% port of WebGL ibl.glsl.ts - same algorithms, same constants.
 *
 * PMREM textures are 2D textures that encode cubemap data in a special format
 * that allows efficient roughness-based mip sampling.
 *
 * @module rendering/tsl/lighting/ibl
 */

import { ClampToEdgeWrapping, CubeUVReflectionMapping, DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from 'three'
import {
  abs,
  clamp,
  dot,
  exp2,
  float,
  floor,
  Fn,
  fract,
  log2,
  max,
  mix,
  pow,
  reflect,
  select,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

import type { Texture } from 'three'
import type { TextureNode, UniformNode } from 'three/tsl'
import { safeNormalize3 } from '../utils/safe-math'

// Type aliases
type FloatNode = ReturnType<typeof float>
type Vec3Node = ReturnType<typeof vec3>

// PMREM constants (match WebGL exactly)
const CUBE_UV_MIN_MIP_LEVEL = 4.0
const CUBE_UV_MIN_TILE_SIZE = 16.0
const CUBEUV_MAX_MIP = 8.0
const CUBEUV_TEXEL_WIDTH = 1.0 / (3.0 * 256.0)
const CUBEUV_TEXEL_HEIGHT = 1.0 / (4.0 * 256.0)

// Roughness to mip mapping constants (match Three.js PMREMGenerator)
const cubeUV_r0 = 1.0
const cubeUV_m0 = -2.0
const cubeUV_r1 = 0.8
const cubeUV_m1 = -1.0
const cubeUV_r4 = 0.4
const cubeUV_m4 = 2.0
const cubeUV_r5 = 0.305
const cubeUV_m5 = 3.0
const cubeUV_r6 = 0.21
const cubeUV_m6 = 4.0

const PI = Math.PI

// Cached placeholder texture to avoid memory leaks (created once, reused)
let cachedPlaceholderTexture: DataTexture | null = null

/**
 * Create a placeholder texture that matches the format of PMREM environment maps.
 *
 * CRITICAL for WebGPU: The placeholder texture MUST match the format of the
 * runtime texture (PMREM environment map) to avoid "Invalid PipelineLayout" errors.
 * WebGPU bind group layouts are determined at pipeline creation time and cannot
 * change when texture.value is updated.
 *
 * Key requirements:
 * - Size: Larger than 1x1 to match expected texture type (16x16 minimum)
 * - Mapping: CubeUVReflectionMapping (matches PMREMGenerator output)
 * - Format: Same as runtime texture (RGBAFormat, UnsignedByteType)
 */
function getPlaceholderTexture(): DataTexture {
  if (!cachedPlaceholderTexture) {
    // Use 16x16 size to match expected PMREM texture type
    // 1x1 textures may cause WebGPU pipeline layout issues when updated
    const size = 16
    const data = new Uint8Array(size * size * 4).fill(128) // Neutral gray

    cachedPlaceholderTexture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)

    // CRITICAL: Match the mapping type of PMREM environment maps
    // PMREMGenerator outputs textures with CubeUVReflectionMapping
    cachedPlaceholderTexture.mapping = CubeUVReflectionMapping

    cachedPlaceholderTexture.minFilter = LinearFilter
    cachedPlaceholderTexture.magFilter = LinearFilter
    cachedPlaceholderTexture.wrapS = ClampToEdgeWrapping
    cachedPlaceholderTexture.wrapT = ClampToEdgeWrapping
    cachedPlaceholderTexture.needsUpdate = true
  }
  return cachedPlaceholderTexture
}

/**
 * IBL TSL uniforms interface
 */
export interface IBLTSLUniforms {
  uEnvMap: TextureNode
  uEnvMapSize: UniformNode<number>
  uIBLIntensity: UniformNode<number>
  uIBLQuality: UniformNode<number> // 0=off, 1=low, 2=high
  placeholderTexture: Texture
}

/**
 * Get cube face index from 3D direction
 * Exact port of WebGL getFace()
 */
export const getFace = Fn(([direction]: [Vec3Node]) => {
  const absDir = abs(direction)

  // Determine which axis has the largest component
  const xGtZ = absDir.x.greaterThan(absDir.z)
  const xGtY = absDir.x.greaterThan(absDir.y)
  const zGtY = absDir.z.greaterThan(absDir.y)
  const xPos = direction.x.greaterThan(0)
  const yPos = direction.y.greaterThan(0)
  const zPos = direction.z.greaterThan(0)

  // Face selection logic (matches WebGL exactly)
  const face = select(
    xGtZ,
    select(xGtY, select(xPos, float(0), float(3)), select(yPos, float(1), float(4))),
    select(zGtY, select(zPos, float(2), float(5)), select(yPos, float(1), float(4)))
  )

  return face
})

/**
 * Get UV coordinates for a cube face from 3D direction
 * Exact port of WebGL getUV()
 */
export const getUV = Fn(([direction, face]: [Vec3Node, FloatNode]) => {
  const absX = abs(direction.x)
  const absY = abs(direction.y)
  const absZ = abs(direction.z)

  // Face 0: +X
  const uv0 = vec2(direction.z, direction.y).div(absX)
  // Face 1: +Y
  const uv1 = vec2(direction.x.negate(), direction.z.negate()).div(absY)
  // Face 2: +Z
  const uv2 = vec2(direction.x.negate(), direction.y).div(absZ)
  // Face 3: -X
  const uv3 = vec2(direction.z.negate(), direction.y).div(absX)
  // Face 4: -Y
  const uv4 = vec2(direction.x.negate(), direction.z).div(absY)
  // Face 5: -Z
  const uv5 = vec2(direction.x, direction.y).div(absZ)

  const uv = select(
    face.equal(0),
    uv0,
    select(
      face.equal(1),
      uv1,
      select(
        face.equal(2),
        uv2,
        select(face.equal(3), uv3, select(face.equal(4), uv4, uv5))
      )
    )
  )

  // Map from [-1,1] to [0,1]
  return uv.mul(0.5).add(0.5)
})

/**
 * Bilinear sampling from PMREM CubeUV texture
 * Exact port of WebGL bilinearCubeUV()
 */
export const bilinearCubeUV = (envMap: TextureNode) =>
  Fn(([direction, mipInt]: [Vec3Node, FloatNode]) => {
    const face = getFace(direction)
    const filterInt = max(float(CUBE_UV_MIN_MIP_LEVEL).sub(mipInt), float(0))
    const mipClamped = max(mipInt, float(CUBE_UV_MIN_MIP_LEVEL))

    const faceSize = exp2(mipClamped)
    const baseUV = getUV(direction, face)
    const uv = baseUV.mul(faceSize.sub(2)).add(1)

    // Adjust for face > 2 (bottom row)
    const isFaceGt2 = face.greaterThan(2)
    const uvY = select(isFaceGt2, uv.y.add(faceSize), uv.y)
    const faceAdj = select(isFaceGt2, face.sub(3), face)

    const uvX = uv.x
      .add(faceAdj.mul(faceSize))
      .add(filterInt.mul(3).mul(CUBE_UV_MIN_TILE_SIZE))

    const uvYFinal = uvY.add(float(4).mul(exp2(float(CUBEUV_MAX_MIP)).sub(faceSize)))

    const finalUV = vec2(uvX.mul(CUBEUV_TEXEL_WIDTH), uvYFinal.mul(CUBEUV_TEXEL_HEIGHT))

    return envMap.sample(finalUV).rgb
  })

/**
 * Convert roughness to PMREM mip level
 * Exact port of WebGL roughnessToMip()
 */
export const roughnessToMip = Fn(([roughness]: [FloatNode]) => {
  // Piecewise linear mapping (matches PMREMGenerator)
  const rGtR1 = roughness.greaterThanEqual(cubeUV_r1)
  const rGtR4 = roughness.greaterThanEqual(cubeUV_r4)
  const rGtR5 = roughness.greaterThanEqual(cubeUV_r5)
  const rGtR6 = roughness.greaterThanEqual(cubeUV_r6)

  const mip0 = float(cubeUV_r0)
    .sub(roughness)
    .mul(cubeUV_m1 - cubeUV_m0)
    .div(cubeUV_r0 - cubeUV_r1)
    .add(cubeUV_m0)

  const mip1 = float(cubeUV_r1)
    .sub(roughness)
    .mul(cubeUV_m4 - cubeUV_m1)
    .div(cubeUV_r1 - cubeUV_r4)
    .add(cubeUV_m1)

  const mip4 = float(cubeUV_r4)
    .sub(roughness)
    .mul(cubeUV_m5 - cubeUV_m4)
    .div(cubeUV_r4 - cubeUV_r5)
    .add(cubeUV_m4)

  const mip5 = float(cubeUV_r5)
    .sub(roughness)
    .mul(cubeUV_m6 - cubeUV_m5)
    .div(cubeUV_r5 - cubeUV_r6)
    .add(cubeUV_m5)

  const mipLog = float(-2).mul(log2(roughness.mul(1.16)))

  return select(
    rGtR1,
    mip0,
    select(rGtR4, mip1, select(rGtR5, mip4, select(rGtR6, mip5, mipLog)))
  )
})

/**
 * Sample PMREM texture with roughness-based mip interpolation
 * Exact port of WebGL textureCubeUV()
 */
export const textureCubeUV = (envMap: TextureNode) =>
  // CRITICAL (docs/tsl.md §5): complex Fn compositions must be created OUTSIDE Fn()
  // to avoid WebGPU "Invalid PipelineLayout" errors.
  //
  // `bilinearCubeUV(envMap)` returns an Fn node, so create it here (material creation scope),
  // then reference it inside the returned Fn via closure.
  (() => {
    const sampleBilinear = bilinearCubeUV(envMap)

    return Fn(([sampleDir, roughness]: [Vec3Node, FloatNode]) => {
    const mip = clamp(roughnessToMip(roughness), float(cubeUV_m0), float(CUBEUV_MAX_MIP))
    const mipF = fract(mip)
    const mipInt = floor(mip)

      const color0 = sampleBilinear(sampleDir, mipInt)

      // Interpolate between mip levels if fractional
      const needsInterp = mipF.greaterThan(0)
      const color1 = sampleBilinear(sampleDir, mipInt.add(1))
      const interpColor = mix(color0, color1, mipF)

      return vec4(select(needsInterp, interpColor, color0), 1)
    })
  })()

/**
 * Fresnel-Schlick with roughness compensation for IBL
 * Exact port of WebGL fresnelSchlickRoughness()
 */
export const fresnelSchlickRoughness = Fn(
  ([cosTheta, F0, roughness]: [FloatNode, Vec3Node, FloatNode]) => {
    const oneMinusRough = float(1).sub(roughness)
    const maxF0 = max(vec3(oneMinusRough, oneMinusRough, oneMinusRough), F0)
    const t = clamp(float(1).sub(cosTheta), float(0), float(1))
    const t5 = pow(t, float(5))
    return F0.add(maxF0.sub(F0).mul(t5))
  }
)

/**
 * Compute IBL contribution using PMREM texture
 * Exact port of WebGL computeIBL()
 *
 * @param uniforms - IBL uniforms
 * @returns TSL Fn that computes IBL color contribution
 */
export const computeIBL = (uniforms: IBLTSLUniforms) =>
  // CRITICAL (docs/tsl.md §5): create complex nodes (Fn returning samplers) OUTSIDE Fn()
  // and reference inside via closure.
  (() => {
    const sampleCubeUV = textureCubeUV(uniforms.uEnvMap)

    return Fn(
      ([N, V, F0, roughness, metallic, albedo]: [
        Vec3Node,
        Vec3Node,
        Vec3Node,
        FloatNode,
        FloatNode,
        Vec3Node
      ]) => {
      // Early exit if IBL disabled
      const isOff = uniforms.uIBLQuality.equal(0)

      const R = reflect(V.negate(), N)
      const NdotV = max(dot(N, V), float(0))

      // Fresnel with roughness compensation
      const F = fresnelSchlickRoughness(NdotV, F0, roughness)

      // Specular IBL - sample PMREM at roughness level
      const specularIBL = sampleCubeUV(R, roughness).rgb.toVar('specularIBL')

      // High quality: blend reflection with normal for rough surfaces
      const isHighQuality = uniforms.uIBLQuality.equal(2)
      const isRough = roughness.greaterThan(0.3)
      const useBlend = isHighQuality.and(isRough)

      // CRITICAL: Use safe normalize - if R and N are nearly opposite, mix could produce zero
      const blendedR = safeNormalize3(mix(R, N, roughness.mul(roughness)), N)
      const blendedSpecular = sampleCubeUV(blendedR, roughness).rgb
      specularIBL.assign(select(useBlend, mix(specularIBL, blendedSpecular, float(0.3)), specularIBL))

      const specularResult = specularIBL.mul(F)

      // Diffuse IBL - sample at max roughness (fully diffuse)
      // Energy conservation: diffuse is reduced by specular reflectance
      // WebGL: vec3 kD = (1.0 - F) * (1.0 - metallic);
      const oneMinusMetallic = float(1).sub(metallic)
      const kD = vec3(1, 1, 1).sub(F).mul(oneMinusMetallic)
      const diffuseIBL = sampleCubeUV(N, float(1)).rgb.mul(kD).mul(albedo).div(PI)

      const result = specularResult.add(diffuseIBL).mul(uniforms.uIBLIntensity)

      return select(isOff, vec3(0, 0, 0), result)
      }
    )
  })()

/**
 * Create IBL TSL uniforms with defaults
 */
export function createIBLTSLUniforms(): IBLTSLUniforms {
  const placeholder = getPlaceholderTexture()
  return {
    uEnvMap: texture(placeholder),
    uEnvMapSize: uniform(256),
    uIBLIntensity: uniform(1.0),
    uIBLQuality: uniform(0), // Off by default
    placeholderTexture: placeholder,
  }
}
