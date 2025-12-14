/**
 * N-Dimensional Transformation GLSL Module
 *
 * Shared vertex shader code for N-dimensional transformations.
 * Used by both point and edge rendering to ensure consistency
 * and avoid code duplication.
 *
 * @module
 */

import { MAX_EXTRA_DIMS } from './constants'

/**
 * GLSL uniform declarations for N-D transformations.
 * Include this at the top of vertex shaders that perform N-D transforms.
 */
export const GLSL_ND_TRANSFORM_UNIFORMS = `
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
`

/**
 * GLSL attribute declarations for extra dimensions.
 * Include this after uniforms in vertex shaders.
 */
export const GLSL_ND_TRANSFORM_ATTRIBUTES = `
    in float aExtraDim0;
    in float aExtraDim1;
    in float aExtraDim2;
    in float aExtraDim3;
    in float aExtraDim4;
    in float aExtraDim5;
    in float aExtraDim6;
`

/**
 * GLSL function to collect and scale input dimensions.
 * Returns a float array with scaled values for all dimensions.
 *
 * @returns GLSL code for the collectScaledInputs function
 */
export const GLSL_ND_COLLECT_SCALED_INPUTS = `
    /**
     * Collect and scale input dimensions into a float array.
     * @param pos - 3D position (xyz)
     * @param extraDim0-6 - Extra dimension values (w and beyond)
     * @param scale4D - Scale for first 4 dimensions
     * @param extraScales - Scales for dimensions 5+
     * @return Float array with 11 scaled values
     */
    void collectScaledInputs(
      vec3 pos,
      float extraDim0, float extraDim1, float extraDim2,
      float extraDim3, float extraDim4, float extraDim5, float extraDim6,
      vec4 scale4D, float extraScales[${MAX_EXTRA_DIMS}],
      out float scaledInputs[11]
    ) {
      scaledInputs[0] = pos.x * scale4D.x;
      scaledInputs[1] = pos.y * scale4D.y;
      scaledInputs[2] = pos.z * scale4D.z;
      scaledInputs[3] = extraDim0 * scale4D.w;
      scaledInputs[4] = extraDim1 * extraScales[0];
      scaledInputs[5] = extraDim2 * extraScales[1];
      scaledInputs[6] = extraDim3 * extraScales[2];
      scaledInputs[7] = extraDim4 * extraScales[3];
      scaledInputs[8] = extraDim5 * extraScales[4];
      scaledInputs[9] = extraDim6 * extraScales[5];
      scaledInputs[10] = 0.0;
    }
`

/**
 * GLSL function to apply N-D rotation.
 * Applies 4x4 rotation matrix to first 4 dimensions and adds
 * contributions from extra dimensions.
 *
 * @returns GLSL code for the applyNDRotation function
 */
export const GLSL_ND_ROTATION = `
    /**
     * Apply N-dimensional rotation to scaled inputs.
     * @param scaledInputs - Array of 11 scaled input values
     * @param rotationMatrix4D - 4x4 rotation matrix for first 4 dims
     * @param extraRotationCols - How extra dims affect x,y,z,w
     * @param dimension - Current dimension count
     * @return Rotated 4D vector
     */
    vec4 applyNDRotation(
      float scaledInputs[11],
      mat4 rotationMatrix4D,
      float extraRotationCols[${MAX_EXTRA_DIMS * 4}],
      int dimension
    ) {
      // Apply 4x4 rotation to first 4 dimensions
      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = rotationMatrix4D * scaledPos;

      // Add contributions from extra dimensions (5+) to x,y,z,w
      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= dimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += extraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += extraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += extraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += extraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      return rotated;
    }
`

/**
 * GLSL function to project N-D point to 3D.
 * Supports both orthographic and perspective projection.
 *
 * @returns GLSL code for the projectTo3D function
 */
export const GLSL_ND_PROJECTION = `
    /**
     * Project N-dimensional point to 3D.
     * @param rotated - Rotated 4D vector
     * @param scaledInputs - Original scaled inputs for depth calculation
     * @param depthRowSums - Precomputed depth contribution sums
     * @param projectionDistance - Distance for perspective projection
     * @param projectionType - 0 = orthographic, 1 = perspective
     * @param dimension - Current dimension count
     * @return Projected 3D position
     */
    vec3 projectTo3D(
      vec4 rotated,
      float scaledInputs[11],
      float depthRowSums[11],
      float projectionDistance,
      int projectionType,
      int dimension
    ) {
      if (projectionType == 0) {
        // Orthographic - just return xyz
        return rotated.xyz;
      }

      // Perspective projection with proper rotated depth
      float effectiveDepth = rotated.w;
      for (int j = 0; j < 11; j++) {
        if (j < dimension) {
          effectiveDepth += depthRowSums[j] * scaledInputs[j];
        }
      }

      float normFactor = dimension > 4 ? sqrt(float(dimension - 3)) : 1.0;
      effectiveDepth /= normFactor;

      float factor = 1.0 / (projectionDistance - effectiveDepth);
      return rotated.xyz * factor;
    }
`

/**
 * Complete N-D transformation GLSL functions.
 * Combine all the above functions into a single include.
 */
export const GLSL_ND_TRANSFORM_FUNCTIONS = `
${GLSL_ND_COLLECT_SCALED_INPUTS}
${GLSL_ND_ROTATION}
${GLSL_ND_PROJECTION}
`
