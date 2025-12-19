/**
 * N-Dimensional GPU Transform System
 *
 * Provides utilities for performing N-dimensional transformations on the GPU:
 * - Rotation matrix application in vertex shaders
 * - Perspective projection
 * - Scale transformations
 *
 * Architecture:
 * - CPU: Compose rotation matrix from individual plane rotations
 * - GPU: Apply composed matrix to vertices via vertex shader
 *
 * This hybrid approach keeps the complex matrix composition on CPU
 * while parallelizing the per-vertex multiplication on GPU.
 */

import { Matrix4 } from 'three';
import type { MatrixND } from '@/lib/math/types';

/**
 * Maximum dimension supported for GPU transforms.
 * WebGL uniform limits constrain array sizes.
 */
export const MAX_GPU_DIMENSION = 11;

/**
 * Size of extra dimensions array (dimensions beyond 4D).
 * For 11D max: 11 - 4 = 7 extra dimensions per vertex.
 */
export const EXTRA_DIMS_SIZE = MAX_GPU_DIMENSION - 4;

/**
 * Converts an N-dimensional rotation matrix to GPU-compatible uniforms.
 *
 * For dimensions 1-4: Uses a single mat4
 * For dimensions 5-11: Uses mat4 for first 4x4 block + extra arrays for:
 *   - extraRotationCols: How dimensions 5+ affect the first 4 outputs (x,y,z,w)
 *   - depthRowSums: For each input dim, sum of how it contributes to dims 4+
 *
 * @param matrix - N-dimensional rotation matrix
 * @param dimension - Current dimension
 * @returns Object with mat4 and extra rotation data for full N-D rotation
 */
export function matrixToGPUUniforms(
  matrix: MatrixND,
  dimension: number
): {
  rotationMatrix4D: Matrix4;
  extraRotationData: Float32Array;
  extraRotationCols: Float32Array;
  depthRowSums: Float32Array;
  dimension: number;
} {
  // Create mat4 for first 4x4 block (row-major to column-major for Three.js)
  const mat4Elements = new Array(16).fill(0);

  // Copy the first 4x4 block (or smaller if dimension < 4)
  const size = Math.min(dimension, 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      // Three.js Matrix4 uses column-major order
      mat4Elements[col * 4 + row] = matrix[row]?.[col] ?? (row === col ? 1 : 0);
    }
  }

  // Fill diagonal for unused dimensions
  for (let i = size; i < 4; i++) {
    mat4Elements[i * 4 + i] = 1;
  }

  const rotationMatrix4D = new Matrix4();
  rotationMatrix4D.fromArray(mat4Elements);

  // For dimensions > 4, store extra rotation data
  // This includes the additional rows/columns of the rotation matrix
  // Format: [row4, row5, row6, ...] where each row is the full dimension length
  const extraSize = dimension > 4 ? (dimension - 4) * dimension * 2 : 0;
  const extraRotationData = new Float32Array(Math.max(extraSize, 1));

  // Extra rotation columns: how dimensions 5+ affect x,y,z,w outputs
  // Format: for each extra dim (5,6,...), store [contribution to x, y, z, w]
  // So extraRotationCols[i*4 + j] = matrix[j][i+4] (how dim i+4 affects output j)
  const numExtraDims = Math.max(dimension - 4, 0);
  const extraRotationCols = new Float32Array(EXTRA_DIMS_SIZE * 4);

  // Depth row sums: for each INPUT dimension j, sum of matrix[i][j] for i >= 4
  // This computes how each input dimension contributes to the rotated "depth" (dims 4+)
  const depthRowSums = new Float32Array(MAX_GPU_DIMENSION);

  if (dimension > 4) {
    let idx = 0;
    // Store extra rows (rows 4+)
    for (let row = 4; row < dimension; row++) {
      for (let col = 0; col < dimension; col++) {
        extraRotationData[idx++] = matrix[row]?.[col] ?? 0;
      }
    }
    // Store extra columns for first 4 rows (cols 4+)
    for (let row = 0; row < 4; row++) {
      for (let col = 4; col < dimension; col++) {
        extraRotationData[idx++] = matrix[row]?.[col] ?? 0;
      }
    }

    // Build extraRotationCols in shader-friendly format
    // For each extra dimension i (0 = dim 5, 1 = dim 6, etc.)
    for (let extraIdx = 0; extraIdx < numExtraDims; extraIdx++) {
      const col = extraIdx + 4; // The actual column in the matrix
      // Store how this extra dimension affects outputs 0,1,2,3 (x,y,z,w)
      for (let row = 0; row < 4; row++) {
        extraRotationCols[extraIdx * 4 + row] = matrix[row]?.[col] ?? 0;
      }
    }

    // Build depthRowSums: for each input column j, sum matrix[i][j] for i >= 4
    for (let col = 0; col < dimension; col++) {
      let sum = 0;
      for (let row = 4; row < dimension; row++) {
        sum += matrix[row]?.[col] ?? 0;
      }
      depthRowSums[col] = sum;
    }
  }

  return {
    rotationMatrix4D,
    extraRotationData,
    extraRotationCols,
    depthRowSums,
    dimension,
  };
}

/**
 * Generates GLSL code for N-dimensional vertex transformation.
 *
 * The shader expects:
 * - position: vec3 (first 3 components)
 * - extraDimensions: float[7] attribute (components 4-11)
 * - rotationMatrix4D: mat4 uniform
 * - extraRotationData: float[] uniform (for dims > 4)
 * - scale: vec4 uniform (first 4 scales) + extraScales for more
 *
 * @param maxDimension - Maximum dimension to support (default: 11)
 * @returns GLSL vertex shader code for transformation
 */
