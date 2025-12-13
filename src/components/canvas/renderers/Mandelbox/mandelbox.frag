// ============================================
// Mandelbox Fragment Shader
// D-dimensional (3D-11D) raymarching
// Same algorithm works for all dimensions
// ============================================

precision highp float;

uniform vec3 uCameraPosition;
uniform float uScale;           // Mandelbox scale (-3 to 3)
uniform float uFoldingLimit;    // Box fold boundary
uniform float uMinRadius2;      // minRadius squared
uniform float uFixedRadius2;    // fixedRadius squared
uniform float uIterations;
uniform float uEscapeRadius;
uniform float uIterationRotation; // Rotation per iteration for N-D mixing
uniform float uFoldLimits[11];    // Per-dimension fold limits (bias-controlled)
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

uniform bool uLightEnabled;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform float uAmbientIntensity;
uniform vec3 uAmbientColor;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
uniform float uLightStrength;
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

varying vec3 vPosition;
varying vec2 vUv;

// Performance constants
#define MAX_MARCH_STEPS_HQ 128
#define MAX_ITER_HQ 64
#define SURF_DIST_HQ 0.002

#define MAX_MARCH_STEPS_LQ 64
#define MAX_ITER_LQ 32
#define SURF_DIST_LQ 0.004

#define BOUND_R 4.0
#define EPS 1e-6

#define PI 3.14159265359

// Palette modes
#define PAL_MONO 0
#define PAL_ANALOG 1
#define PAL_COMP 2
#define PAL_TRIAD 3
#define PAL_SPLIT 4

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
    float totalWeight = uMultiSourceWeights.x + uMultiSourceWeights.y + uMultiSourceWeights.z;
    vec3 w = uMultiSourceWeights / max(totalWeight, 0.001);
    float normalValue = normal.y * 0.5 + 0.5;
    float blendedT = w.x * t + w.y * t + w.z * normalValue;
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

