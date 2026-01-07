// @ts-nocheck
// TODO: Fix TSL types - this file uses .sample(), .cond() methods
// that exist at runtime but are not properly typed for UniformNode<Texture>
// These should use TextureNode and texture() patterns from three/tsl
/**
 * Reprojection Shader for Temporal Cloud Accumulation (TSL)
 *
 * Takes the previous frame's accumulated cloud color and reprojects it
 * to the current camera view. Outputs reprojected color and validity mask.
 *
 * Port of WebGL: shaders/schroedinger/temporal/reprojection.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/temporal/reprojection
 */

import {
  Fn,
  float,
  vec2,
  vec3,
  vec4,
  screenUV,
  abs,
  max,
  length,
  min,
  smoothstep,
  uniform,
  texture,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { ReprojectionUniforms } from './uniforms'

// Cached placeholder texture for texture uniforms
// CRITICAL: TSL requires actual textures, not null - uniform(null) causes
// "THREE.TSL: Error: Uniform 'null' not implemented" WebGPU errors
let cachedReprojectionPlaceholder: THREE.DataTexture | null = null

/**
 * Get or create a placeholder texture for reprojection texture uniforms.
 * Uses 4x4 RGBA format for WebGPU bind group layout compatibility.
 */
function getReprojectionPlaceholder(): THREE.DataTexture {
  if (!cachedReprojectionPlaceholder) {
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(0)
    cachedReprojectionPlaceholder = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    cachedReprojectionPlaceholder.minFilter = THREE.LinearFilter
    cachedReprojectionPlaceholder.magFilter = THREE.LinearFilter
    cachedReprojectionPlaceholder.wrapS = THREE.ClampToEdgeWrapping
    cachedReprojectionPlaceholder.wrapT = THREE.ClampToEdgeWrapping
    cachedReprojectionPlaceholder.needsUpdate = true
  }
  return cachedReprojectionPlaceholder
}

// Motion thresholds (in pixels)
const MOTION_THRESHOLD_MIN = 2.0
const MOTION_THRESHOLD_MAX = 8.0

// Position discontinuity threshold (in world units)
const POS_DISCONTINUITY_THRESHOLD = 0.3

/**
 * Create the reprojection fragment shader as a TSL node.
 *
 * Algorithm:
 * 1. Sample previous frame's data at current screen location
 * 2. Project world position to current frame to see where it went
 * 3. Compute motion-based validity (reject large motion)
 * 4. Detect edges via position/alpha discontinuities
 * 5. Apply screen edge rejection
 *
 * @param uniforms - Reprojection uniforms
 * @returns TSL node returning vec4(color.rgb, 1) for color output and vec4(validity, 0, 0, 1) for validity
 */
export const createReprojectionNode = (uniforms: ReprojectionUniforms): ShaderNodeObject<Node> => {
  return Fn(() => {
    const uv = screenUV

    // Sample previous frame's data at this screen location
    const prevColor = uniforms.uPrevAccumulation.sample(uv)
    const prevPosition = uniforms.uPrevPositionBuffer.sample(uv)

    // Early out if no valid history at this location
    // prevColor.a < 0.001 || prevPosition.w < 0.001
    const hasNoHistory = prevColor.w.lessThan(0.001).or(prevPosition.w.lessThan(0.001))

    // Result variables
    const finalColor = vec4(0, 0, 0, 0).toVar()
    const finalValidity = vec4(0, 0, 0, 1).toVar()

    // Only process if we have valid history
    hasNoHistory.not().cond(() => {
      const worldPos = prevPosition.xyz

      // Project this world position to CURRENT frame to see where it went
      const currentClip = uniforms.uViewProjectionMatrix.mul(vec4(worldPos.x, worldPos.y, worldPos.z, 1.0))

      // Guard against division by zero in perspective divide
      const absW = abs(currentClip.w)
      const safeW = absW.lessThan(0.0001).select(
        currentClip.w.greaterThanEqual(0).select(float(0.0001), float(-0.0001)),
        currentClip.w
      )

      const currentUV = currentClip.xy.div(safeW).mul(0.5).add(0.5)

      // Compute how far the content has "moved" on screen
      const screenMotion = currentUV.sub(uv)
      const motionMagnitude = length(screenMotion.mul(uniforms.uAccumulationResolution)) // In pixels

      // Start with full validity
      const validity = float(1.0).toVar()

      // MOTION-BASED REJECTION:
      // If the world position that WAS at uv has moved significantly on screen,
      // the history at uv is no longer valid for the current frame's uv.
      motionMagnitude.greaterThan(MOTION_THRESHOLD_MIN).cond(() => {
        const motionFactor = float(1.0).sub(
          smoothstep(float(MOTION_THRESHOLD_MIN), float(MOTION_THRESHOLD_MAX), motionMagnitude)
        )
        validity.mulAssign(motionFactor)
      })

      // OFF-SCREEN REJECTION:
      // If the content moved completely off-screen, it's definitely invalid
      const isOffScreen = currentUV.x.lessThan(-0.1)
        .or(currentUV.x.greaterThan(1.1))
        .or(currentUV.y.lessThan(-0.1))
        .or(currentUV.y.greaterThan(1.1))
      isOffScreen.cond(() => {
        validity.assign(0.0)
      })

      // EDGE DETECTION:
      // Check for depth/position discontinuities in the neighborhood
      const texelSize = vec2(1.0, 1.0).div(uniforms.uAccumulationResolution)

      const posL = uniforms.uPrevPositionBuffer.sample(uv.sub(vec2(texelSize.x, 0.0)))
      const posR = uniforms.uPrevPositionBuffer.sample(uv.add(vec2(texelSize.x, 0.0)))
      const posU = uniforms.uPrevPositionBuffer.sample(uv.add(vec2(0.0, texelSize.y)))
      const posD = uniforms.uPrevPositionBuffer.sample(uv.sub(vec2(0.0, texelSize.y)))

      // Large position differences indicate object edges - reduce validity there
      const diffL = length(worldPos.sub(posL.xyz))
      const diffR = length(worldPos.sub(posR.xyz))
      const diffU = length(worldPos.sub(posU.xyz))
      const diffD = length(worldPos.sub(posD.xyz))
      const maxPosDiff = max(max(diffL, diffR), max(diffU, diffD))

      // Position discontinuity: reduce but don't eliminate
      maxPosDiff.greaterThan(POS_DISCONTINUITY_THRESHOLD).cond(() => {
        validity.mulAssign(0.5)
      })

      // ALPHA DISCONTINUITY:
      // Check for sudden alpha changes (object boundary)
      const colorL = uniforms.uPrevAccumulation.sample(uv.sub(vec2(texelSize.x, 0.0)))
      const colorR = uniforms.uPrevAccumulation.sample(uv.add(vec2(texelSize.x, 0.0)))
      const colorU = uniforms.uPrevAccumulation.sample(uv.add(vec2(0.0, texelSize.y)))
      const colorD = uniforms.uPrevAccumulation.sample(uv.sub(vec2(0.0, texelSize.y)))

      const alphaDiffL = abs(prevColor.w.sub(colorL.w))
      const alphaDiffR = abs(prevColor.w.sub(colorR.w))
      const alphaDiffU = abs(prevColor.w.sub(colorU.w))
      const alphaDiffD = abs(prevColor.w.sub(colorD.w))
      const maxAlphaDiff = max(max(alphaDiffL, alphaDiffR), max(alphaDiffU, alphaDiffD))

      maxAlphaDiff.greaterThan(uniforms.uDisocclusionThreshold).cond(() => {
        validity.mulAssign(0.5)
      })

      // SCREEN EDGE REJECTION:
      // Reduce validity near screen edges where content may be entering/leaving
      const edgeDistX = min(uv.x, float(1.0).sub(uv.x))
      const edgeDistY = min(uv.y, float(1.0).sub(uv.y))
      const edgeDist = min(edgeDistX, edgeDistY)

      edgeDist.lessThan(0.03).cond(() => {
        validity.mulAssign(edgeDist.div(0.03))
      })

      finalColor.assign(prevColor)
      finalValidity.assign(vec4(validity, 0.0, 0.0, 1.0))
    })

    // Return combined output - we'll split this in the material
    // Using a vec4 for color and storing validity in a separate output
    return vec4(finalColor.x, finalColor.y, finalColor.z, finalColor.w)
  })()
}

/**
 * Create the validity node separately for MRT output.
 */
export const createReprojectionValidityNode = (uniforms: ReprojectionUniforms): ShaderNodeObject<Node> => {
  return Fn(() => {
    const uv = screenUV

    const prevColor = uniforms.uPrevAccumulation.sample(uv)
    const prevPosition = uniforms.uPrevPositionBuffer.sample(uv)

    const hasNoHistory = prevColor.w.lessThan(0.001).or(prevPosition.w.lessThan(0.001))

    const validity = float(0.0).toVar()

    hasNoHistory.not().cond(() => {
      validity.assign(1.0)

      const worldPos = prevPosition.xyz
      const currentClip = uniforms.uViewProjectionMatrix.mul(vec4(worldPos.x, worldPos.y, worldPos.z, 1.0))
      const absW = abs(currentClip.w)
      const safeW = absW.lessThan(0.0001).select(
        currentClip.w.greaterThanEqual(0).select(float(0.0001), float(-0.0001)),
        currentClip.w
      )
      const currentUV = currentClip.xy.div(safeW).mul(0.5).add(0.5)
      const screenMotion = currentUV.sub(uv)
      const motionMagnitude = length(screenMotion.mul(uniforms.uAccumulationResolution))

      motionMagnitude.greaterThan(MOTION_THRESHOLD_MIN).cond(() => {
        const motionFactor = float(1.0).sub(
          smoothstep(float(MOTION_THRESHOLD_MIN), float(MOTION_THRESHOLD_MAX), motionMagnitude)
        )
        validity.mulAssign(motionFactor)
      })

      const isOffScreen = currentUV.x.lessThan(-0.1)
        .or(currentUV.x.greaterThan(1.1))
        .or(currentUV.y.lessThan(-0.1))
        .or(currentUV.y.greaterThan(1.1))
      isOffScreen.cond(() => {
        validity.assign(0.0)
      })

      const texelSize = vec2(1.0, 1.0).div(uniforms.uAccumulationResolution)

      const posL = uniforms.uPrevPositionBuffer.sample(uv.sub(vec2(texelSize.x, 0.0)))
      const posR = uniforms.uPrevPositionBuffer.sample(uv.add(vec2(texelSize.x, 0.0)))
      const posU = uniforms.uPrevPositionBuffer.sample(uv.add(vec2(0.0, texelSize.y)))
      const posD = uniforms.uPrevPositionBuffer.sample(uv.sub(vec2(0.0, texelSize.y)))

      const diffL = length(worldPos.sub(posL.xyz))
      const diffR = length(worldPos.sub(posR.xyz))
      const diffU = length(worldPos.sub(posU.xyz))
      const diffD = length(worldPos.sub(posD.xyz))
      const maxPosDiff = max(max(diffL, diffR), max(diffU, diffD))

      maxPosDiff.greaterThan(POS_DISCONTINUITY_THRESHOLD).cond(() => {
        validity.mulAssign(0.5)
      })

      const colorL = uniforms.uPrevAccumulation.sample(uv.sub(vec2(texelSize.x, 0.0)))
      const colorR = uniforms.uPrevAccumulation.sample(uv.add(vec2(texelSize.x, 0.0)))
      const colorU = uniforms.uPrevAccumulation.sample(uv.add(vec2(0.0, texelSize.y)))
      const colorD = uniforms.uPrevAccumulation.sample(uv.sub(vec2(0.0, texelSize.y)))

      const alphaDiffL = abs(prevColor.w.sub(colorL.w))
      const alphaDiffR = abs(prevColor.w.sub(colorR.w))
      const alphaDiffU = abs(prevColor.w.sub(colorU.w))
      const alphaDiffD = abs(prevColor.w.sub(colorD.w))
      const maxAlphaDiff = max(max(alphaDiffL, alphaDiffR), max(alphaDiffU, alphaDiffD))

      maxAlphaDiff.greaterThan(uniforms.uDisocclusionThreshold).cond(() => {
        validity.mulAssign(0.5)
      })

      const edgeDistX = min(uv.x, float(1.0).sub(uv.x))
      const edgeDistY = min(uv.y, float(1.0).sub(uv.y))
      const edgeDist = min(edgeDistX, edgeDistY)

      edgeDist.lessThan(0.03).cond(() => {
        validity.mulAssign(edgeDist.div(0.03))
      })
    })

    return vec4(validity, 0.0, 0.0, 1.0)
  })()
}

/**
 * Create the reprojection material with all uniforms.
 *
 * @returns Material and uniforms object
 */
export function createReprojectionMaterial(): {
  material: MeshBasicNodeMaterial
  uniforms: ReprojectionUniforms
} {
  // Get placeholder texture for texture uniforms
  // CRITICAL: TSL requires actual textures, not null
  const placeholder = getReprojectionPlaceholder()

  // Create uniforms
  // NOTE: Texture uniforms use texture() instead of uniform() for TSL compatibility
  // The .value property can be updated at runtime to swap in real textures
  const uniforms: ReprojectionUniforms = {
    uPrevAccumulation: texture(placeholder) as unknown as ReprojectionUniforms['uPrevAccumulation'],
    uPrevPositionBuffer: texture(placeholder) as unknown as ReprojectionUniforms['uPrevPositionBuffer'],
    uPrevViewProjectionMatrix: uniform(new THREE.Matrix4()),
    uViewProjectionMatrix: uniform(new THREE.Matrix4()),
    uCameraPosition: uniform(new THREE.Vector3()),
    uAccumulationResolution: uniform(new THREE.Vector2(1920, 1080)),
    uDisocclusionThreshold: uniform(0.3),
  }

  // Create the color output node
  const colorNode = createReprojectionNode(uniforms)

  // Create material
  const material = new MeshBasicNodeMaterial()
  material.colorNode = colorNode
  material.side = THREE.DoubleSide
  material.depthTest = false
  material.depthWrite = false

  return { material, uniforms }
}

