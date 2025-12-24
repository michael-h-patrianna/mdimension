/**
 * Event Horizon
 *
 * Handles ray-horizon intersection.
 *
 * Uses uVisualEventHorizon for the actual event horizon check (shrinks with spin),
 * while uHorizonRadius remains the Schwarzschild radius (rs = 2M) for scale reference.
 */

export const horizonBlock = /* glsl */ `
//----------------------------------------------
// EVENT HORIZON
//----------------------------------------------

/**
 * Check if ray has crossed the event horizon.
 * Uses uVisualEventHorizon which accounts for Kerr spin:
 * - For spin=0 (Schwarzschild): equals uHorizonRadius
 * - For spin=0.9: ~72% of uHorizonRadius
 * This creates a smaller visual black sphere for spinning black holes.
 */
bool isInsideHorizon(float ndRadius) {
  // Use a tiny "Kill Sphere" near the singularity (0.1x) to allow natural shadow formation.
  // The visual horizon is handled by volumetric absorption in main.glsl.ts.
  return ndRadius < uVisualEventHorizon * 0.1;
}

/**
 * Check for horizon intersection along ray segment.
 * Returns the t-value where ray intersects horizon sphere, or -1 if no hit.
 */
float horizonIntersect(vec3 rayOrigin, vec3 rayDir) {
  // Ray-sphere intersection using visual event horizon
  // |O + t*D|² = R_h²
  float horizonR = uVisualEventHorizon;
  float a = dot(rayDir, rayDir);
  float b = 2.0 * dot(rayOrigin, rayDir);
  float c = dot(rayOrigin, rayOrigin) - horizonR * horizonR;

  float discriminant = b * b - 4.0 * a * c;

  if (discriminant < 0.0) {
    return -1.0; // No intersection
  }

  // Guard against a being zero (degenerate ray direction)
  if (abs(a) < 0.0001) {
    return -1.0;
  }

  float sqrtDisc = sqrt(discriminant);
  float invTwoA = 1.0 / (2.0 * a);
  float t1 = (-b - sqrtDisc) * invTwoA;
  float t2 = (-b + sqrtDisc) * invTwoA;

  // Return nearest positive intersection
  if (t1 > 0.0) return t1;
  if (t2 > 0.0) return t2;
  return -1.0;
}
`
