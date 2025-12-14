/**
 * Point Fragment Shader for Point Cloud Rendering
 *
 * Full-featured fragment shader matching PolytopeScene capabilities:
 * - All 8 color algorithms
 * - Multi-light system (4 lights)
 * - Fresnel/rim lighting
 * - MRT output for SSR
 * - Pseudo-normal sphere shading
 *
 * @module
 */

import { GLSL_COSINE_PALETTE } from '@/lib/shaders/palette/cosine.glsl'
import {
  SHADER_EPSILON,
  MIN_DISTANCE_ATTENUATION,
  FRESNEL_POWER,
  RIM_BASE_FACTOR,
  RIM_NDOTL_FACTOR,
} from './constants'

/**
 * Build fragment shader for GPU point rendering with full lighting.
 *
 * @returns GLSL fragment shader string
 */
export function buildPointFragmentShader(): string {
  return `
    precision highp float;
    precision highp int;

    // MRT output declarations for WebGL2
    layout(location = 0) out vec4 gColor;
    layout(location = 1) out vec4 gNormal;

    // Color uniforms
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform bool uUseVertexColors;

    // Material properties for G-buffer
    uniform float uMetallic;

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

    // Lighting uniforms (legacy single-light)
    uniform bool uLightEnabled;
    uniform vec3 uLightColor;
    uniform vec3 uLightDirection;
    uniform float uLightStrength;
    uniform float uAmbientIntensity;
    uniform vec3 uAmbientColor;
    uniform float uDiffuseIntensity;
    uniform float uSpecularIntensity;
    uniform float uSpecularPower;
    uniform vec3 uSpecularColor;

    // Multi-Light System Constants and Uniforms
    #define MAX_LIGHTS 4
    #define LIGHT_TYPE_POINT 0
    #define LIGHT_TYPE_DIRECTIONAL 1
    #define LIGHT_TYPE_SPOT 2

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

    // Fresnel uniforms
    uniform bool uFresnelEnabled;
    uniform float uFresnelIntensity;
    uniform vec3 uRimColor;

    // Inputs from vertex shader
    in vec3 vColor;
    in float vDepth;
    in vec3 vWorldPosition;
    in vec3 vViewDir;

    // ============================================================
    // Include cosine palette and LCH functions
    // ============================================================
    ${GLSL_COSINE_PALETTE}

    // ============================================================
    // HSL Color Space Functions (for monochromatic/analogous)
    // ============================================================

    vec3 hsl2rgb(vec3 hsl) {
      float h = hsl.x;
      float s = hsl.y;
      float l = hsl.z;
      float c = (1.0 - abs(2.0 * l - 1.0)) * s;
      float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
      float m = l - c / 2.0;
      vec3 rgb;
      if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
      else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
      else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
      else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
      else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
      else rgb = vec3(c, 0.0, x);
      return rgb + m;
    }

    vec3 rgb2hsl(vec3 rgb) {
      float maxC = max(max(rgb.r, rgb.g), rgb.b);
      float minC = min(min(rgb.r, rgb.g), rgb.b);
      float l = (maxC + minC) / 2.0;
      if (maxC == minC) return vec3(0.0, 0.0, l);
      float d = maxC - minC;
      float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
      float h;
      if (maxC == rgb.r) h = mod((rgb.g - rgb.b) / d + 6.0, 6.0) / 6.0;
      else if (maxC == rgb.g) h = ((rgb.b - rgb.r) / d + 2.0) / 6.0;
      else h = ((rgb.r - rgb.g) / d + 4.0) / 6.0;
      return vec3(h, s, l);
    }

    // ============================================================
    // Color Algorithm Functions
    // ============================================================

    // Algorithm 0: Monochromatic - Same hue, varying lightness
    vec3 getMonochromaticColor(vec3 baseHSL, float t) {
      float litVar = mix(0.3, 0.7, t);
      return hsl2rgb(vec3(baseHSL.x, baseHSL.y, litVar));
    }

    // Algorithm 1: Analogous - Hue varies ±30° from base
    vec3 getAnalogousColor(vec3 baseHSL, float t) {
      float hueOffset = (t - 0.5) * 0.167; // ±30° = ±0.0833, doubled for full range
      return hsl2rgb(vec3(fract(baseHSL.x + hueOffset), baseHSL.y, baseHSL.z));
    }

    // Algorithm 6: Multi-Source blending
    // Blends depth, orbitTrap, and normal-based contributions
    vec3 getMultiSourceColor(float depth, float orbitTrap, vec3 normal) {
      vec3 w = uMultiSourceWeights / max(uMultiSourceWeights.x + uMultiSourceWeights.y + uMultiSourceWeights.z, ${SHADER_EPSILON});
      float normalFactor = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
      float t = w.x * depth + w.y * orbitTrap + w.z * normalFactor;
      float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
      return cosinePalette(distributedT, uCosineA, uCosineB, uCosineC, uCosineD);
    }

    // Unified color algorithm selector
    vec3 getColorByAlgorithm(float t, vec3 normal, vec3 baseHSL) {
      if (uColorAlgorithm == 0) {
        // Monochromatic: Same hue, varying lightness
        return getMonochromaticColor(baseHSL, t);
      } else if (uColorAlgorithm == 1) {
        // Analogous: Hue varies ±30° from base
        return getAnalogousColor(baseHSL, t);
      } else if (uColorAlgorithm == 2) {
        // Cosine gradient palette
        float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
        return cosinePalette(distributedT, uCosineA, uCosineB, uCosineC, uCosineD);
      } else if (uColorAlgorithm == 3) {
        // Normal-based coloring
        float normalT = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        float distributedT = applyDistribution(normalT, uDistPower, uDistCycles, uDistOffset);
        return cosinePalette(distributedT, uCosineA, uCosineB, uCosineC, uCosineD);
      } else if (uColorAlgorithm == 4) {
        // Distance-field coloring (uses t as distance)
        float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
        return cosinePalette(distributedT, uCosineA, uCosineB, uCosineC, uCosineD);
      } else if (uColorAlgorithm == 5) {
        // LCH/Oklab perceptual
        float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
        return lchColor(distributedT, uLchLightness, uLchChroma);
      } else if (uColorAlgorithm == 6) {
        // Multi-source mapping (uses depth, position-based trap, and normal)
        // For point clouds, we compute a position-based orbitTrap from world position
        float orbitTrap = length(vWorldPosition) * 0.25; // Scale to ~0-1 range
        return getMultiSourceColor(t, orbitTrap, normal);
      } else {
        // 7=radial, default to cosine
        float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
        return cosinePalette(distributedT, uCosineA, uCosineB, uCosineC, uCosineD);
      }
    }

    // ============================================================
    // Pseudo-Normal Computation for Sphere Shading
    // ============================================================

    vec3 computePseudoNormal() {
      // Map gl_PointCoord from [0,1] to [-1,1]
      vec2 uv = gl_PointCoord * 2.0 - 1.0;

      // Calculate z² for sphere equation: x² + y² + z² = 1
      float z2 = 1.0 - dot(uv, uv);

      // Discard fragments outside the sphere
      if (z2 < 0.0) discard;

      // Return normalized sphere normal
      return normalize(vec3(uv, sqrt(z2)));
    }

    // ============================================================
    // Multi-Light Helper Functions
    // ============================================================

    vec3 getLightDirection(int lightIndex, vec3 fragPos) {
      int lightType = uLightTypes[lightIndex];
      if (lightType == LIGHT_TYPE_POINT) {
        return normalize(uLightPositions[lightIndex] - fragPos);
      } else if (lightType == LIGHT_TYPE_DIRECTIONAL) {
        return normalize(uLightDirections[lightIndex]);
      } else if (lightType == LIGHT_TYPE_SPOT) {
        return normalize(uLightPositions[lightIndex] - fragPos);
      }
      return vec3(0.0, 1.0, 0.0);
    }

    float getSpotAttenuation(int lightIndex, vec3 lightToFrag) {
      float cosAngle = dot(lightToFrag, normalize(uLightDirections[lightIndex]));
      // Use precomputed cosines to avoid per-fragment trig
      return smoothstep(uSpotCosOuter[lightIndex], uSpotCosInner[lightIndex], cosAngle);
    }

    // Distance attenuation for point and spot lights
    float getDistanceAttenuation(int lightIndex, float distance) {
      float range = uLightRanges[lightIndex];
      float decay = uLightDecays[lightIndex];

      // No distance falloff when range is 0 (infinite range)
      if (range <= 0.0) {
        return 1.0;
      }

      // Clamp distance to prevent division by zero
      float d = max(distance, ${MIN_DISTANCE_ATTENUATION});

      // Three.js attenuation formula
      float rangeAttenuation = clamp(1.0 - d / range, 0.0, 1.0);
      return pow(rangeAttenuation, decay);
    }

    vec3 calculateMultiLighting(vec3 fragPos, vec3 normal, vec3 viewDir, vec3 baseColor) {
      vec3 col = baseColor * uAmbientColor * uAmbientIntensity;

      for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uNumLights) break;
        if (!uLightsEnabled[i]) continue;

        vec3 lightDir = getLightDirection(i, fragPos);
        float attenuation = uLightIntensities[i];

        // Apply distance attenuation for point and spot lights
        int lightType = uLightTypes[i];
        if (lightType == LIGHT_TYPE_POINT || lightType == LIGHT_TYPE_SPOT) {
          float distance = length(uLightPositions[i] - fragPos);
          attenuation *= getDistanceAttenuation(i, distance);
        }

        // Apply spot light cone attenuation
        if (lightType == LIGHT_TYPE_SPOT) {
          vec3 lightToFrag = normalize(fragPos - uLightPositions[i]);
          attenuation *= getSpotAttenuation(i, lightToFrag);
        }

        if (attenuation < 0.001) continue;

        // Diffuse (Lambert)
        float NdotL = max(dot(normal, lightDir), 0.0);
        col += baseColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation;

        // Specular (Blinn-Phong)
        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation;
        col += uSpecularColor * uLightColors[i] * spec;
      }

      return col;
    }

    // ============================================================
    // Main Function
    // ============================================================

    void main() {
      // Compute pseudo-normal for sphere-like shading
      vec3 normal = computePseudoNormal();
      vec3 viewDir = normalize(vViewDir);

      // Apply distribution to depth for palette coloring
      float t = vDepth;

      // Get base color from algorithm
      vec3 baseHSL = rgb2hsl(uColor);
      vec3 baseColor;
      if (uUseVertexColors) {
        baseColor = vColor;
      } else {
        baseColor = getColorByAlgorithm(t, normal, baseHSL);
      }

      // Apply lighting
      vec3 col;
      if (uNumLights > 0) {
        // Use multi-light system
        col = calculateMultiLighting(vWorldPosition, normal, viewDir, baseColor);

        // Fresnel rim lighting (applied once for all lights combined)
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = max(dot(normal, viewDir), 0.0);
          float rim = pow(1.0 - NdotV, ${FRESNEL_POWER}) * uFresnelIntensity * 2.0;
          // Average NdotL for rim modulation
          float avgNdotL = 0.0;
          int activeLights = 0;
          for (int i = 0; i < MAX_LIGHTS; i++) {
            if (i >= uNumLights) break;
            if (!uLightsEnabled[i]) continue;
            vec3 lightDir = getLightDirection(i, vWorldPosition);
            avgNdotL += max(dot(normal, lightDir), 0.0);
            activeLights++;
          }
          if (activeLights > 0) {
            avgNdotL /= float(activeLights);
          }
          rim *= (${RIM_BASE_FACTOR} + ${RIM_NDOTL_FACTOR} * avgNdotL);
          col += uRimColor * rim;
        }
      } else if (uLightEnabled) {
        // Legacy single-light fallback
        col = baseColor * uAmbientColor * uAmbientIntensity;
        vec3 lightDir = normalize(uLightDirection);

        // Diffuse
        float NdotL = max(dot(normal, lightDir), 0.0);
        col += baseColor * uLightColor * NdotL * uDiffuseIntensity * uLightStrength;

        // Specular (Blinn-Phong)
        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * uLightStrength;
        col += uSpecularColor * uLightColor * spec;

        // Fresnel rim lighting
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = max(dot(normal, viewDir), 0.0);
          float rim = pow(1.0 - NdotV, ${FRESNEL_POWER}) * uFresnelIntensity * 2.0;
          rim *= (${RIM_BASE_FACTOR} + ${RIM_NDOTL_FACTOR} * NdotL);
          col += uRimColor * rim;
        }
      } else {
        // No lighting - just ambient
        col = baseColor * uAmbientColor * uAmbientIntensity;
      }

      // Output to MRT (Multiple Render Targets)
      // gColor: Color buffer (RGBA)
      // gNormal: Normal buffer (RGB = normal * 0.5 + 0.5, A = reflectivity/metallic)
      gColor = vec4(col, uOpacity);
      gNormal = vec4(normal * 0.5 + 0.5, uMetallic);
    }
  `
}
