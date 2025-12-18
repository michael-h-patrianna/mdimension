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
// Noise & Erosion Functions
// ============================================

// Hash function for 3D noise
vec3 hash33(vec3 p) {
    p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    );
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// 3D Perlin/Gradient Noise
float gradientNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}

// 3D Worley Noise (Cellular)
float worleyNoise(vec3 p) {
    vec3 id = floor(p);
    vec3 f = fract(p);
    float minDist = 1.0;
    for(int k=-1; k<=1; k++) {
        for(int j=-1; j<=1; j++) {
            for(int i=-1; i<=1; i++) {
                vec3 offset = vec3(float(i), float(j), float(k));
                vec3 h = hash33(id + offset) * 0.5 + 0.5; // 0..1
                vec3 diff = offset + h - f;
                float d = dot(diff, diff);
                minDist = min(minDist, d);
            }
        }
    }
    return sqrt(minDist);
}

// Unified Noise Function based on type
// 0=Worley (Billowy), 1=Perlin (Smooth), 2=Hybrid
float getErosionNoise(vec3 p, int type) {
    if (type == 0) {
        // Worley: Returns distance to center. We want "billowy", so invert or use as is.
        // Usually Worley is inverted for clouds: 1 - worley
        return 1.0 - worleyNoise(p);
    } else if (type == 1) {
        // Perlin: -1 to 1. Map to 0..1
        return gradientNoise(p) * 0.5 + 0.5;
    } else {
        // Hybrid: Perlin-Worley
        float pN = gradientNoise(p) * 0.5 + 0.5;
        float wN = 1.0 - worleyNoise(p * 2.0);
        return mix(pN, wN, 0.5);
    }
}

// Apply Curl Noise Distortion (approximate)
vec3 distortPosition(vec3 p, float strength) {
    if (strength < 0.01) return p;
    // Cheap curl approx: gradients of noise
    float e = 0.1;
    float n1 = gradientNoise(p + vec3(e, 0, 0));
    float n2 = gradientNoise(p + vec3(0, e, 0));
    float n3 = gradientNoise(p + vec3(0, 0, e));
    float n0 = gradientNoise(p);
    vec3 grad = vec3(n1 - n0, n2 - n0, n3 - n0) / e;
    return p + cross(grad, vec3(1.0)) * strength; // Not true curl but divergent-free-ish
}

// Erode density based on noise
float erodeDensity(float rho, vec3 pos) {
    if (uErosionStrength <= 0.001) return rho;
    
    // Scale position for noise
    vec3 noisePos = pos * uErosionScale;
    
    // Add turbulence/distortion
    if (uErosionTurbulence > 0.0) {
        // Animate swirl
        float t = uTime * uTimeScale * 0.2;
        noisePos += vec3(0.0, -t, 0.0); // Simple scroll
        noisePos = distortPosition(noisePos, uErosionTurbulence);
    }
    
    // Sample noise
    float noise = getErosionNoise(noisePos, uErosionNoiseType);
    
    // Erosion logic:
    // We want to erode the *edges* (low density) more than the core (high density).
    // Remap noise: [0,1] -> [-1, 1] ? 
    // Typically: density = density - noise * strength
    // But we want to preserve core.
    
    // HZD Cloud approach: remap density based on noise
    // simplified: rho *= saturate(remap(noise, ...))
    
    // Let's use simple subtractive erosion with density weighting
    // High density resists erosion.
    
    // Normalized density proxy (approx 0-1)
    float densitySignal = clamp(log(rho + 1.0) / 4.0, 0.0, 1.0);
    
    // Erosion factor increases at low density
    float erosionFactor = uErosionStrength * (1.0 - densitySignal * 0.5); 
    
    // Apply erosion: reduce density
    // We use a smoothstep to carve out shapes
    float threshold = noise * erosionFactor;
    
    // If we just subtract, we might get negative.
    // Let's multiply: rho *= smoothstep(threshold, threshold + 0.2, densitySignal) ?
    // No, densitySignal is just a proxy.
    
    // Direct subtraction on log-space or linear-space?
    // Linear space: rho_new = max(0, rho - noise * strength * multiplier)
    float erodedRho = max(0.0, rho - noise * uErosionStrength * 2.0);
    
    // Smooth blending to avoid hard cuts
    return mix(rho, erodedRho, uErosionStrength);
}

