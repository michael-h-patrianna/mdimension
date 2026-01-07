/**
 * N-Dimensional Transformation in TSL
 *
 * Full TSL port of the N-D vertex transformation shader.
 * Handles rotation, extra dimension contributions, and perspective projection
 * for polytopes in dimensions 3-11.
 *
 * This is the core vertex transformation that makes N-dimensional visualization possible.
 * All vertices are stored in N-D space and transformed to 3D in real-time.
 *
 * Architecture:
 * - Uses vec4 uniforms for rotation column data (more reliable than uniformArray for runtime updates)
 * - Rotation matrix for first 4D stored as mat4 uniform
 * - Extra dimension rotation columns stored as 7 vec4 uniforms
 * - Depth row sums stored as 3 vec4 uniforms
 *
 * @module rendering/tsl/transforms/ndTransformTSL
 */

import {
  Fn,
  float,
  int,
  vec3,
  vec4,
  uniform,
  attribute,
  positionLocal,
  sqrt,
  abs,
  max,
  add,
  clamp,
  type UniformNode,
} from 'three/tsl'
import { Matrix4, Vector4 } from 'three'

// =============================================================================
// Uniforms
// =============================================================================

/**
 * N-D transformation uniforms for TSL shaders.
 * Uses vec4 uniforms for array data to ensure reliable runtime updates.
 */
export interface NDTransformUniforms {
  /** 4x4 rotation matrix for first 4 dimensions */
  uRotationMatrix4D: UniformNode<Matrix4>
  /** Current dimension (3-11) */
  uDimension: UniformNode<number>
  /** Uniform scale applied after projection (camera zoom) */
  uUniformScale: UniformNode<number>
  /** Projection distance for perspective */
  uProjectionDistance: UniformNode<number>
  /**
   * Extra rotation columns for dimensions 5-11
   * Each vec4 represents one column (4 components for x, y, z, w contribution)
   * 7 vec4s for dims 5-11
   */
  uExtraRotCol0: UniformNode<Vector4> // dim 5
  uExtraRotCol1: UniformNode<Vector4> // dim 6
  uExtraRotCol2: UniformNode<Vector4> // dim 7
  uExtraRotCol3: UniformNode<Vector4> // dim 8
  uExtraRotCol4: UniformNode<Vector4> // dim 9
  uExtraRotCol5: UniformNode<Vector4> // dim 10
  uExtraRotCol6: UniformNode<Vector4> // dim 11
  /**
   * Depth row sums for perspective projection
   * Packed into 3 vec4s (11 floats total, 12 available)
   */
  uDepthSums0: UniformNode<Vector4> // dims 0-3
  uDepthSums1: UniformNode<Vector4> // dims 4-7
  uDepthSums2: UniformNode<Vector4> // dims 8-10 (w unused)
}

/**
 * Create N-D transformation uniforms for TSL.
 * @returns Uniform objects for N-D transformation
 */
export function createNDTransformUniforms(): NDTransformUniforms {
  return {
    uRotationMatrix4D: uniform(new Matrix4()),
    uDimension: uniform(4),
    uUniformScale: uniform(1.0),
    uProjectionDistance: uniform(2.0),
    // Extra rotation columns as vec4 uniforms
    uExtraRotCol0: uniform(new Vector4(0, 0, 0, 0)),
    uExtraRotCol1: uniform(new Vector4(0, 0, 0, 0)),
    uExtraRotCol2: uniform(new Vector4(0, 0, 0, 0)),
    uExtraRotCol3: uniform(new Vector4(0, 0, 0, 0)),
    uExtraRotCol4: uniform(new Vector4(0, 0, 0, 0)),
    uExtraRotCol5: uniform(new Vector4(0, 0, 0, 0)),
    uExtraRotCol6: uniform(new Vector4(0, 0, 0, 0)),
    // Depth row sums as vec4 uniforms
    uDepthSums0: uniform(new Vector4(0, 0, 0, 0)),
    uDepthSums1: uniform(new Vector4(0, 0, 0, 0)),
    uDepthSums2: uniform(new Vector4(0, 0, 0, 0)),
  }
}

// =============================================================================
// N-D Transform TSL Function
// =============================================================================

