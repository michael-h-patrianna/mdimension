/**
 * Edge Vertex Shader for Polytope Rendering
 *
 * Performs N-dimensional transformation on edge vertices without lighting.
 * Used for wireframe/edge rendering.
 *
 * Polytope animations are applied AFTER N-D transformation and projection
 * to 3D space, ensuring mathematically correct behavior.
 *
 * Animation System: Uses organic modulation with layered sine waves at
 * irrational frequency ratios for smooth, non-repeating motion.
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
 * 4. Organic animations (applied to projected 3D result)
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

    // Organic Animation uniforms (applied post-projection)
    uniform float uAnimTime;         // Raw time in seconds (slow, not multiplied)
    uniform float uPulseAmount;      // Organic pulse amplitude (0-1)
    uniform float uFlowAmount;       // Flow/drift intensity (0-1)
    uniform float uRippleAmount;     // Ripple wave amplitude (0-1)

    in float aExtraDim0;
    in float aExtraDim1;
    in float aExtraDim2;
    in float aExtraDim3;
    in float aExtraDim4;
    in float aExtraDim5;
    in float aExtraDim6;

    // Golden ratio and other irrational constants for non-repeating patterns
    const float PHI = 1.618033988749895;
    const float SQRT2 = 1.4142135623730951;
    const float SQRT3 = 1.7320508075688772;

    // Organic noise using layered sine waves with irrational frequency ratios
    // Creates smooth, never-repeating patterns
    float organicWave(float t, float baseFreq) {
      // Layer multiple sines with irrational frequency ratios
      float wave1 = sin(t * baseFreq);
      float wave2 = sin(t * baseFreq * PHI) * 0.5;
      float wave3 = sin(t * baseFreq * SQRT2) * 0.25;
      float wave4 = sin(t * baseFreq * SQRT3 * 0.5) * 0.125;
      // Normalize to roughly -1 to 1 range
      return (wave1 + wave2 + wave3 + wave4) / 1.875;
    }

    // Smooth organic value (0 to 1 range, biased toward 0.5)
    float organicValue(float t, float baseFreq) {
      return organicWave(t, baseFreq) * 0.5 + 0.5;
    }

    // 3D organic displacement field
    vec3 organicDisplacement(vec3 pos, float t) {
      // Each axis gets unique displacement from layered waves
      float dx = organicWave(t + pos.y * 0.3 + pos.z * 0.2, 0.1);
      float dy = organicWave(t * PHI + pos.x * 0.25 + pos.z * 0.15, 0.08);
      float dz = organicWave(t * SQRT2 + pos.x * 0.2 + pos.y * 0.25, 0.09);
      return vec3(dx, dy, dz);
    }

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

    // Apply organic post-projection animations to the 3D result
    vec3 applyAnimations(vec3 pos) {
      vec3 result = pos;
      float t = uAnimTime;

      // 1. Organic Pulse: gentle breathing with layered frequencies
      // Creates smooth, never-repeating scale oscillation
      if (uPulseAmount > 0.001) {
        float pulseValue = organicWave(t, 0.15);
        // Gentle scale variation (e.g., 0.05 amplitude = 95% to 105% scale)
        float scale = 1.0 + pulseValue * uPulseAmount * 0.15;
        result *= scale;
      }

      // 2. Flow: organic vertex drift creating flowing deformation
      // Each vertex drifts independently based on position
      if (uFlowAmount > 0.001) {
        vec3 displacement = organicDisplacement(pos, t);
        // Scale displacement by distance from origin for natural feel
        float distFactor = length(pos) * 0.3 + 0.5;
        result += displacement * uFlowAmount * distFactor * 0.08;
      }

      // 3. Ripple: smooth radial wave emanating from center
      // Creates gentle pulsing waves across the surface
      if (uRippleAmount > 0.001) {
        float dist = length(pos);
        // Organic wave with position-based phase
        float wavePhase = dist * 2.0 - t * 0.5;
        float ripple = organicWave(wavePhase, 0.3);
        // Displace along radial direction
        if (dist > 0.001) {
          vec3 radialDir = pos / dist;
          // Amplitude decreases slightly with distance for natural falloff
          float amplitude = uRippleAmount * 0.06 / (1.0 + dist * 0.2);
          result += radialDir * ripple * amplitude;
        }
      }

      return result;
    }

    void main() {
      vec3 projected = transformND();
      vec3 animated = applyAnimations(projected);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(animated, 1.0);
    }
  `
}
