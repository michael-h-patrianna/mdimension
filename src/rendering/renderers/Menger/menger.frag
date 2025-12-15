// ============================================
// Menger Sponge Fragment Shader
// D-dimensional (3D-11D) raymarching
// Uses KIFS fold operations for true SDF
// ============================================

precision highp float;

// MRT output declarations for WebGL2
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;

// Material property for G-buffer (reflectivity for SSR)
uniform float uMetallic;

uniform vec3 uCameraPosition;
uniform float uIterations;      // Recursion depth (3-8)
uniform float uScale;           // Bounding box scale
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
uniform bool uToneMappingEnabled;
uniform int uToneMappingAlgorithm;
uniform float uExposure;

// Fresnel rim lighting uniforms
uniform bool uFresnelEnabled;
uniform float uFresnelIntensity;
uniform vec3 uRimColor;

// Advanced Color System uniforms
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

// Performance mode
uniform bool uFastMode;

// Progressive refinement quality multiplier (0.25-1.0)
// Used for fine-grained quality control after interaction stops
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

// Dimension Mixing uniforms (Technique A - shear matrix inside iteration)
// Note: Actual shader implementation pending - uniforms reserved for future use
uniform bool uDimensionMixEnabled;
uniform float uMixIntensity;          // 0.0-0.3 strength of mixing
uniform float uMixTime;               // Animated time for mixing matrix

// Fold Twist Animation
uniform bool uFoldTwistEnabled;
uniform float uFoldTwistAngle;  // Current angle (includes time if animated)

in vec3 vPosition;
in vec2 vUv;

// Performance constants
#define MAX_MARCH_STEPS_HQ 128
#define MAX_ITER_HQ 8
#define SURF_DIST_HQ 0.001

#define MAX_MARCH_STEPS_LQ 64
#define MAX_ITER_LQ 4
#define SURF_DIST_LQ 0.003

#define BOUND_R 2.0
#define EPS 1e-6
#define PI 3.14159265359

// Opacity modes
#define OPACITY_SOLID 0
#define OPACITY_SIMPLE_ALPHA 1
#define OPACITY_LAYERED 2
#define OPACITY_VOLUMETRIC 3

// ============================================
// Color utilities
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

