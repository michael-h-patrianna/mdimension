/**
 * Shadow Map Uniform Utilities
 *
 * TypeScript utilities for creating and updating shadow map uniforms
 * used by mesh-based objects (Polytope, TubeWireframe) to receive shadows.
 *
 * Supports:
 * - 2D shadow maps for directional and spot lights
 * - Cube shadow maps for point lights (omnidirectional shadows)
 * - PCF (Percentage Closer Filtering) for soft shadow edges
 */

import type { Matrix4, Texture } from 'three';
// CubeTexture import removed - cube shadow maps disabled due to WebGL bindTexture errors
import * as THREE from 'three';

import { MAX_LIGHTS } from '@/rendering/lights/types';

import type { ShadowQuality } from './types';

// =============================================================================
// Placeholder Textures
// =============================================================================

/**
 * Create a 1x1 placeholder 2D texture for shadow maps.
 * Prevents WebGL errors when no shadow map is bound.
 * Returns depth of 1.0 (max distance = no shadow).
 */
function createPlaceholder2DTexture(): THREE.DataTexture {
  const data = new Uint8Array([255]); // 1.0 = max depth = fully lit
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  return texture;
}

// Cube shadow map placeholder - DISABLED due to WebGL bindTexture errors
// TODO: Fix cube texture creation for point light shadows
// function createPlaceholderCubeTexture(): THREE.CubeTexture { ... }

// Cached placeholder textures - created once and reused
let cachedPlaceholder2D: THREE.DataTexture | null = null;

/** Get the cached placeholder 2D shadow map texture */
function getPlaceholder2D(): THREE.DataTexture {
  if (!cachedPlaceholder2D) {
    cachedPlaceholder2D = createPlaceholder2DTexture();
  }
  return cachedPlaceholder2D;
}

// =============================================================================
// Types
// =============================================================================

/** Shadow data collected from a single light */
export interface ShadowLightData {
  /** Light type: 0=point, 1=directional, 2=spot */
  lightType: number;
  /** Shadow map texture (2D for directional/spot, null for point) */
  shadowMap: Texture | null;
  /** Shadow matrix (world to light clip space) */
  shadowMatrix: Matrix4;
  /** Whether this light casts shadows */
  castsShadow: boolean;
  /** Shadow camera near plane (for point lights) */
  cameraNear: number;
  /** Shadow camera far plane (for point lights) */
  cameraFar: number;
}

/** Shadow map uniform values */
export interface ShadowMapUniforms {
  // 2D shadow maps (directional/spot)
  uShadowMap0: { value: Texture | null };
  uShadowMap1: { value: Texture | null };
  uShadowMap2: { value: Texture | null };
  uShadowMap3: { value: Texture | null };
  // Shadow matrices
  uShadowMatrix0: { value: Matrix4 };
  uShadowMatrix1: { value: Matrix4 };
  uShadowMatrix2: { value: Matrix4 };
  uShadowMatrix3: { value: Matrix4 };
  // Cube shadow maps (point lights) - DISABLED due to WebGL errors
  // TODO: Re-enable when cube texture placeholder issue is fixed
  // uShadowCubeMap0: { value: CubeTexture | null };
  // uShadowCubeMap1: { value: CubeTexture | null };
  // uShadowCubeMap2: { value: CubeTexture | null };
  // uShadowCubeMap3: { value: CubeTexture | null };
  // Per-light flags
  uLightCastsShadow: { value: boolean[] };
  // Global settings
  uShadowMapBias: { value: number };
  uShadowMapSize: { value: number };
  uShadowPCFSamples: { value: number };
  uShadowCameraNear: { value: number };
  uShadowCameraFar: { value: number };
}

// =============================================================================
// Constants
// =============================================================================

/** Shadow map sizes for each quality level */
export const SHADOW_MAP_SIZES: Record<ShadowQuality, number> = {
  low: 512,
  medium: 1024,
  high: 2048,
  ultra: 4096,
};

/** Default shadow bias to prevent shadow acne */
const DEFAULT_SHADOW_BIAS = 0.001;

/** Default shadow map size */
const DEFAULT_SHADOW_MAP_SIZE = 1024;

/** Default PCF samples (1 = 3x3 kernel) */
const DEFAULT_PCF_SAMPLES = 1;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create default shadow map uniforms.
 * Call this when creating a new ShaderMaterial that should receive shadows.
 */
export function createShadowMapUniforms(): ShadowMapUniforms {
  // Use placeholder texture to prevent WebGL binding errors when no shadow map is bound
  const placeholder2D = getPlaceholder2D();

  return {
    // 2D shadow maps (use placeholder to avoid WebGL binding errors)
    uShadowMap0: { value: placeholder2D },
    uShadowMap1: { value: placeholder2D },
    uShadowMap2: { value: placeholder2D },
    uShadowMap3: { value: placeholder2D },
    // Shadow matrices
    uShadowMatrix0: { value: new THREE.Matrix4() },
    uShadowMatrix1: { value: new THREE.Matrix4() },
    uShadowMatrix2: { value: new THREE.Matrix4() },
    uShadowMatrix3: { value: new THREE.Matrix4() },
    // Cube shadow maps - DISABLED due to WebGL bindTexture errors
    // TODO: Re-enable when cube texture placeholder issue is fixed
    // Per-light flags
    uLightCastsShadow: { value: [false, false, false, false] },
    // Global settings
    uShadowMapBias: { value: DEFAULT_SHADOW_BIAS },
    uShadowMapSize: { value: DEFAULT_SHADOW_MAP_SIZE },
    uShadowPCFSamples: { value: DEFAULT_PCF_SAMPLES },
    uShadowCameraNear: { value: 0.5 },
    uShadowCameraFar: { value: 50 },
  };
}