float fresnelSchlick(float cosTheta, float F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// ============================================
// Mandelbox Core Operations
// ============================================

// Box fold: fold each component around the folding limit
float boxFold(float x, float limit) {
    if (x > limit) return 2.0 * limit - x;
    if (x < -limit) return -2.0 * limit - x;
    return x;
}

// Sphere fold: scale based on radius
// Returns the scaling factor applied
float sphereFold(float r2, float minR2, float fixedR2) {
    if (r2 < minR2) return fixedR2 / minR2;
    if (r2 < fixedR2) return fixedR2 / r2;
    return 1.0;
}

// ============================================
// Intra-Iteration Rotation Functions
// These create genuine N-dimensional structure by mixing dimensions during iteration
// ============================================

// Apply 2D rotation in a plane
void rotate2D(inout float a, inout float b, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    float ta = a;
    a = c * ta - s * b;
    b = s * ta + c * b;
}

// Apply rotations in multiple planes for 4D (XW, YW, ZW planes)
// This breaks SO(N) symmetry and creates genuine 4D structure
void applyIterRotation4D(inout float zx, inout float zy, inout float zz, inout float zw, float angle, int iter) {
    // Vary rotation angle slightly per iteration for richer structure
    float a = angle * (1.0 + 0.1 * float(iter % 3));
    // Rotate in XW plane
    rotate2D(zx, zw, a);
    // Rotate in YW plane (smaller angle)
    rotate2D(zy, zw, a * 0.7);
}

// Apply rotations for 5D (XW, YW, ZW, X5, Y5 planes)
void applyIterRotation5D(inout float zx, inout float zy, inout float zz, inout float z3, inout float z4, float angle, int iter) {
    float a = angle * (1.0 + 0.1 * float(iter % 3));
    // Rotate in primary planes involving 4th dimension
    rotate2D(zx, z3, a);
    rotate2D(zy, z3, a * 0.7);
    // Rotate in planes involving 5th dimension
    rotate2D(zz, z4, a * 0.5);
    rotate2D(zx, z4, a * 0.3);
}

// Apply rotations for 6D
void applyIterRotation6D(inout float zx, inout float zy, inout float zz, inout float z3, inout float z4, inout float z5, float angle, int iter) {
    float a = angle * (1.0 + 0.1 * float(iter % 3));
    rotate2D(zx, z3, a);
    rotate2D(zy, z4, a * 0.7);
    rotate2D(zz, z5, a * 0.5);
    rotate2D(z3, z5, a * 0.3);
}

// Apply rotations for 7D
void applyIterRotation7D(inout float zx, inout float zy, inout float zz, inout float z3, inout float z4, inout float z5, inout float z6, float angle, int iter) {
    float a = angle * (1.0 + 0.1 * float(iter % 3));
    rotate2D(zx, z3, a);
    rotate2D(zy, z4, a * 0.7);
    rotate2D(zz, z5, a * 0.5);
    rotate2D(z3, z6, a * 0.4);
    rotate2D(z4, z6, a * 0.3);
}

// Apply rotations for high-D (8D-11D) using array - rotates pairs of dimensions
void applyIterRotationHighD(inout float z[11], int D, float angle, int iter) {
    float a = angle * (1.0 + 0.1 * float(iter % 3));
    // Rotate each low dimension with a higher dimension
    // This creates interdimensional mixing for all dimensions
    for (int i = 0; i < 3; i++) {
        int highDim = 3 + i;
        if (highDim < D) {
            float scaling = 1.0 - 0.2 * float(i);  // 1.0, 0.8, 0.6
            rotate2D(z[i], z[highDim], a * scaling);
        }
    }
    // Additional rotations between higher dimensions
    if (D >= 6) {
        rotate2D(z[3], z[5], a * 0.4);
    }
    if (D >= 8) {
        rotate2D(z[4], z[6], a * 0.3);
        rotate2D(z[5], z[7], a * 0.2);
    }
    if (D >= 10) {
        rotate2D(z[6], z[8], a * 0.2);
        rotate2D(z[7], z[9], a * 0.15);
    }
}

// ============================================
// 3D Mandelbox SDF - FULLY UNROLLED
// ============================================

float sdf3D(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];

    float zx = cx, zy = cy, zz = cz;
    float dr = 1.0;
    float minDist = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold
        zx = boxFold(zx, fold);
        zy = boxFold(zy, fold);
        zz = boxFold(zz, fold);

        // Sphere fold
        float r2 = zx*zx + zy*zy + zz*zz;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf;
        dr *= sf;

        // Scale and translate
        zx = scale * zx + cx;
        zy = scale * zy + cy;
        zz = scale * zz + cz;
        dr = dr * abs(scale) + 1.0;

        // Track orbit trap
        float dist = sqrt(zx*zx + zy*zy + zz*zz);
        minDist = min(minDist, dist);

        if (dist > bail) { escIt = i; break; }
        escIt = i;
    }

    trap = exp(-minDist * 2.0) * 0.5 + float(escIt) / float(maxIt) * 0.5;
    float r = sqrt(zx*zx + zy*zy + zz*zz);
    return r / abs(dr);
}

float sdf3D_simple(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];

    float zx = cx, zy = cy, zz = cz;
    float dr = 1.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        zx = boxFold(zx, fold); zy = boxFold(zy, fold); zz = boxFold(zz, fold);
        float r2 = zx*zx + zy*zy + zz*zz;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; dr *= sf;
        zx = scale * zx + cx; zy = scale * zy + cy; zz = scale * zz + cz;
        dr = dr * abs(scale) + 1.0;

        if (r2 > bail*bail) break;
    }

    float r = sqrt(zx*zx + zy*zy + zz*zz);
    return r / abs(dr);
}

// ============================================
// 4D Mandelbox SDF - FULLY UNROLLED
// ============================================

float sdf4D(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float cw = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];

    float zx = cx, zy = cy, zz = cz, zw = cw;
    float dr = 1.0;
    float minDist = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]);
        zz = boxFold(zz, uFoldLimits[2]); zw = boxFold(zw, uFoldLimits[3]);

        // Apply intra-iteration rotation to mix dimensions (creates genuine 4D structure)
        if (uIterationRotation > 0.0) {
            applyIterRotation4D(zx, zy, zz, zw, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + zw*zw;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; zw *= sf;
        dr *= sf;

        zx = scale * zx + cx; zy = scale * zy + cy;
        zz = scale * zz + cz; zw = scale * zw + cw;
        dr = dr * abs(scale) + 1.0;

        float dist = sqrt(r2);
        minDist = min(minDist, dist);

        if (dist > bail) { escIt = i; break; }
        escIt = i;
    }

    trap = exp(-minDist * 2.0) * 0.5 + float(escIt) / float(maxIt) * 0.5;
    float r = sqrt(zx*zx + zy*zy + zz*zz + zw*zw);
    return r / abs(dr);
}

