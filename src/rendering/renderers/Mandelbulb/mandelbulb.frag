// ============================================
// Hyperbulb Fragment Shader - OPTIMIZED
// D-dimensional (4D-11D) raymarching
// Hand-optimized: no dynamic loops, no arrays in hot path
// ============================================

precision highp float;

// MRT output declarations for WebGL2
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;

uniform vec3 uCameraPosition;
uniform float uPower;
uniform float uIterations;
uniform float uEscapeRadius;
uniform vec3 uColor;
uniform mat4 uModelMatrix;
uniform mat4 uInverseModelMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

uniform int uDimension;

// D-dimensional rotated coordinate system
// c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
uniform float uBasisX[11];
uniform float uBasisY[11];
uniform float uBasisZ[11];
uniform float uOrigin[11];

// Multi-Light System Constants
#define MAX_LIGHTS 4
#define LIGHT_TYPE_POINT 0
#define LIGHT_TYPE_DIRECTIONAL 1
#define LIGHT_TYPE_SPOT 2

// Multi-Light System Uniforms
uniform int uNumLights;
uniform bool uLightsEnabled[MAX_LIGHTS];
uniform int uLightTypes[MAX_LIGHTS];
uniform vec3 uLightPositions[MAX_LIGHTS];
uniform vec3 uLightDirections[MAX_LIGHTS];
uniform vec3 uLightColors[MAX_LIGHTS];
uniform float uLightIntensities[MAX_LIGHTS];
uniform float uSpotAngles[MAX_LIGHTS];
uniform float uSpotPenumbras[MAX_LIGHTS];
uniform float uSpotCosInner[MAX_LIGHTS];
uniform float uSpotCosOuter[MAX_LIGHTS];
uniform float uLightRanges[MAX_LIGHTS];
uniform float uLightDecays[MAX_LIGHTS];

// Global lighting uniforms
uniform float uAmbientIntensity;
uniform vec3 uAmbientColor;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
// Enhanced lighting uniforms
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;
// Material property for G-buffer (reflectivity for SSR)
uniform float uMetallic;

// Fresnel rim lighting uniforms
uniform bool uFresnelEnabled;
uniform float uFresnelIntensity;
uniform vec3 uRimColor;

// Advanced Color System uniforms
// 0=monochromatic, 1=analogous, 2=cosine, 3=normal, 4=distance, 5=lch, 6=multiSource, 7=radial
uniform int uColorAlgorithm;
uniform vec3 uCosineA;
uniform vec3 uCosineB;
uniform vec3 uCosineC;
uniform vec3 uCosineD;
uniform float uDistPower;
uniform float uDistCycles;
uniform float uDistOffset;
uniform float uLchLightness;
uniform float uLchChroma;
uniform vec3 uMultiSourceWeights;

// Performance mode: reduces quality during animation for smoother interaction
uniform bool uFastMode;

// Progressive refinement quality multiplier (0.25-1.0)
// Used for fine-grained quality control after interaction stops
// 0.25 = lowest quality, 1.0 = full quality
uniform float uQualityMultiplier;

// Temporal Reprojection uniforms
// Reuses previous frame depth to accelerate raymarching
uniform sampler2D uPrevDepthTexture;
uniform mat4 uPrevViewProjectionMatrix;
uniform mat4 uPrevInverseViewProjectionMatrix;
uniform bool uTemporalEnabled;
uniform vec2 uDepthBufferResolution;
uniform float uCameraNear;
uniform float uCameraFar;

// Opacity Mode System uniforms
// Mode: 0=solid, 1=simpleAlpha, 2=layeredSurfaces, 3=volumetricDensity
uniform int uOpacityMode;
uniform float uSimpleAlpha;           // 0.0-1.0 for simple alpha mode
uniform int uLayerCount;              // 2-4 for layered surfaces mode
uniform float uLayerOpacity;          // 0.1-0.9 per-layer opacity
uniform float uVolumetricDensity;     // 0.1-2.0 for volumetric mode
uniform int uSampleQuality;           // 0=low, 1=medium, 2=high
uniform bool uVolumetricReduceOnAnim; // Whether to reduce volumetric quality during animation

// Shadow System uniforms
uniform bool uShadowEnabled;
uniform int uShadowQuality;           // 0=low, 1=medium, 2=high, 3=ultra
uniform float uShadowSoftness;        // 0.0-2.0 penumbra softness
uniform int uShadowAnimationMode;     // 0=pause, 1=low, 2=full

// Power Animation uniforms (Technique B - power oscillation)
uniform bool uPowerAnimationEnabled;
uniform float uAnimatedPower;         // Computed on CPU: center + amplitude * sin(time * speed)

// Alternate Power uniforms (Technique B variant - blend between two powers)
uniform bool uAlternatePowerEnabled;
uniform float uAlternatePowerValue;   // Second power value to blend with
uniform float uAlternatePowerBlend;   // 0.0-1.0 blend factor

// Dimension Mixing uniforms (Technique A - shear matrix inside iteration)
// Note: Actual shader implementation pending - uniforms reserved for future use
uniform bool uDimensionMixEnabled;
uniform float uMixIntensity;          // 0.0-0.3 strength of mixing
uniform float uMixTime;               // Animated time for mixing matrix

// Phase Shift uniforms (angular twisting)
uniform bool uPhaseEnabled;
uniform float uPhaseTheta;            // Phase offset for theta angle
uniform float uPhasePhi;              // Phase offset for phi angle

in vec3 vPosition;
in vec2 vUv;

// Performance constants
// High quality mode (when idle)
#define MAX_MARCH_STEPS_HQ 128
#define MAX_ITER_HQ 64
#define SURF_DIST_HQ 0.002

// Low quality mode (during animation)
#define MAX_MARCH_STEPS_LQ 64
#define MAX_ITER_LQ 32
#define SURF_DIST_LQ 0.004

#define BOUND_R 2.0
#define EPS 1e-6

#define PI 3.14159265359
#define HALF_PI 1.57079632679

// Opacity modes
#define OPACITY_SOLID 0
#define OPACITY_SIMPLE_ALPHA 1
#define OPACITY_LAYERED 2
#define OPACITY_VOLUMETRIC 3

// Palette modes
#define PAL_MONO 0
#define PAL_ANALOG 1
#define PAL_COMP 2
#define PAL_TRIAD 3
#define PAL_SPLIT 4

// ============================================
// Power animation helper (Technique B)
// Returns effective power value considering animation and alternate power
// ============================================

float getEffectivePower() {
    // Start with base power (possibly animated)
    float basePower = uPowerAnimationEnabled ? uAnimatedPower : uPower;

    // Apply alternate power blending if enabled
    if (uAlternatePowerEnabled) {
        basePower = mix(basePower, uAlternatePowerValue, uAlternatePowerBlend);
    }

    // Clamp to minimum safe value
    return max(basePower, 2.0);
}

// ============================================
// Color utilities (kept minimal)
// ============================================

vec3 rgb2hsl(vec3 c) {
    float maxC = max(max(c.r, c.g), c.b);
    float minC = min(min(c.r, c.g), c.b);
    float l = (maxC + minC) * 0.5;
    if (maxC == minC) return vec3(0.0, 0.0, l);
    float d = maxC - minC;
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    float h;
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    return vec3(h / 6.0, s, l);
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 0.16667) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 0.66667) return p + (q - p) * (0.66667 - t) * 6.0;
    return p;
}

vec3 hsl2rgb(vec3 hsl) {
    if (hsl.y == 0.0) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    return vec3(hue2rgb(p, q, hsl.x + 0.33333), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 0.33333));
}

vec3 getPaletteColor(vec3 hsl, float t, int mode) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    float minL = min(l * 0.15, 0.08);
    float maxL = l + (1.0 - l) * 0.7;
    if (s < 0.1 && mode != PAL_MONO) { h = 0.0; s = 0.4; }
    float newL = mix(minL, maxL, t);
    if (mode == PAL_MONO) return hsl2rgb(vec3(h, hsl.y, newL));
    if (mode == PAL_ANALOG) return hsl2rgb(vec3(fract(h + (t - 0.5) * 0.167), s, newL));
    if (mode == PAL_COMP) return hsl2rgb(vec3(t < 0.5 ? h : fract(h + 0.5), s, newL));
    if (mode == PAL_TRIAD) {
        float nh = t < 0.333 ? h : (t < 0.667 ? fract(h + 0.333) : fract(h + 0.667));
        return hsl2rgb(vec3(nh, s, newL));
    }
    if (mode == PAL_SPLIT) {
        float nh = t < 0.333 ? h : (t < 0.667 ? fract(h + 0.417) : fract(h + 0.583));
        return hsl2rgb(vec3(nh, s, newL));
    }
    return hsl2rgb(vec3(h, hsl.y, newL));
}

