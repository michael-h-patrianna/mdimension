// ============================================
// Kali Fragment Shader
// D-dimensional (3D-11D) raymarching
// Mathematical basis: z = abs(z) / dot(z,z) + c
// The reciprocal step creates intense nonlinear folding
// ============================================

precision highp float;

// MRT output declarations for WebGL2
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;

uniform vec3 uCameraPosition;
uniform float uIterations;
uniform float uEscapeRadius;
uniform vec3 uColor;
uniform mat4 uModelMatrix;
uniform mat4 uInverseModelMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

uniform int uDimension;

// Kali-specific uniforms
uniform float uKaliConstant[11];
uniform float uReciprocalGain;
uniform float uAxisWeights[11];
uniform float uEpsilon;

// D-dimensional rotated coordinate system
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
uniform vec3 uSpecularColor;
uniform float uDiffuseIntensity;
uniform float uMetallic;

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
uniform float uQualityMultiplier;

// Opacity Mode System uniforms
uniform int uOpacityMode;
uniform float uSimpleAlpha;
uniform int uLayerCount;
uniform float uLayerOpacity;
uniform float uVolumetricDensity;
uniform int uSampleQuality;
uniform bool uVolumetricReduceOnAnim;

// Shadow System uniforms
uniform bool uShadowEnabled;
uniform int uShadowQuality;
uniform float uShadowSoftness;
uniform int uShadowAnimationMode;

// Dimension Mixing uniforms
uniform bool uDimensionMixEnabled;
uniform float uMixIntensity;
uniform float uMixTime;

in vec3 vPosition;
in vec2 vUv;

// Performance constants - Kali uses lower iterations due to fast divergence
#define MAX_MARCH_STEPS_HQ 512
#define MAX_ITER_HQ 64
#define SURF_DIST_HQ 0.002

#define MAX_MARCH_STEPS_LQ 64
#define MAX_ITER_LQ 16
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

// ============================================
// Color utilities (copied exactly from quaternion-julia.frag)
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

vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

float applyDistribution(float t, float power, float cycles, float offset) {
    float clamped = clamp(t, 0.0, 1.0);
    float curved = pow(clamped, power);
    float cycled = fract(curved * cycles + offset);
    return cycled;
}

vec3 getCosinePaletteColor(float t, vec3 a, vec3 b, vec3 c, vec3 d, float power, float cycles, float offset) {
    float distributedT = applyDistribution(t, power, cycles, offset);
    return cosinePalette(distributedT, a, b, c, d);
}

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
        return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD, uDistPower, uDistCycles, uDistOffset);
    } else if (uColorAlgorithm == 3) {
        float normalT = normal.y * 0.5 + 0.5;
        return getCosinePaletteColor(normalT, uCosineA, uCosineB, uCosineC, uCosineD, uDistPower, uDistCycles, uDistOffset);
    } else if (uColorAlgorithm == 4) {
        return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD, uDistPower, uDistCycles, uDistOffset);
    } else if (uColorAlgorithm == 5) {
        float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
        return lchColor(distributedT, uLchLightness, uLchChroma);
    } else if (uColorAlgorithm == 6) {
        float totalWeight = uMultiSourceWeights.x + uMultiSourceWeights.y + uMultiSourceWeights.z;
        vec3 w = uMultiSourceWeights / max(totalWeight, 0.001);
        float normalValue = normal.y * 0.5 + 0.5;
        float orbitTrap = clamp(length(position) / BOUND_R, 0.0, 1.0);
        float blendedT = w.x * t + w.y * orbitTrap + w.z * normalValue;
        return getCosinePaletteColor(blendedT, uCosineA, uCosineB, uCosineC, uCosineD, uDistPower, uDistCycles, uDistOffset);
    } else if (uColorAlgorithm == 7) {
        float radialT = clamp(length(position) / BOUND_R, 0.0, 1.0);
        return getCosinePaletteColor(radialT, uCosineA, uCosineB, uCosineC, uCosineD, uDistPower, uDistCycles, uDistOffset);
    } else {
        return getCosinePaletteColor(t, uCosineA, uCosineB, uCosineC, uCosineD, uDistPower, uDistCycles, uDistOffset);
    }
}

float fresnelSchlick(float cosTheta, float F0) {
    float x = 1.0 - cosTheta;
    float x2 = x * x;
    float x5 = x2 * x2 * x;
    return F0 + (1.0 - F0) * x5;
}

// ============================================
// Kali SDF - The core reciprocal-abs formula
// z = abs(z) / dot(z,z) + c
//
// Unlike Mandelbrot/Julia which use z^n, the Kali formula's
// derivative-based DE doesn't work reliably. We use an orbit
// trap approach which gives consistent results.
// ============================================

