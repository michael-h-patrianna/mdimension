/**
 * Probability density field calculations
 *
 * The probability density is:
 *   ρ(x,t) = |ψ(x,t)|² = ψ*ψ = re² + im²
 *
 * For rendering stability and better dynamic range, we often use
 * log-density:
 *   s(x,t) = log(ρ + ε)
 *
 * This compresses the large range of ρ values and provides
 * better numerical stability for gradient computation.
 */
export const densityBlock = `
// ============================================
// Density Field Calculations
// ============================================

// Small epsilon to prevent log(0)
#define DENSITY_EPS 1e-8

// Compute probability density ρ = |ψ|²
float rhoFromPsi(vec2 psi) {
    return dot(psi, psi); // re² + im²
}

// Compute log-density for stability and dynamic range
// s = log(ρ + ε)
float sFromRho(float rho) {
    return log(rho + DENSITY_EPS);
}

// Compute both ρ and s efficiently
vec2 densityPair(vec2 psi) {
    float rho = rhoFromPsi(psi);
    float s = sFromRho(rho);
    return vec2(rho, s);
}

// Sample density at a 3D position, mapping through ND basis
// This is the primary entry point for volume rendering
float sampleDensity(vec3 pos, float t) {
    // Map 3D position to ND coordinates
    float xND[MAX_DIM];
    for (int j = 0; j < MAX_DIM; j++) {
        if (j >= uDimension) {
            xND[j] = 0.0;
        } else {
            xND[j] = uOrigin[j]
                   + pos.x * uBasisX[j]
                   + pos.y * uBasisY[j]
                   + pos.z * uBasisZ[j];
        }
    }

    // Scale coordinates by field scale
    for (int j = 0; j < MAX_DIM; j++) {
        if (j >= uDimension) break;
        xND[j] *= uFieldScale;
    }

    // Evaluate wavefunction and density
    vec2 psi = evalPsi(xND, t);
    return rhoFromPsi(psi);
}

// Sample density with phase information for coloring
// Returns: vec3(rho, logRho, spatialPhase)
// Note: Uses spatial-only phase for stable coloring (no time flicker)
// OPTIMIZED: Uses single-pass evalPsiWithSpatialPhase to avoid redundant hoND calls
vec3 sampleDensityWithPhase(vec3 pos, float t) {
    // Map 3D position to ND coordinates
    float xND[MAX_DIM];
    for (int j = 0; j < MAX_DIM; j++) {
        if (j >= uDimension) {
            xND[j] = 0.0;
        } else {
            xND[j] = uOrigin[j]
                   + pos.x * uBasisX[j]
                   + pos.y * uBasisY[j]
                   + pos.z * uBasisZ[j];
        }
    }

    // Scale coordinates
    for (int j = 0; j < MAX_DIM; j++) {
        if (j >= uDimension) break;
        xND[j] *= uFieldScale;
    }

    // OPTIMIZED: Single-pass evaluation for both time-dependent density and spatial phase
    // This avoids calling hoND() twice per sample point
    vec4 psiResult = evalPsiWithSpatialPhase(xND, t);
    vec2 psi = psiResult.xy;
    float spatialPhase = psiResult.z;

    float rho = rhoFromPsi(psi);
    float s = sFromRho(rho);

    return vec3(rho, s, spatialPhase);
}
`;