float sdf4D_simple(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float cw = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];

    float zx = cx, zy = cy, zz = cz, zw = cw;
    float dr = 1.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]);
        zz = boxFold(zz, uFoldLimits[2]); zw = boxFold(zw, uFoldLimits[3]);

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotation4D(zx, zy, zz, zw, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + zw*zw;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; zw *= sf; dr *= sf;
        zx = scale * zx + cx; zy = scale * zy + cy;
        zz = scale * zz + cz; zw = scale * zw + cw;
        dr = dr * abs(scale) + 1.0;

        if (r2 > bail*bail) break;
    }

    float r = sqrt(zx*zx + zy*zy + zz*zz + zw*zw);
    return r / abs(dr);
}

// ============================================
// 5D Mandelbox SDF - FULLY UNROLLED
// ============================================

float sdf5D(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];

    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4;
    float dr = 1.0;
    float minDist = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]);
        zz = boxFold(zz, uFoldLimits[2]); z3 = boxFold(z3, uFoldLimits[3]); z4 = boxFold(z4, uFoldLimits[4]);

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotation5D(zx, zy, zz, z3, z4, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; z3 *= sf; z4 *= sf;
        dr *= sf;

        zx = scale * zx + cx; zy = scale * zy + cy;
        zz = scale * zz + cz; z3 = scale * z3 + c3; z4 = scale * z4 + c4;
        dr = dr * abs(scale) + 1.0;

        float dist = sqrt(r2);
        minDist = min(minDist, dist);

        if (dist > bail) { escIt = i; break; }
        escIt = i;
    }

    trap = exp(-minDist * 2.0) * 0.5 + float(escIt) / float(maxIt) * 0.5;
    float r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4);
    return r / abs(dr);
}

float sdf5D_simple(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];

    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4;
    float dr = 1.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]);
        zz = boxFold(zz, uFoldLimits[2]); z3 = boxFold(z3, uFoldLimits[3]); z4 = boxFold(z4, uFoldLimits[4]);

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotation5D(zx, zy, zz, z3, z4, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; z3 *= sf; z4 *= sf; dr *= sf;
        zx = scale * zx + cx; zy = scale * zy + cy;
        zz = scale * zz + cz; z3 = scale * z3 + c3; z4 = scale * z4 + c4;
        dr = dr * abs(scale) + 1.0;

        if (r2 > bail*bail) break;
    }

    float r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4);
    return r / abs(dr);
}

// ============================================
// 6D Mandelbox SDF - FULLY UNROLLED
// ============================================

float sdf6D(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];

    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4, z5 = c5;
    float dr = 1.0;
    float minDist = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]); zz = boxFold(zz, uFoldLimits[2]);
        z3 = boxFold(z3, uFoldLimits[3]); z4 = boxFold(z4, uFoldLimits[4]); z5 = boxFold(z5, uFoldLimits[5]);

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotation6D(zx, zy, zz, z3, z4, z5, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; z3 *= sf; z4 *= sf; z5 *= sf;
        dr *= sf;

        zx = scale * zx + cx; zy = scale * zy + cy; zz = scale * zz + cz;
        z3 = scale * z3 + c3; z4 = scale * z4 + c4; z5 = scale * z5 + c5;
        dr = dr * abs(scale) + 1.0;

        float dist = sqrt(r2);
        minDist = min(minDist, dist);

        if (dist > bail) { escIt = i; break; }
        escIt = i;
    }

    trap = exp(-minDist * 2.0) * 0.5 + float(escIt) / float(maxIt) * 0.5;
    float r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5);
    return r / abs(dr);
}

float sdf6D_simple(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];

    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4, z5 = c5;
    float dr = 1.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]); zz = boxFold(zz, uFoldLimits[2]);
        z3 = boxFold(z3, uFoldLimits[3]); z4 = boxFold(z4, uFoldLimits[4]); z5 = boxFold(z5, uFoldLimits[5]);

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotation6D(zx, zy, zz, z3, z4, z5, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; z3 *= sf; z4 *= sf; z5 *= sf; dr *= sf;
        zx = scale * zx + cx; zy = scale * zy + cy; zz = scale * zz + cz;
        z3 = scale * z3 + c3; z4 = scale * z4 + c4; z5 = scale * z5 + c5;
        dr = dr * abs(scale) + 1.0;

        if (r2 > bail*bail) break;
    }

    float r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5);
    return r / abs(dr);
}

