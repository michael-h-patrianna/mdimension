/**
 * Unified Material Vertex Shader Generator
 *
 * Generates vertex shader code for N-dimensional rendering.
 * Supports dimensions 3 to 11 with GPU-based rotation and projection.
 *
 * @module
 */

import type { UnifiedMaterialOptions } from './types'

/**
 * Generates the vertex shader for unified materials.
 *
 * @param options - Material options including maxDimension and renderMode
 * @returns GLSL vertex shader code (WebGL2/GLSL ES 3.00)
 */
export function generateUnifiedVertexShader(options: Required<UnifiedMaterialOptions>): string {
  const extraDims = options.maxDimension - 4

  return /* glsl */ `
// Unified Material Vertex Shader
// WebGL2 / GLSL ES 3.00
// Supports dimensions 3 to ${options.maxDimension}

// Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[${extraDims}];

// Projection uniforms
uniform float uProjectionDistance;
uniform int uProjectionType; // 0 = orthographic, 1 = perspective

// Visual uniforms
uniform float uPointSize;
uniform float uTime;

// Extra dimension attributes (W and beyond)
attribute float aExtraDim0; // W (4th dimension)
${Array.from({ length: extraDims - 1 }, (_, i) =>
  `attribute float aExtraDim${i + 1}; // ${i + 5}th dimension`
).join('\n')}

// Face depth attribute for palette coloring
attribute float aFaceDepth;

// Varyings for fragment shader
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDirection;
varying float vDepth;
varying float vFaceDepth;

void main() {
  // Collect extra dimensions
  float extraDims[${extraDims}];
  extraDims[0] = aExtraDim0;
  ${Array.from({ length: extraDims - 1 }, (_, i) =>
    `extraDims[${i + 1}] = aExtraDim${i + 1};`
  ).join('\n  ')}

  // Apply scale to all dimensions
  vec3 scaledPos = position * uScale4D.xyz;
  float scaledW = aExtraDim0 * uScale4D.w;
  for (int i = 0; i < ${extraDims}; i++) {
    extraDims[i] *= uExtraScales[i];
  }

  // Build 4D position vector
  vec4 pos4 = vec4(scaledPos, scaledW);

  // Apply 4D rotation matrix
  vec4 rotated4 = uRotationMatrix4D * pos4;

  // Apply perspective projection from N-D to 3D
  vec3 projectedPos;
  if (uProjectionType == 0) {
    // Orthographic
    projectedPos = rotated4.xyz;
  } else {
    // Perspective
    float effectiveDepth = rotated4.w;
    float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;

    for (int i = 0; i < ${extraDims}; i++) {
      if (i + 5 <= uDimension) {
        effectiveDepth += extraDims[i];
      }
    }
    effectiveDepth /= normFactor;

    float factor = 1.0 / (uProjectionDistance - effectiveDepth);
    projectedPos = rotated4.xyz * factor;
  }

  // Standard MVP transform
  vec4 worldPos = modelMatrix * vec4(projectedPos, 1.0);
  vWorldPosition = worldPos.xyz;

  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;

  // Calculate view direction for fresnel
  vViewDirection = normalize(cameraPosition - worldPos.xyz);

  // Transform normal (use rotated normal if available)
  #ifdef USE_NORMALS
    vNormal = normalize(normalMatrix * normal);
  #else
    vNormal = vec3(0.0, 1.0, 0.0);
  #endif

  // Pass depth for color variation
  vDepth = (rotated4.w + 1.0) * 0.5;
  vFaceDepth = aFaceDepth;

  // Point size for points mode
  ${options.renderMode === 'points' ? 'gl_PointSize = uPointSize;' : ''}
}
`
}

