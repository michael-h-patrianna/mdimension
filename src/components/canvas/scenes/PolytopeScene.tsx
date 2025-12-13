/**
 * Unified Polytope Scene Component - GPU Accelerated
 *
 * High-performance renderer using GPU shaders for N-dimensional transformations.
 * All geometry (faces, edges) uses the same GPU pipeline:
 * 1. Store base N-D vertices as shader attributes
 * 2. Perform rotation/scale/projection in vertex shader
 * 3. Only update uniform values in useFrame (no CPU transformation)
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  ShaderMaterial,
  Color,
  DoubleSide,
  Matrix4,
} from 'three';

import type { VectorND } from '@/lib/math/types';
import type { Face } from '@/lib/geometry/faces';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useProjectionStore } from '@/stores/projectionStore';
import { useVisualStore } from '@/stores/visualStore';
import { composeRotations } from '@/lib/math/rotation';
import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection';
import { matrixToGPUUniforms } from '@/lib/shaders/transforms/ndTransform';
import { COLOR_ALGORITHM_TO_INT } from '@/lib/shaders/palette';
import { MAX_LIGHTS, LIGHT_TYPE_TO_INT, rotationToDirection } from '@/lib/lights/types';
import type { LightSource } from '@/lib/lights/types';

/**
 * Props for PolytopeScene component
 */
export interface PolytopeSceneProps {
  /** Base (untransformed) vertices in N dimensions */
  baseVertices: VectorND[];
  /** Edge connections as pairs of vertex indices */
  edges: [number, number][];
  /** Detected faces for surface rendering */
  faces?: Face[];
  /** Current dimension of the polytope */
  dimension: number;
  /** Per-face depth values for palette coloring */
  faceDepths?: number[];
  /** Overall opacity (default: 1.0) */
  opacity?: number;
}

// Maximum extra dimensions (beyond XYZ + W)
const MAX_EXTRA_DIMS = 7;

/**
 * Create base uniforms for N-D transformation (shared by all materials)
 */
function createNDUniforms(): Record<string, { value: unknown }> {
  return {
    uRotationMatrix4D: { value: new Matrix4() },
    uDimension: { value: 4 },
    uScale4D: { value: [1, 1, 1, 1] },
    uExtraScales: { value: new Float32Array(MAX_EXTRA_DIMS).fill(1) },
    uExtraRotationCols: { value: new Float32Array(MAX_EXTRA_DIMS * 4) },
    uDepthRowSums: { value: new Float32Array(11) },
    uProjectionDistance: { value: DEFAULT_PROJECTION_DISTANCE },
    uProjectionType: { value: 1 },
  };
}

/**
 * Update N-D uniforms on a material.
 * Works with both ShaderMaterial (uniforms on material) and
 * MeshPhongMaterial with onBeforeCompile (uniforms in userData).
 */
function updateNDUniforms(
  material: THREE.Material,
  gpuData: ReturnType<typeof matrixToGPUUniforms>,
  dimension: number,
  scales: number[],
  projectionDistance: number,
  projectionType: string
): void {
  // Get uniforms - either from ShaderMaterial directly or from userData for Phong
  let u: Record<string, { value: unknown }> | undefined;

  if ('uniforms' in material && material.uniforms) {
    // ShaderMaterial
    u = (material as ShaderMaterial).uniforms;
  } else if (material.userData?.ndUniforms) {
    // MeshPhongMaterial with onBeforeCompile
    u = material.userData.ndUniforms;
  }

  if (!u) return;

  if (u.uRotationMatrix4D) (u.uRotationMatrix4D.value as Matrix4).copy(gpuData.rotationMatrix4D);
  if (u.uDimension) u.uDimension.value = dimension;
  if (u.uScale4D) u.uScale4D.value = [scales[0] ?? 1, scales[1] ?? 1, scales[2] ?? 1, scales[3] ?? 1];
  if (u.uExtraScales) {
    const extraScales = u.uExtraScales.value as Float32Array;
    for (let i = 0; i < MAX_EXTRA_DIMS; i++) {
      extraScales[i] = scales[i + 4] ?? 1;
    }
  }
  if (u.uExtraRotationCols) {
    (u.uExtraRotationCols.value as Float32Array).set(gpuData.extraRotationCols);
  }
  if (u.uDepthRowSums) {
    (u.uDepthRowSums.value as Float32Array).set(gpuData.depthRowSums);
  }
  if (u.uProjectionDistance) u.uProjectionDistance.value = projectionDistance;
  if (u.uProjectionType) u.uProjectionType.value = projectionType === 'perspective' ? 1 : 0;
}

