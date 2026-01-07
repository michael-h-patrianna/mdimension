/**
 * TSL Shadow Map Uniforms
 *
 * Creates TSL uniform nodes for shadow map rendering.
 * Matches the WebGL ShadowMapUniforms structure.
 *
 * Note: TSL cannot dynamically index sampler arrays, so we use
 * individual texture uniforms and select() chains for sampling.
 *
 * @module rendering/tsl/shadows/shadow-uniforms
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  Matrix4,
  RGBAFormat,
  Texture,
  UnsignedByteType,
  Vector4,
} from 'three'
import { texture, uniform } from 'three/tsl'

import type { ShadowLightData } from '@/rendering/shadows/uniforms'

import type { UniformNode } from 'three/tsl'

// TextureNode type derived from texture() return type (not exported from three/tsl)
export type TextureNode = ReturnType<typeof texture>

// Maximum shadow-casting lights (matches WebGL MAX_LIGHTS)
export const MAX_SHADOW_LIGHTS = 4

/**
 * TSL Shadow map uniforms structure
 * Uses individual uniforms instead of arrays due to TSL sampler limitations
 *
 * NOTE: Shadow maps use TextureNode (created with texture()) not UniformNode<Texture>.
 * This is because TSL's texture() function creates a proper texture sampling node
 * that can be updated via .value property.
 */
export interface ShadowTSLUniforms {
  // Placeholder textures (kept stable; do NOT ref-count bump per frame)
  placeholder2DTexture: DataTexture
  placeholderRGBATexture: DataTexture

  // 2D shadow maps for directional/spot lights (TextureNode for proper TSL sampling)
  uShadowMap0: TextureNode
  uShadowMap1: TextureNode
  uShadowMap2: TextureNode
  uShadowMap3: TextureNode

  // Shadow matrices (world to light clip space)
  uShadowMatrix0: UniformNode<Matrix4>
  uShadowMatrix1: UniformNode<Matrix4>
  uShadowMatrix2: UniformNode<Matrix4>
  uShadowMatrix3: UniformNode<Matrix4>

  // Point shadow maps (2D packed cube faces) - TextureNode for TSL
  uPointShadowMap0: TextureNode
  uPointShadowMap1: TextureNode
  uPointShadowMap2: TextureNode
  uPointShadowMap3: TextureNode

  // Per-light shadow enable flags as vec4 (x,y,z,w = lights 0,1,2,3)
  // NOTE: Changed from uniformArray to vec4 because uniformArray.element() causes
  // "Invalid PipelineLayout" errors in WebGPU. vec4 with .x/.y/.z/.w access works.
  uLightCastsShadow: UniformNode<Vector4>

  // Global shadow settings
  uShadowMapBias: UniformNode<number>
  uShadowMapSize: UniformNode<number>
  uShadowPCFSamples: UniformNode<number> // 0=hard, 1=3x3, 2=5x5
  uShadowCameraNear: UniformNode<number>
  uShadowCameraFar: UniformNode<number>
}

// Cached placeholder textures with reference counting
let placeholder2D: DataTexture | null = null
let placeholderRGBA: DataTexture | null = null
let placeholder2DRefCount = 0
let placeholderRGBARefCount = 0

/**
 * Get placeholder 2D texture for shadow maps
 * Returns depth 1.0 (fully lit / no shadow)
 * Increments reference count - call releasePlaceholder2D() when done
 *
 * NOTE: Uses RGBAFormat instead of RedFormat for WebGPU compatibility.
 * WebGPU doesn't support RedFormat textures properly.
 * @see https://github.com/mrdoob/three.js/issues/30484
 *
 * CRITICAL for WebGPU: Placeholder size must be > 1x1 to avoid potential
 * "Invalid PipelineLayout" errors when bind group layouts are created.
 * Shadow map textures typically use power-of-two sizes (512, 1024, etc.)
 */
function getPlaceholder2D(): DataTexture {
  if (!placeholder2D) {
    // Use 4x4 RGBA format for WebGPU bind group layout compatibility
    // 1x1 textures may cause pipeline layout issues when updated to larger textures
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(255) // Full white = depth 1.0 = no shadow

    placeholder2D = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
    // NOTE: Removed explicit filter modes - let Three.js use defaults for WebGPU compatibility.
    // NearestFilter creates a non-filtering sampler, but WebGPU may expect filtering sampler.
    // By using defaults (LinearFilter), we get a filtering sampler that works with the pipeline.
    placeholder2D.wrapS = ClampToEdgeWrapping
    placeholder2D.wrapT = ClampToEdgeWrapping
    placeholder2D.generateMipmaps = false // Disable mipmaps for WebGPU compatibility
    placeholder2D.needsUpdate = true
  }
  placeholder2DRefCount++
  return placeholder2D
}