float sdfKali(vec3 pos, out float trap) {
    // Map 3D to n-dimensional using basis vectors
    float z[11];
    for (int i = 0; i < 11; i++) z[i] = 0.0;

    for (int i = 0; i < uDimension; i++) {
        z[i] = uOrigin[i] + pos.x*uBasisX[i] + pos.y*uBasisY[i] + pos.z*uBasisZ[i];
    }

    float minDist = 1e10;
    float scale = 1.0;  // Track cumulative scaling for DE
    int escIt = 0;
    int maxIt = uFastMode ? MAX_ITER_LQ : int(uIterations);

    for (int iter = 0; iter < MAX_ITER_HQ; iter++) {
        if (iter >= maxIt) break;

        // Apply axis weights
        for (int i = 0; i < uDimension; i++) {
            z[i] *= uAxisWeights[i];
        }

        // Absolute value fold - the key operation
        for (int i = 0; i < uDimension; i++) {
            z[i] = abs(z[i]);
        }

        // Calculate dot(z,z) with epsilon protection
        float dotZZ = uEpsilon;
        for (int i = 0; i < uDimension; i++) {
            dotZZ += z[i] * z[i];
        }

        float r = sqrt(dotZZ);

        // Orbit trap - minimum distance to origin (for coloring)
        minDist = min(minDist, r);

        // Escape check
        if (r > uEscapeRadius) { escIt = iter; break; }

        // Reciprocal with gain
        // z = z / (dot(z,z) * gain) + c
        float invM = 1.0 / (dotZZ * uReciprocalGain);

        // Track scaling factor for distance estimation
        // The reciprocal operation scales by 1/m where m = dot(z,z)
        scale *= invM;

        // Apply reciprocal and add constant
        for (int i = 0; i < uDimension; i++) {
            z[i] = z[i] * invM + uKaliConstant[i];
        }

        escIt = iter;
    }

    // Final radius
    float finalR = 0.0;
    for (int i = 0; i < uDimension; i++) {
        finalR += z[i] * z[i];
    }
    finalR = sqrt(finalR);

    // Orbit trap for coloring - blend of minimum distance and iteration count
    trap = exp(-minDist * 3.0) * 0.4 + float(escIt) / float(maxIt) * 0.6;

    // Distance estimate for Kali using orbit trap method
    // This is more reliable than derivative-based DE for reciprocal fractals
    // Scale factor converts from fractal space back to world space
    float de = minDist / max(scale, 1.0);

    // Clamp to reasonable range
    return clamp(de * 0.5, 0.0001, 2.0);
}

float sdfKali_simple(vec3 pos) {
    float z[11];
    for (int i = 0; i < 11; i++) z[i] = 0.0;

    for (int i = 0; i < uDimension; i++) {
        z[i] = uOrigin[i] + pos.x*uBasisX[i] + pos.y*uBasisY[i] + pos.z*uBasisZ[i];
    }

    float minDist = 1e10;
    float scale = 1.0;
    int maxIt = uFastMode ? MAX_ITER_LQ : int(uIterations);

    for (int iter = 0; iter < MAX_ITER_HQ; iter++) {
        if (iter >= maxIt) break;

        for (int i = 0; i < uDimension; i++) {
            z[i] *= uAxisWeights[i];
        }

        for (int i = 0; i < uDimension; i++) {
            z[i] = abs(z[i]);
        }

        float dotZZ = uEpsilon;
        for (int i = 0; i < uDimension; i++) {
            dotZZ += z[i] * z[i];
        }

        float r = sqrt(dotZZ);
        minDist = min(minDist, r);

        if (r > uEscapeRadius) break;

        float invM = 1.0 / (dotZZ * uReciprocalGain);
        scale *= invM;

        for (int i = 0; i < uDimension; i++) {
            z[i] = z[i] * invM + uKaliConstant[i];
        }
    }

    float de = minDist / max(scale, 1.0);
    return clamp(de * 0.5, 0.0001, 2.0);
}

// ============================================
// SDF Dispatcher
// ============================================

float sdf(vec3 pos, out float trap) {
    return sdfKali(pos, trap);
}

float sdf_simple(vec3 pos) {
    return sdfKali_simple(pos);
}

// ============================================
// Normal Calculation
// ============================================

vec3 GetNormal(vec3 p) {
    int maxIt = uFastMode ? MAX_ITER_LQ : int(uIterations);
    float h = uFastMode ? SURF_DIST_LQ : SURF_DIST_HQ;
    h *= uQualityMultiplier;

    vec2 e = vec2(h, 0.0);
    vec3 n = vec3(
        sdf_simple(p + e.xyy) - sdf_simple(p - e.xyy),
        sdf_simple(p + e.yxy) - sdf_simple(p - e.yxy),
        sdf_simple(p + e.yyx) - sdf_simple(p - e.yyx)
    );
    return normalize(n);
}