// ============================================
// Cosine Gradient Palette Functions
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
  if (uColorAlgorithm == 0) {
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    float newL = 0.3 + distributedT * 0.4;
    return hsl2rgb(vec3(baseHSL.x, baseHSL.y, newL));
  } else if (uColorAlgorithm == 1) {
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    float hueOffset = (distributedT - 0.5) * 0.167;
    float newH = fract(baseHSL.x + hueOffset);
    return hsl2rgb(vec3(newH, baseHSL.y, baseHSL.z));
  } else if (uColorAlgorithm == 2) {
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 3) {
    float normalT = normal.y * 0.5 + 0.5;
    return getCosinePaletteColor(normalT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 4) {
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 5) {
    float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
    return lchColor(distributedT, uLchLightness, uLchChroma);
  } else if (uColorAlgorithm == 6) {
    // Multi-source color blending: depth (t), orbitTrap, and normal
    // Note: For raymarched fractals, orbitTrap comes from the SDF calculation
    // Here we use trap value passed via the 't' parameter as depth proxy
    float totalWeight = uMultiSourceWeights.x + uMultiSourceWeights.y + uMultiSourceWeights.z;
    vec3 w = uMultiSourceWeights / max(totalWeight, 0.001);
    float normalValue = normal.y * 0.5 + 0.5;
    // w.x = depth weight, w.y = orbitTrap weight (use position-based trap), w.z = normal weight
    float orbitTrap = clamp(length(position) / BOUND_R, 0.0, 1.0);
    float blendedT = w.x * t + w.y * orbitTrap + w.z * normalValue;
    return getCosinePaletteColor(blendedT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else if (uColorAlgorithm == 7) {
    float radialT = clamp(length(position) / BOUND_R, 0.0, 1.0);
    return getCosinePaletteColor(radialT, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  } else {
    return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD,
                                  uDistPower, uDistCycles, uDistOffset);
  }
}

// ============================================
// Tone Mapping Functions
// ============================================

vec3 reinhardToneMap(vec3 c) {
    return c / (c + vec3(1.0));
}

vec3 acesToneMap(vec3 c) {
    const float a = 2.51;
    const float b = 0.03;
    const float c2 = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((c * (a * c + b)) / (c * (c2 * c + d) + e), 0.0, 1.0);
}

vec3 uncharted2ToneMap(vec3 c) {
    const float A = 0.15;
    const float B = 0.50;
    const float C = 0.10;
    const float D = 0.20;
    const float E = 0.02;
    const float F = 0.30;
    const float W = 11.2;
    vec3 curr = ((c * (A * c + C * B) + D * E) / (c * (A * c + B) + D * F)) - E / F;
    vec3 white = ((vec3(W) * (A * W + C * B) + D * E) / (vec3(W) * (A * W + B) + D * F)) - E / F;
    return curr / white;
}

vec3 applyToneMapping(vec3 c, int algo, float exposure) {
    vec3 exposed = c * exposure;
    if (algo == 0) return reinhardToneMap(exposed);
    if (algo == 1) return acesToneMap(exposed);
    if (algo == 2) return uncharted2ToneMap(exposed);
    return clamp(exposed, 0.0, 1.0);
}

// ============================================
// Menger Sponge Core Operations
// Classic IQ-style Menger with cross subtraction
// ============================================

// 3D Box SDF
float sdBox3D(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

// 3D Menger SDF - Classic IQ algorithm
float mengerSDF3D(vec3 pos, float boundScale, int maxIter, out float trap) {
    // Transform to D-dimensional space and back to 3D slice
    vec3 p = vec3(
        uOrigin[0] + pos.x * uBasisX[0] + pos.y * uBasisY[0] + pos.z * uBasisZ[0],
        uOrigin[1] + pos.x * uBasisX[1] + pos.y * uBasisY[1] + pos.z * uBasisZ[1],
        uOrigin[2] + pos.x * uBasisX[2] + pos.y * uBasisY[2] + pos.z * uBasisZ[2]
    ) / boundScale;

    // Start with unit box
    float d = sdBox3D(p, vec3(1.0));
    trap = length(p);

    float s = 1.0;
    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIter) break;

        // Modulo folding into repeating unit cell
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= 3.0;

        // Apply fold twist rotation if enabled
        if (uFoldTwistEnabled) {
            float cs = cos(uFoldTwistAngle);
            float sn = sin(uFoldTwistAngle);
            a.xy = mat2(cs, -sn, sn, cs) * a.xy;
        }

        // Create cross-shaped hole
        vec3 r = abs(1.0 - 3.0 * abs(a));

        // Cross distance: min of the three axis-aligned infinite beams
        float da = max(r.x, r.y);
        float db = max(r.y, r.z);
        float dc = max(r.z, r.x);
        float crossDist = (min(da, min(db, dc)) - 1.0) / s;

        // Union with cross (subtract cross from box)
        d = max(d, crossDist);

        // Track trap for coloring
        trap = min(trap, length(a));
    }

    return d * boundScale;
}

// 4D Menger SDF - Extended cross subtraction
float mengerSDF4D(vec3 pos, float boundScale, int maxIter, out float trap) {
    vec4 p = vec4(
        uOrigin[0] + pos.x * uBasisX[0] + pos.y * uBasisY[0] + pos.z * uBasisZ[0],
        uOrigin[1] + pos.x * uBasisX[1] + pos.y * uBasisY[1] + pos.z * uBasisZ[1],
        uOrigin[2] + pos.x * uBasisX[2] + pos.y * uBasisY[2] + pos.z * uBasisZ[2],
        uOrigin[3] + pos.x * uBasisX[3] + pos.y * uBasisY[3] + pos.z * uBasisZ[3]
    ) / boundScale;

    // 4D box distance
    vec4 q = abs(p) - vec4(1.0);
    float d = min(max(q.x, max(q.y, max(q.z, q.w))), 0.0) + length(max(q, 0.0));
    trap = length(p);

    float s = 1.0;
    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIter) break;

        vec4 a = mod(p * s, 2.0) - 1.0;
        s *= 3.0;

        // Apply fold twist rotation if enabled
        if (uFoldTwistEnabled) {
            float cs = cos(uFoldTwistAngle);
            float sn = sin(uFoldTwistAngle);
            a.xy = mat2(cs, -sn, sn, cs) * a.xy;
        }

        vec4 r = abs(1.0 - 3.0 * abs(a));

        // 4D cross: need 2 of 4 coords to be < 1 (6 combinations)
        float d01 = max(r.x, r.y);
        float d02 = max(r.x, r.z);
        float d03 = max(r.x, r.w);
        float d12 = max(r.y, r.z);
        float d13 = max(r.y, r.w);
        float d23 = max(r.z, r.w);
        float crossDist = (min(min(min(d01, d02), min(d03, d12)), min(d13, d23)) - 1.0) / s;

        d = max(d, crossDist);
        trap = min(trap, length(a));
    }

    return d * boundScale;
}

