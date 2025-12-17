/**
 * Schrödinger wavefunction evaluation
 *
 * Evaluates the time-dependent wavefunction as a superposition of
 * harmonic oscillator eigenstates:
 *
 *   ψ(x,t) = Σ_k c_k · Φ_k(x) · e^{-iE_k t}
 *
 * where:
 *   c_k    = complex coefficient for term k
 *   Φ_k(x) = D-dimensional HO eigenfunction (product of 1D eigenfunctions)
 *   E_k    = energy of state k: Σ_j ω_j(n_{k,j} + ½)
 *   t      = time
 *
 * The interference between terms with different energies creates
 * time-dependent morphing of the probability density |ψ|².
 */
export const psiBlock = `
// ============================================
// Wavefunction Superposition Evaluation
// ============================================

// Maximum number of superposition terms
#define MAX_TERMS 8

// Evaluate wavefunction ψ(x,t) at D-dimensional point xND and time t
// Returns complex value as vec2(re, im)
vec2 evalPsi(float xND[MAX_DIM], float t) {
    vec2 psi = vec2(0.0);

    for (int k = 0; k < MAX_TERMS; k++) {
        if (k >= uTermCount) break;

        // Time phase factor: e^{-iE_k t}
        float phase = -uEnergy[k] * t;
        vec2 timeFactor = cexp_i(phase);

        // Complex coefficient c_k
        vec2 coeff = uCoeff[k];

        // Combined: c_k · e^{-iE_k t}
        vec2 term = cmul(coeff, timeFactor);

        // Spatial eigenfunction Φ_k(x)
        float spatial = hoND(xND, uDimension, k);

        // Accumulate: ψ += c_k · Φ_k(x) · e^{-iE_k t}
        psi += cscale(spatial, term);
    }

    return psi;
}

// Evaluate ψ with phase information for coloring
// Returns: vec3(re, im, phase)
vec3 evalPsiWithPhase(float xND[MAX_DIM], float t) {
    vec2 psi = evalPsi(xND, t);
    float phase = atan(psi.y, psi.x);
    return vec3(psi, phase);
}

// Evaluate spatial-only phase (t=0) for stable coloring
// This gives position-dependent color without time-flickering
// NOTE: Prefer evalPsiWithSpatialPhase() to avoid redundant hoND calculations
float evalSpatialPhase(float xND[MAX_DIM]) {
    vec2 psi = vec2(0.0);

    for (int k = 0; k < MAX_TERMS; k++) {
        if (k >= uTermCount) break;

        // No time factor - just spatial part
        vec2 coeff = uCoeff[k];
        float spatial = hoND(xND, uDimension, k);
        psi += cscale(spatial, coeff);
    }

    return atan(psi.y, psi.x);
}

// OPTIMIZED: Evaluate time-dependent ψ AND spatial-only phase in ONE pass
// This computes both the density (from time-dependent |ψ|²) and the
// stable spatial phase (for coloring) without redundant hoND() calls.
// Returns: vec4(psi_time.re, psi_time.im, spatialPhase, unused)
vec4 evalPsiWithSpatialPhase(float xND[MAX_DIM], float t) {
    vec2 psiTime = vec2(0.0);    // Time-dependent for density
    vec2 psiSpatial = vec2(0.0); // Spatial-only for stable phase

    for (int k = 0; k < MAX_TERMS; k++) {
        if (k >= uTermCount) break;

        // Spatial eigenfunction - computed ONCE per term
        float spatial = hoND(xND, uDimension, k);

        // Complex coefficient c_k
        vec2 coeff = uCoeff[k];

        // Spatial-only accumulation (no time factor)
        psiSpatial += cscale(spatial, coeff);

        // Time-dependent accumulation
        float phase = -uEnergy[k] * t;
        vec2 timeFactor = cexp_i(phase);
        vec2 term = cmul(coeff, timeFactor);
        psiTime += cscale(spatial, term);
    }

    float spatialPhase = atan(psiSpatial.y, psiSpatial.x);
    return vec4(psiTime, spatialPhase, 0.0);
}
`;
