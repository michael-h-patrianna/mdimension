/**
 * Custom Depth Material Shaders
 *
 * These shaders are used for shadow map rendering when objects have custom
 * vertex transformations (like nD projection). Without these, Three.js uses
 * its default MeshDepthMaterial which doesn't apply the custom transformation,
 * causing shadows to be static even when the object animates.
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
`;

/**
 * Custom depth vertex shader for Polytope.
 * Applies the nD transformation to get correct shadow positions.
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

// Extra dimension attributes
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
  float extraSum = aExtraDim0 + aExtraDim1 + aExtraDim2 + aExtraDim3 + aExtraDim4 + aExtraDim5 + aExtraDim6;
  vec3 modulated = modulateVertex(projected, extraSum);
  vec4 worldPos = modelMatrix * vec4(modulated, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

/**
 * Custom depth fragment shader.
 * Outputs depth packed into RGBA.
 */
export const depthFragmentShader = `
precision highp float;

${packDepthBlock}

void main() {
  gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
}
`;

/**
 * Custom distance vertex shader for Polytope (point light shadows).
 * Outputs world position for distance calculation.
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

// Extra dimension attributes
in float aExtraDim0;
in float aExtraDim1;
in float aExtraDim2;
in float aExtraDim3;
in float aExtraDim4;
in float aExtraDim5;
in float aExtraDim6;

// Output to fragment shader
out vec4 vWorldPosition;

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
  float extraSum = aExtraDim0 + aExtraDim1 + aExtraDim2 + aExtraDim3 + aExtraDim4 + aExtraDim5 + aExtraDim6;
  vec3 modulated = modulateVertex(projected, extraSum);
  vWorldPosition = modelMatrix * vec4(modulated, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vWorldPosition;
}
`;

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

${packDepthBlock}

void main() {
  float dist = length(vWorldPosition.xyz - referencePosition);
  dist = (dist - nearDistance) / (farDistance - nearDistance);
  dist = clamp(dist, 0.0, 1.0);
  gl_FragColor = packDepthToRGBA(dist);
}
`;

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

  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
`;

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
`;