// 5D Menger SDF
float mengerSDF5D(vec3 pos, float boundScale, int maxIter, out float trap) {
    float pArr[5];
    pArr[0] = (uOrigin[0] + pos.x * uBasisX[0] + pos.y * uBasisY[0] + pos.z * uBasisZ[0]) / boundScale;
    pArr[1] = (uOrigin[1] + pos.x * uBasisX[1] + pos.y * uBasisY[1] + pos.z * uBasisZ[1]) / boundScale;
    pArr[2] = (uOrigin[2] + pos.x * uBasisX[2] + pos.y * uBasisY[2] + pos.z * uBasisZ[2]) / boundScale;
    pArr[3] = (uOrigin[3] + pos.x * uBasisX[3] + pos.y * uBasisY[3] + pos.z * uBasisZ[3]) / boundScale;
    pArr[4] = (uOrigin[4] + pos.x * uBasisX[4] + pos.y * uBasisY[4] + pos.z * uBasisZ[4]) / boundScale;

    // 5D box distance
    float d = -1.0;
    float len2 = 0.0;
    for (int i = 0; i < 5; i++) {
        d = max(d, abs(pArr[i]) - 1.0);
        len2 += pArr[i] * pArr[i];
    }
    trap = sqrt(len2);

    float s = 1.0;
    for (int iter = 0; iter < MAX_ITER_HQ; iter++) {
        if (iter >= maxIter) break;

        float a[5];
        float r[5];
        for (int i = 0; i < 5; i++) {
            a[i] = mod(pArr[i] * s, 2.0) - 1.0;
        }
        s *= 3.0;

        // Apply fold twist rotation if enabled (rotate first two coords)
        if (uFoldTwistEnabled) {
            float cs = cos(uFoldTwistAngle);
            float sn = sin(uFoldTwistAngle);
            float a0 = a[0] * cs - a[1] * sn;
            float a1 = a[0] * sn + a[1] * cs;
            a[0] = a0;
            a[1] = a1;
        }

        for (int i = 0; i < 5; i++) {
            r[i] = abs(1.0 - 3.0 * abs(a[i]));
        }

        // Find second smallest r value (cross = 2 smallest coords < 1)
        float smallest = 1e10;
        float secondSmallest = 1e10;
        for (int i = 0; i < 5; i++) {
            if (r[i] < smallest) {
                secondSmallest = smallest;
                smallest = r[i];
            } else if (r[i] < secondSmallest) {
                secondSmallest = r[i];
            }
        }
        float crossDist = (secondSmallest - 1.0) / s;
        d = max(d, crossDist);

        float trapLen = 0.0;
        for (int i = 0; i < 5; i++) trapLen += a[i] * a[i];
        trap = min(trap, sqrt(trapLen));
    }

    return d * boundScale;
}

