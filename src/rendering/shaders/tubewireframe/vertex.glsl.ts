// ============================================
// TubeWireframe Vertex Shader
// N-dimensional tube rendering with instanced cylinders
// ============================================

export const vertexBlock = `
precision highp float;

// Instance attributes for tube endpoints
in vec3 instanceStart;
in vec3 instanceEnd;
// Packed extra dimensions: ExtraA = (W, Extra0, Extra1, Extra2)
// ExtraB = (Extra3, Extra4, Extra5, Extra6)
in vec4 instanceStartExtraA;
in vec4 instanceStartExtraB;
in vec4 instanceEndExtraA;
in vec4 instanceEndExtraB;

// N-D Transformation uniforms
uniform mat4 uRotationMatrix4D;
uniform int uDimension;
uniform vec4 uScale4D;
#define MAX_EXTRA_DIMS 7
uniform float uExtraScales[MAX_EXTRA_DIMS];
uniform float uProjectionDistance;
uniform float uExtraRotationCols[28]; // MAX_EXTRA_DIMS * 4
uniform float uDepthRowSums[11];

// Tube rendering uniform
uniform float uRadius;

// Outputs to fragment shader
out vec3 vNormal;
out vec3 vWorldPosition;
out vec3 vViewDirection;

// Transform an N-dimensional point through rotation and projection
vec3 transformNDPoint(vec3 pos, vec4 extraA, vec4 extraB) {
  // Unpack: extraA = (W, Extra0, Extra1, Extra2), extraB = (Extra3, Extra4, Extra5, Extra6)
  float scaledInputs[11];
  scaledInputs[0] = pos.x * uScale4D.x;
  scaledInputs[1] = pos.y * uScale4D.y;
  scaledInputs[2] = pos.z * uScale4D.z;
  scaledInputs[3] = extraA.x * uScale4D.w; // W
  scaledInputs[4] = extraA.y * uExtraScales[0]; // Extra0
  scaledInputs[5] = extraA.z * uExtraScales[1]; // Extra1
  scaledInputs[6] = extraA.w * uExtraScales[2]; // Extra2
  scaledInputs[7] = extraB.x * uExtraScales[3]; // Extra3
  scaledInputs[8] = extraB.y * uExtraScales[4]; // Extra4
  scaledInputs[9] = extraB.z * uExtraScales[5]; // Extra5
  scaledInputs[10] = extraB.w * uExtraScales[6]; // Extra6

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

  // Perspective projection: apply depth-based scaling from higher dimensions
  float effectiveDepth = rotated.w;
  for (int j = 0; j < 11; j++) {
    if (j < uDimension) {
      effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
    }
  }
  // Normalize depth by sqrt(dimension - 3) for consistent visual scale across dimensions.
  // Uses max(1.0, ...) to safely handle edge cases.
  // See src/rendering/shaders/transforms/ndTransform.ts for mathematical justification.
  float normFactor = uDimension > 4 ? sqrt(max(1.0, float(uDimension - 3))) : 1.0;
  effectiveDepth /= normFactor;
  // Add safety check for perspective denominator
  float denominator = uProjectionDistance - effectiveDepth;
  float factor = 1.0 / max(denominator, 0.0001);
  vec3 projected = rotated.xyz * factor;

  return projected;
}

void main() {
  // Transform tube endpoints through N-D pipeline
  vec3 startPos = transformNDPoint(instanceStart, instanceStartExtraA, instanceStartExtraB);
  vec3 endPos = transformNDPoint(instanceEnd, instanceEndExtraA, instanceEndExtraB);

  // Calculate tube direction and length
  vec3 tubeDir = endPos - startPos;
  float tubeLength = length(tubeDir);

  // Handle degenerate tubes (zero length)
  if (tubeLength < 0.0001) {
    tubeDir = vec3(0.0, 1.0, 0.0);
    tubeLength = 0.0001;
  } else {
    tubeDir = tubeDir / tubeLength;
  }

  // Build orthonormal basis for tube orientation
  // Find a vector not parallel to tubeDir using robust selection
  // Check if tubeDir is nearly parallel to the default up vector (0,1,0)
  // If so, use (1,0,0) instead to ensure a valid cross product
  vec3 up = abs(tubeDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = cross(up, tubeDir);
  // Guard against degenerate cross product (can happen if tubeDir is very close to up)
  float tangentLen = length(tangent);
  if (tangentLen < 0.0001) {
    // Fallback: use a different up vector
    up = vec3(0.0, 0.0, 1.0);
    tangent = cross(up, tubeDir);
    tangentLen = length(tangent);
  }
  tangent = tangent / max(tangentLen, 0.0001);
  vec3 bitangent = cross(tubeDir, tangent);

  // CylinderGeometry has Y as the axis, centered at origin, height 1
  // position.xz is the cross-section, position.y is along the length (-0.5 to 0.5)
  vec3 localPos = position;

  // Transform cylinder vertex to tube space
  // Scale the cross-section by radius, the length by tubeLength
  vec3 worldPos = startPos
    + tangent * localPos.x * uRadius
    + bitangent * localPos.z * uRadius
    + tubeDir * (localPos.y + 0.5) * tubeLength;

  // Transform normal from cylinder space to world space
  // Cylinder normals are in the XZ plane (perpendicular to Y axis)
  vec3 localNormal = normalize(normal);
  vNormal = normalize(tangent * localNormal.x + bitangent * localNormal.z + tubeDir * localNormal.y);

  // Pass world position to fragment shader
  vWorldPosition = (modelMatrix * vec4(worldPos, 1.0)).xyz;

  // Calculate view direction
  vViewDirection = normalize(cameraPosition - vWorldPosition);

  // Final position
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
`
