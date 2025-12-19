/**
 * Custom Depth Material Shaders
 *
 * These shaders are used for shadow map rendering when objects have custom
 * vertex transformations (like nD projection). Without these, Three.js uses
 * its default MeshDepthMaterial which doesn't apply the custom transformation,
 * causing shadows to be static even when the object animates.
 *
 * UNIFIED SHADOW MATERIAL APPROACH:
 * To avoid the double shadow bug (caused by having separate customDepthMaterial
 * and customDistanceMaterial), we use a SINGLE unified material that handles
 * both depth mode (directional/spot lights) and distance mode (point lights).
 * The mode is switched via `uIsPointLight` uniform, set in onBeforeShadow
 * by detecting the shadow camera type (fov=90 = point light).
 *
 * Three.js depth packing format:
 * - Depth is packed into RGBA channels for precision
 * - Uses the same formula as MeshDepthMaterial
 *
 * @see https://threejs.org/docs/#api/en/materials/MeshDepthMaterial
 */

/**
 * Pack depth to RGBA - matches Three.js packDepthToRGBA
 */
export const packDepthBlock = `
vec4 packDepthToRGBA(const in float depth) {
  vec4 r = vec4(depth, fract(depth * 255.0), fract(depth * 65025.0), fract(depth * 16581375.0));
  r.yzw -= r.xyz * (1.0 / 255.0);
  return r;
}
`

/**
 * Custom depth vertex shader for Polytope.
 * Applies the nD transformation to get correct shadow positions.
 * Uses packed attributes to stay under WebGL 16 attribute limit.
 */
export const polytopeDepthVertexShader = `
precision highp float;
precision highp int;

#define MAX_EXTRA_DIMS 7

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28]; // MAX_EXTRA_DIMS * 4
uniform float uDepthRowSums[11];

// Vertex modulation uniforms
uniform float uAnimTime;
uniform float uModAmplitude;
uniform float uModFrequency;
uniform float uModWave;
uniform float uModBias;

// Packed extra dimension attributes (dims 4-7 in vec4, dims 8-10 in vec3)
in vec4 aExtraDims0_3;  // extraDim0, extraDim1, extraDim2, extraDim3
in vec3 aExtraDims4_6;  // extraDim4, extraDim5, extraDim6

vec3 transformND() {
  float scaledInputs[11];
  scaledInputs[0] = position.x * uScale4D.x;
  scaledInputs[1] = position.y * uScale4D.y;
  scaledInputs[2] = position.z * uScale4D.z;
  scaledInputs[3] = aExtraDims0_3.x * uScale4D.w;
  scaledInputs[4] = aExtraDims0_3.y * uExtraScales[0];
  scaledInputs[5] = aExtraDims0_3.z * uExtraScales[1];
  scaledInputs[6] = aExtraDims0_3.w * uExtraScales[2];
  scaledInputs[7] = aExtraDims4_6.x * uExtraScales[3];
  scaledInputs[8] = aExtraDims4_6.y * uExtraScales[4];
  scaledInputs[9] = aExtraDims4_6.z * uExtraScales[5];
  scaledInputs[10] = 0.0;

  vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
  vec4 rotated = uRotationMatrix4D * scaledPos;

  for (int i = 0; i < MAX_EXTRA_DIMS; i++) {
    if (i + 5 <= uDimension) {
      float extraDimValue = scaledInputs[i + 4];
      rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
      rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
      rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
      rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
    }
  }

  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
  effectiveDepth /= normFactor;
  float denom = uProjectionDistance - effectiveDepth;
  if (abs(denom) < 0.0001) denom = denom >= 0.0 ? 0.0001 : -0.0001;
  float factor = 1.0 / denom;
  vec3 projected = rotated.xyz * factor;

  return projected;
}

vec3 modulateVertex(vec3 pos, float extraDimSum) {
  if (uModAmplitude < 0.001) return pos;
  float t = uAnimTime * uModFrequency * 0.1;
  float dist = length(pos);
  float wavePhase = dist * uModWave * 2.0;
  float vertexBias = (pos.x * 1.0 + pos.y * 1.618 + pos.z * 2.236) * uModBias;
  float dimensionBias = extraDimSum * uModBias * 0.5;
  float totalPhase = t + wavePhase + vertexBias + dimensionBias;
  float scale = 1.0 + sin(totalPhase) * uModAmplitude * 0.05;
  return pos * scale;
}

void main() {
  vec3 projected = transformND();
  float extraSum = aExtraDims0_3.x + aExtraDims0_3.y + aExtraDims0_3.z + aExtraDims0_3.w + aExtraDims4_6.x + aExtraDims4_6.y + aExtraDims4_6.z;
  vec3 modulated = modulateVertex(projected, extraSum);
  vec4 worldPos = modelMatrix * vec4(modulated, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

/**
 * Custom depth fragment shader.
 * Outputs depth packed into RGBA.
 * Supports uDiscard uniform to skip rendering during point light shadow passes.
 */
export const depthFragmentShader = `
precision highp float;