vec3 GetNormalFast(vec3 p) {
    float h = SURF_DIST_LQ * 2.0;

    vec2 e = vec2(h, 0.0);
    vec3 n = vec3(
        sdf_simple(p + e.xyy) - sdf_simple(p - e.xyy),
        sdf_simple(p + e.yxy) - sdf_simple(p - e.yxy),
        sdf_simple(p + e.yyx) - sdf_simple(p - e.yyx)
    );
    return normalize(n);
}

// ============================================
// Ambient Occlusion
// ============================================

float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0;
    float sca = 1.0;

    for (int i = 0; i < 4; i++) {
        float h = 0.01 + 0.12 * float(i);
        float d = sdf_simple(pos + h * nor);
        occ += (h - d) * sca;
        sca *= 0.8;
    }
    return clamp(1.0 - occ, 0.0, 1.0);
}

// ============================================
// Shadow Calculation
// ============================================

float calcSoftShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;

    for (int i = 0; i < 32; i++) {
        if (t > maxt) break;
        float d = sdf_simple(ro + rd * t);
        if (d < 0.001) return 0.0;
        res = min(res, k * d / t);
        t += d;
    }
    return clamp(res, 0.0, 1.0);
}

float calcSoftShadowQuality(vec3 ro, vec3 rd, float mint, float maxt, float k, int quality) {
    int steps;
    if (quality == 0) steps = 16;
    else if (quality == 1) steps = 32;
    else if (quality == 2) steps = 64;
    else steps = 128;

    float res = 1.0;
    float t = mint;

    for (int i = 0; i < 128; i++) {
        if (i >= steps || t > maxt) break;
        float d = sdf_simple(ro + rd * t);
        if (d < 0.001) return 0.0;
        res = min(res, k * d / t);
        t += max(d, 0.01);
    }
    return clamp(res, 0.0, 1.0);
}

// ============================================
// Sphere Intersection
// ============================================

