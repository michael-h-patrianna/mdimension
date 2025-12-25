/**
 * Common utilities for Hydrogen ND wavefunction evaluation
 *
 * Provides shared functions for computing:
 * - N-dimensional radius from coordinate array
 * - 3D spherical angles from first 3 dimensions
 * - Extra dimension HO eigenfunction factors
 *
 * The hybrid ND hydrogen approach uses:
 * - R_nl(r_ND) for radial decay (using full ND radius)
 * - Y_lm(theta, phi) for angular shape (from first 3 dims)
 * - product of ho1D for extra dimensions (dims 4+)
 */
export const hydrogenNDCommonBlock = `
// ============================================
// Hydrogen ND Common Functions
// ============================================

// Note: QUANTUM_MODE_HYDROGEN_ND is defined in psi.glsl.ts
// to avoid duplicate definitions

/**
 * Compute 3D radius from first 3 dimensions
 */
float radius3D(float x, float y, float z) {
    return sqrt(x * x + y * y + z * z);
}

/**
 * Compute spherical angles from first 3 dimensions
 *
 * Returns vec2(theta, phi) where:
 * - theta: polar angle from z-axis [0, pi]
 * - phi: azimuthal angle from x-axis [0, 2pi]
 *
 * @param x, y, z - Cartesian coordinates
 * @param r3d - 3D radius (precomputed for efficiency)
 * @return vec2(theta, phi)
 */
vec2 sphericalAngles3D(float x, float y, float z, float r3d) {
    if (r3d < 1e-10) return vec2(0.0, 0.0);

    // theta = arccos(z/r)
    float theta = acos(clamp(z / r3d, -1.0, 1.0));

    // phi = atan2(y, x)
    float phi = atan(y, x);
    if (phi < 0.0) phi += 2.0 * PI;

    return vec2(theta, phi);
}

// ============================================
// Early Exit Optimizations for Extra Dimensions
// ============================================

// Note: hydrogenRadialEarlyExit() is defined in hydrogenPsi.glsl.ts
// and is shared between hydrogen 3D and hydrogen ND modes.

/**
 * Check if extra dimension HO contribution is negligible
 *
 * Uses the same 3-sigma threshold as harmonic oscillator mode.
 * The HO eigenfunction decays as exp(-0.5 * omega * x^2), which
 * becomes negligible when the sum of squared scaled coordinates
 * exceeds 18 (approximately 3 sigma per dimension).
 *
 * This check is performed BEFORE computing the ND radius and
 * radial function, providing a fast early exit for points
 * far from the origin in extra dimensions.
 *
 * @param extraDimCount - Number of extra dimensions (dim - 3)
 * @param xND - Full coordinate array
 * @return true if contribution is guaranteed negligible
 */
bool extraDimEarlyExit(int extraDimCount, float xND[MAX_DIM]) {
    if (extraDimCount <= 0) return false;

    float distSq = 0.0;
    for (int i = 0; i < MAX_EXTRA_DIM; i++) {
        if (i >= extraDimCount) break;
        float alpha = sqrt(max(uExtraDimOmega[i], 0.01));
        float u = alpha * xND[3 + i];
        distSq += u * u;
    }
    // 3-sigma threshold: contribution < 1e-8
    return distSq > 18.0;
}

/**
 * Evaluate HO eigenfunction for a single extra dimension
 *
 * This is used for dimensions 4 and above in the hybrid
 * hydrogen ND approach.
 *
 * @param extraDimIdx - Index into uExtraDimN/uExtraDimOmega (0 = dim 4)
 * @param coord - Coordinate value in that dimension
 * @return Eigenfunction value
 */
float extraDimFactor(int extraDimIdx, float coord) {
    // Get quantum number and frequency for this extra dimension
    int n = uExtraDimN[extraDimIdx];
    float omega = uExtraDimOmega[extraDimIdx];

    // Reuse the existing ho1D function
    return ho1D(n, coord, omega);
}

/**
 * Evaluate angular part Y_lm for hydrogen ND
 *
 * Uses the existing spherical harmonic functions.
 *
 * @param l - Azimuthal quantum number
 * @param m - Magnetic quantum number
 * @param theta - Polar angle
 * @param phi - Azimuthal angle
 * @param useReal - Use real orbital representation
 * @return Angular factor value
 */
float evalHydrogenNDAngular(int l, int m, float theta, float phi, bool useReal) {
    if (useReal) {
        // Use fast path for l <= 2, general path otherwise
        return (l <= 2)
            ? fastRealSphericalHarmonic(l, m, theta, phi)
            : realSphericalHarmonic(l, m, theta, phi, true);
    } else {
        // Complex: return magnitude
        vec2 Yc = sphericalHarmonic(l, m, theta, phi);
        return length(Yc);
    }
}

/**
 * Apply time evolution to hydrogen ND wavefunction
 *
 * ψ(t) = ψ(0) * exp(-i * E * t)
 *
 * Energy E_n = -1/(2n²) in atomic units (Hartree).
 *
 * @param psiReal - Real part of wavefunction at t=0
 * @param n - Principal quantum number
 * @param t - Time
 * @return vec2(re, im) of time-evolved wavefunction
 */
vec2 hydrogenNDTimeEvolution(float psiReal, int n, float t) {
    // Guard: n must be >= 1 (principal quantum number)
    if (n < 1) return vec2(psiReal, 0.0);
    float fn = float(n);
    float E = -0.5 / (fn * fn);
    float phase = -E * t;
    vec2 timeFactor = vec2(cos(phase), sin(phase));
    return vec2(psiReal * timeFactor.x, psiReal * timeFactor.y);
}

/**
 * Apply time evolution with FULL energy calculation
 *
 * Includes energy contributions from extra dimensions (HO modes):
 *   E_total = E_hydrogen + Σ ω_j × (n_j + 0.5)
 *
 * This is physically correct - extra dimensions contribute to total
 * energy and affect animation speed.
 *
 * @param psiReal - Real part of wavefunction at t=0
 * @param n - Principal quantum number (hydrogen)
 * @param t - Time
 * @param extraDimCount - Number of extra dimensions (0-8)
 * @return vec2(re, im) of time-evolved wavefunction
 */
vec2 hydrogenNDTimeEvolutionFull(float psiReal, int n, float t, int extraDimCount) {
    if (n < 1) return vec2(psiReal, 0.0);

    // Base hydrogen energy: E = -1/(2n²)
    float fn = float(n);
    float E = -0.5 / (fn * fn);

    // Add extra dimension HO contributions: ω × (n + 0.5)
    for (int i = 0; i < MAX_EXTRA_DIM; i++) {
        if (i >= extraDimCount) break;
        float omega = uExtraDimOmega[i];
        float nj = float(uExtraDimN[i]);
        E += omega * (nj + 0.5);
    }

    float phase = -E * t;
    vec2 timeFactor = vec2(cos(phase), sin(phase));
    return vec2(psiReal * timeFactor.x, psiReal * timeFactor.y);
}
`;
