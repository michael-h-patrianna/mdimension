/**
 * N-Dimensional Embedding
 *
 * Functions to embed 3D rays into N-dimensional space using
 * the slice parameter values and rotation basis. This enables
 * true N-D raymarching when trueND mode is active.
 */

/**
 * N-Dimensional Embedding Functions
 *
 * Embeds 3D rays into N-dimensional space using spherical coordinate extension.
 * Higher dimensions are mapped via time-modulated rotation angles when slice
 * animation is enabled.
 *
 * @mathematical For dimension d > 3, position[d] = paramValue[d-3] + oscillation
 *               where oscillation = sin(time * speed + phase) * amplitude
 *
 * @constraint DIMENSION must be <= 11 due to fixed-size float[11] arrays
 *             in GLSL ES 3.0 which doesn't support variable-length arrays.
 */
export const embeddingBlock = /* glsl */ `
//----------------------------------------------
// N-DIMENSIONAL EMBEDDING
//----------------------------------------------

// Compile-time safety check: prevent array overflow
#if DIMENSION > 11
#error "DIMENSION must not exceed 11 for N-D array operations (float[11] limit)"
#endif

// Named constants for clarity
const float ND_EPSILON = 0.0001;
const float ND_PHASE_OFFSET = 0.7;  // Phase offset between dimensions for animation

/**
 * Initialize an N-D vector to zero.
 * Uses GLSL ES 3.0 array initializer for efficiency.
 */
void zeroND(out float v[11]) {
  // GLSL ES 3.0 supports array initializers - more efficient than loop
  v = float[11](0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
}

/**
 * Copy an N-D vector.
 */
void copyND(in float src[11], out float dst[11]) {
  for (int i = 0; i < 11; i++) {
    dst[i] = src[i];
  }
}

/**
 * Add two N-D vectors: result = a + b
 */
void addND(in float a[11], in float b[11], out float result[11]) {
  for (int i = 0; i < DIMENSION; i++) {
    result[i] = a[i] + b[i];
  }
  // Zero remaining components
  for (int i = DIMENSION; i < 11; i++) {
    result[i] = 0.0;
  }
}

/**
 * Scale an N-D vector: result = v * scalar
 */
void scaleND(in float v[11], float scalar, out float result[11]) {
  for (int i = 0; i < DIMENSION; i++) {
    result[i] = v[i] * scalar;
  }
  // Zero remaining components
  for (int i = DIMENSION; i < 11; i++) {
    result[i] = 0.0;
  }
}

/**
 * Compute squared length of an N-D vector.
 */
float lengthSqND(in float v[11]) {
  float sum = 0.0;
  for (int i = 0; i < DIMENSION; i++) {
    sum += v[i] * v[i];
  }
  return sum;
}

/**
 * Compute length of an N-D vector.
 */
float lengthND(in float v[11]) {
  return sqrt(lengthSqND(v));
}

/**
 * Normalize an N-D vector in place.
 */
void normalizeND(inout float v[11]) {
  float len = lengthND(v);
  if (len > 0.0001) {
    float invLen = 1.0 / len;
    for (int i = 0; i < DIMENSION; i++) {
      v[i] *= invLen;
    }
  }
}

/**
 * Dot product of two N-D vectors.
 */
float dotND(in float a[11], in float b[11]) {
  float sum = 0.0;
  for (int i = 0; i < DIMENSION; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Embed a 3D position into N-D space.
 * Uses uOrigin for the extra dimensions and places
 * the 3D position in the first 3 components.
 *
 * The embedding adds uParamValues for dimensions 4+,
 * scaled by time if slice animation is enabled.
 */
void embed3DtoND(vec3 pos3d, out float posN[11], float time) {
  // First 3 dimensions are the 3D position
  posN[0] = pos3d.x + uOrigin[0];
  posN[1] = pos3d.y + uOrigin[1];
  posN[2] = pos3d.z + uOrigin[2];

  // Higher dimensions use paramValues (slice position)
  for (int i = 3; i < DIMENSION; i++) {
    float baseValue = uParamValues[i - 3];

    // Apply slice animation if enabled
    #ifdef USE_SLICE_ANIMATION
      // Oscillate each higher dimension with phase offset
      float phase = float(i - 3) * 0.7;
      float oscillation = sin(time * uSliceSpeed + phase) * uSliceAmplitude;
      baseValue += oscillation;
    #endif

    posN[i] = baseValue + uOrigin[i];
  }

  // Zero unused dimensions
  for (int i = DIMENSION; i < 11; i++) {
    posN[i] = 0.0;
  }
}

/**
 * Embed a 3D direction into N-D space.
 * The direction is placed in the first 3 components,
 * with higher dimensions set to zero (ray travels in 3D subspace).
 *
 * For more complex N-D raymarching, this could be extended
 * to include rotation into higher dimensions.
 */
void embedDir3DtoND(vec3 dir3d, out float dirN[11]) {
  // Direction in first 3 dimensions
  dirN[0] = dir3d.x;
  dirN[1] = dir3d.y;
  dirN[2] = dir3d.z;

  // Higher dimensions: ray initially travels in 3D subspace
  for (int i = 3; i < 11; i++) {
    dirN[i] = 0.0;
  }
}

/**
 * Embed a 3D ray (origin + direction) into N-D space.
 * Combines embed3DtoND and embedDir3DtoND for convenience.
 */
void embedRay3DtoND(
  vec3 origin3,
  vec3 dir3,
  out float posN[11],
  out float dirN[11],
  float time
) {
  embed3DtoND(origin3, posN, time);
  embedDir3DtoND(dir3, dirN);
}

/**
 * Project an N-D position back to 3D for rendering.
 * Simply extracts the first 3 components.
 */
vec3 projectNDto3D(in float posN[11]) {
  return vec3(posN[0], posN[1], posN[2]);
}

/**
 * Advance an N-D ray by a step.
 * pos += dir * stepSize
 */
void advanceRayND(inout float pos[11], in float dir[11], float stepSize) {
  for (int i = 0; i < DIMENSION; i++) {
    pos[i] += dir[i] * stepSize;
  }
}

/**
 * Compute the gradient direction toward the N-D origin.
 * This is used for gravitational lensing - rays bend toward mass center.
 */
void computeGravityDirND(in float pos[11], out float gravDir[11]) {
  // Direction toward origin
  for (int i = 0; i < DIMENSION; i++) {
    gravDir[i] = -pos[i];
  }
  normalizeND(gravDir);
}
`
