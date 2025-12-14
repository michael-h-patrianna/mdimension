/**
 * Point Vertex Shader for Point Cloud Rendering
 *
 * Performs N-dimensional transformation on point vertices with
 * per-point coloring support and perspective point sizing.
 *
 * @module
 */

import { MAX_EXTRA_DIMS } from './constants'

/**
 * Build vertex shader for GPU point rendering with N-D transforms.
 *
 * Transforms N-dimensional vertices through:
 * 1. Per-axis scaling
 * 2. N-D rotation matrix multiplication
 * 3. Perspective or orthographic projection to 3D
 * 4. Perspective-correct point sizing
 *
 * @returns GLSL vertex shader string
 */
export function buildPointVertexShader(): string {
  return `
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
    uniform float uPointSize;

    attribute float aExtraDim0;
    attribute float aExtraDim1;
    attribute float aExtraDim2;
    attribute float aExtraDim3;
    attribute float aExtraDim4;
    attribute float aExtraDim5;
    attribute float aExtraDim6;
    attribute vec3 aColor;

    varying vec3 vColor;

    void main() {
      // Collect scaled input dimensions
      float scaledInputs[11];
      scaledInputs[0] = position.x * uScale4D.x;
      scaledInputs[1] = position.y * uScale4D.y;
      scaledInputs[2] = position.z * uScale4D.z;
      scaledInputs[3] = aExtraDim0 * uScale4D.w;
      scaledInputs[4] = aExtraDim1 * uExtraScales[0];
      scaledInputs[5] = aExtraDim2 * uExtraScales[1];
      scaledInputs[6] = aExtraDim3 * uExtraScales[2];
      scaledInputs[7] = aExtraDim4 * uExtraScales[3];
      scaledInputs[8] = aExtraDim5 * uExtraScales[4];
      scaledInputs[9] = aExtraDim6 * uExtraScales[5];
      scaledInputs[10] = 0.0;

      // Apply 4x4 rotation to first 4 dimensions
      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      // Add contributions from extra dimensions (5+) to x,y,z,w
      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      // Project to 3D
      vec3 projected;
      if (uProjectionType == 0) {
        // Orthographic
        projected = rotated.xyz;
      } else {
        // Perspective with proper rotated depth
        float effectiveDepth = rotated.w;
        for (int j = 0; j < 11; j++) {
          if (j < uDimension) {
            effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
          }
        }
        float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
        effectiveDepth /= normFactor;

        float factor = 1.0 / (uProjectionDistance - effectiveDepth);
        projected = rotated.xyz * factor;
      }

      vec4 mvPosition = modelViewMatrix * vec4(projected, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Point size with perspective
      gl_PointSize = uPointSize * (300.0 / -mvPosition.z);

      // Pass color
      vColor = aColor;
    }
  `
}