/**
 * TSL function that transforms N-dimensional vertices to 3D.
 *
 * This is the complete port of the GLSL ndTransformVertex function.
 * It performs:
 * 1. Reads base position and extra dimension attributes
 * 2. Applies 4D rotation matrix
 * 3. Adds contributions from dimensions 5-11
 * 4. Computes perspective projection
 * 5. Applies uniform scale
 *
 * @param uniforms - N-D transformation uniforms
 * @returns TSL node for transformed position
 */
export const createNDTransformNode = (uniforms: NDTransformUniforms) => {
  return Fn(() => {
    // Get base position from geometry
    const pos = positionLocal

    // Get packed extra dimension attributes
    // aExtraDims0_3: vec4 containing dims 4-7 (x=dim4, y=dim5, z=dim6, w=dim7)
    // aExtraDims4_6: vec3 containing dims 8-10
    const extraDims0_3 = attribute('aExtraDims0_3', 'vec4')
    const extraDims4_6 = attribute('aExtraDims4_6', 'vec3')

    // Apply rotation to first 4 dimensions
    // pos4 = vec4(pos.x, pos.y, pos.z, extraDims0_3.x)
    // Note: extraDims0_3.x is dimension 4 (the 4th coordinate)
    const pos4 = vec4(pos.x, pos.y, pos.z, extraDims0_3.x)

    // Apply 4D rotation matrix
    const rotated = uniforms.uRotationMatrix4D.mul(pos4)

    // Extract rotated components (will accumulate extra dim contributions)
    let rotX = rotated.x
    let rotY = rotated.y
    let rotZ = rotated.z
    let rotW = rotated.w

    // Get extra dimension values
    const dim5Value = extraDims0_3.y
    const dim6Value = extraDims0_3.z
    const dim7Value = extraDims0_3.w
    const dim8Value = extraDims4_6.x
    const dim9Value = extraDims4_6.y
    const dim10Value = extraDims4_6.z

    const dimension = uniforms.uDimension

    // Add contribution from dimension 5
    const d5Active = dimension.greaterThanEqual(int(5))
    const col0 = uniforms.uExtraRotCol0
    rotX = rotX.add(d5Active.select(col0.x.mul(dim5Value), float(0)))
    rotY = rotY.add(d5Active.select(col0.y.mul(dim5Value), float(0)))
    rotZ = rotZ.add(d5Active.select(col0.z.mul(dim5Value), float(0)))
    rotW = rotW.add(d5Active.select(col0.w.mul(dim5Value), float(0)))

    // Add contribution from dimension 6
    const d6Active = dimension.greaterThanEqual(int(6))
    const col1 = uniforms.uExtraRotCol1
    rotX = rotX.add(d6Active.select(col1.x.mul(dim6Value), float(0)))
    rotY = rotY.add(d6Active.select(col1.y.mul(dim6Value), float(0)))
    rotZ = rotZ.add(d6Active.select(col1.z.mul(dim6Value), float(0)))
    rotW = rotW.add(d6Active.select(col1.w.mul(dim6Value), float(0)))

    // Add contribution from dimension 7
    const d7Active = dimension.greaterThanEqual(int(7))
    const col2 = uniforms.uExtraRotCol2
    rotX = rotX.add(d7Active.select(col2.x.mul(dim7Value), float(0)))
    rotY = rotY.add(d7Active.select(col2.y.mul(dim7Value), float(0)))
    rotZ = rotZ.add(d7Active.select(col2.z.mul(dim7Value), float(0)))
    rotW = rotW.add(d7Active.select(col2.w.mul(dim7Value), float(0)))

    // Add contribution from dimension 8
    const d8Active = dimension.greaterThanEqual(int(8))
    const col3 = uniforms.uExtraRotCol3
    rotX = rotX.add(d8Active.select(col3.x.mul(dim8Value), float(0)))
    rotY = rotY.add(d8Active.select(col3.y.mul(dim8Value), float(0)))
    rotZ = rotZ.add(d8Active.select(col3.z.mul(dim8Value), float(0)))
    rotW = rotW.add(d8Active.select(col3.w.mul(dim8Value), float(0)))

    // Add contribution from dimension 9
    const d9Active = dimension.greaterThanEqual(int(9))
    const col4 = uniforms.uExtraRotCol4
    rotX = rotX.add(d9Active.select(col4.x.mul(dim9Value), float(0)))
    rotY = rotY.add(d9Active.select(col4.y.mul(dim9Value), float(0)))
    rotZ = rotZ.add(d9Active.select(col4.z.mul(dim9Value), float(0)))
    rotW = rotW.add(d9Active.select(col4.w.mul(dim9Value), float(0)))

    // Add contribution from dimension 10
    const d10Active = dimension.greaterThanEqual(int(10))
    const col5 = uniforms.uExtraRotCol5
    rotX = rotX.add(d10Active.select(col5.x.mul(dim10Value), float(0)))
    rotY = rotY.add(d10Active.select(col5.y.mul(dim10Value), float(0)))
    rotZ = rotZ.add(d10Active.select(col5.z.mul(dim10Value), float(0)))
    rotW = rotW.add(d10Active.select(col5.w.mul(dim10Value), float(0)))

    // Note: Dimension 11 contribution uses col6 if needed

    // =========================================================================
    // Perspective Projection
    // =========================================================================
    // Compute effective depth for N-D perspective projection
    // effectiveDepth = rotated.w + sum of (depthRowSums[j] * inputs[j])

    const depthSums0 = uniforms.uDepthSums0 // dims 0-3 (x, y, z, dim4)
    const depthSums1 = uniforms.uDepthSums1 // dims 4-7 (dim5, dim6, dim7, dim8)
    const depthSums2 = uniforms.uDepthSums2 // dims 8-10 (dim9, dim10, dim11)

    // Start with rotated.w
    let effectiveDepth = rotW

    // Add depth contributions from base position (dims 0-2)
    effectiveDepth = effectiveDepth.add(depthSums0.x.mul(pos.x))
    effectiveDepth = effectiveDepth.add(depthSums0.y.mul(pos.y))
    effectiveDepth = effectiveDepth.add(depthSums0.z.mul(pos.z))

    // Add depth contribution from dim 4 (always present for 4D+)
    const d4Active = dimension.greaterThanEqual(int(4))
    effectiveDepth = effectiveDepth.add(
      d4Active.select(depthSums0.w.mul(extraDims0_3.x), float(0))
    )

    // Add depth contributions from dims 5-8
    effectiveDepth = effectiveDepth.add(
      d5Active.select(depthSums1.x.mul(dim5Value), float(0))
    )
    effectiveDepth = effectiveDepth.add(
      d6Active.select(depthSums1.y.mul(dim6Value), float(0))
    )
    effectiveDepth = effectiveDepth.add(
      d7Active.select(depthSums1.z.mul(dim7Value), float(0))
    )
    effectiveDepth = effectiveDepth.add(
      d8Active.select(depthSums1.w.mul(dim8Value), float(0))
    )

    // Add depth contributions from dims 9-10
    effectiveDepth = effectiveDepth.add(
      d9Active.select(depthSums2.x.mul(dim9Value), float(0))
    )
    effectiveDepth = effectiveDepth.add(
      d10Active.select(depthSums2.y.mul(dim10Value), float(0))
    )

    // Normalize depth by sqrt(dimension - 3) for consistent visual scale
    // See transforms/ndTransform.ts for mathematical justification
    const dimFloat = float(dimension)
    const normFactor = dimension.greaterThan(int(4)).select(
      sqrt(max(float(1), dimFloat.sub(float(3)))),
      float(1)
    )
    effectiveDepth = effectiveDepth.div(normFactor)

    // =========================================================================
    // Final Projection
    // =========================================================================
    // Compute perspective projection factor: 1 / (projectionDistance - effectiveDepth)
    const projDist = uniforms.uProjectionDistance
    let denom = projDist.sub(effectiveDepth)

    // Guard against division by zero
    const denomAbs = abs(denom)
    const isNearZero = denomAbs.lessThan(float(0.0001))
    const signedMinDenom = denom.greaterThanEqual(float(0)).select(
      float(0.0001),
      float(-0.0001)
    )
    denom = isNearZero.select(signedMinDenom, denom)

    const factor = float(1).div(denom)

    // Apply uniform scale (like camera zoom)
    const scale = uniforms.uUniformScale

    // Final projected position
    const projected = vec3(
      rotX.mul(factor).mul(scale),
      rotY.mul(factor).mul(scale),
      rotZ.mul(factor).mul(scale)
    )

    return projected
  })()
}