/**
 * Get placeholder RGBA texture for point shadow maps
 * Returns packed depth 1.0 (fully lit)
 * Increments reference count - call releasePlaceholderRGBA() when done
 *
 * CRITICAL for WebGPU: Same as getPlaceholder2D - use size > 1x1 for
 * bind group layout compatibility.
 */
function getPlaceholderRGBA(): DataTexture {
  if (!placeholderRGBA) {
    // Use 4x4 RGBA format for WebGPU bind group layout compatibility
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(255) // Full white = depth 1.0 = no shadow

    placeholderRGBA = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
    // NOTE: Removed explicit filter modes - let Three.js use defaults for WebGPU compatibility.
    // NearestFilter creates a non-filtering sampler, but WebGPU may expect filtering sampler.
    placeholderRGBA.wrapS = ClampToEdgeWrapping
    placeholderRGBA.wrapT = ClampToEdgeWrapping
    placeholderRGBA.generateMipmaps = false // Disable mipmaps for WebGPU compatibility
    placeholderRGBA.needsUpdate = true
  }
  placeholderRGBARefCount++
  return placeholderRGBA
}

/**
 * Release a reference to the 2D placeholder texture
 */
export function releasePlaceholder2D(): void {
  if (placeholder2DRefCount > 0) {
    placeholder2DRefCount--
  }
}

/**
 * Release a reference to the RGBA placeholder texture
 */
export function releasePlaceholderRGBA(): void {
  if (placeholderRGBARefCount > 0) {
    placeholderRGBARefCount--
  }
}

/**
 * Create default shadow TSL uniforms
 *
 * NOTE: Uses texture() instead of uniform() for shadow maps.
 * TSL's texture() creates a proper TextureNode that can be sampled directly.
 * The texture value can be updated via textureNode.value = newTexture.
 *
 * @returns Shadow uniform nodes with placeholder textures
 */
export function createShadowTSLUniforms(): ShadowTSLUniforms {
  const placeholder2D = getPlaceholder2D()
  const placeholderRGBA = getPlaceholderRGBA()
  const uShadowMap0 = texture(placeholder2D)
  const uShadowMap1 = texture(placeholder2D)
  const uShadowMap2 = texture(placeholder2D)
  const uShadowMap3 = texture(placeholder2D)
  const uShadowMatrix0 = uniform(new Matrix4())
  const uShadowMatrix1 = uniform(new Matrix4())
  const uShadowMatrix2 = uniform(new Matrix4())
  const uShadowMatrix3 = uniform(new Matrix4())
  const uPointShadowMap0 = texture(placeholderRGBA)
  const uPointShadowMap1 = texture(placeholderRGBA)
  const uPointShadowMap2 = texture(placeholderRGBA)
  const uPointShadowMap3 = texture(placeholderRGBA)

  // NOTE: Using vec4 uniform instead of uniformArray because uniformArray.element()
  // causes "Invalid PipelineLayout" errors in WebGPU. Access via .x/.y/.z/.w instead.
  const uLightCastsShadow = uniform(new Vector4(0, 0, 0, 0)) as UniformNode<Vector4> & {
    /**
     * Compatibility shim for older tests that expected uniformArray([...]).array.
     * Kept in sync by updateShadowTSLUniforms().
     */
    array: Float32Array
  }
  uLightCastsShadow.array = new Float32Array([0, 0, 0, 0])

  const result: ShadowTSLUniforms = {
    placeholder2DTexture: placeholder2D,
    placeholderRGBATexture: placeholderRGBA,
    uShadowMap0,
    uShadowMap1,
    uShadowMap2,
    uShadowMap3,
    uShadowMatrix0,
    uShadowMatrix1,
    uShadowMatrix2,
    uShadowMatrix3,
    uPointShadowMap0,
    uPointShadowMap1,
    uPointShadowMap2,
    uPointShadowMap3,
    uLightCastsShadow,
    uShadowMapBias: uniform(0.001),
    uShadowMapSize: uniform(1024),
    uShadowPCFSamples: uniform(1),
    uShadowCameraNear: uniform(0.5),
    uShadowCameraFar: uniform(50),
  }

  return result
}

