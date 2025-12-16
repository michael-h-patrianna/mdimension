/**
 * Edge Vertex Shader for Polytope Rendering
 *
 * Performs N-dimensional transformation on edge vertices without lighting.
 * Used for wireframe/edge rendering.
 *
 * Animation: Radial breathing modulation - vertices scale toward/away from
 * origin with optional phase offset based on distance for wave-like effect.
 *
 * @module
 */

import { MAX_EXTRA_DIMS } from './constants'

/**
 * Build edge vertex shader (N-D transformation only, no lighting).
 *
 * Transforms N-dimensional vertices through:
 * 1. Per-axis scaling
 * 2. N-D rotation matrix multiplication
 * 3. Perspective or orthographic projection to 3D
 * 4. Simple sine/cosine vertex modulation
 *
 * @returns GLSL vertex shader string
 */
export function buildEdgeVertexShader(): string {
  return `
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];

    // Vertex modulation uniforms
    uniform float uAnimTime;       // Time in seconds
    uniform float uModAmplitude;   // Displacement amplitude (0-1)
    uniform float uModFrequency;   // Oscillation frequency
    uniform float uModWave;        // Phase offset based on distance (wave effect)
    uniform float uModBias;        // Per-vertex/dimension phase variation

    in float aExtraDim0;
    in float aExtraDim1;
    in float aExtraDim2;
    in float aExtraDim3;
    in float aExtraDim4;
    in float aExtraDim5;
    in float aExtraDim6;

    vec3 transformND() {
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

      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      vec3 projected;
      if (uProjectionType == 0) {
        projected = rotated.xyz;
      } else {
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

      return projected;
    }

    // Radial breathing modulation - smooth coherent motion
    vec3 modulateVertex(vec3 pos, float extraDimSum) {
      if (uModAmplitude < 0.001) return pos;

      // Very slow base oscillation
      float t = uAnimTime * uModFrequency * 0.1;

      // Wave: phase offset based on distance from origin (radial wave effect)
      float dist = length(pos);
      float wavePhase = dist * uModWave * 2.0;

      // Bias: per-vertex variation based on position coordinates
      // Creates unique phase for each vertex based on its spatial location
      float vertexBias = (pos.x * 1.0 + pos.y * 1.618 + pos.z * 2.236) * uModBias;

      // Bias: per-dimension variation using extra dimension coordinates
      // Vertices in higher dimensions get additional phase offset
      float dimensionBias = extraDimSum * uModBias * 0.5;

      // Combined phase
      float totalPhase = t + wavePhase + vertexBias + dimensionBias;

      // Single sine wave controls radial scale
      float scale = 1.0 + sin(totalPhase) * uModAmplitude * 0.05;

      return pos * scale;
    }

    void main() {
      vec3 projected = transformND();

      // Sum of extra dimensions for dimension-aware bias
      float extraSum = aExtraDim0 + aExtraDim1 + aExtraDim2 + aExtraDim3 + aExtraDim4 + aExtraDim5 + aExtraDim6;

      vec3 modulated = modulateVertex(projected, extraSum);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(modulated, 1.0);
    }
  `
}