// ============================================
// 7D Mandelbox SDF - FULLY UNROLLED
// ============================================

float sdf7D(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt, out float trap) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float c6 = uOrigin[6] + pos.x*uBasisX[6] + pos.y*uBasisY[6] + pos.z*uBasisZ[6];

    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4, z5 = c5, z6 = c6;
    float dr = 1.0;
    float minDist = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]); zz = boxFold(zz, uFoldLimits[2]);
        z3 = boxFold(z3, uFoldLimits[3]); z4 = boxFold(z4, uFoldLimits[4]); z5 = boxFold(z5, uFoldLimits[5]);
        z6 = boxFold(z6, uFoldLimits[6]);

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotation7D(zx, zy, zz, z3, z4, z5, z6, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5 + z6*z6;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; z3 *= sf; z4 *= sf; z5 *= sf; z6 *= sf;
        dr *= sf;

        zx = scale * zx + cx; zy = scale * zy + cy; zz = scale * zz + cz;
        z3 = scale * z3 + c3; z4 = scale * z4 + c4; z5 = scale * z5 + c5;
        z6 = scale * z6 + c6;
        dr = dr * abs(scale) + 1.0;

        float dist = sqrt(r2);
        minDist = min(minDist, dist);

        if (dist > bail) { escIt = i; break; }
        escIt = i;
    }

    trap = exp(-minDist * 2.0) * 0.5 + float(escIt) / float(maxIt) * 0.5;
    float r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5 + z6*z6);
    return r / abs(dr);
}

float sdf7D_simple(vec3 pos, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt) {
    float cx = uOrigin[0] + pos.x*uBasisX[0] + pos.y*uBasisY[0] + pos.z*uBasisZ[0];
    float cy = uOrigin[1] + pos.x*uBasisX[1] + pos.y*uBasisY[1] + pos.z*uBasisZ[1];
    float cz = uOrigin[2] + pos.x*uBasisX[2] + pos.y*uBasisY[2] + pos.z*uBasisZ[2];
    float c3 = uOrigin[3] + pos.x*uBasisX[3] + pos.y*uBasisY[3] + pos.z*uBasisZ[3];
    float c4 = uOrigin[4] + pos.x*uBasisX[4] + pos.y*uBasisY[4] + pos.z*uBasisZ[4];
    float c5 = uOrigin[5] + pos.x*uBasisX[5] + pos.y*uBasisY[5] + pos.z*uBasisZ[5];
    float c6 = uOrigin[6] + pos.x*uBasisX[6] + pos.y*uBasisY[6] + pos.z*uBasisZ[6];

    float zx = cx, zy = cy, zz = cz, z3 = c3, z4 = c4, z5 = c5, z6 = c6;
    float dr = 1.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        zx = boxFold(zx, uFoldLimits[0]); zy = boxFold(zy, uFoldLimits[1]); zz = boxFold(zz, uFoldLimits[2]);
        z3 = boxFold(z3, uFoldLimits[3]); z4 = boxFold(z4, uFoldLimits[4]); z5 = boxFold(z5, uFoldLimits[5]);
        z6 = boxFold(z6, uFoldLimits[6]);

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotation7D(zx, zy, zz, z3, z4, z5, z6, uIterationRotation, i);
        }

        float r2 = zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5 + z6*z6;
        float sf = sphereFold(r2, minR2, fixedR2);
        zx *= sf; zy *= sf; zz *= sf; z3 *= sf; z4 *= sf; z5 *= sf; z6 *= sf; dr *= sf;
        zx = scale * zx + cx; zy = scale * zy + cy; zz = scale * zz + cz;
        z3 = scale * z3 + c3; z4 = scale * z4 + c4; z5 = scale * z5 + c5;
        z6 = scale * z6 + c6;
        dr = dr * abs(scale) + 1.0;

        if (r2 > bail*bail) break;
    }

    float r = sqrt(zx*zx + zy*zy + zz*zz + z3*z3 + z4*z4 + z5*z5 + z6*z6);
    return r / abs(dr);
}

// ============================================
// 8D-11D Array-based Mandelbox SDF
// ============================================

