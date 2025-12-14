/**
 * Edge Vertex Shader for Point Cloud Rendering
 *
 * Performs N-dimensional transformation on edge vertices for wireframe rendering.
 *
 * @module
 */

import {
  GLSL_ND_TRANSFORM_UNIFORMS,
  GLSL_ND_TRANSFORM_ATTRIBUTES,
  GLSL_ND_TRANSFORM_FUNCTIONS,
} from './ndTransform.glsl'

/**
 * Build vertex shader for GPU edge rendering with N-D transforms.
 *
 * Transforms N-dimensional vertices through:
 * 1. Per-axis scaling
 * 2. N-D rotation matrix multiplication
 * 3. Perspective or orthographic projection to 3D
 *
 * @returns GLSL vertex shader string
 */
export function buildEdgeVertexShader(): string {
  return `
    precision highp float;
    precision highp int;

    // N-D transformation uniforms
    ${GLSL_ND_TRANSFORM_UNIFORMS}

    // Extra dimension attributes
    ${GLSL_ND_TRANSFORM_ATTRIBUTES}

    // N-D transformation functions
    ${GLSL_ND_TRANSFORM_FUNCTIONS}

    void main() {
      // Collect and scale input dimensions
      float scaledInputs[11];
      collectScaledInputs(
        position,
        aExtraDim0, aExtraDim1, aExtraDim2,
        aExtraDim3, aExtraDim4, aExtraDim5, aExtraDim6,
        uScale4D, uExtraScales,
        scaledInputs
      );

      // Apply N-D rotation
      vec4 rotated = applyNDRotation(
        scaledInputs,
        uRotationMatrix4D,
        uExtraRotationCols,
        uDimension
      );

      // Project to 3D
      vec3 projected = projectTo3D(
        rotated,
        scaledInputs,
        uDepthRowSums,
        uProjectionDistance,
        uProjectionType,
        uDimension
      );

      // Standard MVP transform
      gl_Position = projectionMatrix * modelViewMatrix * vec4(projected, 1.0);
    }
  `
}