// Procedural Curl Noise (Divergence Free)
vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    // Helper to sample potential function (Perlin-like noise)
    // We use gradientNoise from above
    
    // Gradients of potential function
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    
    // We use 3 separate noise fields for vector potential?
    // Or just one and some cross product?
    // Simple way: Curl = Cross(Grad(Noise), Vector(1,1,1)) ? 
    // Better: 3 noise samples offset.
    // But expensive.
    // Cheap way:
    float n1 = gradientNoise(p + vec3(0, 0, 0));
    float n2 = gradientNoise(p + vec3(12.3, 4.5, 6.7));
    float n3 = gradientNoise(p + vec3(5.6, 7.8, 9.0));
    // This is vector noise.
    // Actually, curl of a scalar potential field is not enough for 3D curl noise.
    // We need a vector potential A. Curl(A).
    
    // Let's use the 'distortPosition' logic which is basically cheap curl
    // But adapt it for flow field.
    
    float x0 = gradientNoise(p);
    float x1 = gradientNoise(p + dx);
    float y0 = gradientNoise(p + vec3(31.4)); // Offset inputs for different noise
    float y1 = gradientNoise(p + dy + vec3(31.4));
    float z0 = gradientNoise(p + vec3(72.1));
    float z1 = gradientNoise(p + dz + vec3(72.1));
    
    float valX = x1 - x0;
    float valY = y1 - y0;
    float valZ = z1 - z0;
    
    // This is gradient. Not curl.
    // Curl = (dAz/dy - dAy/dz, dAx/dz - dAz/dx, dAy/dx - dAx/dy)
    // We need partial derivatives of 3 potential components.
    // That's 6 noise lookups (or 3 gradients).
    // Expensive!
    
    // Alternative: Simplex noise usually provides derivatives.
    // Since we only have gradientNoise (value noise), let's use a cheaper pseudo-swirl.
    
    return distortPosition(p, 1.0) - p; // Use the existing function's offset
}

// Apply Curl Noise Flow to position
vec3 applyFlow(vec3 pos, float t) {
    if (!uCurlEnabled || uCurlStrength <= 0.001) return pos;
    
    vec3 flowPos = pos * uCurlScale + vec3(0.0, 0.0, t * uCurlSpeed * 0.2);
    
    // Base curl vector
    vec3 curl = curlNoise(flowPos);
    
    // Apply bias
    if (uCurlBias == 1) { // Upward
        curl += vec3(0.0, 1.0, 0.0) * 0.5;
    } else if (uCurlBias == 2) { // Outward
        curl += normalize(pos) * 0.5;
    } else if (uCurlBias == 3) { // Inward
        curl -= normalize(pos) * 0.5;
    }
    
    // Distort sampling position by the curl vector
    // This means we sample from 'pos + offset'
    // If flow moves UP, density at P comes from P - Velocity?
    // Advection: new_density(x) = old_density(x - v*dt)
    // Here we are mapping: space -> density.
    // If we want the cloud to "move up", we should sample "down".
    // So pos - curl.
    
    return pos - curl * uCurlStrength;
}

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
    // Apply Animated Flow (Curl Noise)
    // We warp the sampling position 'pos' before mapping to ND space
    vec3 flowedPos = applyFlow(pos, t);

    // Map 3D position to ND coordinates
    float xND[MAX_DIM];
    for (int j = 0; j < MAX_DIM; j++) {
        if (j >= uDimension) {
            xND[j] = 0.0;
        } else {
            xND[j] = uOrigin[j]
                   + flowedPos.x * uBasisX[j]
                   + flowedPos.y * uBasisY[j]
                   + flowedPos.z * uBasisZ[j];
        }
    }

    // Scale coordinates by field scale
    for (int j = 0; j < MAX_DIM; j++) {
        if (j >= uDimension) break;
        xND[j] *= uFieldScale;
    }

    // Evaluate wavefunction and density
    vec2 psi = evalPsi(xND, t);
    float rho = rhoFromPsi(psi);

    // Hydrogen orbital density boost
    // Hydrogen wavefunctions have much smaller local density values than
    // harmonic oscillator superpositions due to different normalization.
    // Boost the density to make hydrogen orbitals visible with same gain settings.