// ============================================
// Cosine Gradient Palette Functions
// Based on Inigo Quilez's technique
// ============================================

vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

float applyDistribution(float t, float power, float cycles, float offset) {
  float clamped = clamp(t, 0.0, 1.0);
  float curved = pow(clamped, power);
  float cycled = fract(curved * cycles + offset);
  return cycled;
}

vec3 getCosinePaletteColor(
  float t,
  vec3 a, vec3 b, vec3 c, vec3 d,
  float power, float cycles, float offset
) {
  float distributedT = applyDistribution(t, power, cycles, offset);
  return cosinePalette(distributedT, a, b, c, d);
}

// ============================================
// Oklab Color Space Functions (for LCH algorithm)
// ============================================

vec3 oklabToLinearSrgb(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;

  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;

  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 lchColor(float t, float lightness, float chroma) {
  float hue = t * 6.28318;
  vec3 oklab = vec3(lightness, chroma * cos(hue), chroma * sin(hue));
  vec3 rgb = oklabToLinearSrgb(oklab);
  return clamp(rgb, 0.0, 1.0);
}

// ============================================
// Unified Color Algorithm Selector
// ============================================

vec3 getColorByAlgorithm(float t, vec3 normal, vec3 baseHSL, vec3 position) {
  // Use else-if chain for proper mutual exclusion on all GPU architectures
  if (uColorAlgorithm == 0) {
    // Algorithm 0: Monochromatic - same hue, varying lightness
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    float newL = 0.3 + distributedT * 0.4;
    return hsl2rgb(vec3(baseHSL.x, baseHSL.y, newL));
  } else if (uColorAlgorithm == 1) {
    // Algorithm 1: Analogous - hue varies ±30° from base
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    float hueOffset = (distributedT - 0.5) * 0.167;
    float newH = fract(baseHSL.x + hueOffset);
    return hsl2rgb(vec3(newH, baseHSL.y, baseHSL.z));
  } else if (uColorAlgorithm == 2) {
    // Algorithm 2: Cosine gradient palette
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 3) {
    // Algorithm 3: Normal-based coloring
    float normalT = normal.y * 0.5 + 0.5;
    return getCosinePaletteColor(normalT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 4) {
    // Algorithm 4: Distance-field coloring
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 5) {
    // Algorithm 5: LCH/Oklab perceptual
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    return lchColor(distributedT, uLchLightness, uLchChroma);
  } else if (uColorAlgorithm == 6) {
    // Algorithm 6: Multi-source mapping
    // Blends depth (t), orbitTrap (position-based), and normal contributions
    float totalWeight = uMultiSourceWeights.x + uMultiSourceWeights.y + uMultiSourceWeights.z;
    vec3 w = uMultiSourceWeights / max(totalWeight, 0.001);
    float normalValue = normal.y * 0.5 + 0.5;
    // Use position-based orbit trap instead of duplicating t
    float orbitTrap = clamp(length(position) / BOUND_R, 0.0, 1.0);
    float blendedT = w.x * t + w.y * orbitTrap + w.z * normalValue;
    return getCosinePaletteColor(blendedT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 7) {
    // Algorithm 7: Radial - color based on 3D distance from origin
    // Normalize by bounding radius (BOUND_R = 2.0)
    float radialT = clamp(length(position) / BOUND_R, 0.0, 1.0);
    return getCosinePaletteColor(radialT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else {
    // Fallback: cosine palette
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  }
}

// Fresnel (Schlick approximation)
// float fresnelSchlick(float cosTheta, float F0) {
//    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
//}

// Optimized version
float fresnelSchlick(float cosTheta, float F0) {
    float x = 1.0 - cosTheta;
    float x2 = x * x;
    float x5 = x2 * x2 * x; // x^5 with 4 multiplies total
    return F0 + (1.0 - F0) * x5;
}

// ============================================
// Optimized Power Functions
// ============================================

// Fast integer power for common Mandelbulb power value (8)
// Uses only 3 multiplications instead of expensive pow()
// pow(r, 8) = r^8, pow(r, 7) = r^7 for derivative
void fastPow8(float r, out float rPow, out float rPowMinus1) {
    float r2 = r * r;
    float r4 = r2 * r2;
    rPowMinus1 = r4 * r2 * r;  // r^7
    rPow = rPowMinus1 * r;      // r^8
}

// Generic optimized power that uses fastPow8 when applicable
// Returns r^pwr and r^(pwr-1) for derivative calculation
void optimizedPow(float r, float pwr, out float rPow, out float rPowMinus1) {
    if (pwr == 8.0) {
        fastPow8(r, rPow, rPowMinus1);
    } else {
        // Use direct exponentiation for stability
        // pow(max(r, EPS), pwr-1.0) is more stable than rPow/r when r is small
        rPow = pow(r, pwr);
        rPowMinus1 = pow(max(r, EPS), pwr - 1.0);
    }
}

// ============================================
// 3D Mandelbulb - Standard spherical coordinates
// (Hyperbulb in 3D reduces to standard Mandelbulb)
// ============================================

float sdf3D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // For 3D, we use standard spherical coordinates
    // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
    // But in 3D, this simplifies to just pos (with possible slice offset)
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float zx = cx, zy = cy, zz = cz;

    float dr = 1.0;
    float r = 0.0;

    // Orbit traps
    float minPlane = 1000.0, minAxis = 1000.0, minSphere = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // r = |z|
        r = sqrt(zx*zx + zy*zy + zz*zz);
        if (r > bail) { escIt = i; break; }

        // Orbit traps (using z-axis primary convention)
        minPlane = min(minPlane, abs(zy));
        minAxis = min(minAxis, sqrt(zx*zx + zy*zy));  // Distance from z-axis
        minSphere = min(minSphere, abs(r - 0.8));

        // Optimized power calculation
        float rp, rpMinus1;
        optimizedPow(r, pwr, rp, rpMinus1);
        dr = rpMinus1 * pwr * dr + 1.0;

        // To spherical: z-axis primary (standard Mandelbulb)
        // theta = angle from z-axis, phi = angle in xy-plane
        float theta = acos(clamp(zz / max(r, EPS), -1.0, 1.0));  // From z-axis
        float phi = atan(zy, zx);  // In xy plane

        // Power map: angles * n (with optional phase shift)
        float thetaN = (theta + (uPhaseEnabled ? uPhaseTheta : 0.0)) * pwr;
        float phiN = (phi + (uPhaseEnabled ? uPhasePhi : 0.0)) * pwr;

        // From spherical: z-axis primary reconstruction
        float cTheta = cos(thetaN), sTheta = sin(thetaN);
        float cPhi = cos(phiN), sPhi = sin(phiN);

        zz = rp * cTheta + cz;              // z = r * cos(theta)
        zx = rp * sTheta * cPhi + cx;       // x = r * sin(theta) * cos(phi)
        zy = rp * sTheta * sPhi + cy;       // y = r * sin(theta) * sin(phi)
        escIt = i;
    }

    trap = exp(-minPlane * 5.0) * 0.3 + exp(-minAxis * 3.0) * 0.2 +
           exp(-minSphere * 8.0) * 0.2 + float(escIt) / float(maxIt) * 0.3;
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

float sdf3D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float zx = cx, zy = cy, zz = cz;
    float dr = 1.0, r = 0.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz);
        if (r > bail) break;

        // Optimized power calculation
        float rp, rpMinus1;
        optimizedPow(r, pwr, rp, rpMinus1);
        dr = rpMinus1 * pwr * dr + 1.0;

        // z-axis primary (standard Mandelbulb)
        float theta = acos(clamp(zz / max(r, EPS), -1.0, 1.0));
        float phi = atan(zy, zx);

        float thetaN = (theta + (uPhaseEnabled ? uPhaseTheta : 0.0)) * pwr;
        float phiN = (phi + (uPhaseEnabled ? uPhasePhi : 0.0)) * pwr;
        float cTheta = cos(thetaN), sTheta = sin(thetaN);
        float cPhi = cos(phiN), sPhi = sin(phiN);

        zz = rp * cTheta + cz;
        zx = rp * sTheta * cPhi + cx;
        zy = rp * sTheta * sPhi + cy;
    }
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

// ============================================
// 4D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf4D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // c = uOrigin + pos.x * uBasisX + pos.y * uBasisY + pos.z * uBasisZ
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float cw = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float zx = cx, zy = cy, zz = cz, zw = cw;

    float dr = 1.0;
    float r = 0.0;

    // Orbit traps
    float minPlane = 1000.0, minAxis = 1000.0, minSphere = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // r = |z|
        r = sqrt(zx*zx + zy*zy + zz*zz + zw*zw);
        if (r > bail) { escIt = i; break; }

        // Orbit traps (using z-axis primary convention)
        minPlane = min(minPlane, abs(zy));
        minAxis = min(minAxis, sqrt(zx*zx + zy*zy));  // Distance from z-axis
        minSphere = min(minSphere, abs(r - 0.8));

        // Optimized power calculation
        float rp, rpMinus1;
        optimizedPow(r, pwr, rp, rpMinus1);
        dr = rpMinus1 * pwr * dr + 1.0;

        // To hyperspherical: z-axis primary (like Mandelbulb)
        // 4D: (z, x, y, w) -> (x1, x2, x3, x4) hyperspherical
        float theta = acos(clamp(zz / max(r, EPS), -1.0, 1.0));  // From z-axis (like Mandelbulb)
        float rxyw = sqrt(zx*zx + zy*zy + zw*zw);
        float phi = rxyw > EPS ? acos(clamp(zx / max(rxyw, EPS), -1.0, 1.0)) : 0.0;  // From x in xyw
        float psi = atan(zw, zy);  // In yw plane

        // Power map: angles * n (with optional phase shift)
        float thetaN = (theta + (uPhaseEnabled ? uPhaseTheta : 0.0)) * pwr;
        float phiN = (phi + (uPhaseEnabled ? uPhasePhi : 0.0)) * pwr;
        float psiN = psi * pwr;

        // From hyperspherical: z-axis primary reconstruction
        float cTheta = cos(thetaN), sTheta = sin(thetaN);
        float cPhi = cos(phiN), sPhi = sin(phiN);
        float cPsi = cos(psiN), sPsi = sin(psiN);

        float rSinTheta = rp * sTheta;
        float rSinThetaSinPhi = rSinTheta * sPhi;
        zz = rp * cTheta + cz;              // z = r * cos(theta)
        zx = rSinTheta * cPhi + cx;         // x = r * sin(theta) * cos(phi)
        zy = rSinThetaSinPhi * cPsi + cy;   // y = r * sin(theta) * sin(phi) * cos(psi)
        zw = rSinThetaSinPhi * sPsi + cw;   // w = r * sin(theta) * sin(phi) * sin(psi)
        escIt = i;
    }

    trap = exp(-minPlane * 5.0) * 0.3 + exp(-minAxis * 3.0) * 0.2 +
           exp(-minSphere * 8.0) * 0.2 + float(escIt) / float(maxIt) * 0.3;
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

float sdf4D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float cw = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float zx = cx, zy = cy, zz = cz, zw = cw;
    float dr = 1.0, r = 0.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + zw*zw);
        if (r > bail) break;

        // Optimized power calculation
        float rp, rpMinus1;
        optimizedPow(r, pwr, rp, rpMinus1);
        dr = rpMinus1 * pwr * dr + 1.0;

        // z-axis primary (like Mandelbulb)
        float theta = acos(clamp(zz / max(r, EPS), -1.0, 1.0));
        float rxyw = sqrt(zx*zx + zy*zy + zw*zw);
        float phi = rxyw > EPS ? acos(clamp(zx / max(rxyw, EPS), -1.0, 1.0)) : 0.0;
        float psi = atan(zw, zy);

        float thetaN = (theta + (uPhaseEnabled ? uPhaseTheta : 0.0)) * pwr;
        float phiN = (phi + (uPhaseEnabled ? uPhasePhi : 0.0)) * pwr;
        float cTheta = cos(thetaN), sTheta = sin(thetaN);
        float cPhi = cos(phiN), sPhi = sin(phiN);
        float cPsi = cos(psi * pwr), sPsi = sin(psi * pwr);

        float rSinThetaSinPhi = rp * sTheta * sPhi;
        zz = rp * cTheta + cz;
        zx = rp * sTheta * cPhi + cx;
        zy = rSinThetaSinPhi * cPsi + cy;
        zw = rSinThetaSinPhi * sPsi + cw;
    }
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