float sdfHighD(vec3 pos, int D, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt, out float trap) {
    float c[11], z[11];
    for (int j = 0; j < 11; j++) {
        c[j] = uOrigin[j] + pos.x*uBasisX[j] + pos.y*uBasisY[j] + pos.z*uBasisZ[j];
        z[j] = c[j];
    }

    float dr = 1.0;
    float minDist = 1000.0;
    int escIt = 0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold all dimensions with per-dimension fold limits
        for (int j = 0; j < 11; j++) {
            if (j >= D) break;
            z[j] = boxFold(z[j], uFoldLimits[j]);
        }

        // Apply intra-iteration rotation for high-D
        if (uIterationRotation > 0.0) {
            applyIterRotationHighD(z, D, uIterationRotation, i);
        }

        // Compute r²
        float r2 = 0.0;
        for (int j = 0; j < 11; j++) {
            if (j >= D) break;
            r2 += z[j] * z[j];
        }

        // Sphere fold
        float sf = sphereFold(r2, minR2, fixedR2);
        for (int j = 0; j < 11; j++) {
            if (j >= D) break;
            z[j] *= sf;
        }
        dr *= sf;

        // Scale and translate
        for (int j = 0; j < 11; j++) {
            if (j >= D) break;
            z[j] = scale * z[j] + c[j];
        }
        dr = dr * abs(scale) + 1.0;

        float dist = sqrt(r2);
        minDist = min(minDist, dist);

        if (dist > bail) { escIt = i; break; }
        escIt = i;
    }

    // Final r
    float r2 = 0.0;
    for (int j = 0; j < 11; j++) {
        if (j >= D) break;
        r2 += z[j] * z[j];
    }

    trap = exp(-minDist * 2.0) * 0.5 + float(escIt) / float(maxIt) * 0.5;
    return sqrt(r2) / abs(dr);
}

float sdfHighD_simple(vec3 pos, int D, float scale, float fold, float minR2, float fixedR2, float bail, int maxIt) {
    float c[11], z[11];
    for (int j = 0; j < 11; j++) {
        c[j] = uOrigin[j] + pos.x*uBasisX[j] + pos.y*uBasisY[j] + pos.z*uBasisZ[j];
        z[j] = c[j];
    }

    float dr = 1.0;

    for (int i = 0; i < MAX_ITER_HQ; i++) {
        if (i >= maxIt) break;

        // Box fold with per-dimension fold limits
        for (int j = 0; j < 11; j++) { if (j >= D) break; z[j] = boxFold(z[j], uFoldLimits[j]); }

        // Apply intra-iteration rotation
        if (uIterationRotation > 0.0) {
            applyIterRotationHighD(z, D, uIterationRotation, i);
        }

        float r2 = 0.0;
        for (int j = 0; j < 11; j++) { if (j >= D) break; r2 += z[j] * z[j]; }

        float sf = sphereFold(r2, minR2, fixedR2);
        for (int j = 0; j < 11; j++) { if (j >= D) break; z[j] *= sf; }
        dr *= sf;

        for (int j = 0; j < 11; j++) { if (j >= D) break; z[j] = scale * z[j] + c[j]; }
        dr = dr * abs(scale) + 1.0;

        if (r2 > bail*bail) break;
    }

    float r2 = 0.0;
    for (int j = 0; j < 11; j++) { if (j >= D) break; r2 += z[j] * z[j]; }
    return sqrt(r2) / abs(dr);
}

// ============================================
// Dispatch to dimension-specific SDF
// ============================================

float GetDist(vec3 pos) {
    float scale = uScale;
    float fold = uFoldingLimit;
    float minR2 = uMinRadius2;
    float fixedR2 = uFixedRadius2;
    float bail = max(uEscapeRadius, 2.0);
    int maxIterLimit = uFastMode ? MAX_ITER_LQ : MAX_ITER_HQ;
    int maxIt = int(min(uIterations, float(maxIterLimit)));

    if (uDimension == 3) return sdf3D_simple(pos, scale, fold, minR2, fixedR2, bail, maxIt);
    if (uDimension == 4) return sdf4D_simple(pos, scale, fold, minR2, fixedR2, bail, maxIt);
    if (uDimension == 5) return sdf5D_simple(pos, scale, fold, minR2, fixedR2, bail, maxIt);
    if (uDimension == 6) return sdf6D_simple(pos, scale, fold, minR2, fixedR2, bail, maxIt);
    if (uDimension == 7) return sdf7D_simple(pos, scale, fold, minR2, fixedR2, bail, maxIt);
    return sdfHighD_simple(pos, uDimension, scale, fold, minR2, fixedR2, bail, maxIt);
}