// =============================================================================
// Face Depth Computation (for color algorithms)
// =============================================================================

/**
 * Compute face depth from N-D extra dimensions for color algorithms.
 *
 * This is the TSL port of the WebGL face depth calculation:
 * float extraSum = aExtraDims0_3.x + aExtraDims0_3.y + aExtraDims0_3.z + aExtraDims0_3.w
 *                + aExtraDims4_6.x + aExtraDims4_6.y + aExtraDims4_6.z;
 * vFaceDepth = clamp(extraSum * 0.15 + 0.5, 0.0, 1.0);
 *
 * Uses vertexStage() to ensure computation happens in vertex shader
 * and result is passed as varying to fragment shader.
 *
 * @returns TSL node representing face depth (0-1 range)
 */
export const createFaceDepthNode = () => {
  // Read extra dimension attributes (same as in createNDTransformNode)
  const extraDims0_3 = attribute('aExtraDims0_3', 'vec4')
  const extraDims4_6 = attribute('aExtraDims4_6', 'vec3')

  // Sum all extra dimensions (WebGL parity)
  // extraSum = aExtraDims0_3.x + .y + .z + .w + aExtraDims4_6.x + .y + .z
  const extraSum = add(
    add(
      add(extraDims0_3.x, extraDims0_3.y),
      add(extraDims0_3.z, extraDims0_3.w)
    ),
    add(
      add(extraDims4_6.x, extraDims4_6.y),
      extraDims4_6.z
    )
  )

  // WebGL: vFaceDepth = clamp(extraSum * 0.15 + 0.5, 0.0, 1.0)
  const faceDepth = clamp(extraSum.mul(0.15).add(0.5), float(0), float(1))

  // Use .toVertexStage() to compute in vertex shader and pass as varying
  // Note: vertexStage() was renamed to .toVertexStage() in Three.js r173
  return faceDepth.toVertexStage()
}