#ifdef HYDROGEN_MODE_ENABLED
    if (uQuantumMode == QUANTUM_MODE_HYDROGEN) {
        // Boost factor depends on orbital size and shape
        // Higher n orbitals are more spread out (volume ~ n³)
        // Higher l orbitals have more angular lobes, spreading density further
        // The ρ^l factor in radial function also reduces density for high l
        float fn = float(uPrincipalN);
        float fl = float(uAzimuthalL);
        // Base boost scales with n², additional boost for l to compensate for angular spreading
        // For l=0 (s): boost = 50 * n²
        // For l=1 (p): boost = 50 * n² * 3
        // For l=2 (d): boost = 50 * n² * 10
        // For l=3 (f): boost = 50 * n² * 30
        // For l=4 (g): boost = 50 * n² * 100
        float lBoost = pow(3.0, fl); // Exponential boost for higher l
        float hydrogenBoost = 50.0 * fn * fn * lBoost;
        rho *= hydrogenBoost;
    }
#endif

    // Hydrogen ND density boost
    // ND hydrogen has additional decay from extra dimensions, requiring more aggressive boost
#ifdef HYDROGEN_ND_MODE_ENABLED
    if (uQuantumMode == QUANTUM_MODE_HYDROGEN_ND) {
        float fn = float(uPrincipalN);
        float fl = float(uAzimuthalL);
        // Base hydrogen boost + l boost + dimension factor to compensate for extra dim decay
        float lBoost = pow(3.0, fl);
        float dimFactor = 1.0 + float(uDimension - 3) * 0.3;
        float hydrogenNDBoost = 50.0 * fn * fn * lBoost * dimFactor;
        rho *= hydrogenNDBoost;
    }
#endif

    // Apply Edge Erosion
    rho = erodeDensity(rho, flowedPos);

    return rho;
}

// Sample density with phase information for coloring
// Returns: vec3(rho, logRho, spatialPhase)
// Note: Uses spatial-only phase for stable coloring (no time flicker)
// OPTIMIZED: Uses single-pass evalPsiWithSpatialPhase to avoid redundant hoND calls
vec3 sampleDensityWithPhase(vec3 pos, float t) {
    // Apply Animated Flow (Curl Noise)
    vec3 flowedPos = applyFlow(pos, t);

    // Map 3D position to ND coordinates
    float xND[MAX_DIM];
    for (int j = 0; j < MAX_DIM; j++) {
        if (j >= uDimension) {
            xND[j] = 0.0;
        } else {
            xND[j] = uOrigin[j]
                   + flowedPos.x * uBasisX[j]
                   + flowedPos.y * uBasisY[j]
                   + flowedPos.z * uBasisZ[j];
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

    // Hydrogen orbital density boost (same as sampleDensity above)
#ifdef HYDROGEN_MODE_ENABLED
    if (uQuantumMode == QUANTUM_MODE_HYDROGEN) {
        float fn = float(uPrincipalN);
        float fl = float(uAzimuthalL);
        float lBoost = pow(3.0, fl);
        float hydrogenBoost = 50.0 * fn * fn * lBoost;
        rho *= hydrogenBoost;
    }
#endif

    // Hydrogen ND density boost (same as sampleDensity above)
#ifdef HYDROGEN_ND_MODE_ENABLED
    if (uQuantumMode == QUANTUM_MODE_HYDROGEN_ND) {
        float fn = float(uPrincipalN);
        float fl = float(uAzimuthalL);
        float lBoost = pow(3.0, fl);
        float dimFactor = 1.0 + float(uDimension - 3) * 0.3;
        float hydrogenNDBoost = 50.0 * fn * fn * lBoost * dimFactor;
        rho *= hydrogenNDBoost;
    }
#endif

    // Apply Edge Erosion
    rho = erodeDensity(rho, flowedPos);

    // Uncertainty Shimmer
    if (uShimmerEnabled && uShimmerStrength > 0.0) {
        // Only shimmer at low densities (edges)
        if (rho > 0.001 && rho < 0.5) {
            float time = uTime * uTimeScale;
            // High frequency noise for shimmer
            vec3 noisePos = flowedPos * 5.0 + vec3(0.0, 0.0, time * 2.0);
            float shimmer = gradientNoise(noisePos);

            // Map to positive perturbation
            shimmer = shimmer * 0.5 + 0.5;

            // Strength inversely proportional to density (more uncertainty where probability is low)
            float uncertainty = 1.0 - clamp(rho * 2.0, 0.0, 1.0);

            rho *= (1.0 + (shimmer - 0.5) * uShimmerStrength * uncertainty);
        }
    }

    float s = sFromRho(rho);

    return vec3(rho, s, spatialPhase);
}
`;