// When uDiscard > 0.5, discard the fragment to prevent double shadow bug
// Set in onBeforeShadow when customDepthMaterial is used during point light pass
uniform float uDiscard;

out vec4 fragColor;

${packDepthBlock}

void main() {
  if (uDiscard > 0.5) discard;
  fragColor = packDepthToRGBA(gl_FragCoord.z);
}
`

/**
 * Custom distance vertex shader for Polytope (point light shadows).
 * Outputs world position for distance calculation.
 * Uses packed attributes to stay under WebGL 16 attribute limit.
 */
export const polytopeDistanceVertexShader = `
precision highp float;
precision highp int;

#define MAX_EXTRA_DIMS 7

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];

// Vertex modulation uniforms
uniform float uAnimTime;
uniform float uModAmplitude;
uniform float uModFrequency;
uniform float uModWave;
uniform float uModBias;

// Packed extra dimension attributes (dims 4-7 in vec4, dims 8-10 in vec3)
in vec4 aExtraDims0_3;  // extraDim0, extraDim1, extraDim2, extraDim3
in vec3 aExtraDims4_6;  // extraDim4, extraDim5, extraDim6

// Output to fragment shader
out vec4 vWorldPosition;

vec3 transformND() {
  float scaledInputs[11];
  scaledInputs[0] = position.x * uScale4D.x;
  scaledInputs[1] = position.y * uScale4D.y;
  scaledInputs[2] = position.z * uScale4D.z;
  scaledInputs[3] = aExtraDims0_3.x * uScale4D.w;
  scaledInputs[4] = aExtraDims0_3.y * uExtraScales[0];
  scaledInputs[5] = aExtraDims0_3.z * uExtraScales[1];
  scaledInputs[6] = aExtraDims0_3.w * uExtraScales[2];
  scaledInputs[7] = aExtraDims4_6.x * uExtraScales[3];
  scaledInputs[8] = aExtraDims4_6.y * uExtraScales[4];
  scaledInputs[9] = aExtraDims4_6.z * uExtraScales[5];
  scaledInputs[10] = 0.0;

  vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
  vec4 rotated = uRotationMatrix4D * scaledPos;

  for (int i = 0; i < MAX_EXTRA_DIMS; i++) {
    if (i + 5 <= uDimension) {
      float extraDimValue = scaledInputs[i + 4];
      rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
      rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
      rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
      rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
    }
  }

  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
  effectiveDepth /= normFactor;
  float denom = uProjectionDistance - effectiveDepth;
  if (abs(denom) < 0.0001) denom = denom >= 0.0 ? 0.0001 : -0.0001;
  float factor = 1.0 / denom;
  vec3 projected = rotated.xyz * factor;

  return projected;
}

vec3 modulateVertex(vec3 pos, float extraDimSum) {
  if (uModAmplitude < 0.001) return pos;
  float t = uAnimTime * uModFrequency * 0.1;
  float dist = length(pos);
  float wavePhase = dist * uModWave * 2.0;
  float vertexBias = (pos.x * 1.0 + pos.y * 1.618 + pos.z * 2.236) * uModBias;
  float dimensionBias = extraDimSum * uModBias * 0.5;
  float totalPhase = t + wavePhase + vertexBias + dimensionBias;
  float scale = 1.0 + sin(totalPhase) * uModAmplitude * 0.05;
  return pos * scale;
}