// ============================================
// 5D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf5D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4;
    float dr = 1.0, r = 0.0;
    float minP = 1000.0, minA = 1000.0, minS = 1000.0;
    int escIt = 0;

    // Pre-compute phase offsets
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4);
        if (r > bail) { escIt = i; break; }
        minP = min(minP, abs(zy));
        minA = min(minA, sqrt(zx*zx + zy*zy));
        minS = min(minS, abs(r - 0.8));
        dr = pow(max(r, EPS), pwr - 1.0) * pwr * dr + 1.0;

        // 5D: 4 angles, z-axis primary (like Mandelbulb)
        float t0 = acos(clamp(zz / max(r, EPS), -1.0, 1.0));
        float r1 = sqrt(zx*zx + zy*zy + z3*z3 + z4*z4);
        float t1 = r1 > EPS ? acos(clamp(zx / max(r1, EPS), -1.0, 1.0)) : 0.0;
        float r2 = sqrt(zy*zy + z3*z3 + z4*z4);
        float t2 = r2 > EPS ? acos(clamp(zy / max(r2, EPS), -1.0, 1.0)) : 0.0;
        float t3 = atan(z4, z3);

        float rp = pow(r, pwr);
        float s0 = sin((t0+phaseT)*pwr), c0 = cos((t0+phaseT)*pwr);
        float s1 = sin((t1+phaseP)*pwr), c1 = cos((t1+phaseP)*pwr);
        float s2 = sin(t2*pwr), c2 = cos(t2*pwr);
        float s3 = sin(t3*pwr), c3_ = cos(t3*pwr);

        float sp = rp * s0 * s1 * s2;
        zz = rp * c0 + cz;
        zx = rp * s0 * c1 + cx;
        zy = rp * s0 * s1 * c2 + cy;
        z3 = sp * c3_ + c3;
        z4 = sp * s3 + c4;
        escIt = i;
    }

    trap = exp(-minP * 5.0) * 0.3 + exp(-minA * 3.0) * 0.2 + exp(-minS * 8.0) * 0.2 + float(escIt) / float(maxIt) * 0.3;
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

float sdf5D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4;
    float dr = 1.0, r = 0.0;
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4);
        if (r > bail) break;
        dr = pow(max(r, EPS), pwr - 1.0) * pwr * dr + 1.0;

        float t0 = acos(clamp(zz / max(r, EPS), -1.0, 1.0));
        float r1 = sqrt(zx*zx + zy*zy + z3*z3 + z4*z4);
        float t1 = r1 > EPS ? acos(clamp(zx / max(r1, EPS), -1.0, 1.0)) : 0.0;
        float r2 = sqrt(zy*zy + z3*z3 + z4*z4);
        float t2 = r2 > EPS ? acos(clamp(zy / max(r2, EPS), -1.0, 1.0)) : 0.0;
        float t3 = atan(z4, z3);

        float rp = pow(r, pwr);
        float s0 = sin((t0+phaseT)*pwr), c0 = cos((t0+phaseT)*pwr);
        float s1 = sin((t1+phaseP)*pwr), c1 = cos((t1+phaseP)*pwr);
        float s2 = sin(t2*pwr), c2 = cos(t2*pwr);
        float s3 = sin(t3*pwr), c3_ = cos(t3*pwr);
        float sp = rp * s0 * s1 * s2;
        zz = rp * c0 + cz; zx = rp * s0 * c1 + cx; zy = rp * s0 * s1 * c2 + cy;
        z3 = sp * c3_ + c3; z4 = sp * s3 + c4;
    }
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

