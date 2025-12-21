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

// Ridged multifractal noise for electric/plasma look
float ridgedMF(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    float prev = 1.0;
    
    // Adapt octaves based on quality
    int octaves = uFastMode ? 2 : (uSampleQuality < 2 ? 3 : 5);

    for(int i = 0; i < 5; i++) {
        if (i >= octaves) break;
        
        float n = snoise(p * freq);
        
        // Ridged artifact: |noise| -> 1.0 - |noise|
        // Creates sharp valleys (ridges)
        n = 1.0 - abs(n);
        n = n * n; // sharpen ridges
        
        sum += n * amp; // * prev; // scaling by prev makes it multifractal (more sparse)
        
        // prev = n;
        freq *= 2.0;
        amp *= 0.5;
        
        // Rotate domain to avoid axis bias
        // p = p.yzx * 1.5 + p.zxy * 0.2; 
    }
    return sum;
}

// Flow noise with domain warping
float flowNoise(vec3 p, float time) {
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
    if (r < innerR * 0.9 || r > outerR * 1.2) return 0.0;

    // 2. Vertical Profile (Gaussian with flaring)
    float flare = 1.0 + pow(r / outerR, 2.5) * 1.5; // Thickness increases with radius
    float thickness = uManifoldThickness * uHorizonRadius * 0.5 * flare;
    
    // Very sharp vertical falloff for "thin disk" look at center
    float hDensity = exp(-(h * h) / (thickness * thickness));
    
    // Cut off if too far vertically
    if (hDensity < 0.001) return 0.0;

    // 3. Radial Profile
    // Soft inner edge near ISCO, Soft outer edge fade
    float rDensity = smoothstep(innerR * 0.9, innerR, r) * (1.0 - smoothstep(outerR * 0.9, outerR * 1.2, r));
    
    // Inverse square falloff for bulk density (denser inside)
    rDensity *= 2.0 / (pow(r/innerR, 2.0) + 0.1);

    // 4. Volumetric Detail (The "Interstellar" Look)
    
    // Coordinate mapping for "streak" texture
    // Map (x,y,z) -> (radius, angle, height)
    float angle = atan(pos.z, pos.x);
    
    // Differential rotation: Inner parts move faster (Keplerian)
    // Omega ~ r^(-1.5)
    float rotSpeed = 5.0 * pow(innerR / max(r, 0.1), 1.5);
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
        noiseVal = pow(noiseVal, 2.0); 
        
        // Apply noise amount with higher contrast boost
        rDensity *= mix(1.0, noiseVal * 3.0, uNoiseAmount);
    }

    // 5. Dust Lanes (dark rings)
    // Sine wave modulation on radius
    float dustLanes = 0.5 + 0.5 * sin(r * 15.0 / uHorizonRadius);
    dustLanes = pow(dustLanes, 0.5); // Sharpen
    rDensity *= mix(1.0, dustLanes, 0.3 * uNoiseAmount); // Subtle banding

    return hDensity * rDensity * uManifoldIntensity * 20.0;
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

    // Temperature Profile
    // T ~ r^(-3/4) standard accretion disk
    float tempRatio = pow(innerR / max(r, innerR), 0.75);
    
    // Get base color
    vec3 color;
    
    if (uColorAlgorithm == ALGO_BLACKBODY) {
        // Map ratio to temperature
        // Inner edge = uDiskTemperature (e.g. 10000K - Blue/White)
        // Outer edge = Cooler (e.g. 2000K - Red/Orange)
        float temp = uDiskTemperature * tempRatio;
        color = blackbodyColor(temp);
        
        // Boost intensity heavily for the "core" look
        color *= 2.0; 
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
        color = mix(color, coreColor * 3.0, coreMix * 0.6); 
        
        color *= 2.5 * tempRatio;
    }

    // Gravitational Redshift
    float gRedshift = gravitationalRedshift(r);
    color *= gRedshift;
    
    // Doppler Shift (Relativistic Beaming)
    // Approaching side is brighter and bluer
    float dopplerFac = dopplerFactor(pos, rayDir);
    color = applyDopplerShift(color, dopplerFac);
    
    // Density grading
    // Thicker parts are hotter/brighter
    // Use a linear ramp instead of smoothstep to preserve dynamic range
    color *= (density * 0.2 + 0.1);

    return color * density;
}

/**
 * Compute disk surface normal from density gradient.
 * Used for lighting/shading interactions.
 */
vec3 computeDiskNormal(vec3 pos, vec3 rayDir) {
    // Standard central difference
    float eps = 0.02 * uHorizonRadius; // Scale epsilon with size
    float time = uTime * uTimeScale;
    
    float dx = getDiskDensity(pos + vec3(eps, 0.0, 0.0), time) - getDiskDensity(pos - vec3(eps, 0.0, 0.0), time);
    float dy = getDiskDensity(pos + vec3(0.0, eps, 0.0), time) - getDiskDensity(pos - vec3(0.0, eps, 0.0), time);
    float dz = getDiskDensity(pos + vec3(0.0, 0.0, eps), time) - getDiskDensity(pos - vec3(0.0, 0.0, eps), time);
    
    vec3 grad = vec3(dx, dy, dz);
    
    if (dot(grad, grad) < 1e-8) return vec3(0.0, 1.0, 0.0);
    
    vec3 normal = -normalize(grad);
    if (dot(normal, rayDir) > 0.0) normal = -normal;
    
    return normal;
}
`;