void main() {
  vec3 projected = transformND();
  float extraSum = aExtraDims0_3.x + aExtraDims0_3.y + aExtraDims0_3.z + aExtraDims0_3.w + aExtraDims4_6.x + aExtraDims4_6.y + aExtraDims4_6.z;
  vec3 modulated = modulateVertex(projected, extraSum);
  vWorldPosition = modelMatrix * vec4(modulated, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vWorldPosition;
}
`

/**
 * Custom distance fragment shader for point light shadows.
 * Outputs distance from fragment to light, packed into RGBA.
 */
export const distanceFragmentShader = `
precision highp float;

uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;

in vec4 vWorldPosition;
out vec4 fragColor;

${packDepthBlock}

void main() {
  float dist = length(vWorldPosition.xyz - referencePosition);
  dist = (dist - nearDistance) / (farDistance - nearDistance);
  dist = clamp(dist, 0.0, 1.0);
  fragColor = packDepthToRGBA(dist);
}
`

/**
 * TubeWireframe custom depth vertex shader.
 * Applies the instanced tube transformation for correct shadow positions.
 */
export const tubeWireframeDepthVertexShader = `
precision highp float;

#define MAX_EXTRA_DIMS 7

// Instance attributes for tube endpoints
in vec3 instanceStart;
in vec3 instanceEnd;
in vec4 instanceStartExtraA;
in vec4 instanceStartExtraB;
in vec4 instanceEndExtraA;
in vec4 instanceEndExtraB;

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];

// Tube rendering uniform
uniform float uRadius;

// Discard uniform for point light shadow pass workaround
uniform float uDiscard;

vec3 transformNDPoint(vec3 pos, vec4 extraA, vec4 extraB) {
  float scaledInputs[11];
  scaledInputs[0] = pos.x * uScale4D.x;
  scaledInputs[1] = pos.y * uScale4D.y;
  scaledInputs[2] = pos.z * uScale4D.z;
  scaledInputs[3] = extraA.x * uScale4D.w;
  scaledInputs[4] = extraA.y * uExtraScales[0];
  scaledInputs[5] = extraA.z * uExtraScales[1];
  scaledInputs[6] = extraA.w * uExtraScales[2];
  scaledInputs[7] = extraB.x * uExtraScales[3];
  scaledInputs[8] = extraB.y * uExtraScales[4];
  scaledInputs[9] = extraB.z * uExtraScales[5];
  scaledInputs[10] = extraB.w * uExtraScales[6];

  vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
  vec4 rotated = uRotationMatrix4D * scaledPos;

  for (int i = 0; i < MAX_EXTRA_DIMS; i++) {
    if (i + 5 <= uDimension) {
      float extraDimValue = scaledInputs[i + 4];
      rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
      rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
      rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
      rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
    }
  }

  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  float normFactor = uDimension > 4 ? sqrt(max(1.0, float(uDimension - 3))) : 1.0;
  effectiveDepth /= normFactor;
  float denominator = uProjectionDistance - effectiveDepth;
  float factor = 1.0 / max(denominator, 0.0001);
  vec3 projected = rotated.xyz * factor;

  return projected;
}

