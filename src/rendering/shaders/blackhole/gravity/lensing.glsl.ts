/**
 * Gravitational Lensing
 *
 * Implements N-dimensional ray bending based on simplified gravitational field.
 * Uses the formula: d = -k * (N^α) * r_hat / |r|^β
 */

export const lensingBlock = /* glsl */ `
//----------------------------------------------
// GRAVITATIONAL LENSING
//----------------------------------------------

/**
 * Safely normalize a vector, returning a fallback if near zero.
 * Prevents NaN artifacts.
 */
vec3 safeNormalize(vec3 v, vec3 fallback) {
  float len = length(v);
  return len > 1e-6 ? v / len : fallback;
}

/**
 * Compute N-dimensional distance to origin.
 *
 * Mathematically, for a 3D slice defined by orthonormal basis vectors
 * and an origin offset, the distance squared to the N-D origin is:
 *   Radius^2 = worldX^2 + worldY^2 + worldZ^2 + |OriginOffset|^2
 *
 * @param pos3d - 3D world position in the slice
 * @returns N-dimensional radius
 */
float ndDistance(vec3 pos3d) {
  // Compute distance squared in the 3D slice
  float dist3dSq = dot(pos3d, pos3d);
  
  // Add the pre-calculated squared length of the N-D origin offset
  float sumSq = dist3dSq + uOriginOffsetLengthSq;

  return sqrt(max(sumSq, 1e-10));
}

/**
 * Compute gravitational lensing strength.
 *
 * Uses the N-dimensional lensing formula:
 *   G(r,N) = k * N^α / (r + ε)^β
 *
 * Where:
 * - k = uGravityStrength (overall gravity intensity)
 * - N = DIMENSION (number of dimensions)
 * - α = uDimensionEmphasis (dimension scaling exponent)
 * - r = ndRadius (N-dimensional distance from center)
 * - ε = uEpsilonMul (numerical stability term)
 * - β = uDistanceFalloff (distance falloff exponent)
 *
 * This formula provides:
 * - Smooth scaling across dimensions via N^α
 * - Proper falloff with distance via (r+ε)^β
 * - No singularity at origin due to ε term
 */
float computeDeflectionAngle(float ndRadius) {
  // N-dimensional lensing formula: G(r,N) = k * N^α / (r + ε)^β
  // N^α is pre-calculated on CPU as uDimPower
  float k = uGravityStrength;
  float r = ndRadius;
  float epsilon = uEpsilonMul;
  float beta = uDistanceFalloff;

  // Compute lensing strength per spec using pre-calculated uDimPower
  float deflectionAngle = k * uDimPower / pow(r + epsilon, beta);

  // Scale by horizon radius for physical units
  deflectionAngle *= uHorizonRadius;

  // Clamp to prevent extreme bending per step
  deflectionAngle = min(deflectionAngle, uBendMaxPerStep);

  return deflectionAngle;
}

/**
 * Apply ray bending for one raymarch step.
 *
 * Uses the Schwarzschild geodesic equation:
 *   u″(φ) = -u * (1 - 1.5*u²)
 *
 * Where u = 1/r (inverse radius), integrated along the angular parameter φ.
 * See: https://oseiskar.github.io/black-hole/docs/physics.html
 *
 * The algorithm:
 * 1. Decompose ray into radial and tangential components in the orbital plane
 * 2. Convert to inverse radius u = 1/r
 * 3. Compute du (derivative of u with respect to φ)
 * 4. Apply geodesic acceleration: ddu = -u*(1 - 1.5*u²)
 * 5. Update u and reconstruct new direction
 *
 * Units: Schwarzschild radius rs = uHorizonRadius, c = 1
 */
vec3 bendRay(vec3 rayDir, vec3 pos3d, float stepSize, float ndRadius) {
  // Current radius
  float r = ndRadius;
  float rs = uHorizonRadius;

  // Skip if too close to singularity or inside photon sphere core
  if (r < rs * 0.5) {
    return rayDir;
  }

  // Inverse radius (key variable for geodesic equation)
  float u = 1.0 / r;

  // Radial unit vector (pointing away from center)
  vec3 radialDir = pos3d / r;

  // Decompose ray direction into radial and tangential components
  // The orbital plane is defined by pos and rayDir
  float radialComponent = dot(rayDir, radialDir);

  // Tangent direction (perpendicular to radial, in orbital plane)
  vec3 tangentDir = rayDir - radialComponent * radialDir;
  float tangentMag = length(tangentDir);

  // If ray is nearly radial, no bending needed
  if (tangentMag < 0.0001) {
    return rayDir;
  }
  tangentDir /= tangentMag;

  // du/dφ: rate of change of inverse radius with angle
  // du = -u * (radial_velocity / tangent_velocity)
  // Since |rayDir| = 1, we have: radial² + tangent² = 1
  float du = -radialComponent * u / tangentMag;

  // Angular step (φ increment)
  // Scale step by tangent velocity to maintain consistent spatial stepping
  // Apply gravity strength multiplier for artistic control (Arcade Lensing)
  float dPhi = stepSize * tangentMag / r * uGravityStrength * uBendScale;
  
  // Clamp dPhi to prevent numerical explosion
  dPhi = min(dPhi, uBendMaxPerStep);

  // Schwarzschild geodesic equation: u″ = -u + 1.5 * rs * u²
  // This is the correct relativistic equation for light deflection
  float ddu = -u + 1.5 * rs * u * u;

  // Leapfrog integration (Semi-Implicit Euler for stability)
  du += ddu * dPhi;
  u += du * dPhi;

  // Clamp u to prevent going inside event horizon
  float uMax = 1.0 / (rs * 0.5);
  u = min(u, uMax);

  // New radius from updated inverse radius
  float newR = 1.0 / max(u, 0.0001);

  // Reconstruct velocity components from updated values
  // The ray direction in the orbital plane is: v = vr * radialDir + vt * tangentDir
  // where vr/vt = -du/u (from du = -u * vr/vt)
  float newRadialRatio = -du / max(u, 0.0001);

  // Renormalize to unit direction
  // vr² + vt² = 1, and vr/vt = newRadialRatio
  // So vt = 1/sqrt(1 + ratio²), vr = ratio * vt
  float ratioSq = newRadialRatio * newRadialRatio;
  float newTangent = 1.0 / sqrt(1.0 + ratioSq);
  float newRadial = newRadialRatio * newTangent;

  // Reconstruct 3D direction
  vec3 newDir = newRadial * radialDir + newTangent * tangentDir;

  return normalize(newDir);
}

/**
 * Sample background with gravitational lensing.
 * Uses the bent ray direction to sample environment.
 */
vec3 sampleBentBackground(vec3 bentDir, samplerCube envMap) {
  // Sample environment map with bent direction
  vec3 envColor = texture(envMap, bentDir).rgb;
  return envColor;
}

/**
 * Procedural starfield for background.
 * Creates tiled stars based on bent ray direction.
 */
vec3 proceduralStars(vec3 bentDir) {
  // Hash function for star placement
  vec3 starDir = normalize(bentDir);

  // Create star grid cells
  float scale = 50.0 * uStarfieldDensity;
  vec3 cell = floor(starDir * scale);
  vec3 frac = fract(starDir * scale);

  // Hash for star position within cell
  float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);

  // Star probability
  float starProb = step(0.98, h);

  // Star brightness varies
  float brightness = h * h * uStarfieldBrightness;

  // Point spread function (soft star)
  vec3 starPos = vec3(h, fract(h * 2.1), fract(h * 3.7));
  float dist = length(frac - starPos) * 3.0;
  float star = exp(-dist * dist * 10.0) * starProb * brightness;

  // Star color (slight variation)
  vec3 starColor = mix(vec3(1.0, 0.9, 0.8), vec3(0.8, 0.9, 1.0), h);

  return starColor * star;
}

//----------------------------------------------
// N-DIMENSIONAL LENSING (True N-D Mode)
//----------------------------------------------
#ifdef USE_TRUE_ND

/**
 * Compute N-dimensional distance from an N-D position.
 * Uses the full position vector rather than 3D + params.
 */
float ndDistanceND(in float pos[11]) {
  float sumSq = 0.0;
  for (int i = 0; i < DIMENSION; i++) {
    sumSq += pos[i] * pos[i];
  }
  return sqrt(max(sumSq, 1e-10));
}

/**
 * Compute deflection angle for N-D raymarching.
 * Same formula as 3D version but uses N-D distance.
 */
float computeDeflectionAngleND(float ndRadius) {
  // Use same formula as 3D version
  return computeDeflectionAngle(ndRadius);
}

/**
 * Bend ray in N-D space.
 *
 * Uses the Schwarzschild geodesic equation generalized to N dimensions:
 *   u″(φ) = -u * (1 - 1.5*u²)
 *
 * Where u = 1/r (inverse radius). The orbital plane is defined by
 * the position and velocity vectors in N-D space.
 */
void bendRayND(inout float dir[11], in float pos[11], float stepSize, float ndRadius) {
  float r = ndRadius;
  float rs = uHorizonRadius;

  // Skip if too close to singularity
  if (r < rs * 0.5) {
    return;
  }

  // Inverse radius
  float u = 1.0 / r;

  // Compute radial unit vector
  float radialDir[11];
  for (int i = 0; i < DIMENSION; i++) {
    radialDir[i] = pos[i] / r;
  }

  // Decompose velocity into radial and tangential
  float vDotR = dotND(dir, radialDir);

  float tangent[11];
  for (int i = 0; i < DIMENSION; i++) {
    tangent[i] = dir[i] - vDotR * radialDir[i];
  }

  float tangentMag = lengthND(tangent);

  // If nearly radial, skip bending
  if (tangentMag < 0.0001) {
    return;
  }

  // Normalize tangent
  for (int i = 0; i < DIMENSION; i++) {
    tangent[i] /= tangentMag;
  }

  // du/dφ
  float du = -vDotR * u / tangentMag;

  // Angular step
  float dPhi = stepSize * tangentMag / r * uGravityStrength * uBendScale;
  
  // Clamp dPhi
  dPhi = min(dPhi, uBendMaxPerStep);

  // Schwarzschild geodesic: u″ = -u + 1.5 * rs * u²
  float ddu = -u + 1.5 * rs * u * u;

  // Leapfrog integration (Semi-Implicit Euler)
  du += ddu * dPhi;
  u += du * dPhi;

  // Clamp u
  float uMax = 1.0 / (rs * 0.5);
  u = min(u, uMax);

  // Reconstruct direction
  float newRadialRatio = -du / max(u, 0.0001);
  float ratioSq = newRadialRatio * newRadialRatio;
  float newTangent = 1.0 / sqrt(1.0 + ratioSq);
  float newRadial = newRadialRatio * newTangent;

  for (int i = 0; i < DIMENSION; i++) {
    dir[i] = newRadial * radialDir[i] + newTangent * tangent[i];
  }

  normalizeND(dir);
}

#endif // USE_TRUE_ND
`