// ============================================
// 6D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf6D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4, z5 = c5;
    float dr = 1.0, r = 0.0;
    float minP = 1000.0, minA = 1000.0, minS = 1000.0;
    int escIt = 0;
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5);
        if (r > bail) { escIt = i; break; }
        minP = min(minP, abs(zy)); minA = min(minA, sqrt(zx*zx + zy*zy)); minS = min(minS, abs(r - 0.8));
        dr = pow(max(r, EPS), pwr - 1.0) * pwr * dr + 1.0;

        // 6D: 5 angles, z-axis primary (like Mandelbulb)
        float t0 = acos(clamp(zz / max(r, EPS), -1.0, 1.0));
        float r1 = sqrt(zx*zx + zy*zy + z3*z3 + z4*z4 + z5*z5);
        float t1 = r1 > EPS ? acos(clamp(zx / max(r1, EPS), -1.0, 1.0)) : 0.0;
        float r2 = sqrt(zy*zy + z3*z3 + z4*z4 + z5*z5);
        float t2 = r2 > EPS ? acos(clamp(zy / max(r2, EPS), -1.0, 1.0)) : 0.0;
        float r3 = sqrt(z3*z3 + z4*z4 + z5*z5);
        float t3 = r3 > EPS ? acos(clamp(z3 / max(r3, EPS), -1.0, 1.0)) : 0.0;
        float t4 = atan(z5, z4);

        float rp = pow(r, pwr);
        float s0 = sin((t0+phaseT)*pwr), c0 = cos((t0+phaseT)*pwr);
        float s1 = sin((t1+phaseP)*pwr), c1 = cos((t1+phaseP)*pwr);
        float s2 = sin(t2*pwr), c2 = cos(t2*pwr);
        float s3 = sin(t3*pwr), c3_ = cos(t3*pwr);
        float s4 = sin(t4*pwr), c4_ = cos(t4*pwr);

        float sp = rp * s0 * s1 * s2 * s3;
        zz = rp * c0 + cz;
        zx = rp * s0 * c1 + cx;
        zy = rp * s0 * s1 * c2 + cy;
        z3 = rp * s0 * s1 * s2 * c3_ + c3;
        z4 = sp * c4_ + c4;
        z5 = sp * s4 + c5;
        escIt = i;
    }

    trap = exp(-minP * 5.0) * 0.3 + exp(-minA * 3.0) * 0.2 + exp(-minS * 8.0) * 0.2 + float(escIt) / float(maxIt) * 0.3;
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

float sdf6D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4, z5 = c5;
    float dr = 1.0, r = 0.0;
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5);
        if (r > bail) break;
        dr = pow(max(r, EPS), pwr - 1.0) * pwr * dr + 1.0;
        float t0 = acos(clamp(zz / max(r, EPS), -1.0, 1.0));
        float r1 = sqrt(zx*zx+zy*zy+z3*z3+z4*z4+z5*z5); float t1 = r1>EPS ? acos(clamp(zx / max(r1, EPS),-1.0,1.0)) : 0.0;
        float r2 = sqrt(zy*zy+z3*z3+z4*z4+z5*z5); float t2 = r2>EPS ? acos(clamp(zy / max(r2, EPS),-1.0,1.0)) : 0.0;
        float r3 = sqrt(z3*z3+z4*z4+z5*z5); float t3 = r3>EPS ? acos(clamp(z3 / max(r3, EPS),-1.0,1.0)) : 0.0;
        float t4 = atan(z5, z4);
        float rp = pow(r, pwr);
        float s0=sin((t0+phaseT)*pwr),c0=cos((t0+phaseT)*pwr),s1=sin((t1+phaseP)*pwr),c1=cos((t1+phaseP)*pwr);
        float s2=sin(t2*pwr),c2=cos(t2*pwr),s3=sin(t3*pwr),c3_=cos(t3*pwr);
        float s4=sin(t4*pwr),c4_=cos(t4*pwr);
        float sp = rp*s0*s1*s2*s3;
        zz=rp*c0+cz; zx=rp*s0*c1+cx; zy=rp*s0*s1*c2+cy;
        z3=rp*s0*s1*s2*c3_+c3; z4=sp*c4_+c4; z5=sp*s4+c5;
    }
    return max(0.5 * log(max(r, EPS)) * r / max(dr, EPS), EPS);
}

// ============================================
// 7D Hyperbulb - FULLY UNROLLED with rotated basis
// ============================================

float sdf7D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float c6 = uOrigin[6] + pos.x*uBasisX[6] + pos.y*uBasisY[6] + pos.z*uBasisZ[6];
    float zx=cx,zy=cy,zz=cz,z3=c3,z4=c4,z5=c5,z6=c6;
    float dr=1.0, r=0.0;
    float minP=1000.0, minA=1000.0, minS=1000.0;
    int escIt=0;
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;
        r = sqrt(zx*zx+zy*zy+zz*zz+z3*z3+z4*z4+z5*z5+z6*z6);
        if (r > bail) { escIt=i; break; }
        minP=min(minP,abs(zy)); minA=min(minA,sqrt(zx*zx+zy*zy)); minS=min(minS,abs(r-0.8));
        dr = pow(max(r, EPS), pwr-1.0)*pwr*dr + 1.0;

        // 7D: 6 angles, z-axis primary (like Mandelbulb)
        float t0=acos(clamp(zz / max(r, EPS),-1.0,1.0));
        float r1=sqrt(zx*zx+zy*zy+z3*z3+z4*z4+z5*z5+z6*z6); float t1=r1>EPS?acos(clamp(zx / max(r1, EPS),-1.0,1.0)):0.0;
        float r2=sqrt(zy*zy+z3*z3+z4*z4+z5*z5+z6*z6); float t2=r2>EPS?acos(clamp(zy / max(r2, EPS),-1.0,1.0)):0.0;
        float r3=sqrt(z3*z3+z4*z4+z5*z5+z6*z6); float t3=r3>EPS?acos(clamp(z3 / max(r3, EPS),-1.0,1.0)):0.0;
        float r4=sqrt(z4*z4+z5*z5+z6*z6); float t4=r4>EPS?acos(clamp(z4 / max(r4, EPS),-1.0,1.0)):0.0;
        float t5=atan(z6,z5);

        float rp=pow(r,pwr);
        float s0=sin((t0+phaseT)*pwr),c0=cos((t0+phaseT)*pwr);
        float s1=sin((t1+phaseP)*pwr),c1=cos((t1+phaseP)*pwr);
        float s2=sin(t2*pwr),c2=cos(t2*pwr);
        float s3=sin(t3*pwr),c3_=cos(t3*pwr);
        float s4=sin(t4*pwr),c4_=cos(t4*pwr);
        float s5=sin(t5*pwr),c5_=cos(t5*pwr);

        float p0=rp, p1=p0*s0, p2=p1*s1, p3=p2*s2, p4=p3*s3, p5=p4*s4;
        zz=p0*c0+cz; zx=p1*c1+cx; zy=p2*c2+cy; z3=p3*c3_+c3; z4=p4*c4_+c4;
        z5=p5*c5_+c5; z6=p5*s5+c6;
        escIt=i;
    }
    trap = exp(-minP*5.0)*0.3 + exp(-minA*3.0)*0.2 + exp(-minS*8.0)*0.2 + float(escIt)/float(maxIt)*0.3;
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

float sdf7D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    // Mandelbulb mode: z starts at c (sample point)
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float c6 = uOrigin[6] + pos.x*uBasisX[6] + pos.y*uBasisY[6] + pos.z*uBasisZ[6];
    float zx=cx,zy=cy,zz=cz,z3=c3,z4=c4,z5=c5,z6=c6;
    float dr=1.0,r=0.0;
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    for(int i=0;i<MAX_ITER_HQ;i++){
        if(i>=maxIt)break;
        r=sqrt(zx*zx+zy*zy+zz*zz+z3*z3+z4*z4+z5*z5+z6*z6);
        if(r>bail)break;
        dr=pow(max(r, EPS), pwr-1.0)*pwr*dr+1.0;
        float t0=acos(clamp(zz / max(r, EPS),-1.0,1.0));
        float r1=sqrt(zx*zx+zy*zy+z3*z3+z4*z4+z5*z5+z6*z6);float t1=r1>EPS?acos(clamp(zx / max(r1, EPS),-1.0,1.0)):0.0;
        float r2=sqrt(zy*zy+z3*z3+z4*z4+z5*z5+z6*z6);float t2=r2>EPS?acos(clamp(zy / max(r2, EPS),-1.0,1.0)):0.0;
        float r3=sqrt(z3*z3+z4*z4+z5*z5+z6*z6);float t3=r3>EPS?acos(clamp(z3 / max(r3, EPS),-1.0,1.0)):0.0;
        float r4=sqrt(z4*z4+z5*z5+z6*z6);float t4=r4>EPS?acos(clamp(z4 / max(r4, EPS),-1.0,1.0)):0.0;
        float t5=atan(z6,z5);
        float rp=pow(r,pwr);
        float s0=sin((t0+phaseT)*pwr),c0=cos((t0+phaseT)*pwr),s1=sin((t1+phaseP)*pwr),c1=cos((t1+phaseP)*pwr);
        float s2=sin(t2*pwr),c2=cos(t2*pwr),s3=sin(t3*pwr),c3_=cos(t3*pwr);
        float s4=sin(t4*pwr),c4_=cos(t4*pwr),s5=sin(t5*pwr),c5_=cos(t5*pwr);
        float p0=rp,p1=p0*s0,p2=p1*s1,p3=p2*s2,p4=p3*s3,p5=p4*s4;
        zz=p0*c0+cz;zx=p1*c1+cx;zy=p2*c2+cy;z3=p3*c3_+c3;z4=p4*c4_+c4;z5=p5*c5_+c5;z6=p5*s5+c6;
    }
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

