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
 * Apply ray bending for one raymarch step using "Magic Potential" approach
 * with Kerr frame dragging.
 *
 * Base algorithm (from Starless raytracer):
 *   acceleration = -1.5 * h² * pos / |pos|^5
 *
 * Kerr frame dragging addition:
 *   The spacetime is "dragged" by the spinning black hole.
 *   This adds an azimuthal component to the acceleration that
 *   pulls light rays in the direction of the black hole's rotation.
 *
 *   Frame dragging acceleration ∝ (a/r³) × (spin_axis × r_hat)
 *   where a = chi * M is the spin parameter.
 *
 * Reference: https://rantonels.github.io/starless/
 *
 * @param rayDir - Current normalized ray direction
 * @param pos3d - Current 3D position
 * @param stepSize - Integration step size
 * @param ndRadius - N-dimensional radius for gravity strength scaling
 */
vec3 bendRay(vec3 rayDir, vec3 pos3d, float stepSize, float ndRadius) {
  float rs = uHorizonRadius;
  float r = length(pos3d);

  // Skip if too close to singularity
  if (r < rs * 0.5) {
    return rayDir;
  }

  // Compute squared angular momentum: h² = |cross(pos, vel)|²
  vec3 angularMomentum = cross(pos3d, rayDir);
  float h2 = dot(angularMomentum, angularMomentum);

  // If h² ≈ 0, ray is purely radial - no bending possible
  if (h2 < 1e-10) {
    return rayDir;
  }

  // === Schwarzschild component ===
  // F_schwarzschild = -1.5 * h² * r_hat / r^5
  float r3 = r * r * r;
  float r5 = r3 * r * r;
  float forceMagnitude = 1.5 * h2 / r5;

  // Apply gravity strength for artistic control
  forceMagnitude *= uGravityStrength * uBendScale;

  // Clamp force to prevent numerical explosion
  forceMagnitude = min(forceMagnitude, uBendMaxPerStep / stepSize);

  // Radial acceleration (toward origin)
  vec3 radialDir = pos3d / r;
  vec3 acceleration = -forceMagnitude * radialDir;

  // === Kerr frame dragging component ===
  // Frame dragging causes spacetime to rotate with the black hole.
  // The spin axis is assumed to be the Y-axis (vertical).
  // This creates an azimuthal acceleration that pulls light around.
  if (uSpin > 0.001) {
    vec3 spinAxis = vec3(0.0, 1.0, 0.0);

    // Frame dragging strength falls off as 1/r³
    // a = chi * M, and M = rs/2, so a = chi * rs/2
    float a = uSpin * rs * 0.5;

    // Azimuthal direction (perpendicular to both spin axis and radial)
    vec3 azimuthalDir = cross(spinAxis, radialDir);
    float azimuthalMag = length(azimuthalDir);

    if (azimuthalMag > 0.001) {
      azimuthalDir /= azimuthalMag;

      // Frame dragging acceleration: ~ 2*a/r³ in the azimuthal direction
      // The factor of 2 comes from the Lense-Thirring effect
      float frameDragMag = 2.0 * a / r3;

      // Scale by gravity strength for consistency
      frameDragMag *= uGravityStrength * uBendScale;

      // Add azimuthal acceleration (frame dragging)
      acceleration += frameDragMag * azimuthalDir;
    }
  }

  // Velocity Verlet integration (semi-implicit Euler)
  vec3 newDir = rayDir + acceleration * stepSize;

  // Renormalize to maintain unit direction (light travels at c)
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
`