vec2 intersectSphere(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

// ============================================
// Raymarching
// ============================================

float RayMarch(vec3 ro, vec3 rd, vec3 worldRd, out float trap, out bool usedTemporal) {
    usedTemporal = false;
    trap = 0.0;

    int maxIt = uFastMode ? MAX_ITER_LQ : int(uIterations);
    float surfDist = (uFastMode ? SURF_DIST_LQ : SURF_DIST_HQ) * uQualityMultiplier;
    int maxSteps = uFastMode ? MAX_MARCH_STEPS_LQ : MAX_MARCH_STEPS_HQ;

    // Intersect bounding sphere first
    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    if (tSphere.y < 0.0) return 1e10;

    float t = max(0.0, tSphere.x);
    float tMax = tSphere.y;

    for (int i = 0; i < MAX_MARCH_STEPS_HQ; i++) {
        if (i >= maxSteps) break;
        if (t > tMax) break;

        vec3 p = ro + rd * t;
        float d = sdf(p, trap);

        if (d < surfDist) return t;
        t += d;
    }

    return 1e10;
}

// ============================================
// Multi-Light System Helper Functions
// ============================================

vec3 getLightDirection(int lightIndex, vec3 fragPos) {
    int lightType = uLightTypes[lightIndex];

    if (lightType == LIGHT_TYPE_POINT) {
        return normalize(uLightPositions[lightIndex] - fragPos);
    }
    else if (lightType == LIGHT_TYPE_DIRECTIONAL) {
        return normalize(uLightDirections[lightIndex]);
    }
    else if (lightType == LIGHT_TYPE_SPOT) {
        return normalize(uLightPositions[lightIndex] - fragPos);
    }

    return vec3(0.0, 1.0, 0.0);
}

float getDistanceAttenuation(int lightIndex, float distance) {
    float range = uLightRanges[lightIndex];
    float decay = uLightDecays[lightIndex];

    if (range <= 0.0) {
        return 1.0;
    }

    float d = max(distance, 0.0001);
    float rangeAttenuation = clamp(1.0 - d / range, 0.0, 1.0);
    return pow(rangeAttenuation, decay);
}

float getSpotAttenuation(int lightIndex, vec3 lightToFrag) {
    float cosAngle = dot(lightToFrag, normalize(uLightDirections[lightIndex]));
    return smoothstep(uSpotCosOuter[lightIndex], uSpotCosInner[lightIndex], cosAngle);
}

// ============================================
// Opacity Calculations
// ============================================

float calculateSolidAlpha() {
    return 1.0;
}

float calculateSimpleAlpha() {
    return uSimpleAlpha;
}

float calculateLayeredAlpha(float hitDist, float maxDepth) {
    float normalizedDist = clamp(hitDist / maxDepth, 0.0, 1.0);
    int layerIndex = int(normalizedDist * float(uLayerCount));
    layerIndex = min(layerIndex, uLayerCount - 1);
    float layerAlpha = uLayerOpacity + (1.0 - uLayerOpacity) * (float(layerIndex) / float(uLayerCount - 1));
    return layerAlpha;
}

float calculateVolumetricAlpha(float distanceInVolume) {
    float densityMultiplier = 1.0;
    bool reduceQuality = uFastMode && uVolumetricReduceOnAnim;

    if (reduceQuality) {
        densityMultiplier = 0.5;
    } else {
        if (uSampleQuality == 0) densityMultiplier = 0.6;
        else if (uSampleQuality == 2) densityMultiplier = 1.5;
    }

    float effectiveDensity = uVolumetricDensity * densityMultiplier;
    float alpha = 1.0 - exp(-effectiveDensity * distanceInVolume);
    return clamp(alpha, 0.0, 1.0);
}

float calculateOpacityAlpha(float hitDist, float sphereEntry, float maxDepth) {
    if (uOpacityMode == OPACITY_SOLID) {
        return calculateSolidAlpha();
    } else if (uOpacityMode == OPACITY_SIMPLE_ALPHA) {
        return calculateSimpleAlpha();
    } else if (uOpacityMode == OPACITY_LAYERED) {
        return calculateLayeredAlpha(hitDist, maxDepth);
    } else if (uOpacityMode == OPACITY_VOLUMETRIC) {
        float distanceInVolume = hitDist - max(0.0, sphereEntry);
        return calculateVolumetricAlpha(distanceInVolume);
    }
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

    vec2 tSphere = intersectSphere(ro, rd, BOUND_R);
    float sphereEntry = max(0.0, tSphere.x);

    float trap;
    bool usedTemporal;
    float d = RayMarch(ro, rd, worldRayDir, trap, usedTemporal);

    if (d > maxDist) discard;

    vec3 p = ro + rd * d;
    vec3 n = uFastMode ? GetNormalFast(p) : GetNormal(p);
    float ao = uFastMode ? 1.0 : calcAO(p, n);

    vec3 baseHSL = rgb2hsl(uColor);
    float t = 1.0 - trap;
    vec3 surfaceColor = getColorByAlgorithm(t, n, baseHSL, p);
    surfaceColor *= (0.3 + 0.7 * ao);

    // Lighting
    vec3 col = surfaceColor * uAmbientColor * uAmbientIntensity;
    vec3 viewDir = -rd;
    float totalNdotL = 0.0;

    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uNumLights) break;
        if (!uLightsEnabled[i]) continue;

        vec3 l = getLightDirection(i, p);
        float attenuation = uLightIntensities[i];

        int lightType = uLightTypes[i];
        if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
            float distance = length(uLightPositions[i] - p);
            attenuation *= getDistanceAttenuation(i, distance);
        }

        if (lightType == LIGHT_TYPE_SPOT) {
            vec3 lightToFrag = normalize(p - uLightPositions[i]);
            attenuation *= getSpotAttenuation(i, lightToFrag);
        }

        if (attenuation < 0.001) continue;

        // Shadow
        float shadow = 1.0;
        if (uShadowEnabled) {
            bool shouldRenderShadow = !uFastMode || uShadowAnimationMode > 0;
            if (shouldRenderShadow) {
                vec3 shadowOrigin = p + n * 0.02;
                vec3 shadowDir = l;
                float shadowMaxDist = lightType == LIGHT_TYPE_DIRECTIONAL ? 10.0 : length(uLightPositions[i] - p);

                int effectiveQuality = uShadowQuality;
                if (uFastMode && uShadowAnimationMode == 1) effectiveQuality = 0;

                shadow = calcSoftShadowQuality(shadowOrigin, shadowDir, 0.02, shadowMaxDist, uShadowSoftness, effectiveQuality);
            }
        }

        // Diffuse
        float NdotL = max(dot(n, l), 0.0);
        col += surfaceColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation * shadow;

        // Specular
        vec3 halfDir = normalize(l + viewDir);
        float NdotH = max(dot(n, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation * shadow;
        col += uSpecularColor * uLightColors[i] * spec;

        totalNdotL = max(totalNdotL, NdotL * attenuation);
    }

    // Fresnel rim
    if (uFresnelEnabled && uFresnelIntensity > 0.0) {
        float NdotV = max(dot(n, viewDir), 0.0);
        float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
        rim *= (0.3 + 0.7 * totalNdotL);
        col += uRimColor * rim;
    }

    vec4 worldHitPos = uModelMatrix * vec4(p, 1.0);
    vec4 clipPos = uProjectionMatrix * uViewMatrix * worldHitPos;
    gl_FragDepth = clamp((clipPos.z / clipPos.w) * 0.5 + 0.5, 0.0, 1.0);

    float alpha = calculateOpacityAlpha(d, sphereEntry, maxDist);

    gColor = vec4(col, alpha);
    gNormal = vec4(n * 0.5 + 0.5, uMetallic);
}