// =============================================================================
// Uniform Update Helper
// =============================================================================

/**
 * Update N-D transformation uniforms with new values.
 *
 * Converts the Float32Array data from matrixToGPUUniforms into
 * the vec4 uniform format used by TSL.
 *
 * @param uniforms - The uniforms object to update
 * @param gpuData - GPU data from matrixToGPUUniforms
 * @param dimension - Current dimension
 * @param uniformScale - Scale factor
 * @param projectionDistance - Projection distance
 */
export function updateNDTransformUniforms(
  uniforms: NDTransformUniforms,
  gpuData: {
    rotationMatrix4D: Matrix4
    extraRotationCols: Float32Array
    depthRowSums: Float32Array
  },
  dimension: number,
  uniformScale: number,
  projectionDistance: number
): void {
  // Update scalar uniforms
  uniforms.uRotationMatrix4D.value.copy(gpuData.rotationMatrix4D)
  uniforms.uDimension.value = dimension
  uniforms.uUniformScale.value = uniformScale
  uniforms.uProjectionDistance.value = projectionDistance

  // Unpack extraRotationCols (28 floats) into 7 vec4 uniforms
  const cols = gpuData.extraRotationCols
  uniforms.uExtraRotCol0.value.set(cols[0] ?? 0, cols[1] ?? 0, cols[2] ?? 0, cols[3] ?? 0)
  uniforms.uExtraRotCol1.value.set(cols[4] ?? 0, cols[5] ?? 0, cols[6] ?? 0, cols[7] ?? 0)
  uniforms.uExtraRotCol2.value.set(cols[8] ?? 0, cols[9] ?? 0, cols[10] ?? 0, cols[11] ?? 0)
  uniforms.uExtraRotCol3.value.set(cols[12] ?? 0, cols[13] ?? 0, cols[14] ?? 0, cols[15] ?? 0)
  uniforms.uExtraRotCol4.value.set(cols[16] ?? 0, cols[17] ?? 0, cols[18] ?? 0, cols[19] ?? 0)
  uniforms.uExtraRotCol5.value.set(cols[20] ?? 0, cols[21] ?? 0, cols[22] ?? 0, cols[23] ?? 0)
  uniforms.uExtraRotCol6.value.set(cols[24] ?? 0, cols[25] ?? 0, cols[26] ?? 0, cols[27] ?? 0)

  // Unpack depthRowSums (11 floats) into 3 vec4 uniforms
  const depths = gpuData.depthRowSums
  uniforms.uDepthSums0.value.set(depths[0] ?? 0, depths[1] ?? 0, depths[2] ?? 0, depths[3] ?? 0)
  uniforms.uDepthSums1.value.set(depths[4] ?? 0, depths[5] ?? 0, depths[6] ?? 0, depths[7] ?? 0)
  uniforms.uDepthSums2.value.set(depths[8] ?? 0, depths[9] ?? 0, depths[10] ?? 0, 0)
}