// ============================================
// 8D-11D: Array-based with rotated basis
// ============================================

float sdf8D(vec3 pos, float pwr, float bail, int maxIt, out float trap) {
    float c[8], z[8];
    // Mandelbulb mode: both z and c start at sample point
    for(int j=0;j<8;j++) {
        c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
        z[j]=c[j];
    }
    // Phase shifts for angular twisting
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    float dr=1.0,r=0.0,minP=1000.0,minA=1000.0,minS=1000.0;
    int escIt=0;

    for(int i=0;i<MAX_ITER_HQ;i++){
        if(i>=maxIt)break;
        r=sqrt(z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4]+z[5]*z[5]+z[6]*z[6]+z[7]*z[7]);
        if(r>bail){escIt=i;break;}
        minP=min(minP,abs(z[1]));minA=min(minA,sqrt(z[0]*z[0]+z[1]*z[1]));minS=min(minS,abs(r-0.8));
        dr=pow(max(r, EPS), pwr-1.0)*pwr*dr+1.0;

        // 8D: 7 angles - compute tails and angles
        float t[7];
        float tail=r;
        for(int k=0;k<6;k++){
            t[k]=acos(clamp(z[k] / max(tail, EPS),-1.0,1.0));
            tail=sqrt(max(tail*tail-z[k]*z[k],EPS));
        }
        t[6]=atan(z[7],z[6]);

        float rp=pow(r,pwr);
        // Apply phase shifts to first two angles (theta, phi)
        float s0 = sin((t[0]+phaseT)*pwr), c0 = cos((t[0]+phaseT)*pwr);
        float s1 = sin((t[1]+phaseP)*pwr), c1 = cos((t[1]+phaseP)*pwr);
        z[0]=rp*c0+c[0];
        float sp=rp*s0;
        z[1]=sp*c1+c[1];
        sp*=s1;
        for(int k=2;k<6;k++){
            z[k]=sp*cos(t[k]*pwr)+c[k];
            sp*=sin(t[k]*pwr);
        }
        z[6]=sp*cos(t[6]*pwr)+c[6];
        z[7]=sp*sin(t[6]*pwr)+c[7];
        escIt=i;
    }
    trap=exp(-minP*5.0)*0.3+exp(-minA*3.0)*0.2+exp(-minS*8.0)*0.2+float(escIt)/float(maxIt)*0.3;
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

float sdf8D_simple(vec3 pos, float pwr, float bail, int maxIt) {
    float c[8], z[8];
    // Mandelbulb mode: both z and c start at sample point
    for(int j=0;j<8;j++) {
        c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
        z[j]=c[j];
    }
    // Phase shifts for angular twisting
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    float dr=1.0,r=0.0;
    for(int i=0;i<MAX_ITER_HQ;i++){
        if(i>=maxIt)break;
        r=sqrt(z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4]+z[5]*z[5]+z[6]*z[6]+z[7]*z[7]);
        if(r>bail)break;
        dr=pow(max(r, EPS), pwr-1.0)*pwr*dr+1.0;
        float t[7];float tail=r;
        for(int k=0;k<6;k++){t[k]=acos(clamp(z[k] / max(tail, EPS),-1.0,1.0));tail=sqrt(max(tail*tail-z[k]*z[k],EPS));}
        t[6]=atan(z[7],z[6]);
        float rp=pow(r,pwr);
        // Apply phase shifts to first two angles (theta, phi)
        float s0=sin((t[0]+phaseT)*pwr),c0=cos((t[0]+phaseT)*pwr);
        float s1=sin((t[1]+phaseP)*pwr),c1=cos((t[1]+phaseP)*pwr);
        z[0]=rp*c0+c[0];
        float sp=rp*s0;
        z[1]=sp*c1+c[1];
        sp*=s1;
        for(int k=2;k<6;k++){z[k]=sp*cos(t[k]*pwr)+c[k];sp*=sin(t[k]*pwr);}
        z[6]=sp*cos(t[6]*pwr)+c[6];z[7]=sp*sin(t[6]*pwr)+c[7];
    }
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

// 9D-11D use array-based approach with rotated basis
float sdfHighD(vec3 pos, int D, float pwr, float bail, int maxIt, out float trap) {
    float c[11],z[11];
    // Mandelbulb mode: both z and c start at sample point
    for(int j=0;j<11;j++) {
        c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
        z[j]=c[j];
    }
    // Phase shifts for angular twisting
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    float dr=1.0,r=0.0,minP=1000.0,minA=1000.0,minS=1000.0;
    int escIt=0;

    for(int i=0;i<MAX_ITER_HQ;i++){
        if(i>=maxIt)break;

        // Compute r - unrolled for speed
        r=z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4];
        r+=z[5]*z[5]+z[6]*z[6]+z[7]*z[7]+z[8]*z[8]+z[9]*z[9]+z[10]*z[10];
        r=sqrt(r);

        if(r>bail){escIt=i;break;}
        minP=min(minP,abs(z[1]));minA=min(minA,sqrt(z[0]*z[0]+z[1]*z[1]));minS=min(minS,abs(r-0.8));
        dr=pow(max(r, EPS), pwr-1.0)*pwr*dr+1.0;

        // Compute angles
        float t[10];
        float tail2=r*r;
        for(int k=0;k<D-2;k++){
            float tail=sqrt(max(tail2,EPS));
            t[k]=acos(clamp(z[k] / max(tail, EPS),-1.0,1.0));
            tail2-=z[k]*z[k];
        }
        t[D-2]=atan(z[D-1],z[D-2]);

        // Power map and reconstruct with phase shifts on first two angles
        float rp=pow(r,pwr);
        float s0=sin((t[0]+phaseT)*pwr),c0=cos((t[0]+phaseT)*pwr);
        float s1=sin((t[1]+phaseP)*pwr),c1=cos((t[1]+phaseP)*pwr);
        z[0]=rp*c0+c[0];
        float sp=rp*s0;
        z[1]=sp*c1+c[1];
        sp*=s1;
        for(int k=2;k<D-2;k++){
            sp*=sin(t[k-1]*pwr);
            z[k]=sp*cos(t[k]*pwr)+c[k];
        }
        sp*=sin(t[D-3]*pwr);
        z[D-2]=sp*cos(t[D-2]*pwr)+c[D-2];
        z[D-1]=sp*sin(t[D-2]*pwr)+c[D-1];
        // Zero out unused dimensions
        for(int k=D;k<11;k++)z[k]=0.0;
        escIt=i;
    }
    trap=exp(-minP*5.0)*0.3+exp(-minA*3.0)*0.2+exp(-minS*8.0)*0.2+float(escIt)/float(maxIt)*0.3;
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

float sdfHighD_simple(vec3 pos, int D, float pwr, float bail, int maxIt) {
    float c[11],z[11];
    // Mandelbulb mode: both z and c start at sample point
    for(int j=0;j<11;j++) {
        c[j]=uOrigin[j]+pos.x*uBasisX[j]+pos.y*uBasisY[j]+pos.z*uBasisZ[j];
        z[j]=c[j];
    }
    // Phase shifts for angular twisting
    float phaseT = uPhaseEnabled ? uPhaseTheta : 0.0;
    float phaseP = uPhaseEnabled ? uPhasePhi : 0.0;

    float dr=1.0,r=0.0;

    for(int i=0;i<MAX_ITER_HQ;i++){
        if(i>=maxIt)break;
        r=z[0]*z[0]+z[1]*z[1]+z[2]*z[2]+z[3]*z[3]+z[4]*z[4];
        r+=z[5]*z[5]+z[6]*z[6]+z[7]*z[7]+z[8]*z[8]+z[9]*z[9]+z[10]*z[10];
        r=sqrt(r);
        if(r>bail)break;
        dr=pow(max(r, EPS), pwr-1.0)*pwr*dr+1.0;

        float t[10];float tail2=r*r;
        for(int k=0;k<D-2;k++){float tail=sqrt(max(tail2,EPS));t[k]=acos(clamp(z[k] / max(tail, EPS),-1.0,1.0));tail2-=z[k]*z[k];}
        t[D-2]=atan(z[D-1],z[D-2]);

        float rp=pow(r,pwr);
        // Apply phase shifts to first two angles (theta, phi)
        float s0=sin((t[0]+phaseT)*pwr),c0=cos((t[0]+phaseT)*pwr);
        float s1=sin((t[1]+phaseP)*pwr),c1=cos((t[1]+phaseP)*pwr);
        z[0]=rp*c0+c[0];
        float sp=rp*s0;
        z[1]=sp*c1+c[1];
        sp*=s1;
        for(int k=2;k<D-2;k++){sp*=sin(t[k-1]*pwr);z[k]=sp*cos(t[k]*pwr)+c[k];}
        sp*=sin(t[D-3]*pwr);
        z[D-2]=sp*cos(t[D-2]*pwr)+c[D-2];
        z[D-1]=sp*sin(t[D-2]*pwr)+c[D-1];
        for(int k=D;k<11;k++)z[k]=0.0;
    }
    return max(0.5*log(max(r,EPS))*r/max(dr,EPS),EPS);
}

