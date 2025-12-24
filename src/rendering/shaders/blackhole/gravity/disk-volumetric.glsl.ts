/**
 * Volumetric Accretion Disk Shader
 *
 * Implements a physically-inspired volumetric accretion disk using raymarching density accumulation.
 *
 * Key Features:
 * - Volumetric density field with "Ridged Multifractal" noise for electric/filigree look
 * - Domain Warping for fluid dynamics
 * - Relativistic beaming (Doppler boosting intensity)
 * - Temperature gradient (Blackbody)
 * - Soft edges and gaps
 */

export const diskVolumetricBlock = /* glsl */ `
//----------------------------------------------
// VOLUMETRIC ACCRETION DISK
//----------------------------------------------

// === Named Constants ===
// Disk geometry
const float DISK_INNER_EDGE_SOFTNESS = 0.9;  // Fraction of innerR where fade starts
const float DISK_OUTER_EDGE_SOFTNESS = 0.9;  // Fraction of outerR where fade starts
const float DISK_OUTER_FADE_END = 1.2;       // Fraction of outerR where disk ends
const float DISK_FLARE_POWER = 2.5;          // Disk flare exponent (thicker at edges)
const float DISK_FLARE_SCALE = 1.5;          // Disk flare amplitude

// Density thresholds
const float DENSITY_CUTOFF = 0.001;          // Minimum density to process
const float DENSITY_HIT_THRESHOLD = 0.5;     // Density for depth buffer hit
const float DISK_BASE_INTENSITY = 20.0;      // Base density multiplier

// Temperature profile
const float TEMP_FALLOFF_EXPONENT = 0.75;    // r^(-3/4) for thin disk

// Brightness constants
const float BLACKBODY_BOOST = 2.0;           // Boost for blackbody mode
const float PALETTE_BOOST = 2.5;             // Boost for palette modes
const float CORE_BRIGHTNESS = 3.0;           // Inner core glow multiplier

// Noise parameters
const float DUST_LANE_FREQUENCY = 15.0;      // Radial dust lane period
const float DUST_LANE_STRENGTH = 0.3;        // Dust lane modulation amount

// === Simplex Noise 3D ===
// standard simplex noise (more expensive but much higher quality than value noise)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  // Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

// === FBM & Domain Warping ===

/**
 * Ridged multifractal noise for electric/plasma look.
 *
 * PERF: Octave count adapts to quality settings:
 * - Fast mode: 2 octaves (2 snoise calls)
 * - Low quality: 3 octaves (3 snoise calls)
 * - High quality: 4 octaves (4 snoise calls)
 * Reduced from 5 max octaves - the visual difference is minimal but cost is linear.
 */
float ridgedMF(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    float freq = 1.0;

    // PERF: Reduced max octaves from 5 to 4 - imperceptible quality difference
    // Adapt octaves based on quality: fast=2, low=3, medium/high=4
    int octaves = uFastMode ? 2 : (uSampleQuality < 2 ? 3 : 4);

    // PERF: Unrolled first 2 iterations (always needed) to avoid branch overhead
    // First octave
    float n = snoise(p);
    n = 1.0 - abs(n);
    n = n * n;
    sum += n * 0.5;

    // Second octave
    n = snoise(p * 2.0);
    n = 1.0 - abs(n);
    n = n * n;
    sum += n * 0.25;

    // Remaining octaves (only in non-fast mode)
    if (octaves > 2) {
        n = snoise(p * 4.0);
        n = 1.0 - abs(n);
        n = n * n;
        sum += n * 0.125;

        if (octaves > 3) {
            n = snoise(p * 8.0);
            n = 1.0 - abs(n);
            n = n * n;
            sum += n * 0.0625;
        }
    }

    return sum;
}

/**
 * Flow noise with domain warping for fluid dynamics look.
 *
 * PERF: In fast mode, skip expensive domain warping (3 extra snoise calls)
 * and use direct ridged noise. Visual difference is subtle but cost is 3x.
 */
float flowNoise(vec3 p, float time) {
    // PERF: Fast mode skips domain warping entirely (saves 3 snoise calls)
    if (uFastMode) {
        // Simple animated offset instead of full domain warping
        vec3 animOffset = vec3(time * 0.1, time * 0.05, 0.0);
        return ridgedMF(p + animOffset);
    }

    // Full quality: domain warping for fluid turbulence
    vec3 q = vec3(
        snoise(p + vec3(0.0, 0.0, time * 0.2)),
        snoise(p + vec3(4.2, 1.3, time * 0.15)),
        snoise(p + vec3(2.4, 8.1, time * 0.25))
    );

    return ridgedMF(p + q * uNoiseScale);
}

/**
 * Calculate density of the accretion disk at a given point.
 *
 * @param pos - Position in space (relative to black hole center)
 * @param time - Animation time
 * @returns Density value (0.0 to ~1.0+)
 */
float getDiskDensity(vec3 pos, float time) {
    float r = length(pos.xz);
    float h = abs(pos.y);

    // Radii
    float innerR = uHorizonRadius * uDiskInnerRadiusMul;
    float outerR = uHorizonRadius * uDiskOuterRadiusMul;

    // 1. Basic Bounds Check
    // No plunging region extension - keep disk bounds simple
    if (r < innerR * DISK_INNER_EDGE_SOFTNESS || r > outerR * DISK_OUTER_FADE_END) return 0.0;

    // 2. Vertical Profile (Gaussian with flaring)
    float flare = 1.0 + pow(r / outerR, DISK_FLARE_POWER) * DISK_FLARE_SCALE;
    float thickness = uManifoldThickness * uHorizonRadius * 0.5 * flare;

    // Very sharp vertical falloff for "thin disk" look at center
    float hDensity = exp(-(h * h) / (thickness * thickness));

    // Cut off if too far vertically
    if (hDensity < DENSITY_CUTOFF) return 0.0;

    // 3. Radial Profile
    // Soft inner edge near ISCO, Soft outer edge fade

    // Asymmetric ISCO: Modulate inner radius based on spin and angle
    float spinMod = 0.0;
    if (uSpin > 0.01) {
        float spinFactor = pos.x / (r + 0.001);
        spinMod = -spinFactor * uSpin * 0.4;
    }

    float effectiveInnerR = innerR * (1.0 + spinMod);
    float safeInnerR = max(effectiveInnerR, 0.001);

    // Simple radial profile with soft edges
    // Inner edge: smooth transition starting at 0.9 * innerR
    // Outer edge: smooth fade from 0.9 * outerR to 1.2 * outerR
    float rDensity = smoothstep(effectiveInnerR * DISK_INNER_EDGE_SOFTNESS, effectiveInnerR, r)
                   * (1.0 - smoothstep(outerR * DISK_OUTER_EDGE_SOFTNESS, outerR * DISK_OUTER_FADE_END, r));

    // Inverse square falloff for bulk density (denser inside)
    // PERF: Use multiplication instead of pow(x, 2.0)
    float rOverInner = r / safeInnerR;
    rDensity *= 2.0 / (rOverInner * rOverInner + 0.1);

    // 4. Volumetric Detail (The "Interstellar" Look)
    //
    // WARNING: Do NOT move angle/noiseCoord computation inside the noise guard block.
    // This was attempted as a PERF optimization but causes visible banding artifacts
    // (4 discrete rings with line structure instead of smooth noise). The atan() and
    // coordinate setup must remain unconditional for correct noise sampling.

    // Coordinate mapping for "streak" texture
    // Map (x,y,z) -> (radius, angle, height)
    float angle = atan(pos.z, pos.x);

    // Differential rotation: Inner parts move faster (Keplerian)
    // Omega ~ r^(-1.5)
    // Guard against r and innerR being zero to prevent NaN
    float safeR = max(r, max(safeInnerR * 0.1, 0.001));
    float rotSpeed = 5.0 * pow(safeInnerR / safeR, 1.5);
    float phase = angle + time * rotSpeed;

    // Streak coordinates: High freq in R, Low freq in Angle
    vec3 noiseCoord = vec3(
        r * 1.5,           // Ring frequency
        phase * 2.0,       // Angular frequency (streaks)
        h * 4.0            // Vertical structure
    );

    // Sample high quality noise
    float noiseVal = 0.0;

    if (uNoiseAmount > 0.01) {
        // Use domain warping for fluid look
        float warped = flowNoise(noiseCoord * uNoiseScale, time * 0.2);

        // Mix base density with noise
        // Ridged noise gives the "filigree" look
        noiseVal = warped;

        // Erode more aggressively to avoid "solid cream" look
        // Sharpen the strands by squaring the noise
        noiseVal = smoothstep(0.1, 0.9, noiseVal);
        noiseVal = noiseVal * noiseVal;

        // Apply noise amount with higher contrast boost
        rDensity *= mix(1.0, noiseVal * 3.0, uNoiseAmount);
    }

    // 5. Dust Lanes (dark rings) - RESTORED TO ORIGINAL LOCATION
    // Sine wave modulation on radius
    float dustLanes = 0.5 + 0.5 * sin(r * DUST_LANE_FREQUENCY / uHorizonRadius);
    dustLanes = pow(dustLanes, 0.5); // Sharpen
    rDensity *= mix(1.0, dustLanes, DUST_LANE_STRENGTH * uNoiseAmount); // Subtle banding

    return hDensity * rDensity * uManifoldIntensity * DISK_BASE_INTENSITY;
}

/**
 * Calculate emission color for a point in the disk.
 *
 * PERF: r and innerR are passed as parameters to avoid redundant length() calls.
 * These values are already computed in getDiskDensity and the main raymarch loop.
 *
 * @param pos - Position
 * @param density - Calculated density
 * @param time - Time
 * @param rayDir - Ray direction (for Doppler)
 * @param normal - Surface normal (for ALGO_NORMAL coloring)
 * @param r - Pre-computed radial distance length(pos.xz)
 * @param innerR - Pre-computed inner radius uHorizonRadius * uDiskInnerRadiusMul
 * @returns Emission color
 */
vec3 getDiskEmission(vec3 pos, float density, float time, vec3 rayDir, vec3 normal, float r, float innerR) {
    // Temperature Profile with Stress-Free ISCO Boundary
    //
    // Standard Shakura-Sunyaev thin disk: T ∝ r^(-3/4)
    // But at ISCO (innerR), there's a stress-free boundary where torque vanishes.
    // The corrected temperature profile is:
    //   T(r) = T_max * (r/r_ISCO)^(-3/4) * [1 - sqrt(r_ISCO/r)]^(1/4)
    //
    // The [1 - sqrt(r_ISCO/r)]^(1/4) factor:
    // - Goes to 0 at r = r_ISCO (no radiation at inner edge)
    // - Approaches 1 for r >> r_ISCO (standard profile at large r)
    // - Peak temperature occurs at r ≈ (49/36) * r_ISCO ≈ 1.36 * r_ISCO
    //
    // Reference: Novikov & Thorne (1973), Page & Thorne (1974)
    //
    float safeInnerR = max(innerR, 0.001);
    float safeR = max(r, safeInnerR);

    // Standard thin disk temperature profile: T ∝ r^(-3/4)
    // This is the Shakura-Sunyaev model without ISCO correction
    // (the ISCO correction was creating a dark ring artifact)
    float tempRatio = pow(safeInnerR / safeR, TEMP_FALLOFF_EXPONENT);

    // Renormalize so peak (at r ≈ 1.36 * innerR) equals 1.0
    // At peak: basicFalloff ≈ (1/1.36)^0.75 ≈ 0.78
    //          iscoCorrection ≈ (1 - sqrt(1/1.36))^0.25 ≈ 0.60
    //          product ≈ 0.47
    // To normalize, divide by peak value (≈ 0.47)
    // However, this changes visual appearance significantly - keep simpler version for now
    // tempRatio /= 0.47; // Uncomment for physically normalized profile

    // Get base color
    vec3 color;

    if (uColorAlgorithm == ALGO_BLACKBODY) {
        // Map ratio to temperature
        // Inner edge = low (ISCO boundary), peak slightly outside, outer = cooler
        float temp = uDiskTemperature * tempRatio;
        color = blackbodyColor(temp);

        // Boost intensity heavily for the "core" look
        color *= BLACKBODY_BOOST;
    } else {
        // Use palette based on tempRatio (1.0 = hot/inner, 0.0 = cold/outer)
        // Non-linear mapping to push "cold" colors to the outer edge
        float t = pow(max(0.0, 1.0 - tempRatio), 0.8);
        color = getAlgorithmColor(t, pos, normal);

        // Boost contrast of palette colors to avoid pastel/cream look
        // This makes darks darker and brights brighter
        color = pow(color, vec3(1.5));

        // Add "thermal core" - lighter/whiter at high temp regardless of palette
        // This simulates incandescence at the inner edge
        vec3 coreColor = vec3(1.0, 0.98, 0.9);
        float coreMix = smoothstep(0.7, 1.0, tempRatio);
        color = mix(color, coreColor * CORE_BRIGHTNESS, coreMix * 0.6);

        // Apply temperature-based brightness (inner regions brighter)
        color *= PALETTE_BOOST * tempRatio;
    }

    // Gravitational Redshift
    float gRedshift = gravitationalRedshift(r);
    color *= gRedshift;
    
    // Doppler Shift (Relativistic Beaming)
    // Approaching side is brighter and bluer
    float dopplerFac = dopplerFactor(pos, rayDir);
    color = applyDopplerShift(color, dopplerFac);

    // Limb Darkening
    // Physical effect: edges of the disk appear darker because we view
    // through more optically thin material at grazing angles.
    //
    // Approximation: I(θ) = I₀ * (1 - u * (1 - cos(θ)))
    // where θ is the angle between surface normal and view direction.
    // For a thin disk in XZ plane, the normal is ±Y, so cos(θ) ≈ |rayDir.y|
    //
    // u = limb darkening coefficient:
    // - u = 0: no limb darkening
    // - u = 0.6: typical stellar value (used for accretion disk approximation)
    float cosTheta = abs(rayDir.y);
    float limbDarkening = 1.0 - 0.4 * (1.0 - cosTheta); // u ≈ 0.4 for subtle effect
    color *= limbDarkening;

    // Density grading
    // Thicker parts are hotter/brighter
    // Use a linear ramp instead of smoothstep to preserve dynamic range
    color *= (density * 0.2 + 0.1);

    return color * density;
}

/**
 * Compute disk surface normal from density gradient.
 * Used for volumetric lighting/shading interactions.
 * Named differently from SDF version to avoid conflicts when both are included.
 *
 * PERF OPTIMIZATION: Uses analytical approximation instead of numerical gradient.
 * For a thin accretion disk in the XZ plane:
 * - The Y (vertical) gradient dominates and is predictable (Gaussian falloff)
 * - The radial gradient follows the density profile
 *
 * This reduces from 4 expensive getDiskDensity calls to 0 noise samples,
 * a ~10x speedup for normal computation.
 *
 * For high quality (ALGO_NORMAL coloring), falls back to numerical gradient.
 */
vec3 computeVolumetricDiskNormal(vec3 pos, vec3 rayDir) {
    // PERF: Fast mode uses analytical approximation (no noise samples)
    // The disk is thin and mostly flat in XZ plane, so the normal is dominated by Y
    if (uFastMode || uSampleQuality < 2) {
        // For a thin disk in XZ plane:
        // - Vertical component: sign based on which side of disk plane
        // - Radial component: slight outward tilt at edges (disk flare)
        float r = length(pos.xz);
        float outerR = uHorizonRadius * uDiskOuterRadiusMul;

        // Radial direction in XZ plane (outward from center)
        vec3 radialDir = r > 0.001 ? vec3(pos.x / r, 0.0, pos.z / r) : vec3(1.0, 0.0, 0.0);

        // Vertical component: dominant, points away from disk plane
        float ySign = pos.y > 0.0 ? 1.0 : -1.0;

        // Slight radial tilt at outer edge (disk flare)
        float flareTilt = smoothstep(outerR * 0.5, outerR, r) * 0.3;

        vec3 normal = normalize(vec3(radialDir.x * flareTilt, ySign, radialDir.z * flareTilt));

        // Ensure normal faces the viewer
        if (dot(normal, rayDir) > 0.0) normal = -normal;

        return normal;
    }

    // HIGH QUALITY: Numerical gradient (4 getDiskDensity samples)
    // Only used when uSampleQuality >= 2 and not in fast mode
    float eps = 0.02 * uHorizonRadius;
    float time = uTime * uTimeScale;

    float d0 = getDiskDensity(pos, time);
    float dx = getDiskDensity(pos + vec3(eps, 0.0, 0.0), time) - d0;
    float dy = getDiskDensity(pos + vec3(0.0, eps, 0.0), time) - d0;
    float dz = getDiskDensity(pos + vec3(0.0, 0.0, eps), time) - d0;

    vec3 grad = vec3(dx, dy, dz);

    if (dot(grad, grad) < 1e-8) return vec3(0.0, 1.0, 0.0);

    vec3 normal = -normalize(grad);
    if (dot(normal, rayDir) > 0.0) normal = -normal;

    return normal;
}
`;