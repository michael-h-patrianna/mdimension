/**
 * Point Vertex Shader for Point Cloud Rendering
 *
 * Performs N-dimensional transformation on point vertices with
 * per-point coloring support and perspective point sizing.
 *
 * @module
 */

import { PERSPECTIVE_POINT_SCALE } from './constants'
import {
  GLSL_ND_TRANSFORM_UNIFORMS,
  GLSL_ND_TRANSFORM_ATTRIBUTES,
  GLSL_ND_TRANSFORM_FUNCTIONS,
} from './ndTransform.glsl'

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
    precision highp float;
    precision highp int;

    // N-D transformation uniforms
    ${GLSL_ND_TRANSFORM_UNIFORMS}
    uniform float uPointSize;

    // Extra dimension attributes
    ${GLSL_ND_TRANSFORM_ATTRIBUTES}
    in vec3 aColor;

    // Varyings for fragment shader
    out vec3 vColor;
    out float vDepth;
    out vec3 vWorldPosition;
    out vec3 vViewDir;

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
      vec4 mvPosition = modelViewMatrix * vec4(projected, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Point size with perspective
      gl_PointSize = uPointSize * (${PERSPECTIVE_POINT_SCALE} / -mvPosition.z);

      // Pass color
      vColor = aColor;

      // Pass world position and view direction for lighting
      vWorldPosition = projected;
      vViewDir = normalize(-mvPosition.xyz);

      // Compute normalized depth for palette coloring (0-1 range based on position in scene)
      // Use the w component (4th dimension) normalized by projection distance
      float depthValue = uProjectionType == 0 ? rotated.w : (rotated.w / uProjectionDistance);
      vDepth = clamp(depthValue * 0.5 + 0.5, 0.0, 1.0);
    }
  `
}