// ============================================
// Dispatch to dimension-specific SDF
// ============================================

float GetDist(vec3 pos) {
    float pwr = getEffectivePower();
    float bail = max(uEscapeRadius, 2.0);
    // Use reduced iterations in fast mode for better performance
    int maxIterLimit = uFastMode ? MAX_ITER_LQ : MAX_ITER_HQ;
    int maxIt = int(min(uIterations, float(maxIterLimit)));

    if (uDimension == 3) return sdf3D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 4) return sdf4D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 5) return sdf5D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 6) return sdf6D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 7) return sdf7D_simple(pos, pwr, bail, maxIt);
    if (uDimension == 8) return sdf8D_simple(pos, pwr, bail, maxIt);
    return sdfHighD_simple(pos, uDimension, pwr, bail, maxIt);
}

float GetDistWithTrap(vec3 pos, out float trap) {
    float pwr = getEffectivePower();
    float bail = max(uEscapeRadius, 2.0);
    // Calculate iteration limit based on performance mode and quality multiplier
    // Fast mode: use LQ settings immediately
    // Normal mode: interpolate between LQ and HQ based on quality multiplier (0.25-1.0)
    int maxIterLimit;
    if (uFastMode) {
        maxIterLimit = MAX_ITER_LQ;
    } else {
        // Progressive refinement: interpolate iterations based on quality multiplier
        // At 0.25: use LQ iterations, at 1.0: use HQ iterations
        float t = clamp((uQualityMultiplier - 0.25) / 0.75, 0.0, 1.0);
        maxIterLimit = int(mix(float(MAX_ITER_LQ), float(MAX_ITER_HQ), t));
    }
    int maxIt = int(min(uIterations, float(maxIterLimit)));

    if (uDimension == 3) return sdf3D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 4) return sdf4D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 5) return sdf5D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 6) return sdf6D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 7) return sdf7D(pos, pwr, bail, maxIt, trap);
    if (uDimension == 8) return sdf8D(pos, pwr, bail, maxIt, trap);
    return sdfHighD(pos, uDimension, pwr, bail, maxIt, trap);
}

// ============================================
// Temporal Reprojection
// ============================================

/**
 * Reproject current pixel to previous frame and sample depth.
 * Returns the reprojected depth distance, or -1.0 if invalid.
 *
 * The temporal depth buffer stores linear depth normalized to [0, 1]:
 *   stored = linearDepth / farClip
 *
 * To recover world-space distance:
 *   worldDepth = stored * farClip
 *
 * @param ro Ray origin in model space
 * @param rd Ray direction in model space (normalized)
 * @param worldRayDir Ray direction in world space (for reprojection)
 * @return Reprojected depth distance in model space, or -1.0 if invalid
 */
float getTemporalDepth(vec3 ro, vec3 rd, vec3 worldRayDir) {
    if (!uTemporalEnabled) return -1.0;

    // Estimate a world-space point along the ray at an average expected distance
    // Use the bounding sphere radius as a reasonable estimate
    float estimatedWorldDist = BOUND_R * 1.5;
    vec3 estimatedWorldHit = uCameraPosition + worldRayDir * estimatedWorldDist;

    // Transform estimated hit point to previous frame's clip space
    vec4 prevClipPos = uPrevViewProjectionMatrix * vec4(estimatedWorldHit, 1.0);

    // Perspective divide to get NDC
    vec2 prevNDC = prevClipPos.xy / prevClipPos.w;

    // Convert from NDC [-1, 1] to UV [0, 1]
    vec2 prevUV = prevNDC * 0.5 + 0.5;

    // Check if point is visible in previous frame
    if (prevUV.x < 0.0 || prevUV.x > 1.0 || prevUV.y < 0.0 || prevUV.y > 1.0) {
        return -1.0;  // Off-screen in previous frame
    }

    // Sample previous depth (stored as normalized linear depth)
    float normalizedDepth = texture(uPrevDepthTexture, prevUV).r;

    // Validate depth (0 means no hit or sky)
    if (normalizedDepth <= 0.001 || normalizedDepth >= 0.999) {
        return -1.0;
    }

    // Disocclusion detection: check for depth discontinuities
    // Large differences with neighbors indicate unreliable temporal data
    vec2 texelSize = 1.0 / uDepthBufferResolution;
    float depthLeft = texture(uPrevDepthTexture, prevUV - vec2(texelSize.x, 0.0)).r;
    float depthRight = texture(uPrevDepthTexture, prevUV + vec2(texelSize.x, 0.0)).r;
    float depthUp = texture(uPrevDepthTexture, prevUV + vec2(0.0, texelSize.y)).r;
    float depthDown = texture(uPrevDepthTexture, prevUV - vec2(0.0, texelSize.y)).r;

    float maxNeighborDiff = max(
        max(abs(normalizedDepth - depthLeft), abs(normalizedDepth - depthRight)),
        max(abs(normalizedDepth - depthUp), abs(normalizedDepth - depthDown))
    );

    // Threshold for disocclusion detection (tuned for normalized depth)
    // 0.05 corresponds to ~5% of far clip depth difference
    if (maxNeighborDiff > 0.05) {
        return -1.0;  // Depth discontinuity - temporal data unreliable
    }

    // Convert from normalized depth to world-space distance
    float worldDepth = normalizedDepth * uCameraFar;

    // Convert world-space depth to model-space ray distance
    // This is an approximation assuming uniform scale
    float modelDepth = worldDepth;

    // Apply safety margin - step back 5% to handle surface movement
    return max(0.0, modelDepth * 0.95);
}

// ============================================
// Raymarching & Rendering
// ============================================

vec2 intersectSphere(vec3 ro, vec3 rd, float radius) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

float RayMarch(vec3 ro, vec3 rd, vec3 worldRayDir, out float trap, out bool usedTemporal) {
    trap = 0.0;
    usedTemporal = false;
    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) return maxDist + 1.0;

    float dO = max(0.0, tSphere.x);
    float maxT = min(tSphere.y, maxDist);

    // Temporal Reprojection: Use previous frame's depth as starting point
    // This can skip many empty-space march steps
    float temporalDepth = getTemporalDepth(ro, rd, worldRayDir);
    if (temporalDepth > 0.0 && temporalDepth < maxT) {
        // Start from the temporal hint, with safety margin
        // We step back slightly in case the surface moved closer
        float temporalStart = max(dO, temporalDepth * 0.95);
        dO = temporalStart;
        usedTemporal = true;
    }

    // Calculate march steps and surface distance based on performance mode and quality multiplier
    // Fast mode: use LQ settings immediately
    // Normal mode: interpolate between LQ and HQ based on quality multiplier (0.25-1.0)
    int maxSteps;
    float surfDist;
    float omega;

    if (uFastMode) {
        maxSteps = MAX_MARCH_STEPS_LQ;
        surfDist = SURF_DIST_LQ;
        omega = 1.0;  // No overrelaxation in fast mode (already fast)
    } else {
        // Progressive refinement: interpolate based on quality multiplier
        float t = clamp((uQualityMultiplier - 0.25) / 0.75, 0.0, 1.0);
        maxSteps = int(mix(float(MAX_MARCH_STEPS_LQ), float(MAX_MARCH_STEPS_HQ), t));
        surfDist = mix(SURF_DIST_LQ, SURF_DIST_HQ, t);
        omega = mix(1.0, 1.2, t);  // Gradually enable overrelaxation as quality increases
    }

    // Relaxed sphere tracing with overrelaxation
    // omega > 1 allows larger steps, reducing total march count
    // Safety: if we overstep, fall back to conservative stepping
    float prevDist = 1e10;

    // Loop uses max possible steps, early exit via maxSteps check
    for (int i = 0; i < MAX_MARCH_STEPS_HQ; i++) {
        if (i >= maxSteps) break;

        vec3 p = ro + rd * dO;
        float currentTrap;
        float dS = GetDistWithTrap(p, currentTrap);

        if (dS < surfDist) { trap = currentTrap; return dO; }

        // Relaxed sphere tracing: take larger steps when safe
        float step = dS * omega;

        // Safety check: if step would be larger than previous distance,
        // we might have overstepped - use conservative step instead
        if (step > prevDist + dS) {
            step = dS;  // Conservative fallback
        }

        dO += step;
        prevDist = dS;

        if (dO > maxT) break;
    }
    return maxDist + 1.0;
}

