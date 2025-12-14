/**
 * Face Fragment Shader for Polytope Rendering
 *
 * Implements full lighting system with multi-light support and advanced
 * color algorithms including cosine palettes, LCH, and multi-source mapping.
 *
 * @module
 */

/**
 * Build fragment shader with full lighting (matches Mandelbulb approach).
 *
 * Features:
 * - Multi-light system (point, directional, spot lights)
 * - Advanced color system (cosine palettes, LCH, multi-source)
 * - Fresnel rim lighting
 * - Legacy single-light fallback
 *
 * @returns GLSL fragment shader string
 */
export function buildFaceFragmentShader(): string {
  return `
    // Color uniforms
    uniform vec3 uColor;
    uniform float uOpacity;

    // Advanced Color System uniforms
    // 0=monochromatic, 1=analogous, 2=cosine, 3=normal, 4=distance, 5=lch, 6=multiSource
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

    // Varyings
    varying vec3 vWorldPosition;
    varying vec3 vViewDir;
    varying float vFaceDepth;

    // ============================================================
    // Cosine Gradient Palette Functions (Inigo Quilez technique)
    // ============================================================

    // Cosine gradient: a + b * cos(2π * (c * t + d))
    vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
      return a + b * cos(6.28318 * (c * t + d));
    }

    // Apply distribution curve to t value
    float applyDistribution(float t, float power, float cycles, float offset) {
      float curved = pow(clamp(t, 0.0, 1.0), power);
      float cycled = fract(curved * cycles + offset);
      return cycled;
    }

    // Main cosine palette function with distribution
    vec3 getCosinePaletteColor(float t) {
      float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
      return cosinePalette(distributedT, uCosineA, uCosineB, uCosineC, uCosineD);
    }

    // ============================================================
    // Oklab / LCH Color Space Functions (perceptually uniform)
    // ============================================================

    vec3 oklabToLinearSrgb(vec3 c) {
      float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
      float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
      float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;

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

    // Monochromatic: Same hue, varying lightness based on t
    vec3 getMonochromaticColor(vec3 baseHSL, float t) {
      float litVar = mix(0.3, 0.7, t);
      return hsl2rgb(vec3(baseHSL.x, baseHSL.y, litVar));
    }

    // Analogous: Hue varies ±30° from base color based on t
    vec3 getAnalogousColor(vec3 baseHSL, float t) {
      float hueOffset = (t - 0.5) * 0.167; // ±30° = ±0.0833, doubled for full range
      return hsl2rgb(vec3(fract(baseHSL.x + hueOffset), baseHSL.y, baseHSL.z));
    }

    // ============================================================
    // Multi-Source Color Mapping
    // ============================================================

    vec3 getMultiSourceColor(float depth, float orbitTrap, vec3 normal) {
      vec3 w = uMultiSourceWeights / (uMultiSourceWeights.x + uMultiSourceWeights.y + uMultiSourceWeights.z);
      float normalFactor = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
      float t = w.x * depth + w.y * orbitTrap + w.z * normalFactor;
      return getCosinePaletteColor(t);
    }

    // ============================================================
    // Unified Color Algorithm Selector
    // 0=monochromatic, 1=analogous, 2=cosine, 3=normal, 4=distance, 5=lch, 6=multiSource
    // ============================================================

    vec3 getColorByAlgorithm(float t, vec3 normal, vec3 baseHSL) {
      if (uColorAlgorithm == 0) {
        // Monochromatic: Same hue, varying lightness
        return getMonochromaticColor(baseHSL, t);
      } else if (uColorAlgorithm == 1) {
        // Analogous: Hue varies ±30° from base
        return getAnalogousColor(baseHSL, t);
      } else if (uColorAlgorithm == 2) {
        // Cosine gradient palette
        return getCosinePaletteColor(t);
      } else if (uColorAlgorithm == 3) {
        // Normal-based coloring
        float normalT = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        float distributedT = applyDistribution(normalT, uDistPower, uDistCycles, uDistOffset);
        return cosinePalette(distributedT, uCosineA, uCosineB, uCosineC, uCosineD);
      } else if (uColorAlgorithm == 4) {
        // Distance-field coloring (uses t as distance)
        return getCosinePaletteColor(t);
      } else if (uColorAlgorithm == 5) {
        // LCH/Oklab perceptual
        float distributedT = applyDistribution(t, uDistPower, uDistCycles, uDistOffset);
        return lchColor(distributedT, uLchLightness, uLchChroma);
      } else if (uColorAlgorithm == 6) {
        // Multi-source mapping (uses depth and normal)
        return getMultiSourceColor(t, t, normal);
      }
      return getCosinePaletteColor(t);
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
    // range = 0: infinite range (no falloff)
    // range > 0: light reaches zero intensity at this distance
    // decay = 0: no decay, 1: linear, 2: physically correct inverse square
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

    vec3 calculateMultiLighting(vec3 fragPos, vec3 normal, vec3 viewDir, vec3 baseColor) {
      vec3 col = baseColor * uAmbientIntensity;

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

        float NdotL = max(dot(normal, lightDir), 0.0);
        col += baseColor * uLightColors[i] * NdotL * uDiffuseIntensity * attenuation;

        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * attenuation;
        col += uSpecularColor * uLightColors[i] * spec;
      }

      return col;
    }

    void main() {
      // Compute face normal from screen-space derivatives of world position
      vec3 dPdx = dFdx(vWorldPosition);
      vec3 dPdy = dFdy(vWorldPosition);
      vec3 normal = normalize(cross(dPdx, dPdy));
      vec3 viewDir = normalize(vViewDir);

      // Get base color from algorithm using face depth as t value
      vec3 baseHSL = rgb2hsl(uColor);
      vec3 baseColor = getColorByAlgorithm(vFaceDepth, normal, baseHSL);

      // Multi-light calculation
      vec3 col;
      if (uNumLights > 0) {
        // Use multi-light system
        col = calculateMultiLighting(vWorldPosition, normal, viewDir, baseColor);

        // Fresnel rim lighting (applied once for all lights combined)
        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = max(dot(normal, viewDir), 0.0);
          float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
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
          rim *= (0.3 + 0.7 * avgNdotL);
          col += uRimColor * rim;
        }
      } else if (uLightEnabled) {
        // Legacy single-light fallback
        col = baseColor * uAmbientIntensity;
        vec3 lightDir = normalize(uLightDirection);

        float NdotL = max(dot(normal, lightDir), 0.0);
        col += baseColor * uLightColor * NdotL * uDiffuseIntensity * uLightStrength;

        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        float spec = pow(NdotH, uSpecularPower) * uSpecularIntensity * uLightStrength;
        col += uSpecularColor * uLightColor * spec;

        if (uFresnelEnabled && uFresnelIntensity > 0.0) {
          float NdotV = max(dot(normal, viewDir), 0.0);
          float rim = pow(1.0 - NdotV, 3.0) * uFresnelIntensity * 2.0;
          rim *= (0.3 + 0.7 * NdotL);
          col += uRimColor * rim;
        }
      } else {
        // No lighting - just ambient
        col = baseColor * uAmbientIntensity;
      }

      gl_FragColor = vec4(col, uOpacity);
    }
  `
}