// =============================================================================
// Update Functions
// =============================================================================

/**
 * Update shadow map uniforms from collected light data.
 *
 * @param uniforms - The uniform object to update (must have shadow map uniforms)
 * @param shadowData - Array of shadow data from scene lights
 * @param bias - Shadow map bias (prevents acne)
 * @param mapSize - Shadow map resolution
 * @param pcfSamples - PCF kernel: 0=hard, 1=3x3, 2=5x5
 */
export function updateShadowMapUniforms(
  uniforms: Record<string, { value: unknown }>,
  shadowData: ShadowLightData[],
  bias: number,
  mapSize: number,
  pcfSamples: number
): void {
  // Get typed uniform references
  const u = uniforms as unknown as ShadowMapUniforms;

  // Update per-light shadow data (cube shadow maps disabled due to WebGL errors)
  const maps = [u.uShadowMap0, u.uShadowMap1, u.uShadowMap2, u.uShadowMap3];
  const matrices = [u.uShadowMatrix0, u.uShadowMatrix1, u.uShadowMatrix2, u.uShadowMatrix3];

  for (let i = 0; i < MAX_LIGHTS; i++) {
    const data = shadowData[i];
    const map = maps[i];
    const matrix = matrices[i];

    if (data && data.castsShadow) {
      // Update 2D shadow map - use placeholder if null to avoid WebGL binding errors
      if (map) map.value = data.shadowMap ?? getPlaceholder2D();

      // Update shadow matrix (with null guard)
      if (matrix) matrix.value.copy(data.shadowMatrix);

      // Update per-light flag (with null guard)
      // Note: Point light shadows are disabled (lightType 0), only directional (1) and spot (2) work
      if (u.uLightCastsShadow?.value) {
        u.uLightCastsShadow.value[i] = data.lightType !== 0; // Disable for point lights
      }
    } else {
      // Clear data for this light - use placeholder instead of null to avoid WebGL binding errors
      if (map) map.value = getPlaceholder2D();
      if (u.uLightCastsShadow?.value) u.uLightCastsShadow.value[i] = false;
    }
  }

  // Update global settings (with null guards for materials without shadow uniforms)
  if (u.uShadowMapBias) u.uShadowMapBias.value = bias;
  if (u.uShadowMapSize) u.uShadowMapSize.value = mapSize;
  if (u.uShadowPCFSamples) u.uShadowPCFSamples.value = pcfSamples;
  if (u.uShadowCameraNear) u.uShadowCameraNear.value = 0.5;
  if (u.uShadowCameraFar) u.uShadowCameraFar.value = 50;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Collect shadow data from a Three.js scene.
 * Traverses the scene to find shadow-casting lights and extracts their shadow maps.
 *
 * @param scene - The Three.js scene to traverse
 * @param lightingState - Current lighting state from store
 * @returns Array of shadow data for each light (up to MAX_LIGHTS)
 */
export function collectShadowDataFromScene(
  scene: THREE.Scene
): ShadowLightData[] {
  const shadowData: ShadowLightData[] = [];
  let lightIdx = 0;

  scene.traverse((obj) => {
    if (lightIdx >= MAX_LIGHTS) return;

    // Check for shadow-casting lights
    if (obj instanceof THREE.DirectionalLight && obj.castShadow) {
      shadowData[lightIdx] = {
        lightType: 1, // Directional
        shadowMap: obj.shadow.map?.texture ?? null,
        shadowMatrix: obj.shadow.matrix,
        castsShadow: obj.shadow.map !== null,
        cameraNear: obj.shadow.camera.near,
        cameraFar: obj.shadow.camera.far,
      };
      lightIdx++;
    } else if (obj instanceof THREE.SpotLight && obj.castShadow) {
      shadowData[lightIdx] = {
        lightType: 2, // Spot
        shadowMap: obj.shadow.map?.texture ?? null,
        shadowMatrix: obj.shadow.matrix,
        castsShadow: obj.shadow.map !== null,
        cameraNear: obj.shadow.camera.near,
        cameraFar: obj.shadow.camera.far,
      };
      lightIdx++;
    } else if (obj instanceof THREE.PointLight && obj.castShadow) {
      // Point light shadows disabled - cube shadow maps cause WebGL bindTexture errors
      // Skip point lights entirely for shadow collection
      lightIdx++;
    }
  });

  // Fill remaining slots with empty data
  while (lightIdx < MAX_LIGHTS) {
    shadowData[lightIdx] = {
      lightType: 0,
      shadowMap: null,
      shadowMatrix: new THREE.Matrix4(),
      castsShadow: false,
      cameraNear: 0.5,
      cameraFar: 50,
    };
    lightIdx++;
  }

  return shadowData;
}

/**
 * Map shadow blur setting to PCF sample count.
 *
 * @param blur - Shadow blur setting (0-10)
 * @returns PCF sample mode: 0=hard, 1=3x3, 2=5x5
 */
export function blurToPCFSamples(blur: number): number {
  if (blur <= 0) return 0; // Hard shadows
  if (blur <= 5) return 1; // 3x3 PCF
  return 2; // 5x5 PCF
}
