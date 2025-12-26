/**
 * Photon Shell
 *
 * The photon sphere where light orbits the black hole.
 * For Schwarzschild black hole, R_p = 1.5 * R_h (photon sphere at 1.5× horizon).
 */

export const shellBlock = /* glsl */ `
//----------------------------------------------
// PHOTON SHELL
//----------------------------------------------

/**
 * Calculate photon sphere radius for given dimension.
 * R_p = uPhotonShellRadiusMul * R_h * (1 + bias * log(N))
 *
 * PERF OPTIMIZATION: Now uses precomputed value from CPU to avoid
 * log() and multiplication per-pixel. The value is computed once per
 * frame in useBlackHoleUniformUpdates.ts.
 *
 * Original formula (for reference):
 *   dimBias = uPhotonShellRadiusDimBias * log(DIMENSION)
 *   return uHorizonRadius * (uPhotonShellRadiusMul + dimBias)
 */
float getPhotonShellRadius() {
  return uShellRpPrecomputed;
}

/**
 * Calculate photon shell mask.
 * Returns 1 when on the shell, 0 elsewhere.
 *
 * NOTE: Shell emission is now handled in main.glsl.ts using transmittance gradient.
 * This function is kept for compatibility but is not used for the actual shell glow.
 * The transmittance-based shell naturally follows the lensing-deformed horizon shape.
 *
 * PERF OPTIMIZATION: Uses precomputed Rp and delta from CPU.
 *
 * mask = 1 - smoothstep(0, Δ, |r - R_p|)
 */
float photonShellMask(float ndRadius) {
  // Use precomputed values (avoids per-pixel getPhotonShellRadius() call)
  float Rp = uShellRpPrecomputed;
  float delta = uShellDeltaPrecomputed;

  // Use smooth falloff - no hard cutoffs to prevent ring artifacts
  float dist = abs(ndRadius - Rp);

  // Smooth ring falloff using smoothstep
  float mask = 1.0 - smoothstep(0.0, delta, dist);

  // Apply contrast boost for sharper ring (default 1.0 = no change)
  mask = pow(mask, 1.0 / max(uShellContrastBoost, 0.1));

  return mask;
}

/**
 * Calculate photon shell emission.
 *
 * NOTE: Shell emission is now handled directly in main.glsl.ts using
 * lensing-aware closest approach tracking. This function is kept as a
 * stub for compatibility but returns vec3(0.0).
 *
 * The new implementation emits glow when a ray is at its closest approach
 * to the black hole, which naturally follows the lensing-deformed visual
 * shape instead of being a geometric sphere.
 */
vec3 photonShellEmissionWithMask(float mask, vec3 pos) {
  // Shell emission moved to main.glsl.ts for lensing-aware rendering
  return vec3(0.0);
}

/**
 * Calculate photon shell emission (convenience wrapper).
 * NOTE: Shell emission is now handled in main.glsl.ts
 */
vec3 photonShellEmission(float ndRadius, vec3 pos) {
  return vec3(0.0);
}

/**
 * Get adaptive step size modifier near shell, also outputs the computed mask.
 * Smaller steps near the photon sphere for accurate capture.
 *
 * PERF (OPT-BH-2): Returns mask via out parameter to avoid redundant
 * photonShellMask() call in photonShellEmission.
 *
 * NOTE: Shell emission is now handled in main.glsl.ts using transmittance gradient.
 * This function is kept for adaptive step sizing but the mask is unused for emission.
 *
 * @param ndRadius - N-dimensional radius
 * @param outMask - Output: the computed shell mask (0 if outside shell region)
 * @returns Step size modifier (1.0 = no change, <1.0 = smaller steps)
 */
float shellStepModifierWithMask(float ndRadius, out float outMask) {
  // Use smooth transitions instead of hard cutoffs to prevent aliasing artifacts.
  // The shell emission is now based on transmittance gradient, so this is only
  // for step size adaptation.

  // Smooth step size reduction near the visual horizon
  // Use uVisualEventHorizon for the center of the adaptive region
  float adaptiveCenter = uShellRpPrecomputed;
  float adaptiveWidth = uShellDeltaPrecomputed * 2.0;

  float dist = abs(ndRadius - adaptiveCenter);

  // Smooth mask using smoothstep (no hard cutoffs)
  outMask = 1.0 - smoothstep(0.0, adaptiveWidth, dist);

  // Reduce step size smoothly near the region of interest
  // This helps capture details near the horizon/shell without causing aliasing
  return mix(1.0, uShellStepMul, outMask);
}

/**
 * Get adaptive step size modifier near shell (convenience wrapper).
 * Use shellStepModifierWithMask if you also need the mask for emission.
 */
float shellStepModifier(float ndRadius) {
  float unusedMask;
  return shellStepModifierWithMask(ndRadius, unusedMask);
}
`