/**
 * Convert horizontal/vertical angles to a normalized direction vector.
 * MUST match the light position calculation in SceneLighting.tsx exactly.
 * This is the direction FROM origin TO light (same as light position normalized).
 */
function anglesToDirection(horizontalDeg: number, verticalDeg: number): THREE.Vector3 {
  const hRad = (horizontalDeg * Math.PI) / 180;
  const vRad = (verticalDeg * Math.PI) / 180;
  // Match SceneLighting: x = cos(v)*cos(h), y = sin(v), z = cos(v)*sin(h)
  return new THREE.Vector3(
    Math.cos(vRad) * Math.cos(hRad),
    Math.sin(vRad),
    Math.cos(vRad) * Math.sin(hRad)
  ).normalize();
}

/**
 * Build vertex shader for N-D transformation with lighting varyings
 */
function buildFaceVertexShader(): string {
  return `
    // N-D Transformation uniforms
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];

    // Extra dimension attributes
    attribute float aExtraDim0;
    attribute float aExtraDim1;
    attribute float aExtraDim2;
    attribute float aExtraDim3;
    attribute float aExtraDim4;
    attribute float aExtraDim5;
    attribute float aExtraDim6;

    // Face depth attribute for color algorithm
    attribute float aFaceDepth;

    // Varyings for fragment shader
    varying vec3 vWorldPosition;
    varying vec3 vViewDir;
    varying float vFaceDepth;

    vec3 transformND() {
      float scaledInputs[11];
      scaledInputs[0] = position.x * uScale4D.x;
      scaledInputs[1] = position.y * uScale4D.y;
      scaledInputs[2] = position.z * uScale4D.z;
      scaledInputs[3] = aExtraDim0 * uScale4D.w;
      scaledInputs[4] = aExtraDim1 * uExtraScales[0];
      scaledInputs[5] = aExtraDim2 * uExtraScales[1];
      scaledInputs[6] = aExtraDim3 * uExtraScales[2];
      scaledInputs[7] = aExtraDim4 * uExtraScales[3];
      scaledInputs[8] = aExtraDim5 * uExtraScales[4];
      scaledInputs[9] = aExtraDim6 * uExtraScales[5];
      scaledInputs[10] = 0.0;

      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      vec3 projected;
      if (uProjectionType == 0) {
        projected = rotated.xyz;
      } else {
        float effectiveDepth = rotated.w;
        for (int j = 0; j < 11; j++) {
          if (j < uDimension) {
            effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
          }
        }
        float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
        effectiveDepth /= normFactor;
        float factor = 1.0 / (uProjectionDistance - effectiveDepth);
        projected = rotated.xyz * factor;
      }

      return projected;
    }

    void main() {
      vec3 transformed = transformND();
      vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * viewMatrix * worldPos;

      // Pass world position for normal calculation in fragment shader
      vWorldPosition = worldPos.xyz;
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      vFaceDepth = aFaceDepth;
    }
  `;
}

/**
 * Build fragment shader with full lighting (matches Mandelbulb approach)
 * Includes advanced color system with cosine palettes, LCH, and multi-source algorithms
 */