/**
 * RayMarch without temporal reprojection - used as fallback when temporal skip misses.
 * This prevents feedback loops where temporal hints cause persistent misses.
 */
float RayMarchNoTemporal(vec3 ro, vec3 rd, out float trap) {
    trap = 0.0;
    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) return maxDist + 1.0;

    float dO = max(0.0, tSphere.x);
    float maxT = min(tSphere.y, maxDist);

    // No temporal reprojection - start from sphere intersection

    int maxSteps;
    float surfDist;
    float omega;

    if (uFastMode) {
        maxSteps = MAX_MARCH_STEPS_LQ;
        surfDist = SURF_DIST_LQ;
        omega = 1.0;
    } else {
        float t = clamp((uQualityMultiplier - 0.25) / 0.75, 0.0, 1.0);
        maxSteps = int(mix(float(MAX_MARCH_STEPS_LQ), float(MAX_MARCH_STEPS_HQ), t));
        surfDist = mix(SURF_DIST_LQ, SURF_DIST_HQ, t);
        omega = mix(1.0, 1.2, t);
    }

    float prevDist = 1e10;

    for (int i = 0; i < MAX_MARCH_STEPS_HQ; i++) {
        if (i >= maxSteps) break;

        vec3 p = ro + rd * dO;
        float currentTrap;
        float dS = GetDistWithTrap(p, currentTrap);

        if (dS < surfDist) { trap = currentTrap; return dO; }

        float step = dS * omega;
        if (step > prevDist + dS) {
            step = dS;
        }

        dO += step;
        prevDist = dS;

        if (dO > maxT) break;
    }
    return maxDist + 1.0;
}

// Standard normal calculation (4 SDF evaluations)
vec3 GetNormal(vec3 p) {
    float d = GetDist(p);
    vec2 e = vec2(0.001, 0);
    return normalize(d - vec3(GetDist(p-e.xyy), GetDist(p-e.yxy), GetDist(p-e.yyx)));
}

// Faster normal calculation with larger epsilon (smoother but faster)
vec3 GetNormalFast(vec3 p) {
    vec2 e = vec2(0.005, 0);  // Larger epsilon = fewer iterations needed
    float d = GetDist(p);
    return normalize(d - vec3(GetDist(p-e.xyy), GetDist(p-e.yxy), GetDist(p-e.yyx)));
}

// Ambient occlusion (3 SDF evaluations)
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    occ += (0.02 - GetDist(p + 0.02 * n));
    occ += (0.08 - GetDist(p + 0.08 * n)) * 0.7;
    occ += (0.16 - GetDist(p + 0.16 * n)) * 0.5;
    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

// Soft shadow calculation - traces toward light to find occlusion
float calcSoftShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 24; i++) {
        if (t > maxt) break;
        float h = GetDist(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += clamp(h, 0.01, 0.2);
    }
    return clamp(res, 0.0, 1.0);
}

// Quality-aware soft shadow with variable sample count and improved penumbra
// quality: 0=low(8), 1=medium(16), 2=high(24), 3=ultra(32)
// softness: 0.0-2.0 controls penumbra size (0=hard, 2=very soft)
float calcSoftShadowQuality(vec3 ro, vec3 rd, float mint, float maxt, float softness, int quality) {
    // Sample counts based on quality level
    int maxSteps = 8 + quality * 8;

    float res = 1.0;
    float t = mint;
    float ph = 1e10;

    // Softness affects penumbra size (k parameter)
    // softness=0 -> k=64 (hard shadows), softness=2 -> k=4 (very soft)
    float k = mix(64.0, 4.0, softness * 0.5);

    // Unrolled loop with max 32 iterations (ultra quality)
    for (int i = 0; i < 32; i++) {
        if (i >= maxSteps || t > maxt) break;

        float h = GetDist(ro + rd * t);
        if (h < 0.001) return 0.0;

        // Improved soft shadow technique (Inigo Quilez)
        float y = h * h / (2.0 * ph);
        float d = sqrt(h * h - y * y);
        res = min(res, k * d / max(0.0, t - y));
        ph = h;

        t += clamp(h, 0.02, 0.25);
    }
    return clamp(res, 0.0, 1.0);
}

// Compute rotation matrix from basis vectors for light transformation
// The basis vectors define the orientation of the 3D slice in D-space
// We use the first 3 components to build a 3x3 rotation matrix
mat3 getBasisRotation() {
    // Extract 3x3 from basis vectors (they form columns of the rotation matrix)
    vec3 bx = vec3(uBasisX[0], uBasisX[1], uBasisX[2]);
    vec3 by = vec3(uBasisY[0], uBasisY[1], uBasisY[2]);
    vec3 bz = vec3(uBasisZ[0], uBasisZ[1], uBasisZ[2]);

    // Build rotation matrix (basis vectors as columns)
    // This transforms from world space to object space
    return mat3(bx, by, bz);
}

// ============================================
// Multi-Light System Helper Functions
// ============================================

/**
 * Calculate light direction for a given light index.
 * Returns normalized direction FROM fragment TO light source.
 */
vec3 getLightDirection(int lightIndex, vec3 fragPos) {
    int lightType = uLightTypes[lightIndex];

    if (lightType == LIGHT_TYPE_POINT) {
        return normalize(uLightPositions[lightIndex] - fragPos);
    }
    else if (lightType == LIGHT_TYPE_DIRECTIONAL) {
        // Directional lights: use the stored direction (pointing toward surface)
        return normalize(uLightDirections[lightIndex]);
    }
    else if (lightType == LIGHT_TYPE_SPOT) {
        return normalize(uLightPositions[lightIndex] - fragPos);
    }

    return vec3(0.0, 1.0, 0.0);
}

/**
 * Calculate spot light cone attenuation with penumbra falloff.
 * Uses precomputed cosines (uSpotCosInner/uSpotCosOuter) to avoid per-fragment trig.
 */
float getSpotAttenuation(int lightIndex, vec3 lightToFrag) {
    float cosAngle = dot(lightToFrag, normalize(uLightDirections[lightIndex]));
    return smoothstep(uSpotCosOuter[lightIndex], uSpotCosInner[lightIndex], cosAngle);
}

/**
 * Calculate distance attenuation for point and spot lights.
 * range = 0: infinite range (no falloff)
 * range > 0: light reaches zero intensity at this distance
 * decay = 0: no decay, 1: linear, 2: physically correct inverse square
 */
float getDistanceAttenuation(int lightIndex, float distance) {
    float range = uLightRanges[lightIndex];
    float decay = uLightDecays[lightIndex];

    // No distance falloff when range is 0 (infinite range)
    if (range <= 0.0) {
        return 1.0;
    }

    // Clamp distance to prevent division by zero
    float d = max(distance, 0.0001);

    // Three.js attenuation formula
    float rangeAttenuation = clamp(1.0 - d / range, 0.0, 1.0);
    return pow(rangeAttenuation, decay);
}

// ============================================
// Opacity Mode Functions
// ============================================

/**
 * Solid mode: fully opaque (alpha = 1.0)
 */
float calculateSolidAlpha() {
    return 1.0;
}

/**
 * Simple alpha mode: uniform transparency
 */
float calculateSimpleAlpha() {
    return uSimpleAlpha;
}

/**
 * Layered surfaces mode: calculate alpha based on ray depth and layer count
 * Creates visible depth layers by modulating alpha based on hit distance
 * @param depth - Distance from ray origin to hit point
 * @param maxDepth - Maximum ray distance (for normalization)
 */