export function generateNDTransformVertexShader(maxDimension: number = MAX_GPU_DIMENSION): string {
  const extraDims = maxDimension - 4;

  return `
// N-Dimensional Transform Vertex Shader
// Supports dimensions 3 to ${maxDimension}

// Uniforms
uniform mat4 rotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[${extraDims}];
uniform float uExtraRotationData[${(maxDimension - 4) * maxDimension * 2}];

// Projection uniforms
uniform float uProjectionDistance;

// Attributes for extra dimensions (beyond xyz)
attribute float extraDim0; // W (4th dimension)
${Array.from({ length: extraDims - 1 }, (_, i) => `attribute float extraDim${i + 1}; // ${i + 5}th dimension`).join('\n')}

// Varying for fragment shader
varying vec3 vNormal;
varying float vDepth;

// Apply N-dimensional rotation
vec3 applyNDRotation(vec3 pos3, float w, float extraDims[${extraDims}]) {
  // Build full N-dimensional position
  vec4 pos4 = vec4(pos3, w);

  // Apply 4x4 rotation to first 4 dimensions
  vec4 rotated4 = rotationMatrix4D * pos4;

  // For dimensions > 4, apply extra rotation
  // This is a simplified version - full implementation would
  // multiply with the extra rotation data

  return rotated4.xyz;
}

// Apply perspective projection from N-D to 3D
vec3 applyProjection(vec3 pos3, float w, float extraDims[${extraDims}]) {
  // Compute effective depth from higher dimensions
  float effectiveDepth = w;
  float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;

  for (int i = 0; i < ${extraDims}; i++) {
    if (i + 5 <= uDimension) {
      effectiveDepth += extraDims[i];
    }
  }
  effectiveDepth /= normFactor;

  // Apply perspective scaling (matches CPU projection formula)
  float factor = 1.0 / (uProjectionDistance - effectiveDepth);
  return pos3 * factor;
}

void main() {
  // Collect extra dimensions into array
  float extraDims[${extraDims}];
  ${Array.from({ length: extraDims }, (_, i) => `extraDims[${i}] = extraDim${i};`).join('\n  ')}

  // Apply scale
  vec3 scaledPos = position * uScale4D.xyz;
  float scaledW = extraDim0 * uScale4D.w;
  for (int i = 0; i < ${extraDims}; i++) {
    if (i + 5 <= uDimension) {
      extraDims[i] *= uExtraScales[i];
    }
  }

  // Apply rotation
  vec3 rotatedPos = applyNDRotation(scaledPos, scaledW, extraDims);

  // Apply projection
  vec3 projectedPos = applyProjection(rotatedPos, scaledW, extraDims);

  // Standard MVP transform for final position
  gl_Position = projectionMatrix * modelViewMatrix * vec4(projectedPos, 1.0);

  // Pass depth for fragment shader (for color variation)
  vDepth = (scaledW + extraDims[0]) * 0.5 + 0.5;
}
`;
}

/**
 * Generates a simple fragment shader for N-dimensional objects.
 *
 * @returns GLSL fragment shader code
 */
export function generateNDTransformFragmentShader(): string {
  return `
// N-Dimensional Transform Fragment Shader

uniform vec3 uColor;
uniform float uOpacity;

varying vec3 vNormal;
varying float vDepth;

void main() {
  // Simple depth-based color variation
  vec3 color = uColor * (0.5 + 0.5 * vDepth);

  gl_FragColor = vec4(color, uOpacity);
}
`;
}

/**
 * Creates uniforms object for N-dimensional transform shader.
 *
 * @param dimension - Current dimension
 * @returns Three.js uniforms object
 */
export function createNDTransformUniforms(dimension: number): Record<string, { value: unknown }> {
  const extraDims = MAX_GPU_DIMENSION - 4;

  return {
    rotationMatrix4D: { value: new Matrix4() },
    uDimension: { value: dimension },
    uScale4D: { value: [1, 1, 1, 1] },
    uExtraScales: { value: new Float32Array(extraDims).fill(1) },
    uExtraRotationData: { value: new Float32Array((MAX_GPU_DIMENSION - 4) * MAX_GPU_DIMENSION * 2) },
    uProjectionDistance: { value: 5.0 },
    uColor: { value: [1, 1, 1] },
    uOpacity: { value: 1.0 },
  };
}

/**
 * Updates N-dimensional transform uniforms with current state.
 *
 * @param uniforms - Uniforms object to update
 * @param rotationMatrix - Composed rotation matrix
 * @param dimension - Current dimension
 * @param scales - Per-axis scales
 * @param projectionDistance - Projection distance
 */
export function updateNDTransformUniforms(
  uniforms: Record<string, { value: unknown }>,
  rotationMatrix: MatrixND,
  dimension: number,
  scales: number[],
  projectionDistance: number
): void {
  const gpuData = matrixToGPUUniforms(rotationMatrix, dimension);

  uniforms.rotationMatrix4D!.value = gpuData.rotationMatrix4D;
  uniforms.uDimension!.value = dimension;
  uniforms.uExtraRotationData!.value = gpuData.extraRotationData;
  uniforms.uProjectionDistance!.value = projectionDistance;

  // Update scales
  const scale4D = uniforms.uScale4D!.value as number[];
  for (let i = 0; i < 4; i++) {
    scale4D[i] = scales[i] ?? 1;
  }

  const extraScales = uniforms.uExtraScales!.value as Float32Array;
  for (let i = 0; i < EXTRA_DIMS_SIZE; i++) {
    extraScales[i] = scales[i + 4] ?? 1;
  }
}
