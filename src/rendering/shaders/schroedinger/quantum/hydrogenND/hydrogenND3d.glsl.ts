/**
 * Hydrogen ND for 3D - Pure hydrogen orbital (no extra dimensions)
 *
 * In 3D, HydrogenND is identical to the standard hydrogen orbital.
 * This module provides compatibility when dimension = 3.
 */
export const hydrogenND3dBlock = `
// ============================================
// Hydrogen ND - 3D (No Extra Dimensions)
// ============================================

/**
 * Evaluate Hydrogen ND wavefunction in 3D
 *
 * This is identical to standard hydrogen orbital evaluation.
 * Uses the common functions to avoid circular dependencies.
 *
 * @param xND - N-dimensional coordinates array
 * @param t - Time for phase evolution
 * @return vec2(re, im) of wavefunction
 */
vec2 evalHydrogenNDPsi3D(float xND[MAX_DIM], float t) {
    float x0 = xND[0], x1 = xND[1], x2 = xND[2];

    // 3D radius
    float r3D = radius3D(x0, x1, x2);

    // EARLY EXIT: Skip if radial contribution is negligible
    if (hydrogenRadialEarlyExit(r3D, uPrincipalN, uBohrRadius, uAzimuthalL)) {
        return vec2(0.0);
    }

    vec2 angles = sphericalAngles3D(x0, x1, x2, r3D);
    float theta = angles.x, phi = angles.y;

    // Radial part R_nl(r)
    float R = hydrogenRadial(uPrincipalN, uAzimuthalL, r3D, uBohrRadius);

    // Angular part Y_lm(theta, phi)
    float Y = evalHydrogenNDAngular(uAzimuthalL, uMagneticM, theta, phi, uUseRealOrbitals);

    // Combine and apply time evolution
    float psiReal = R * Y;
    return hydrogenNDTimeEvolution(psiReal, uPrincipalN, t);
}
`;
