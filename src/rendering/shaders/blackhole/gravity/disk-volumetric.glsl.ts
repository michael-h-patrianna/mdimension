/**
 * Volumetric Accretion Disk Shader
 *
 * Implements a physically-inspired volumetric accretion disk using raymarching density accumulation.
 *
 * Key Features:
 * - Volumetric density field (not just a surface)
 * - FBM Noise for turbulence and "Gargantua" look
 * - Relativistic beaming (Doppler boosting intensity)
 * - Temperature gradient (Blackbody)
 * - Soft edges and gaps
 */

export const diskVolumetricBlock = /* glsl */ `
//----------------------------------------------
// VOLUMETRIC ACCRETION DISK
//----------------------------------------------

// Noise functions
// Basic 3D value noise
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

// Fractal Brownian Motion
float fbm(vec3 p) {
    float f = 0.0;
    float w = 0.5;
    // Adapt octaves based on quality settings
    int octaves = 4;
    if (uFastMode) octaves = 2;
    else if (uSampleQuality < 2) octaves = 3;
    
    for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;
        f += w * noise(p);
        p *= 2.0;
        w *= 0.5;
    }
    return f;
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

    // Inner and outer boundaries
    float innerR = uHorizonRadius * uDiskInnerRadiusMul;
    float outerR = uHorizonRadius * uDiskOuterRadiusMul;

    // Early out
    if (r < innerR * 0.95 || r > outerR * 1.1) return 0.0;

    // Vertical thickness profile (Gaussian falloff)
    float thickness = uManifoldThickness * uHorizonRadius * getManifoldThicknessScale();
    // Thicker at outer edge (flaring)
    thickness *= (1.0 + pow(r / outerR, 2.0) * 0.5); 
    
    float hDensity = exp(-(h * h) / (thickness * thickness * 0.5));
    if (hDensity < 0.01) return 0.0;

    // Radial profile (ISCO cut-off and outer fade)
    // Sharp inner edge (ISCO), smooth outer edge
    float rDensity = smoothstep(innerR * 0.95, innerR, r) * (1.0 - smoothstep(outerR * 0.8, outerR * 1.1, r));
    
    // Main density falloff (accretion disks are denser inside)
    rDensity *= 1.0 / (pow(r / innerR, 1.5) + 0.1); 

    // Turbulence / Noise / Streaks
    // Coordinate transformation for swirling noise
    float angle = atan(pos.z, pos.x);
    // Differential rotation: inner parts rotate faster
    float rotSpeed = 3.0 / (r + 0.1); 
    float phase = angle * 2.0 + time * rotSpeed;
    
    // "Interstellar" Streak Texture:
    // High frequency in R (rings), Low frequency in Angle (streaks)
    vec3 noisePos = vec3(r * 8.0, phase, h * 3.0);
    
    // Domain warping for flow look
    float q = fbm(noisePos * uNoiseScale);
    float n = fbm(noisePos * uNoiseScale + vec3(q * 1.5, q * 0.5, 0.0));
    
    // Ridged noise for "strands"
    float detail = 1.0 - abs(2.0 * n - 1.0);
    detail = pow(detail, 3.0); // Sharpen strands

    float noiseFactor = mix(1.0, detail, uNoiseAmount);

    return hDensity * rDensity * noiseFactor * uManifoldIntensity * 20.0; // Boost density
}

/**
 * Calculate emission color for a point in the disk.
 *
 * @param pos - Position
 * @param density - Calculated density
 * @param time - Time
 * @param rayDir - Ray direction (for Doppler)
 * @param normal - Surface normal (for ALGO_NORMAL coloring)
 * @returns Emission color
 */
vec3 getDiskEmission(vec3 pos, float density, float time, vec3 rayDir, vec3 normal) {
    float r = length(pos.xz);
    float innerR = uHorizonRadius * uDiskInnerRadiusMul;

    // Temperature based on radius (hotter inside)
    float tempProfile = pow(innerR / max(r, innerR), 0.75); // Approx physical falloff
    
    // Get color from selected algorithm
    // t = 1.0 - tempProfile (0.0 = inner/hot, 1.0 = outer/cold)
    // This maps well to gradients where left=start(hot) and right=end(cold)
    vec3 color = getAlgorithmColor(1.0 - tempProfile, pos, normal);

    // Apply base intensity scaling (for non-blackbody modes)
    // Blackbody mode handles intensity internally
    if (uColorAlgorithm != ALGO_BLACKBODY) {
        // Boost brightness for volumetric look
        color *= 2.0 * tempProfile; 
    }

    // Gravitational Redshift (dimmer and redder near horizon)
    float gRedshift = gravitationalRedshift(r);
    color *= gRedshift;
    
    // Doppler Shift (Beaming)
    // Pass rayDir to dopplerFactor
    float dopplerFac = dopplerFactor(pos, rayDir);
    color = applyDopplerShift(color, dopplerFac);

    return color * density;
}

/**
 * Compute disk surface normal from density gradient.
 * Used for lighting/shading interactions.
 *
 * @param pos - Position
 * @param rayDir - Ray direction (to orient normal towards viewer)
 * @returns Normalized normal vector
 */
vec3 computeDiskNormal(vec3 pos, vec3 rayDir) {
    float eps = 0.01;
    float time = uTime * uTimeScale;
    
    // Central differences for better quality
    float dx = getDiskDensity(pos + vec3(eps, 0.0, 0.0), time) - getDiskDensity(pos - vec3(eps, 0.0, 0.0), time);
    float dy = getDiskDensity(pos + vec3(0.0, eps, 0.0), time) - getDiskDensity(pos - vec3(0.0, eps, 0.0), time);
    float dz = getDiskDensity(pos + vec3(0.0, 0.0, eps), time) - getDiskDensity(pos - vec3(0.0, 0.0, eps), time);
    
    vec3 grad = vec3(dx, dy, dz);
    
    // If gradient is zero (outside disk), default to up/down
    if (dot(grad, grad) < 1e-8) {
        return vec3(0.0, 1.0, 0.0);
    }
    
    // Normal points towards decreasing density (outwards)
    vec3 normal = -normalize(grad);
    
    // Ensure normal faces the viewer
    if (dot(normal, rayDir) > 0.0) {
        normal = -normal;
    }
    
    return normal;
}
`;