void main() {
  // Clip vertices during point light shadow pass to prevent double shadow bug
  if (uDiscard > 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
    return;
  }

  vec3 startPos = transformNDPoint(instanceStart, instanceStartExtraA, instanceStartExtraB);
  vec3 endPos = transformNDPoint(instanceEnd, instanceEndExtraA, instanceEndExtraB);

  vec3 tubeDir = endPos - startPos;
  float tubeLength = length(tubeDir);

  if (tubeLength < 0.0001) {
    tubeDir = vec3(0.0, 1.0, 0.0);
    tubeLength = 0.0001;
  } else {
    tubeDir = tubeDir / tubeLength;
  }

  vec3 up = abs(tubeDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = cross(up, tubeDir);
  float tangentLen = length(tangent);
  if (tangentLen < 0.0001) {
    up = vec3(0.0, 0.0, 1.0);
    tangent = cross(up, tubeDir);
    tangentLen = length(tangent);
  }
  tangent = tangent / max(tangentLen, 0.0001);
  vec3 bitangent = cross(tubeDir, tangent);

  vec3 localPos = position;
  vec3 worldPos = startPos
    + tangent * localPos.x * uRadius
    + bitangent * localPos.z * uRadius
    + tubeDir * (localPos.y + 0.5) * tubeLength;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
`

/**
 * TubeWireframe custom distance vertex shader (point light shadows).
 */
export const tubeWireframeDistanceVertexShader = `
precision highp float;

#define MAX_EXTRA_DIMS 7

// Instance attributes for tube endpoints
in vec3 instanceStart;
in vec3 instanceEnd;
in vec4 instanceStartExtraA;
in vec4 instanceStartExtraB;
in vec4 instanceEndExtraA;
in vec4 instanceEndExtraB;

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];

// Tube rendering uniform
uniform float uRadius;

// Output to fragment shader
out vec4 vWorldPosition;

vec3 transformNDPoint(vec3 pos, vec4 extraA, vec4 extraB) {
  float scaledInputs[11];
  scaledInputs[0] = pos.x * uScale4D.x;
  scaledInputs[1] = pos.y * uScale4D.y;
  scaledInputs[2] = pos.z * uScale4D.z;
  scaledInputs[3] = extraA.x * uScale4D.w;
  scaledInputs[4] = extraA.y * uExtraScales[0];
  scaledInputs[5] = extraA.z * uExtraScales[1];
  scaledInputs[6] = extraA.w * uExtraScales[2];
  scaledInputs[7] = extraB.x * uExtraScales[3];
  scaledInputs[8] = extraB.y * uExtraScales[4];
  scaledInputs[9] = extraB.z * uExtraScales[5];
  scaledInputs[10] = extraB.w * uExtraScales[6];

  vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
  vec4 rotated = uRotationMatrix4D * scaledPos;

  for (int i = 0; i < MAX_EXTRA_DIMS; i++) {
    if (i + 5 <= uDimension) {
      float extraDimValue = scaledInputs[i + 4];
      rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
      rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
      rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
      rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
    }
  }

  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  float normFactor = uDimension > 4 ? sqrt(max(1.0, float(uDimension - 3))) : 1.0;
  effectiveDepth /= normFactor;
  float denominator = uProjectionDistance - effectiveDepth;
  float factor = 1.0 / max(denominator, 0.0001);
  vec3 projected = rotated.xyz * factor;

  return projected;
}

void main() {
  vec3 startPos = transformNDPoint(instanceStart, instanceStartExtraA, instanceStartExtraB);
  vec3 endPos = transformNDPoint(instanceEnd, instanceEndExtraA, instanceEndExtraB);

  vec3 tubeDir = endPos - startPos;
  float tubeLength = length(tubeDir);

  if (tubeLength < 0.0001) {
    tubeDir = vec3(0.0, 1.0, 0.0);
    tubeLength = 0.0001;
  } else {
    tubeDir = tubeDir / tubeLength;
  }

  vec3 up = abs(tubeDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = cross(up, tubeDir);
  float tangentLen = length(tangent);
  if (tangentLen < 0.0001) {
    up = vec3(0.0, 0.0, 1.0);
    tangent = cross(up, tubeDir);
    tangentLen = length(tangent);
  }
  tangent = tangent / max(tangentLen, 0.0001);
  vec3 bitangent = cross(tubeDir, tangent);

  vec3 localPos = position;
  vec3 worldPos = startPos
    + tangent * localPos.x * uRadius
    + bitangent * localPos.z * uRadius
    + tubeDir * (localPos.y + 0.5) * tubeLength;

  vWorldPosition = modelMatrix * vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vWorldPosition;
}
`

// ============================================================================
// UNIFIED SHADOW MATERIAL SHADERS
// ============================================================================
// These unified shaders handle BOTH depth mode (directional/spot lights) and
// distance mode (point lights) in a single material. This avoids the double
// shadow bug caused by having separate customDepthMaterial and customDistanceMaterial.
//
// The mode is switched via `uIsPointLight` uniform, which is set in onBeforeShadow
// by detecting the shadow camera type (PerspectiveCamera with fov=90 = point light).
// ============================================================================

/**
 * Unified shadow vertex shader for Polytope.
 * Outputs world position for both depth and distance modes.
 */
export const polytopeUnifiedShadowVertexShader = `
precision highp float;
precision highp int;

#define MAX_EXTRA_DIMS 7

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];

// Vertex modulation uniforms
uniform float uAnimTime;
uniform float uModAmplitude;
uniform float uModFrequency;
uniform float uModWave;
uniform float uModBias;

// Packed extra dimension attributes
in vec4 aExtraDims0_3;
in vec3 aExtraDims4_6;

// Output world position for distance calculation in point light mode
out vec3 vWorldPosition;

vec3 transformND() {
  float scaledInputs[11];
  scaledInputs[0] = position.x * uScale4D.x;
  scaledInputs[1] = position.y * uScale4D.y;
  scaledInputs[2] = position.z * uScale4D.z;
  scaledInputs[3] = aExtraDims0_3.x * uScale4D.w;
  scaledInputs[4] = aExtraDims0_3.y * uExtraScales[0];
  scaledInputs[5] = aExtraDims0_3.z * uExtraScales[1];
  scaledInputs[6] = aExtraDims0_3.w * uExtraScales[2];
  scaledInputs[7] = aExtraDims4_6.x * uExtraScales[3];
  scaledInputs[8] = aExtraDims4_6.y * uExtraScales[4];
  scaledInputs[9] = aExtraDims4_6.z * uExtraScales[5];
  scaledInputs[10] = 0.0;

  vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
  vec4 rotated = uRotationMatrix4D * scaledPos;

  for (int i = 0; i < MAX_EXTRA_DIMS; i++) {
    if (i + 5 <= uDimension) {
      float extraDimValue = scaledInputs[i + 4];
      rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
      rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
      rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
      rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
    }
  }

  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
  effectiveDepth /= normFactor;
  float denom = uProjectionDistance - effectiveDepth;
  if (abs(denom) < 0.0001) denom = denom >= 0.0 ? 0.0001 : -0.0001;
  float factor = 1.0 / denom;
  vec3 projected = rotated.xyz * factor;

  return projected;
}

vec3 modulateVertex(vec3 pos, float extraDimSum) {
  if (uModAmplitude < 0.001) return pos;
  float t = uAnimTime * uModFrequency * 0.1;
  float dist = length(pos);
  float wavePhase = dist * uModWave * 2.0;
  float vertexBias = (pos.x * 1.0 + pos.y * 1.618 + pos.z * 2.236) * uModBias;
  float dimensionBias = extraDimSum * uModBias * 0.5;
  float totalPhase = t + wavePhase + vertexBias + dimensionBias;
  float scale = 1.0 + sin(totalPhase) * uModAmplitude * 0.05;
  return pos * scale;
}

void main() {
  vec3 projected = transformND();
  float extraSum = aExtraDims0_3.x + aExtraDims0_3.y + aExtraDims0_3.z + aExtraDims0_3.w + aExtraDims4_6.x + aExtraDims4_6.y + aExtraDims4_6.z;
  vec3 modulated = modulateVertex(projected, extraSum);
  vec4 worldPos = modelMatrix * vec4(modulated, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

/**
 * Unified shadow fragment shader.
 * Switches between depth mode (directional/spot) and distance mode (point) via uniform.
 */
export const unifiedShadowFragmentShader = `
precision highp float;

// Mode switch: 0 = depth mode (directional/spot), 1 = distance mode (point)
uniform float uIsPointLight;

// Point light uniforms (only used when uIsPointLight > 0.5)
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;

// World position from vertex shader
in vec3 vWorldPosition;

out vec4 fragColor;

${packDepthBlock}

void main() {
  if (uIsPointLight > 0.5) {
    // Point light mode: output distance from light
    float dist = length(vWorldPosition - referencePosition);
    dist = (dist - nearDistance) / (farDistance - nearDistance);
    dist = clamp(dist, 0.0, 1.0);
    fragColor = packDepthToRGBA(dist);
  } else {
    // Depth mode: output fragment depth (directional/spot lights)
    fragColor = packDepthToRGBA(gl_FragCoord.z);
  }
}
`

/**
 * Unified shadow vertex shader for TubeWireframe.
 * Outputs world position for both depth and distance modes.
 */
export const tubeWireframeUnifiedShadowVertexShader = `
precision highp float;

#define MAX_EXTRA_DIMS 7

// Instance attributes for tube endpoints
in vec3 instanceStart;
in vec3 instanceEnd;
in vec4 instanceStartExtraA;
in vec4 instanceStartExtraB;
in vec4 instanceEndExtraA;
in vec4 instanceEndExtraB;

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28];
uniform float uDepthRowSums[11];

// Tube rendering uniform
uniform float uRadius;

// Output world position for distance calculation
out vec3 vWorldPosition;

vec3 transformNDPoint(vec3 pos, vec4 extraA, vec4 extraB) {
  float scaledInputs[11];
  scaledInputs[0] = pos.x * uScale4D.x;
  scaledInputs[1] = pos.y * uScale4D.y;
  scaledInputs[2] = pos.z * uScale4D.z;
  scaledInputs[3] = extraA.x * uScale4D.w;
  scaledInputs[4] = extraA.y * uExtraScales[0];
  scaledInputs[5] = extraA.z * uExtraScales[1];
  scaledInputs[6] = extraA.w * uExtraScales[2];
  scaledInputs[7] = extraB.x * uExtraScales[3];
  scaledInputs[8] = extraB.y * uExtraScales[4];
  scaledInputs[9] = extraB.z * uExtraScales[5];
  scaledInputs[10] = extraB.w * uExtraScales[6];

  vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
  vec4 rotated = uRotationMatrix4D * scaledPos;

  for (int i = 0; i < MAX_EXTRA_DIMS; i++) {
    if (i + 5 <= uDimension) {
      float extraDimValue = scaledInputs[i + 4];
      rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
      rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
      rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
      rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
    }
  }

  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  float normFactor = uDimension > 4 ? sqrt(max(1.0, float(uDimension - 3))) : 1.0;
  effectiveDepth /= normFactor;
  float denominator = uProjectionDistance - effectiveDepth;
  float factor = 1.0 / max(denominator, 0.0001);
  vec3 projected = rotated.xyz * factor;

  return projected;
}

void main() {
  vec3 startPos = transformNDPoint(instanceStart, instanceStartExtraA, instanceStartExtraB);
  vec3 endPos = transformNDPoint(instanceEnd, instanceEndExtraA, instanceEndExtraB);

  vec3 tubeDir = endPos - startPos;
  float tubeLength = length(tubeDir);

  if (tubeLength < 0.0001) {
    tubeDir = vec3(0.0, 1.0, 0.0);
    tubeLength = 0.0001;
  } else {
    tubeDir = tubeDir / tubeLength;
  }

  vec3 up = abs(tubeDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = cross(up, tubeDir);
  float tangentLen = length(tangent);
  if (tangentLen < 0.0001) {
    up = vec3(0.0, 0.0, 1.0);
    tangent = cross(up, tubeDir);
    tangentLen = length(tangent);
  }
  tangent = tangent / max(tangentLen, 0.0001);
  vec3 bitangent = cross(tubeDir, tangent);

  vec3 localPos = position;
  vec3 worldPos = startPos
    + tangent * localPos.x * uRadius
    + bitangent * localPos.z * uRadius
    + tubeDir * (localPos.y + 0.5) * tubeLength;

  vec4 worldPos4 = modelMatrix * vec4(worldPos, 1.0);
  vWorldPosition = worldPos4.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos4;
}
`