// 6D+ Menger SDF - Generic N-dimensional version
float mengerSDF_ND(vec3 pos, int D, float boundScale, int maxIter, out float trap) {
    float pArr[11];
    for (int i = 0; i < 11; i++) {
        if (i >= D) { pArr[i] = 0.0; continue; }
        pArr[i] = (uOrigin[i] + pos.x * uBasisX[i] + pos.y * uBasisY[i] + pos.z * uBasisZ[i]) / boundScale;
    }

    // ND box distance
    float d = -1.0;
    float len2 = 0.0;
    for (int i = 0; i < 11; i++) {
        if (i >= D) break;
        d = max(d, abs(pArr[i]) - 1.0);
        len2 += pArr[i] * pArr[i];
    }
    trap = sqrt(len2);

    float s = 1.0;
    for (int iter = 0; iter < MAX_ITER_HQ; iter++) {
        if (iter >= maxIter) break;

        float a[11];
        float r[11];
        for (int i = 0; i < 11; i++) {
            if (i >= D) { a[i] = 0.0; r[i] = 1e10; continue; }
            a[i] = mod(pArr[i] * s, 2.0) - 1.0;
        }
        s *= 3.0;

        // Apply fold twist rotation if enabled (rotate first two coords)
        if (uFoldTwistEnabled && D >= 2) {
            float cs = cos(uFoldTwistAngle);
            float sn = sin(uFoldTwistAngle);
            float a0 = a[0] * cs - a[1] * sn;
            float a1 = a[0] * sn + a[1] * cs;
            a[0] = a0;
            a[1] = a1;
        }

        for (int i = 0; i < 11; i++) {
            if (i >= D) continue;
            r[i] = abs(1.0 - 3.0 * abs(a[i]));
        }

        // Find second smallest r value
        float smallest = 1e10;
        float secondSmallest = 1e10;
        for (int i = 0; i < 11; i++) {
            if (i >= D) break;
            if (r[i] < smallest) {
                secondSmallest = smallest;
                smallest = r[i];
            } else if (r[i] < secondSmallest) {
                secondSmallest = r[i];
            }
        }
        float crossDist = (secondSmallest - 1.0) / s;
        d = max(d, crossDist);

        float trapLen = 0.0;
        for (int i = 0; i < 11; i++) {
            if (i >= D) break;
            trapLen += a[i] * a[i];
        }
        trap = min(trap, sqrt(trapLen));
    }

    return d * boundScale;
}

// ============================================
// SDF Dispatcher
// ============================================

float GetDistWithTrap(vec3 p, out float trap) {
    // Calculate iteration limit based on performance mode and quality multiplier
    // Fast mode: use LQ settings immediately
    // Normal mode: interpolate between LQ and HQ based on quality multiplier (0.25-1.0)
    int maxIter;
    if (uFastMode) {
        maxIter = MAX_ITER_LQ;
    } else {
        // Progressive refinement: interpolate iterations based on quality multiplier
        float t = clamp((uQualityMultiplier - 0.25) / 0.75, 0.0, 1.0);
        int interpolatedIter = int(mix(float(MAX_ITER_LQ), float(MAX_ITER_HQ), t));
        maxIter = min(interpolatedIter, int(uIterations));
    }

    if (uDimension == 3) {
        return mengerSDF3D(p, uScale, maxIter, trap);
    } else if (uDimension == 4) {
        return mengerSDF4D(p, uScale, maxIter, trap);
    } else if (uDimension == 5) {
        return mengerSDF5D(p, uScale, maxIter, trap);
    } else {
        return mengerSDF_ND(p, uDimension, uScale, maxIter, trap);
    }
}

float GetDist(vec3 p) {
    float trap;
    return GetDistWithTrap(p, trap);
}

// ============================================
// Temporal Reprojection
// ============================================

/**
 * Reproject current pixel to previous frame and sample depth.
 * Returns the reprojected depth distance, or -1.0 if invalid.
 *
 * @param ro Ray origin in model space
 * @param rd Ray direction in model space (normalized)
 * @param worldRayDir Ray direction in world space (for reprojection)
 * @return Reprojected depth distance in model space, or -1.0 if invalid
 */
