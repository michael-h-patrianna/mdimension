/**
 * Event Horizon
 *
 * Handles ray-horizon intersection and edge glow effects.
 */

export const horizonBlock = /* glsl */ `
//----------------------------------------------
// EVENT HORIZON
//----------------------------------------------

/**
 * Check if ray has crossed the event horizon.
 * Returns true if the ray is inside the horizon sphere.
 */
bool isInsideHorizon(float ndRadius) {
  return ndRadius < uHorizonRadius;
}

/**
 * Compute proximity to horizon for edge glow.
 * Returns 0 at horizon, 1 far from horizon.
 */
float horizonProximity(float ndRadius) {
  float diff = ndRadius - uHorizonRadius;
  return smoothstep(0.0, uEdgeGlowWidth * uHorizonRadius, diff);
}

/**
 * Compute edge glow contribution.
 * Creates a bright ring at the edge of the horizon.
 */
vec3 computeEdgeGlow(float ndRadius, vec3 accumulatedColor) {
  if (!uEdgeGlowEnabled) return vec3(0.0);

  float proximity = horizonProximity(ndRadius);
  // Glow is strongest near horizon
  float glowFactor = 1.0 - proximity;
  glowFactor = pow(glowFactor, 2.0); // Sharper falloff

  return uEdgeGlowColor * glowFactor * uEdgeGlowIntensity;
}

/**
 * Check for horizon intersection along ray segment.
 * Returns the t-value where ray intersects horizon sphere, or -1 if no hit.
 */
float horizonIntersect(vec3 rayOrigin, vec3 rayDir) {
  // Ray-sphere intersection
  // |O + t*D|² = R_h²
  float a = dot(rayDir, rayDir);
  float b = 2.0 * dot(rayOrigin, rayDir);
  float c = dot(rayOrigin, rayOrigin) - uHorizonRadius * uHorizonRadius;

  float discriminant = b * b - 4.0 * a * c;

  if (discriminant < 0.0) {
    return -1.0; // No intersection
  }

  float sqrtDisc = sqrt(discriminant);
  float t1 = (-b - sqrtDisc) / (2.0 * a);
  float t2 = (-b + sqrtDisc) / (2.0 * a);

  // Return nearest positive intersection
  if (t1 > 0.0) return t1;
  if (t2 > 0.0) return t2;
  return -1.0;
}
`