function buildFaceFragmentShader(): string {
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
      float innerCos = cos(uSpotAngles[lightIndex] * (1.0 - uSpotPenumbras[lightIndex]));
      float outerCos = cos(uSpotAngles[lightIndex]);
      return smoothstep(outerCos, innerCos, cosAngle);
    }

    vec3 calculateMultiLighting(vec3 fragPos, vec3 normal, vec3 viewDir, vec3 baseColor) {
      vec3 col = baseColor * uAmbientIntensity;

      for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= uNumLights) break;
        if (!uLightsEnabled[i]) continue;

        vec3 lightDir = getLightDirection(i, fragPos);
        float attenuation = uLightIntensities[i];

        if (uLightTypes[i] == LIGHT_TYPE_SPOT) {
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
  `;
}

/**
 * Create face ShaderMaterial with custom lighting (same approach as Mandelbulb)
 * Includes advanced color system uniforms for cosine palettes, LCH, and multi-source algorithms
 */
function createFaceShaderMaterial(
  faceColor: string,
  opacity: number
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      // N-D transformation uniforms
      ...createNDUniforms(),
      // Color
      uColor: { value: new Color(faceColor) },
      uOpacity: { value: opacity },
      // Advanced Color System uniforms
      uColorAlgorithm: { value: 2 }, // Default to cosine
      uCosineA: { value: new Vector3(0.5, 0.5, 0.5) },
      uCosineB: { value: new Vector3(0.5, 0.5, 0.5) },
      uCosineC: { value: new Vector3(1.0, 1.0, 1.0) },
      uCosineD: { value: new Vector3(0.0, 0.33, 0.67) },
      uDistPower: { value: 1.0 },
      uDistCycles: { value: 1.0 },
      uDistOffset: { value: 0.0 },
      uLchLightness: { value: 0.7 },
      uLchChroma: { value: 0.15 },
      uMultiSourceWeights: { value: new Vector3(0.5, 0.3, 0.2) },
      // Lighting (updated every frame from store)
      uLightEnabled: { value: true },
      uLightColor: { value: new Color('#ffffff') },
      uLightDirection: { value: new Vector3(0.5, 1, 0.5).normalize() },
      uLightStrength: { value: 1.0 },
      uAmbientIntensity: { value: 0.3 },
      uDiffuseIntensity: { value: 1.0 },
      uSpecularIntensity: { value: 1.0 },
      uSpecularPower: { value: 32.0 },
      uSpecularColor: { value: new Color('#ffffff') },
      // Fresnel
      uFresnelEnabled: { value: false },
      uFresnelIntensity: { value: 0.5 },
      uRimColor: { value: new Color('#ffffff') },
      // Multi-light system uniforms
      uNumLights: { value: 0 },
      uLightsEnabled: { value: [false, false, false, false] },
      uLightTypes: { value: [0, 0, 0, 0] },
      uLightPositions: { value: [new Vector3(0, 5, 0), new Vector3(0, 5, 0), new Vector3(0, 5, 0), new Vector3(0, 5, 0)] },
      uLightDirections: { value: [new Vector3(0, -1, 0), new Vector3(0, -1, 0), new Vector3(0, -1, 0), new Vector3(0, -1, 0)] },
      uLightColors: { value: [new Color('#FFFFFF'), new Color('#FFFFFF'), new Color('#FFFFFF'), new Color('#FFFFFF')] },
      uLightIntensities: { value: [1.0, 1.0, 1.0, 1.0] },
      uSpotAngles: { value: [Math.PI / 6, Math.PI / 6, Math.PI / 6, Math.PI / 6] },
      uSpotPenumbras: { value: [0.5, 0.5, 0.5, 0.5] },
    },
    vertexShader: buildFaceVertexShader(),
    fragmentShader: buildFaceFragmentShader(),
    transparent: opacity < 1,
    side: DoubleSide,
    depthWrite: opacity >= 1,
  });
}

/**
 * Build edge vertex shader (N-D transformation only, no lighting)
 */
function buildEdgeVertexShader(): string {
  return `
    uniform mat4 uRotationMatrix4D;
    uniform int uDimension;
    uniform vec4 uScale4D;
    uniform float uExtraScales[${MAX_EXTRA_DIMS}];
    uniform float uProjectionDistance;
    uniform int uProjectionType;
    uniform float uExtraRotationCols[${MAX_EXTRA_DIMS * 4}];
    uniform float uDepthRowSums[11];

    attribute float aExtraDim0;
    attribute float aExtraDim1;
    attribute float aExtraDim2;
    attribute float aExtraDim3;
    attribute float aExtraDim4;
    attribute float aExtraDim5;
    attribute float aExtraDim6;

    vec3 transformND() {
      float scaledInputs[11];
      scaledInputs[0] = position.x * uScale4D.x;
      scaledInputs[1] = position.y * uScale4D.y;
      scaledInputs[2] = position.z * uScale4D.z;
      scaledInputs[3] = aExtraDim0 * uScale4D.w;
      scaledInputs[4] = aExtraDim1 * uExtraScales[0];
      scaledInputs[5] = aExtraDim2 * uExtraScales[1];
      scaledInputs[6] = aExtraDim3 * uExtraScales[2];
      scaledInputs[7] = aExtraDim4 * uExtraScales[3];
      scaledInputs[8] = aExtraDim5 * uExtraScales[4];
      scaledInputs[9] = aExtraDim6 * uExtraScales[5];
      scaledInputs[10] = 0.0;

      vec4 scaledPos = vec4(scaledInputs[0], scaledInputs[1], scaledInputs[2], scaledInputs[3]);
      vec4 rotated = uRotationMatrix4D * scaledPos;

      for (int i = 0; i < ${MAX_EXTRA_DIMS}; i++) {
        if (i + 5 <= uDimension) {
          float extraDimValue = scaledInputs[i + 4];
          rotated.x += uExtraRotationCols[i * 4 + 0] * extraDimValue;
          rotated.y += uExtraRotationCols[i * 4 + 1] * extraDimValue;
          rotated.z += uExtraRotationCols[i * 4 + 2] * extraDimValue;
          rotated.w += uExtraRotationCols[i * 4 + 3] * extraDimValue;
        }
      }

      vec3 projected;
      if (uProjectionType == 0) {
        projected = rotated.xyz;
      } else {
        float effectiveDepth = rotated.w;
        for (int j = 0; j < 11; j++) {
          if (j < uDimension) {
            effectiveDepth += uDepthRowSums[j] * scaledInputs[j];
          }
        }
        float normFactor = uDimension > 4 ? sqrt(float(uDimension - 3)) : 1.0;
        effectiveDepth /= normFactor;
        float factor = 1.0 / (uProjectionDistance - effectiveDepth);
        projected = rotated.xyz * factor;
      }

      return projected;
    }

    void main() {
      vec3 projected = transformND();
      gl_Position = projectionMatrix * modelViewMatrix * vec4(projected, 1.0);
    }
  `;
}

/**
 * Create edge material with N-D transformation (no lighting)
 */
function createEdgeMaterial(edgeColor: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...createNDUniforms(),
      uColor: { value: new Color(edgeColor) },
      uOpacity: { value: opacity },
    },
    vertexShader: buildEdgeVertexShader(),
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
  });
}

/**
 * Calculate safe projection distance
 */
function calculateSafeProjectionDistance(
  vertices: VectorND[],
  normalizationFactor: number
): number {
  if (vertices.length === 0 || vertices[0]!.length <= 3) {
    return DEFAULT_PROJECTION_DISTANCE;
  }

  let maxEffectiveDepth = 0;
  for (const vertex of vertices) {
    let sum = 0;
    for (let d = 3; d < vertex.length; d++) {
      sum += vertex[d]!;
    }
    const effectiveDepth = sum / normalizationFactor;
    maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth);
  }

  return Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + 2.0);
}

/**
 * Build BufferGeometry with N-D attributes from vertices
 */
function buildNDGeometry(
  vertices: VectorND[],
  setNormal?: (idx: number, normals: Float32Array) => void
): BufferGeometry {
  const count = vertices.length;
  const geo = new BufferGeometry();

  const positions = new Float32Array(count * 3);
  const normals = setNormal ? new Float32Array(count * 3) : null;
  const extraDim0 = new Float32Array(count);
  const extraDim1 = new Float32Array(count);
  const extraDim2 = new Float32Array(count);
  const extraDim3 = new Float32Array(count);
  const extraDim4 = new Float32Array(count);
  const extraDim5 = new Float32Array(count);
  const extraDim6 = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const v = vertices[i]!;
    const i3 = i * 3;
    positions[i3] = v[0] ?? 0;
    positions[i3 + 1] = v[1] ?? 0;
    positions[i3 + 2] = v[2] ?? 0;
    extraDim0[i] = v[3] ?? 0;
    extraDim1[i] = v[4] ?? 0;
    extraDim2[i] = v[5] ?? 0;
    extraDim3[i] = v[6] ?? 0;
    extraDim4[i] = v[7] ?? 0;
    extraDim5[i] = v[8] ?? 0;
    extraDim6[i] = v[9] ?? 0;

    if (normals && setNormal) {
      setNormal(i, normals);
    }
  }

  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (normals) {
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  }
  geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
  geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
  geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
  geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
  geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
  geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
  geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));

  return geo;
}

/**
 * GPU-accelerated polytope renderer.
 * All transformations happen in vertex shaders - only uniforms updated per frame.
 */
export const PolytopeScene = React.memo(function PolytopeScene({
  baseVertices,
  edges,
  faces = [],
  dimension,
  faceDepths = [],
  opacity = 1.0,
}: PolytopeSceneProps) {
  const numVertices = baseVertices.length;
  const numEdges = edges.length;
  const numFaces = faces.length;

  // ============ REFS ============
  const faceMeshRef = useRef<THREE.Mesh>(null);
  const edgeMeshRef = useRef<THREE.LineSegments>(null);

  // ============ VISUAL SETTINGS ============
  const {
    edgesVisible,
    facesVisible,
    edgeColor,
    faceColor,
    shaderSettings,
  } = useVisualStore(
    useShallow((state) => ({
      edgesVisible: state.edgesVisible,
      facesVisible: state.facesVisible,
      edgeColor: state.edgeColor,
      faceColor: state.faceColor,
      shaderSettings: state.shaderSettings,
    }))
  );

  const surfaceSettings = shaderSettings.surface;

  // ============ MATERIALS ============
  // Uses custom ShaderMaterial with lighting (same approach as Mandelbulb)
  const faceMaterial = useMemo(() => {
    return createFaceShaderMaterial(faceColor, surfaceSettings.faceOpacity);
  }, [faceColor, surfaceSettings.faceOpacity]);

  const edgeMaterial = useMemo(() => {
    return createEdgeMaterial(edgeColor, opacity);
  }, [edgeColor, opacity]);

  // ============ FACE GEOMETRY ============
  const faceGeometry = useMemo(() => {
    if (numFaces === 0) return null;

    let vertexCount = 0;
    for (const face of faces) {
      if (face.vertices.length === 3) vertexCount += 3;
      else if (face.vertices.length === 4) vertexCount += 6;
    }
    if (vertexCount === 0) return null;

    const geo = new BufferGeometry();
    const positions = new Float32Array(vertexCount * 3);
    const extraDim0 = new Float32Array(vertexCount);
    const extraDim1 = new Float32Array(vertexCount);
    const extraDim2 = new Float32Array(vertexCount);
    const extraDim3 = new Float32Array(vertexCount);
    const extraDim4 = new Float32Array(vertexCount);
    const extraDim5 = new Float32Array(vertexCount);
    const extraDim6 = new Float32Array(vertexCount);
    const faceDepthAttr = new Float32Array(vertexCount);

    let idx = 0;
    let faceIdx = 0;

    const setVertex = (vIdx: number, depth: number) => {
      const v = baseVertices[vIdx];
      if (!v) return;

      const i3 = idx * 3;
      positions[i3] = v[0] ?? 0;
      positions[i3 + 1] = v[1] ?? 0;
      positions[i3 + 2] = v[2] ?? 0;

      extraDim0[idx] = v[3] ?? 0;
      extraDim1[idx] = v[4] ?? 0;
      extraDim2[idx] = v[5] ?? 0;
      extraDim3[idx] = v[6] ?? 0;
      extraDim4[idx] = v[7] ?? 0;
      extraDim5[idx] = v[8] ?? 0;
      extraDim6[idx] = v[9] ?? 0;
      faceDepthAttr[idx] = depth;

      idx++;
    };

    for (const face of faces) {
      const vis = face.vertices;
      if (vis.length < 3) {
        faceIdx++;
        continue;
      }

      const depth = faceDepths[faceIdx] ?? 0.5;

      // Normals computed in fragment shader via dFdx/dFdy - no need to calculate here
      if (vis.length === 3) {
        setVertex(vis[0]!, depth);
        setVertex(vis[1]!, depth);
        setVertex(vis[2]!, depth);
      } else if (vis.length === 4) {
        setVertex(vis[0]!, depth);
        setVertex(vis[1]!, depth);
        setVertex(vis[2]!, depth);
        setVertex(vis[0]!, depth);
        setVertex(vis[2]!, depth);
        setVertex(vis[3]!, depth);
      }

      faceIdx++;
    }

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    // Note: normals are computed in fragment shader via dFdx/dFdy derivatives
    geo.setAttribute('aExtraDim0', new Float32BufferAttribute(extraDim0, 1));
    geo.setAttribute('aExtraDim1', new Float32BufferAttribute(extraDim1, 1));
    geo.setAttribute('aExtraDim2', new Float32BufferAttribute(extraDim2, 1));
    geo.setAttribute('aExtraDim3', new Float32BufferAttribute(extraDim3, 1));
    geo.setAttribute('aExtraDim4', new Float32BufferAttribute(extraDim4, 1));
    geo.setAttribute('aExtraDim5', new Float32BufferAttribute(extraDim5, 1));
    geo.setAttribute('aExtraDim6', new Float32BufferAttribute(extraDim6, 1));
    geo.setAttribute('aFaceDepth', new Float32BufferAttribute(faceDepthAttr, 1));

    return geo;
  }, [numFaces, faces, baseVertices, faceDepths]);

  // ============ EDGE GEOMETRY ============
  const edgeGeometry = useMemo(() => {
    if (numEdges === 0) return null;

    const edgeVertices: VectorND[] = [];
    for (const [a, b] of edges) {
      const vA = baseVertices[a];
      const vB = baseVertices[b];
      if (vA && vB) {
        edgeVertices.push(vA, vB);
      }
    }

    return buildNDGeometry(edgeVertices);
  }, [numEdges, edges, baseVertices]);

  // ============ CLEANUP ============
  useEffect(() => {
    return () => {
      faceMaterial.dispose();
      edgeMaterial.dispose();
      faceGeometry?.dispose();
      edgeGeometry?.dispose();
    };
  }, [
    faceMaterial,
    edgeMaterial,
    faceGeometry,
    edgeGeometry,
  ]);

  // ============ USEFRAME: UPDATE UNIFORMS ONLY ============
  useFrame(() => {
    if (numVertices === 0) return;

    // Read current state
    const rotations = useRotationStore.getState().rotations;
    const { uniformScale, perAxisScale } = useTransformStore.getState();
    const projectionType = useProjectionStore.getState().type;

    // Read lighting and color settings from store
    const visualState = useVisualStore.getState();
    const lightEnabled = visualState.lightEnabled;
    const lightColor = visualState.lightColor;
    const lightHorizontalAngle = visualState.lightHorizontalAngle;
    const lightVerticalAngle = visualState.lightVerticalAngle;
    const lightStrength = visualState.lightStrength ?? 1.0;
    const ambientIntensity = visualState.ambientIntensity;
    const diffuseIntensity = visualState.diffuseIntensity;
    const specularIntensity = visualState.specularIntensity;
    const shininess = visualState.shininess;
    const specularColor = visualState.specularColor;
    const fresnelEnabled = visualState.shaderSettings.surface.fresnelEnabled;
    const fresnelIntensity = visualState.fresnelIntensity;
    const rimColor = visualState.edgeColor;

    // Read advanced color system state
    const colorAlgorithm = visualState.colorAlgorithm;
    const cosineCoefficients = visualState.cosineCoefficients;
    const distribution = visualState.distribution;
    const lchLightness = visualState.lchLightness;
    const lchChroma = visualState.lchChroma;
    const multiSourceWeights = visualState.multiSourceWeights;

    // Calculate light direction from angles
    const lightDirection = anglesToDirection(lightHorizontalAngle, lightVerticalAngle);

    // Build transformation data
    const scales: number[] = [];
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale);
    }

    const rotationMatrix = composeRotations(dimension, rotations);
    const gpuData = matrixToGPUUniforms(rotationMatrix, dimension);

    const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1;
    const projectionDistance = calculateSafeProjectionDistance(baseVertices, normalizationFactor);

    // Update all materials through mesh refs
    const meshRefs = [
      faceMeshRef,
      edgeMeshRef,
    ];

    for (const ref of meshRefs) {
      if (ref.current) {
        const material = ref.current.material as ShaderMaterial;

        // Update N-D transformation uniforms
        updateNDUniforms(material, gpuData, dimension, scales, projectionDistance, projectionType);

        // Update lighting uniforms (only for materials that have them)
        const u = material.uniforms;
        if (u.uLightEnabled) u.uLightEnabled.value = lightEnabled;
        if (u.uLightColor) (u.uLightColor.value as Color).set(lightColor);
        if (u.uLightDirection) (u.uLightDirection.value as Vector3).copy(lightDirection);
        if (u.uLightStrength) u.uLightStrength.value = lightStrength;
        if (u.uAmbientIntensity) u.uAmbientIntensity.value = ambientIntensity;
        if (u.uDiffuseIntensity) u.uDiffuseIntensity.value = diffuseIntensity;
        if (u.uSpecularIntensity) u.uSpecularIntensity.value = specularIntensity;
        if (u.uSpecularPower) u.uSpecularPower.value = shininess;
        if (u.uSpecularColor) (u.uSpecularColor.value as Color).set(specularColor);
        if (u.uFresnelEnabled) u.uFresnelEnabled.value = fresnelEnabled;
        if (u.uFresnelIntensity) u.uFresnelIntensity.value = fresnelIntensity;
        if (u.uRimColor) (u.uRimColor.value as Color).set(rimColor);

        // Update advanced color system uniforms (only for face materials)
        if (u.uColorAlgorithm) u.uColorAlgorithm.value = COLOR_ALGORITHM_TO_INT[colorAlgorithm];
        if (u.uCosineA) (u.uCosineA.value as Vector3).set(cosineCoefficients.a[0], cosineCoefficients.a[1], cosineCoefficients.a[2]);
        if (u.uCosineB) (u.uCosineB.value as Vector3).set(cosineCoefficients.b[0], cosineCoefficients.b[1], cosineCoefficients.b[2]);
        if (u.uCosineC) (u.uCosineC.value as Vector3).set(cosineCoefficients.c[0], cosineCoefficients.c[1], cosineCoefficients.c[2]);
        if (u.uCosineD) (u.uCosineD.value as Vector3).set(cosineCoefficients.d[0], cosineCoefficients.d[1], cosineCoefficients.d[2]);
        if (u.uDistPower) u.uDistPower.value = distribution.power;
        if (u.uDistCycles) u.uDistCycles.value = distribution.cycles;
        if (u.uDistOffset) u.uDistOffset.value = distribution.offset;
        if (u.uLchLightness) u.uLchLightness.value = lchLightness;
        if (u.uLchChroma) u.uLchChroma.value = lchChroma;
        if (u.uMultiSourceWeights) (u.uMultiSourceWeights.value as Vector3).set(multiSourceWeights.depth, multiSourceWeights.orbitTrap, multiSourceWeights.normal);

        // Update multi-light system uniforms
        if (u.uNumLights && u.uLightsEnabled && u.uLightTypes && u.uLightPositions &&
            u.uLightDirections && u.uLightColors && u.uLightIntensities &&
            u.uSpotAngles && u.uSpotPenumbras) {
          const lights = visualState.lights;
          const numLights = Math.min(lights.length, MAX_LIGHTS);
          u.uNumLights.value = numLights;

          for (let i = 0; i < MAX_LIGHTS; i++) {
            const light: LightSource | undefined = lights[i];

            if (light) {
              (u.uLightsEnabled.value as boolean[])[i] = light.enabled;
              (u.uLightTypes.value as number[])[i] = LIGHT_TYPE_TO_INT[light.type];
              (u.uLightPositions.value as Vector3[])[i]!.set(light.position[0], light.position[1], light.position[2]);

              // Calculate direction from rotation
              const dir = rotationToDirection(light.rotation);
              (u.uLightDirections.value as Vector3[])[i]!.set(dir[0], dir[1], dir[2]);

              (u.uLightColors.value as Color[])[i]!.set(light.color);
              (u.uLightIntensities.value as number[])[i] = light.intensity;
              (u.uSpotAngles.value as number[])[i] = (light.coneAngle * Math.PI) / 180;
              (u.uSpotPenumbras.value as number[])[i] = light.penumbra;
            } else {
              (u.uLightsEnabled.value as boolean[])[i] = false;
            }
          }
        }
      }
    }
  });

  // ============ RENDER ============
  return (
    <group>
      {/* Polytope faces */}
      {facesVisible && faceGeometry && (
        <mesh ref={faceMeshRef} geometry={faceGeometry} material={faceMaterial} />
      )}

      {/* Polytope edges */}
      {edgesVisible && edgeGeometry && (
        <lineSegments ref={edgeMeshRef} geometry={edgeGeometry} material={edgeMaterial} />
      )}
    </group>
  );
});