float getTemporalDepth(vec3 ro, vec3 rd, vec3 worldRayDir) {
    if (!uTemporalEnabled) return -1.0;

    // Estimate a world-space point along the ray at an average expected distance
    float estimatedWorldDist = BOUND_R * 1.5;
    vec3 estimatedWorldHit = uCameraPosition + worldRayDir * estimatedWorldDist;

    // Transform estimated hit point to previous frame's clip space
    vec4 prevClipPos = uPrevViewProjectionMatrix * vec4(estimatedWorldHit, 1.0);
    vec2 prevNDC = prevClipPos.xy / prevClipPos.w;
    vec2 prevUV = prevNDC * 0.5 + 0.5;

    // Check if point is visible in previous frame
    if (prevUV.x < 0.0 || prevUV.x > 1.0 || prevUV.y < 0.0 || prevUV.y > 1.0) {
        return -1.0;
    }

    // Sample previous depth (stored as normalized linear depth)
    float normalizedDepth = texture(uPrevDepthTexture, prevUV).r;

    // Validate depth
    if (normalizedDepth <= 0.001 || normalizedDepth >= 0.999) {
        return -1.0;
    }

    // Disocclusion detection: check for depth discontinuities
    vec2 texelSize = 1.0 / uDepthBufferResolution;
    float depthLeft = texture(uPrevDepthTexture, prevUV - vec2(texelSize.x, 0.0)).r;
    float depthRight = texture(uPrevDepthTexture, prevUV + vec2(texelSize.x, 0.0)).r;
    float depthUp = texture(uPrevDepthTexture, prevUV + vec2(0.0, texelSize.y)).r;
    float depthDown = texture(uPrevDepthTexture, prevUV - vec2(0.0, texelSize.y)).r;

    float maxNeighborDiff = max(
        max(abs(normalizedDepth - depthLeft), abs(normalizedDepth - depthRight)),
        max(abs(normalizedDepth - depthUp), abs(normalizedDepth - depthDown))
    );

    if (maxNeighborDiff > 0.05) {
        return -1.0;  // Depth discontinuity - temporal data unreliable
    }

    // Convert from normalized depth to world-space distance
    float worldDepth = normalizedDepth * uCameraFar;

    // Apply safety margin
    return max(0.0, worldDepth * 0.95);
}

// ============================================
// Raymarching
// ============================================

vec2 intersectSphere(vec3 ro, vec3 rd, float radius) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

float RayMarch(vec3 ro, vec3 rd, vec3 worldRayDir, out float trap) {
    trap = 0.0;
    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) return maxDist + 1.0;

    float dO = max(0.0, tSphere.x);
    float maxT = min(tSphere.y, maxDist);

    // Temporal Reprojection: Use previous frame's depth as starting point
    float temporalDepth = getTemporalDepth(ro, rd, worldRayDir);
    if (temporalDepth > 0.0 && temporalDepth < maxT) {
        float temporalStart = max(dO, temporalDepth * 0.95);
        dO = temporalStart;
    }

    // Calculate march steps and surface distance based on performance mode and quality multiplier
    int maxSteps;
    float surfDist;
    float omega;

    if (uFastMode) {
        maxSteps = MAX_MARCH_STEPS_LQ;
        surfDist = SURF_DIST_LQ;
        omega = 1.0;
    } else {
        // Progressive refinement: interpolate based on quality multiplier
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
        if (step > prevDist + dS) step = dS;

        dO += step;
        prevDist = dS;

        if (dO > maxT) break;
    }
    return maxDist + 1.0;
}

vec3 GetNormal(vec3 p) {
    float d = GetDist(p);
    vec2 e = vec2(0.001, 0);
    return normalize(d - vec3(GetDist(p-e.xyy), GetDist(p-e.yxy), GetDist(p-e.yyx)));
}

vec3 GetNormalFast(vec3 p) {
    vec2 e = vec2(0.003, 0);
    float d = GetDist(p);
    return normalize(d - vec3(GetDist(p-e.xyy), GetDist(p-e.yxy), GetDist(p-e.yyx)));
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    occ += (0.02 - GetDist(p + 0.02 * n));
    occ += (0.08 - GetDist(p + 0.08 * n)) * 0.7;
    occ += (0.16 - GetDist(p + 0.16 * n)) * 0.5;
    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
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
// Shadow System Functions
// ============================================

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

// ============================================
// Main
// ============================================

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
    float d = RayMarch(ro, rd, worldRayDir, trap);

    if (d > maxDist) discard;

    vec3 p = ro + rd * d;
    vec3 n = uFastMode ? GetNormalFast(p) : GetNormal(p);
    float ao = uFastMode ? 1.0 : calcAO(p, n);

    // Color based on trap value and iteration depth
    vec3 baseHSL = rgb2hsl(uColor);
    float t = clamp(trap / 3.0, 0.0, 1.0);  // Normalize trap for coloring
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

    if (uToneMappingEnabled) {
        col = applyToneMapping(col, uToneMappingAlgorithm, uExposure);
    }

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