float calculateLayeredAlpha(float depth, float maxDepth) {
    // Normalize depth to 0-1 range
    float normalizedDepth = clamp(depth / maxDepth, 0.0, 1.0);

    // Calculate which layer this hit belongs to
    float layerSize = 1.0 / float(uLayerCount);
    int layerIndex = int(normalizedDepth / layerSize);
    layerIndex = min(layerIndex, uLayerCount - 1);

    // Base alpha from layer opacity setting
    float alpha = uLayerOpacity;

    // Slight gradation: outer layers (lower index) are slightly more opaque
    // This creates visual depth distinction between layers
    float layerFactor = 1.0 - float(layerIndex) * 0.1;
    alpha *= layerFactor;

    return clamp(alpha, 0.1, 1.0);
}

/**
 * Volumetric density mode: cloud-like accumulation based on distance in volume
 * @param distanceInVolume - How far the ray traveled inside the fractal volume
 */
float calculateVolumetricAlpha(float distanceInVolume) {
    // Determine sample quality (affects density accumulation rate)
    // Higher quality = more samples = smoother gradients
    float densityMultiplier = 1.0;

    // Check if we should reduce quality during animation
    bool reduceQuality = uFastMode && uVolumetricReduceOnAnim;

    if (reduceQuality) {
        // Reduced quality during animation for performance
        densityMultiplier = 0.5;
    } else {
        // Apply sample quality setting
        if (uSampleQuality == 0) {
            densityMultiplier = 0.6;  // Low: less dense
        } else if (uSampleQuality == 2) {
            densityMultiplier = 1.5;  // High: more dense
        }
        // Medium (1) stays at 1.0
    }

    // Beer-Lambert law for volume absorption
    // alpha = 1 - exp(-density * distance)
    float effectiveDensity = uVolumetricDensity * densityMultiplier;
    float alpha = 1.0 - exp(-effectiveDensity * distanceInVolume);

    return clamp(alpha, 0.0, 1.0);
}

/**
 * Dispatch to appropriate opacity calculation based on mode
 * @param hitDist - Distance from ray origin to hit point
 * @param sphereEntry - Distance where ray enters the bounding sphere
 * @param maxDepth - Maximum possible ray distance
 */
float calculateOpacityAlpha(float hitDist, float sphereEntry, float maxDepth) {
    if (uOpacityMode == OPACITY_SOLID) {
        return calculateSolidAlpha();
    } else if (uOpacityMode == OPACITY_SIMPLE_ALPHA) {
        return calculateSimpleAlpha();
    } else if (uOpacityMode == OPACITY_LAYERED) {
        return calculateLayeredAlpha(hitDist, maxDepth);
    } else if (uOpacityMode == OPACITY_VOLUMETRIC) {
        // Calculate distance traveled inside the bounding sphere
        float distanceInVolume = hitDist - max(0.0, sphereEntry);
        return calculateVolumetricAlpha(distanceInVolume);
    }
    // Fallback to solid
    return 1.0;
}

void main() {
    vec3 ro = (uInverseModelMatrix * vec4(uCameraPosition, 1.0)).xyz;
    vec3 worldRayDir = normalize(vPosition - uCameraPosition);
    vec3 rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);

    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    // Compute sphere intersection for opacity calculations
    // sphereEntry is where the ray enters the bounding sphere (0 if camera inside)
    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    float sphereEntry = max(0.0, tSphere.x);

    float trap;
    bool usedTemporal;
    float d = RayMarch(ro, rd, worldRayDir, trap, usedTemporal);

    // If temporal skip caused a miss, retry without temporal (prevents feedback loop)
    if (d > maxDist && usedTemporal) {
        usedTemporal = false;
        d = RayMarchNoTemporal(ro, rd, trap);
    }

    if (d > maxDist) discard;

    vec3 p = ro + rd * d;

    // Use faster normal calculation in fast mode
    vec3 n = uFastMode ? GetNormalFast(p) : GetNormal(p);

    // Skip AO calculation in fast mode (saves 3 SDF evaluations)
    float ao = uFastMode ? 1.0 : calcAO(p, n);

    // Convert base color to HSL (needed for legacy algorithm)
    vec3 baseHSL = rgb2hsl(uColor);

    // Get color using the selected algorithm
    // Invert trap: high trap in crevices, but we want peaks bright, valleys dark
    float t = 1.0 - trap;
    vec3 surfaceColor = getColorByAlgorithm(t, n, baseHSL, p);
    surfaceColor *= (0.3 + 0.7 * ao);

    // Lighting calculation using multi-light system
    // Start with ambient
    vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;
    vec3 viewDir = -rd;

    // Accumulator for total light contribution (for fresnel rim calculation)
    float totalNdotL = 0.0;

    // Loop over all active lights
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uNumLights) break;
        if (!uLightsEnabled[i]) continue;

        // Get light direction based on light type
        vec3 l = getLightDirection(i, p);
        float attenuation = uLightIntensities[i];

        // Apply distance attenuation for point and spot lights
        int lightType = uLightTypes[i];
        if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
            float distance = length(uLightPositions[i] - p);
            attenuation *= getDistanceAttenuation(i, distance);
        }

        // Apply spot light cone attenuation
        if (lightType == LIGHT_TYPE_SPOT) {
            vec3 lightToFrag = normalize(p - uLightPositions[i]);
            attenuation *= getSpotAttenuation(i, lightToFrag);
        }

        // Skip negligible contributions
        if (attenuation < 0.001) continue;

        // Calculate shadow
        // uShadowAnimationMode: 0=pause (skip in fast mode), 1=low (use low quality), 2=full
        float shadow = 1.0;
        if (uShadowEnabled) {
            bool shouldRenderShadow = !uFastMode || uShadowAnimationMode > 0;

            if (shouldRenderShadow) {
                vec3 shadowOrigin = p + n * 0.02; // Offset to avoid self-shadowing
                vec3 shadowDir = l;
                float shadowMaxDist;

                if (lightType == LIGHT_TYPE_DIRECTIONAL) {
                    shadowMaxDist = 10.0;
                } else {
                    shadowMaxDist = length(uLightPositions[i] - p);
                }

                // Determine quality to use
                int effectiveQuality = uShadowQuality;
                if (uFastMode && uShadowAnimationMode == 1) {
                    effectiveQuality = 0; // Force low quality during animation
                }

                // For spot lights, only calculate shadow if within cone
                if (lightType == LIGHT_TYPE_SPOT) {
                    vec3 lightToFrag = normalize(p - uLightPositions[i]);
                    float spotEffect = getSpotAttenuation(i, lightToFrag);
                    if (spotEffect > 0.001) {
                        shadow = calcSoftShadowQuality(shadowOrigin, shadowDir, 0.02, shadowMaxDist, uShadowSoftness, effectiveQuality);
                    }
                } else {
                    shadow = calcSoftShadowQuality(shadowOrigin, shadowDir, 0.02, shadowMaxDist, uShadowSoftness, effectiveQuality);
                }
            }
        }

        // Diffuse (Lambert) with shadow
        float NdotL = max(dot(n, l), 0.0);
        col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;

        // Specular (Blinn-Phong) with shadow
        vec3 halfDir = normalize(l + viewDir);
        float NdotH = max(dot(n, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation * shadow;
        col += uSpecularColor * uLightColors[i] * spec;

        // Track total light for fresnel calculation
        totalNdotL = max(totalNdotL, NdotL * attenuation);
    }

    // Fresnel rim lighting (controlled by Edges render mode)
    // Uses combined light contribution from all lights
    if (uFresnelEnabled && uFresnelIntensity > 0.0) {
        float NdotV = max(dot(n, viewDir), 0.0);
        float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
        // Rim is stronger on lit side (use total light contribution)
        rim *= (0.3 + 0.7 * totalNdotL);
        col += uRimColor * rim;
    }

    // Tone mapping is applied by post-processing OutputPass

    vec4 worldHitPos = uModelMatrix * vec4(p, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    gl_FragDepth = clamp((clipPos.z / clipPos.w) * 0.5 + 0.5, 0.0, 1.0);

    // Calculate opacity based on selected mode
    float alpha = calculateOpacityAlpha(d, sphereEntry, maxDist);

    // Output to MRT (Multiple Render Targets)
    // gColor: Color buffer (RGBA)
    // gNormal: Normal buffer (RGB = normal * 0.5 + 0.5, A = reflectivity/metallic)
    gColor = vec4(col, alpha);
    gNormal = vec4(n * 0.5 + 0.5, uMetallic);
}