/**
 * Update TSL shadow uniforms from collected scene shadow data.
 * Mirrors WebGL updateShadowMapUniforms behavior:
 * - Always assigns a valid texture (real or placeholder), never null.
 * - Uses uLightCastsShadow flags to control whether a light contributes shadows.
 */
export function updateShadowTSLUniforms(
  uniforms: ShadowTSLUniforms,
  shadowData: ShadowLightData[],
  bias: number,
  mapSize: number,
  pcfSamples: number
): void {
  const shadowMaps = [
    uniforms.uShadowMap0,
    uniforms.uShadowMap1,
    uniforms.uShadowMap2,
    uniforms.uShadowMap3,
  ]
  const pointShadowMaps = [
    uniforms.uPointShadowMap0,
    uniforms.uPointShadowMap1,
    uniforms.uPointShadowMap2,
    uniforms.uPointShadowMap3,
  ]
  const shadowMatrices = [
    uniforms.uShadowMatrix0,
    uniforms.uShadowMatrix1,
    uniforms.uShadowMatrix2,
    uniforms.uShadowMatrix3,
  ]

  const placeholder2D = uniforms.placeholder2DTexture
  const placeholderRGBA = uniforms.placeholderRGBATexture

  // Build castsShadow flags as vec4 components
  const castsShadowVec = new Vector4(0, 0, 0, 0)
  let pointLightCameraFar = 50

  for (let i = 0; i < MAX_SHADOW_LIGHTS; i++) {
    const data = shadowData[i]

    // TextureNode.value is the underlying THREE.Texture used by TSL texture sampling.
    const mapNode = shadowMaps[i] as unknown as { value: Texture }
    const pointMapNode = pointShadowMaps[i] as unknown as { value: Texture }
    const matrixNode = shadowMatrices[i] as unknown as { value: Matrix4 }

    if (data && data.castsShadow) {
      if (data.lightType === 0) {
        // Point light: packed 2D shadow texture
        mapNode.value = placeholder2D
        pointMapNode.value = (data.pointShadowMap ?? placeholderRGBA) as unknown as Texture
        pointLightCameraFar = data.cameraFar
      } else {
        // Directional/Spot: regular 2D shadow map
        mapNode.value = (data.shadowMap ?? placeholder2D) as unknown as Texture
        pointMapNode.value = placeholderRGBA
      }

      matrixNode.value.copy(data.shadowMatrix)
      // Set vec4 component for this light index
      castsShadowVec.setComponent(i, 1.0)
    } else {
      // Clear this slot: placeholders + disabled flag
      mapNode.value = placeholder2D
      pointMapNode.value = placeholderRGBA
      castsShadowVec.setComponent(i, 0.0)
    }
  }

  // Update the vec4 uniform value
  uniforms.uLightCastsShadow.value.copy(castsShadowVec)
  // Keep compatibility array (if present) in sync for tests and debug tooling.
  const uCasts = uniforms.uLightCastsShadow as unknown as { array?: Float32Array }
  if (uCasts.array) {
    uCasts.array[0] = castsShadowVec.x
    uCasts.array[1] = castsShadowVec.y
    uCasts.array[2] = castsShadowVec.z
    uCasts.array[3] = castsShadowVec.w
  }

  uniforms.uShadowMapBias.value = bias
  uniforms.uShadowMapSize.value = mapSize
  uniforms.uShadowPCFSamples.value = pcfSamples
  uniforms.uShadowCameraNear.value = 0.5
  uniforms.uShadowCameraFar.value = pointLightCameraFar
}

/**
 * Dispose of cached placeholder textures
 * Only disposes if no materials are using them (refCount == 0)
 * Call during cleanup to prevent memory leaks
 *
 * @param force - Force disposal regardless of reference count (use at app shutdown only)
 */
export function disposeShadowPlaceholders(force = false): void {
  if (placeholder2D && (force || placeholder2DRefCount === 0)) {
    placeholder2D.dispose()
    placeholder2D = null
    placeholder2DRefCount = 0
  }
  if (placeholderRGBA && (force || placeholderRGBARefCount === 0)) {
    placeholderRGBA.dispose()
    placeholderRGBA = null
    placeholderRGBARefCount = 0
  }
}

/**
 * Get current reference counts for debugging
 */
export function getPlaceholderRefCounts(): { placeholder2D: number; placeholderRGBA: number } {
  return {
    placeholder2D: placeholder2DRefCount,
    placeholderRGBA: placeholderRGBARefCount,
  }
}