float GetDistWithTrap(vec3 pos, out float trap) {
    float scale = uScale;
    float fold = uFoldingLimit;
    float minR2 = uMinRadius2;
    float fixedR2 = uFixedRadius2;
    float bail = max(uEscapeRadius, 2.0);
    int maxIterLimit = uFastMode ? MAX_ITER_LQ : MAX_ITER_HQ;
    int maxIt = int(min(uIterations, float(maxIterLimit)));

    if (uDimension == 3) return sdf3D(pos, scale, fold, minR2, fixedR2, bail, maxIt, trap);
    if (uDimension == 4) return sdf4D(pos, scale, fold, minR2, fixedR2, bail, maxIt, trap);
    if (uDimension == 5) return sdf5D(pos, scale, fold, minR2, fixedR2, bail, maxIt, trap);
    if (uDimension == 6) return sdf6D(pos, scale, fold, minR2, fixedR2, bail, maxIt, trap);
    if (uDimension == 7) return sdf7D(pos, scale, fold, minR2, fixedR2, bail, maxIt, trap);
    return sdfHighD(pos, uDimension, scale, fold, minR2, fixedR2, bail, maxIt, trap);
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

float RayMarch(vec3 ro, vec3 rd, out float trap) {
    trap = 0.0;
    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) return maxDist + 1.0;

    float dO = max(0.0, tSphere.x);
    float maxT = min(tSphere.y, maxDist);

    int maxSteps = uFastMode ? MAX_MARCH_STEPS_LQ : MAX_MARCH_STEPS_HQ;
    float surfDist = uFastMode ? SURF_DIST_LQ : SURF_DIST_HQ;

    float omega = uFastMode ? 1.0 : 1.2;
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
    vec2 e = vec2(0.005, 0);
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

mat3 getBasisRotation() {
    vec3 bx = vec3(uBasisX[0], uBasisX[1], uBasisX[2]);
    vec3 by = vec3(uBasisY[0], uBasisY[1], uBasisY[2]);
    vec3 bz = vec3(uBasisZ[0], uBasisZ[1], uBasisZ[2]);
    return mat3(bx, by, bz);
}

void main() {
    vec3 ro = (uInverseModelMatrix * vec4(uCameraPosition, 1.0)).xyz;
    vec3 worldRayDir = normalize(vPosition - uCameraPosition);
    vec3 rd = normalize((uInverseModelMatrix * vec4(worldRayDir, 0.0)).xyz);

    float camDist = length(ro);
    float maxDist = camDist + BOUND_R * 2.0 + 1.0;

    float trap;
    float d = RayMarch(ro, rd, trap);

    if (d > maxDist) discard;

    vec3 p = ro + rd * d;
    vec3 n = uFastMode ? GetNormalFast(p) : GetNormal(p);
    float ao = uFastMode ? 1.0 : calcAO(p, n);

    vec3 baseHSL = rgb2hsl(uColor);
    float t = 1.0 - trap;
    vec3 surfaceColor = getColorByAlgorithm(t, n, baseHSL, p);
    surfaceColor *= (0.3 + 0.7 * ao);

    vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;

    if (uLightEnabled) {
        vec3 l = normalize(uLightDirection);
        vec3 viewDir = -rd;

        float NdotL = max(dot(n, l), 0.0);
        col += surfaceColor * uLightColor * NdotL * uDiffuseIntensity * uLightStrength;

        vec3 halfDir = normalize(l + viewDir);
        float NdotH = max(dot(n, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * uLightStrength;
        col += uSpecularColor * uLightColor * spec;

        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
            float NdotV = max(dot(n, viewDir), 0.0);
            float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
            rim *= (0.3 + 0.7 * NdotL);
            col += uRimColor * rim;
        }
    }

    if (uToneMappingEnabled) {
        col = applyToneMapping(col, uToneMappingAlgorithm, uExposure);
    }

    vec4 worldHitPos = uModelMatrix * vec4(p, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    gl_FragDepth = clamp((clipPos.z / clipPos.w) * 0.5 + 0.5, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
}
