// @ts-nocheck
// TODO: Fix TSL types - this file uses .sample(), .cond(), .assign() methods
// that exist at runtime but are not properly typed for UniformNode<Texture>
// These should use TextureNode and texture() patterns from three/tsl
/**
 * Reconstruction Shader for Temporal Cloud Accumulation (TSL)
 *
 * Combines freshly rendered quarter-res pixels with reprojected history
 * to produce the full-resolution accumulated cloud image.
 *
 * Port of WebGL: shaders/schroedinger/temporal/reconstruction.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/temporal/reconstruction
 */

import {
  Fn,
  float,
  vec2,
  vec3,
  vec4,
  int,
  screenUV,
  floor,
  max,
  min,
  clamp,
  Loop,
  uniform,
  texture,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { ReconstructionUniforms } from './uniforms'

// Cached placeholder texture for texture uniforms
// CRITICAL: TSL requires actual textures, not null - uniform(null) causes
// "THREE.TSL: Error: Uniform 'null' not implemented" WebGPU errors
let cachedReconstructionPlaceholder: THREE.DataTexture | null = null

/**
 * Get or create a placeholder texture for reconstruction texture uniforms.
 * Uses 4x4 RGBA format for WebGPU bind group layout compatibility.
 */
function getReconstructionPlaceholder(): THREE.DataTexture {
  if (!cachedReconstructionPlaceholder) {
    const size = 4
    const data = new Uint8Array(size * size * 4).fill(0)
    cachedReconstructionPlaceholder = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    cachedReconstructionPlaceholder.minFilter = THREE.LinearFilter
    cachedReconstructionPlaceholder.magFilter = THREE.LinearFilter
    cachedReconstructionPlaceholder.wrapS = THREE.ClampToEdgeWrapping
    cachedReconstructionPlaceholder.wrapT = THREE.ClampToEdgeWrapping
    cachedReconstructionPlaceholder.needsUpdate = true
  }
  return cachedReconstructionPlaceholder
}

// Reduction factor for history influence on freshly rendered pixels
const FRESH_PIXEL_HISTORY_REDUCTION = 0.5

/**
 * Sample color from quarter-res cloud buffer for a given full-res pixel coordinate.
 * Maps full-res pixel to the corresponding quarter-res location.
 */
const sampleCloudColorAtPixel = Fn(
  ([fullResPixel, cloudRender, cloudResolution]: [Node, Node, Node]) => {
    // Each 2x2 block in full-res maps to one pixel in quarter-res
    const quarterPixel = floor(vec2(fullResPixel).div(2.0))
    const quarterUV = quarterPixel.add(0.5).div(cloudResolution)
    return cloudRender.sample(quarterUV)
  }
)

/**
 * Sample position from quarter-res cloud buffer for a given full-res pixel coordinate.
 */
const sampleCloudPositionAtPixel = Fn(
  ([fullResPixel, cloudPosition, cloudResolution]: [Node, Node, Node]) => {
    const quarterPixel = floor(vec2(fullResPixel).div(2.0))
    const quarterUV = quarterPixel.add(0.5).div(cloudResolution)
    return cloudPosition.sample(quarterUV)
  }
)

/**
 * Spatial interpolation from cloud buffer for pixels without valid history.
 * Samples from the rendered pixel in the same 2x2 block.
 */
const spatialInterpolationColorFromCloud = Fn(
  ([fullResPixel, bayerOffset, cloudRender, cloudResolution]: [Node, Node, Node, Node]) => {
    // Find the 2x2 block this pixel belongs to
    const blockBase = floor(vec2(fullResPixel).div(2.0)).mul(2.0)
    // The Bayer offset tells us which pixel in the block was rendered
    const renderedPixel = blockBase.add(bayerOffset)
    return sampleCloudColorAtPixel(renderedPixel, cloudRender, cloudResolution)
  }
)

/**
 * Spatial interpolation position from cloud buffer.
 */
const spatialInterpolationPositionFromCloud = Fn(
  ([fullResPixel, bayerOffset, cloudPosition, cloudResolution]: [Node, Node, Node, Node]) => {
    const blockBase = floor(vec2(fullResPixel).div(2.0)).mul(2.0)
    const renderedPixel = blockBase.add(bayerOffset)
    return sampleCloudPositionAtPixel(renderedPixel, cloudPosition, cloudResolution)
  }
)

/**
 * Spatial interpolation from history buffer.
 * Samples 4 neighbors and averages valid ones.
 */
const spatialInterpolationColorFromHistory = Fn(
  ([uv, reprojectedHistory, accumulationResolution]: [Node, Node, Node]) => {
    const texelSize = vec2(1.0, 1.0).div(accumulationResolution)

    const c0 = reprojectedHistory.sample(uv.add(vec2(texelSize.x.negate(), 0.0)))
    const c1 = reprojectedHistory.sample(uv.add(vec2(texelSize.x, 0.0)))
    const c2 = reprojectedHistory.sample(uv.add(vec2(0.0, texelSize.y.negate())))
    const c3 = reprojectedHistory.sample(uv.add(vec2(0.0, texelSize.y)))

    // Average valid neighbors
    const sum = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const count = float(0.0).toVar()

    c0.w.greaterThan(0.001).cond(() => {
      sum.addAssign(c0)
      count.addAssign(1.0)
    })
    c1.w.greaterThan(0.001).cond(() => {
      sum.addAssign(c1)
      count.addAssign(1.0)
    })
    c2.w.greaterThan(0.001).cond(() => {
      sum.addAssign(c2)
      count.addAssign(1.0)
    })
    c3.w.greaterThan(0.001).cond(() => {
      sum.addAssign(c3)
      count.addAssign(1.0)
    })

    return count.greaterThan(0.0).select(sum.div(count), vec4(0.0, 0.0, 0.0, 0.0))
  }
)

/**
 * Spatial interpolation position from history buffer.
 */
const spatialInterpolationPositionFromHistory = Fn(
  ([uv, reprojectedPositionHistory, accumulationResolution]: [Node, Node, Node]) => {
    const texelSize = vec2(1.0, 1.0).div(accumulationResolution)

    const p0 = reprojectedPositionHistory.sample(uv.add(vec2(texelSize.x.negate(), 0.0)))
    const p1 = reprojectedPositionHistory.sample(uv.add(vec2(texelSize.x, 0.0)))
    const p2 = reprojectedPositionHistory.sample(uv.add(vec2(0.0, texelSize.y.negate())))
    const p3 = reprojectedPositionHistory.sample(uv.add(vec2(0.0, texelSize.y)))

    const sum = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const count = float(0.0).toVar()

    p0.w.greaterThan(0.001).cond(() => {
      sum.addAssign(p0)
      count.addAssign(1.0)
    })
    p1.w.greaterThan(0.001).cond(() => {
      sum.addAssign(p1)
      count.addAssign(1.0)
    })
    p2.w.greaterThan(0.001).cond(() => {
      sum.addAssign(p2)
      count.addAssign(1.0)
    })
    p3.w.greaterThan(0.001).cond(() => {
      sum.addAssign(p3)
      count.addAssign(1.0)
    })

    return count.greaterThan(0.0).select(sum.div(count), vec4(0.0, 0.0, 0.0, 0.0))
  }
)

/**
 * Create the reconstruction color node.
 *
 * @param uniforms - Reconstruction uniforms
 * @returns TSL node returning accumulated color
 */
export const createReconstructionColorNode = (
  uniforms: ReconstructionUniforms
): ShaderNodeObject<Node> => {
  return Fn(() => {
    const uv = screenUV

    // Use integer math for Bayer pattern detection
    const pixelCoordInt = floor(uv.mul(uniforms.uAccumulationResolution))
    const px = int(pixelCoordInt.x)
    const py = int(pixelCoordInt.y)

    // Determine which pixel in the 2x2 block this is (0 or 1 for each axis)
    const blockPosX = px.mod(2)
    const blockPosY = py.mod(2)

    // Convert Bayer offset to integer for reliable comparison
    const bayerOffsetX = int(uniforms.uBayerOffset.x)
    const bayerOffsetY = int(uniforms.uBayerOffset.y)

    // Check if this pixel was rendered this frame
    const renderedThisFrame = blockPosX.equal(bayerOffsetX).and(blockPosY.equal(bayerOffsetY))

    const newColor = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const newPosition = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const historyColor = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const historyPosition = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const validity = float(0.0).toVar()

    // Get the new rendered color and position (for pixels rendered this frame)
    renderedThisFrame.cond(() => {
      newColor.assign(sampleCloudColorAtPixel(pixelCoordInt, uniforms.uCloudRender, uniforms.uCloudResolution))
      newPosition.assign(sampleCloudPositionAtPixel(pixelCoordInt, uniforms.uCloudPosition, uniforms.uCloudResolution))
    })

    // Get reprojected history (only if we have valid history)
    uniforms.uHasValidHistory.cond(() => {
      historyColor.assign(uniforms.uReprojectedHistory.sample(uv))
      historyPosition.assign(uniforms.uReprojectedPositionHistory.sample(uv))
      validity.assign(uniforms.uValidityMask.sample(uv).x)
    })

    // NEIGHBORHOOD CLAMPING: Compute bounds from current frame's quarter-res data
    // Sample 3x3 neighborhood at 2-pixel stride
    const neighborMin = vec4(1e10, 1e10, 1e10, 1e10).toVar()
    const neighborMax = vec4(-1e10, -1e10, -1e10, -1e10).toVar()
    const hasValidNeighbor = float(0.0).toVar()

    // Unrolled 3x3 loop (9 iterations)
    Loop(int(9), ({ i }) => {
      const dx = i.mod(3).sub(1) // -1, 0, 1
      const dy = i.div(3).sub(1) // -1, 0, 1

      // Sample neighboring 2x2 blocks in full-res space
      const samplePixel = pixelCoordInt.add(vec2(dx, dy).mul(2.0))

      // Clamp to valid range
      const clampedPixel = clamp(
        samplePixel,
        vec2(0.0, 0.0),
        uniforms.uAccumulationResolution.sub(1.0)
      )

      const neighborColor = sampleCloudColorAtPixel(
        clampedPixel,
        uniforms.uCloudRender,
        uniforms.uCloudResolution
      )

      // Only include valid samples in bounds
      neighborColor.w.greaterThan(0.001).cond(() => {
        neighborMin.assign(min(neighborMin, neighborColor))
        neighborMax.assign(max(neighborMax, neighborColor))
        hasValidNeighbor.assign(1.0)
      })
    })

    // If no valid samples found, use defaults that won't clamp
    hasValidNeighbor.lessThan(0.5).cond(() => {
      neighborMin.assign(vec4(0.0, 0.0, 0.0, 0.0))
      neighborMax.assign(vec4(1.0, 1.0, 1.0, 1.0))
    })

    // Clamp history to neighborhood bounds BEFORE any blending
    const clampedHistoryColor = clamp(historyColor, neighborMin, neighborMax).toVar()

    // Final output
    const finalColor = vec4(0.0, 0.0, 0.0, 0.0).toVar()

    renderedThisFrame.cond(() => {
      // This pixel was freshly rendered
      const hasValidHistoryAndColor = uniforms.uHasValidHistory
        .and(validity.greaterThan(0.5))
        .and(historyColor.w.greaterThan(0.001))

      hasValidHistoryAndColor.cond(() => {
        // Blend with CLAMPED history for temporal stability without ghosting
        const blendWeight = uniforms.uHistoryWeight.mul(validity).mul(FRESH_PIXEL_HISTORY_REDUCTION)
        finalColor.assign(newColor.mix(clampedHistoryColor, blendWeight))

        // CRITICAL: Preserve alpha=1.0 for SOLID objects
        newColor.w.greaterThanEqual(0.99).cond(() => {
          finalColor.w.assign(1.0)
        })
      }).else(() => {
        // No valid history - use new data directly
        finalColor.assign(newColor)
      })
    }).else(() => {
      // This pixel was NOT rendered this frame
      const hasValidHistoryAndColor = uniforms.uHasValidHistory
        .and(validity.greaterThan(0.5))
        .and(historyColor.w.greaterThan(0.001))

      hasValidHistoryAndColor.cond(() => {
        // Use CLAMPED reprojected history
        finalColor.assign(clampedHistoryColor)

        // Preserve alpha=1.0 for SOLID objects from history
        historyColor.w.greaterThanEqual(0.99).cond(() => {
          finalColor.w.assign(1.0)
        })
      }).else(() => {
        const hasPartialHistory = uniforms.uHasValidHistory.and(historyColor.w.greaterThan(0.001))

        hasPartialHistory.cond(() => {
          // History exists but validity is low - blend with spatial interpolation from history
          const spatialColor = spatialInterpolationColorFromHistory(
            uv,
            uniforms.uReprojectedHistory,
            uniforms.uAccumulationResolution
          )
          const clampedSpatial = clamp(spatialColor, neighborMin, neighborMax)
          finalColor.assign(clampedSpatial.mix(clampedHistoryColor, validity))

          // Preserve alpha for SOLID objects
          historyColor.w.greaterThanEqual(0.99).or(spatialColor.w.greaterThanEqual(0.99)).cond(() => {
            finalColor.w.assign(1.0)
          })
        }).else(() => {
          // No valid history at all - use spatial interpolation from quarter-res cloud buffer
          finalColor.assign(
            spatialInterpolationColorFromCloud(
              pixelCoordInt,
              uniforms.uBayerOffset,
              uniforms.uCloudRender,
              uniforms.uCloudResolution
            )
          )
        })
      })
    })

    // Clamp to valid range
    return max(finalColor, vec4(0.0, 0.0, 0.0, 0.0))
  })()
}

/**
 * Create the reconstruction position node.
 *
 * @param uniforms - Reconstruction uniforms
 * @returns TSL node returning accumulated position
 */
export const createReconstructionPositionNode = (
  uniforms: ReconstructionUniforms
): ShaderNodeObject<Node> => {
  return Fn(() => {
    const uv = screenUV

    const pixelCoordInt = floor(uv.mul(uniforms.uAccumulationResolution))
    const px = int(pixelCoordInt.x)
    const py = int(pixelCoordInt.y)

    const blockPosX = px.mod(2)
    const blockPosY = py.mod(2)

    const bayerOffsetX = int(uniforms.uBayerOffset.x)
    const bayerOffsetY = int(uniforms.uBayerOffset.y)

    const renderedThisFrame = blockPosX.equal(bayerOffsetX).and(blockPosY.equal(bayerOffsetY))

    const newPosition = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const historyPosition = vec4(0.0, 0.0, 0.0, 0.0).toVar()
    const validity = float(0.0).toVar()

    renderedThisFrame.cond(() => {
      newPosition.assign(sampleCloudPositionAtPixel(pixelCoordInt, uniforms.uCloudPosition, uniforms.uCloudResolution))
    })

    uniforms.uHasValidHistory.cond(() => {
      historyPosition.assign(uniforms.uReprojectedPositionHistory.sample(uv))
      validity.assign(uniforms.uValidityMask.sample(uv).x)
    })

    const finalPosition = vec4(0.0, 0.0, 0.0, 0.0).toVar()

    renderedThisFrame.cond(() => {
      const hasValidHistory = uniforms.uHasValidHistory
        .and(validity.greaterThan(0.5))
        .and(historyPosition.w.greaterThan(0.001))

      hasValidHistory.cond(() => {
        const blendWeight = uniforms.uHistoryWeight.mul(validity).mul(FRESH_PIXEL_HISTORY_REDUCTION)
        finalPosition.assign(newPosition.mix(historyPosition, blendWeight))
      }).else(() => {
        finalPosition.assign(newPosition)
      })
    }).else(() => {
      const hasValidHistory = uniforms.uHasValidHistory
        .and(validity.greaterThan(0.5))
        .and(historyPosition.w.greaterThan(0.001))

      hasValidHistory.cond(() => {
        finalPosition.assign(historyPosition)
      }).else(() => {
        const hasPartialHistory = uniforms.uHasValidHistory.and(historyPosition.w.greaterThan(0.001))

        hasPartialHistory.cond(() => {
          const spatialPosition = spatialInterpolationPositionFromHistory(
            uv,
            uniforms.uReprojectedPositionHistory,
            uniforms.uAccumulationResolution
          )
          finalPosition.assign(spatialPosition.mix(historyPosition, validity))
        }).else(() => {
          finalPosition.assign(
            spatialInterpolationPositionFromCloud(
              pixelCoordInt,
              uniforms.uBayerOffset,
              uniforms.uCloudPosition,
              uniforms.uCloudResolution
            )
          )
        })
      })
    })

    // Clamp w component (alpha weight)
    const result = vec4(finalPosition.x, finalPosition.y, finalPosition.z, max(finalPosition.w, float(0.0)))
    return result
  })()
}

/**
 * Create the reconstruction material with all uniforms.
 *
 * @returns Material and uniforms object
 */
export function createReconstructionMaterial(): {
  material: MeshBasicNodeMaterial
  uniforms: ReconstructionUniforms
} {
  // Get placeholder texture for texture uniforms
  // CRITICAL: TSL requires actual textures, not null
  const placeholder = getReconstructionPlaceholder()

  // Create uniforms
  // NOTE: Texture uniforms use texture() instead of uniform() for TSL compatibility
  // The .value property can be updated at runtime to swap in real textures
  const uniforms: ReconstructionUniforms = {
    uCloudRender: texture(placeholder) as unknown as ReconstructionUniforms['uCloudRender'],
    uCloudPosition: texture(placeholder) as unknown as ReconstructionUniforms['uCloudPosition'],
    uReprojectedHistory: texture(placeholder) as unknown as ReconstructionUniforms['uReprojectedHistory'],
    uReprojectedPositionHistory: texture(placeholder) as unknown as ReconstructionUniforms['uReprojectedPositionHistory'],
    uValidityMask: texture(placeholder) as unknown as ReconstructionUniforms['uValidityMask'],
    uBayerOffset: uniform(new THREE.Vector2(0, 0)),
    uFrameIndex: uniform(0),
    uCloudResolution: uniform(new THREE.Vector2(480, 270)),
    uAccumulationResolution: uniform(new THREE.Vector2(1920, 1080)),
    uHistoryWeight: uniform(0.9),
    uHasValidHistory: uniform(false),
  }

  // Create the color output node
  const colorNode = createReconstructionColorNode(uniforms)

  // Create material
  const material = new MeshBasicNodeMaterial()
  material.colorNode = colorNode
  material.side = THREE.DoubleSide
  material.depthTest = false
  material.depthWrite = false

  return { material, uniforms }
}

