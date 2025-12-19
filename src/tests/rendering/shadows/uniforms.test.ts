/**
 * Tests for Shadow Map Uniform Utilities
 *
 * Tests the shadow uniform creation, updating, and data collection utilities.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  createShadowMapUniforms,
  updateShadowMapUniforms,
  collectShadowDataFromScene,
  blurToPCFSamples,
  SHADOW_MAP_SIZES,
  type ShadowLightData,
} from '@/rendering/shadows/uniforms';
import { MAX_LIGHTS } from '@/rendering/lights/types';

// =============================================================================
// Mock Setup
// =============================================================================

/**
 * Create a mock shadow camera
 * @param near
 * @param far
 */
function createMockShadowCamera(near = 0.5, far = 50): THREE.Camera {
  const camera = new THREE.PerspectiveCamera();
  camera.near = near;
  camera.far = far;
  return camera;
}

/**
 * Create a mock shadow map render target
 */
function createMockShadowMap(): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(1024, 1024);
  return target;
}

/**
 * Create a mock point light with shadow
 * @param position
 * @param castShadow
 */
function createMockPointLight(
  position: [number, number, number] = [5, 5, 5],
  castShadow = true
): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, 1);
  light.position.set(...position);
  light.castShadow = castShadow;

  if (castShadow) {
    light.shadow.camera = createMockShadowCamera() as THREE.PerspectiveCamera;
    light.shadow.map = createMockShadowMap();
    light.shadow.matrix = new THREE.Matrix4();
  }

  return light;
}

/**
 * Create a mock directional light with shadow
 * @param position
 * @param castShadow
 */
function createMockDirectionalLight(
  position: [number, number, number] = [10, 10, 10],
  castShadow = true
): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(...position);
  light.castShadow = castShadow;

  if (castShadow) {
    light.shadow.camera = createMockShadowCamera() as THREE.OrthographicCamera;
    light.shadow.map = createMockShadowMap();
    light.shadow.matrix = new THREE.Matrix4();
  }

  return light;
}

/**
 * Create a mock spot light with shadow
 * @param position
 * @param castShadow
 */
function createMockSpotLight(
  position: [number, number, number] = [-5, 5, 5],
  castShadow = true
): THREE.SpotLight {
  const light = new THREE.SpotLight(0xffffff, 1);
  light.position.set(...position);
  light.castShadow = castShadow;

  if (castShadow) {
    light.shadow.camera = createMockShadowCamera() as THREE.PerspectiveCamera;
    light.shadow.map = createMockShadowMap();
    light.shadow.matrix = new THREE.Matrix4();
  }

  return light;
}

// =============================================================================
// Tests
// =============================================================================

describe('Shadow Uniform Utilities', () => {
  describe('createShadowMapUniforms', () => {
    it('should create all required shadow map uniforms', () => {
      const uniforms = createShadowMapUniforms();

      // 2D shadow maps
      expect(uniforms.uShadowMap0).toBeDefined();
      expect(uniforms.uShadowMap1).toBeDefined();
      expect(uniforms.uShadowMap2).toBeDefined();
      expect(uniforms.uShadowMap3).toBeDefined();

      // Shadow matrices
      expect(uniforms.uShadowMatrix0).toBeDefined();
      expect(uniforms.uShadowMatrix1).toBeDefined();
      expect(uniforms.uShadowMatrix2).toBeDefined();
      expect(uniforms.uShadowMatrix3).toBeDefined();

      // Point shadow maps
      expect(uniforms.uPointShadowMap0).toBeDefined();
      expect(uniforms.uPointShadowMap1).toBeDefined();
      expect(uniforms.uPointShadowMap2).toBeDefined();
      expect(uniforms.uPointShadowMap3).toBeDefined();

      // Per-light flags
      expect(uniforms.uLightCastsShadow).toBeDefined();
      expect(uniforms.uLightCastsShadow.value).toHaveLength(4);

      // Global settings
      expect(uniforms.uShadowMapBias).toBeDefined();
      expect(uniforms.uShadowMapSize).toBeDefined();
      expect(uniforms.uShadowPCFSamples).toBeDefined();
      expect(uniforms.uShadowCameraNear).toBeDefined();
      expect(uniforms.uShadowCameraFar).toBeDefined();
    });

    it('should initialize shadow map textures with placeholder textures', () => {
      const uniforms = createShadowMapUniforms();

      // 2D shadow maps should have placeholder textures (not null)
      expect(uniforms.uShadowMap0.value).not.toBeNull();
      expect(uniforms.uShadowMap1.value).not.toBeNull();
      expect(uniforms.uShadowMap2.value).not.toBeNull();
      expect(uniforms.uShadowMap3.value).not.toBeNull();

      // Point shadow maps should have placeholder textures (not null)
      expect(uniforms.uPointShadowMap0.value).not.toBeNull();
      expect(uniforms.uPointShadowMap1.value).not.toBeNull();
      expect(uniforms.uPointShadowMap2.value).not.toBeNull();
      expect(uniforms.uPointShadowMap3.value).not.toBeNull();
    });

    it('should initialize shadow matrices as identity matrices', () => {
      const uniforms = createShadowMapUniforms();
      const identity = new THREE.Matrix4();

      expect(uniforms.uShadowMatrix0.value.equals(identity)).toBe(true);
      expect(uniforms.uShadowMatrix1.value.equals(identity)).toBe(true);
      expect(uniforms.uShadowMatrix2.value.equals(identity)).toBe(true);
      expect(uniforms.uShadowMatrix3.value.equals(identity)).toBe(true);
    });

    it('should initialize per-light shadow flags to false', () => {
      const uniforms = createShadowMapUniforms();

      expect(uniforms.uLightCastsShadow.value).toEqual([false, false, false, false]);
    });

    it('should set sensible default values for global settings', () => {
      const uniforms = createShadowMapUniforms();

      expect(uniforms.uShadowMapBias.value).toBeGreaterThan(0);
      expect(uniforms.uShadowMapBias.value).toBeLessThan(0.1);
      expect(uniforms.uShadowMapSize.value).toBeGreaterThanOrEqual(512);
      expect(uniforms.uShadowPCFSamples.value).toBeGreaterThanOrEqual(0);
      expect(uniforms.uShadowCameraNear.value).toBeGreaterThan(0);
      expect(uniforms.uShadowCameraFar.value).toBeGreaterThan(0);
    });
  });

  describe('updateShadowMapUniforms', () => {
    it('should update uniforms with point light shadow data', () => {
      const uniforms = createShadowMapUniforms();
      const mockTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      const mockMatrix = new THREE.Matrix4().makeTranslation(1, 2, 3);

      const shadowData: ShadowLightData[] = [
        {
          lightType: 0, // Point
          shadowMap: null,
          pointShadowMap: mockTexture,
          shadowMatrix: mockMatrix,
          castsShadow: true,
          cameraNear: 0.5,
          cameraFar: 100,
        },
      ];

      updateShadowMapUniforms(
        uniforms as unknown as Record<string, { value: unknown }>,
        shadowData,
        0.001,
        1024,
        1
      );

      // Point light should use point shadow map
      expect(uniforms.uPointShadowMap0.value).toBe(mockTexture);
      expect(uniforms.uLightCastsShadow.value[0]).toBe(true);
      expect(uniforms.uShadowCameraFar.value).toBe(100);
    });

    it('should update uniforms with directional light shadow data', () => {
      const uniforms = createShadowMapUniforms();
      const mockTexture = new THREE.DataTexture(new Uint8Array([255]), 1, 1);
      const mockMatrix = new THREE.Matrix4().makeTranslation(1, 2, 3);

      const shadowData: ShadowLightData[] = [
        {
          lightType: 1, // Directional
          shadowMap: mockTexture,
          pointShadowMap: null,
          shadowMatrix: mockMatrix,
          castsShadow: true,
          cameraNear: 0.5,
          cameraFar: 50,
        },
      ];

      updateShadowMapUniforms(
        uniforms as unknown as Record<string, { value: unknown }>,
        shadowData,
        0.001,
        1024,
        1
      );

      // Directional light should use regular shadow map
      expect(uniforms.uShadowMap0.value).toBe(mockTexture);
      expect(uniforms.uLightCastsShadow.value[0]).toBe(true);
    });

    it('should update uniforms with spot light shadow data', () => {
      const uniforms = createShadowMapUniforms();
      const mockTexture = new THREE.DataTexture(new Uint8Array([255]), 1, 1);
      const mockMatrix = new THREE.Matrix4().makeTranslation(1, 2, 3);

      const shadowData: ShadowLightData[] = [
        {
          lightType: 2, // Spot
          shadowMap: mockTexture,
          pointShadowMap: null,
          shadowMatrix: mockMatrix,
          castsShadow: true,
          cameraNear: 0.5,
          cameraFar: 50,
        },
      ];

      updateShadowMapUniforms(
        uniforms as unknown as Record<string, { value: unknown }>,
        shadowData,
        0.001,
        1024,
        1
      );

      // Spot light should use regular shadow map
      expect(uniforms.uShadowMap0.value).toBe(mockTexture);
      expect(uniforms.uLightCastsShadow.value[0]).toBe(true);
    });

    it('should handle mixed light types', () => {
      const uniforms = createShadowMapUniforms();
      const texture1 = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      const texture2 = new THREE.DataTexture(new Uint8Array([255]), 1, 1);
      const texture3 = new THREE.DataTexture(new Uint8Array([255]), 1, 1);

      const shadowData: ShadowLightData[] = [
        {
          lightType: 0, // Point
          shadowMap: null,
          pointShadowMap: texture1,
          shadowMatrix: new THREE.Matrix4(),
          castsShadow: true,
          cameraNear: 0.5,
          cameraFar: 100,
        },
        {
          lightType: 1, // Directional
          shadowMap: texture2,
          pointShadowMap: null,
          shadowMatrix: new THREE.Matrix4(),
          castsShadow: true,
          cameraNear: 0.5,
          cameraFar: 50,
        },
        {
          lightType: 2, // Spot
          shadowMap: texture3,
          pointShadowMap: null,
          shadowMatrix: new THREE.Matrix4(),
          castsShadow: true,
          cameraNear: 0.5,
          cameraFar: 50,
        },
      ];

      updateShadowMapUniforms(
        uniforms as unknown as Record<string, { value: unknown }>,
        shadowData,
        0.001,
        1024,
        1
      );

      expect(uniforms.uPointShadowMap0.value).toBe(texture1);
      expect(uniforms.uShadowMap1.value).toBe(texture2);
      expect(uniforms.uShadowMap2.value).toBe(texture3);
      expect(uniforms.uLightCastsShadow.value).toEqual([true, true, true, false]);
    });

    it('should handle lights that do not cast shadows', () => {
      const uniforms = createShadowMapUniforms();

      const shadowData: ShadowLightData[] = [
        {
          lightType: 0,
          shadowMap: null,
          pointShadowMap: null,
          shadowMatrix: new THREE.Matrix4(),
          castsShadow: false,
          cameraNear: 0.5,
          cameraFar: 50,
        },
      ];

      updateShadowMapUniforms(
        uniforms as unknown as Record<string, { value: unknown }>,
        shadowData,
        0.001,
        1024,
        1
      );

      expect(uniforms.uLightCastsShadow.value[0]).toBe(false);
    });

    it('should update global shadow settings', () => {
      const uniforms = createShadowMapUniforms();
      const shadowData: ShadowLightData[] = [];

      updateShadowMapUniforms(
        uniforms as unknown as Record<string, { value: unknown }>,
        shadowData,
        0.005,
        2048,
        2
      );

      expect(uniforms.uShadowMapBias.value).toBe(0.005);
      expect(uniforms.uShadowMapSize.value).toBe(2048);
      expect(uniforms.uShadowPCFSamples.value).toBe(2);
    });
  });

  describe('collectShadowDataFromScene', () => {
    it('should collect shadow data from point lights', () => {
      const scene = new THREE.Scene();
      const pointLight = createMockPointLight([5, 5, 5], true);
      scene.add(pointLight);

      const shadowData = collectShadowDataFromScene(scene);

      expect(shadowData[0]!.lightType).toBe(0); // Point
      expect(shadowData[0]!.castsShadow).toBe(true);
      expect(shadowData[0]!.pointShadowMap).not.toBeNull();
    });

    it('should collect shadow data from directional lights', () => {
      const scene = new THREE.Scene();
      const directionalLight = createMockDirectionalLight([10, 10, 10], true);
      scene.add(directionalLight);

      const shadowData = collectShadowDataFromScene(scene);

      expect(shadowData[0]!.lightType).toBe(1); // Directional
      expect(shadowData[0]!.castsShadow).toBe(true);
      expect(shadowData[0]!.shadowMap).not.toBeNull();
    });

    it('should collect shadow data from spot lights', () => {
      const scene = new THREE.Scene();
      const spotLight = createMockSpotLight([-5, 5, 5], true);
      scene.add(spotLight);

      const shadowData = collectShadowDataFromScene(scene);

      expect(shadowData[0]!.lightType).toBe(2); // Spot
      expect(shadowData[0]!.castsShadow).toBe(true);
      expect(shadowData[0]!.shadowMap).not.toBeNull();
    });

    it('should ignore lights that do not cast shadows', () => {
      const scene = new THREE.Scene();
      const lightWithShadow = createMockPointLight([5, 5, 5], true);
      const lightWithoutShadow = createMockPointLight([-5, 5, 5], false);
      scene.add(lightWithShadow);
      scene.add(lightWithoutShadow);

      const shadowData = collectShadowDataFromScene(scene);

      // Only the shadow-casting light should be collected
      const shadowCastingLights = shadowData.filter((d) => d.castsShadow);
      expect(shadowCastingLights.length).toBe(1);
    });

    it('should limit to MAX_LIGHTS', () => {
      const scene = new THREE.Scene();

      // Add more than MAX_LIGHTS lights
      for (let i = 0; i < MAX_LIGHTS + 2; i++) {
        const light = createMockPointLight([i * 2, 5, 5], true);
        scene.add(light);
      }

      const shadowData = collectShadowDataFromScene(scene);

      // Should be exactly MAX_LIGHTS entries
      expect(shadowData.length).toBe(MAX_LIGHTS);
    });

    it('should handle empty scene', () => {
      const scene = new THREE.Scene();

      const shadowData = collectShadowDataFromScene(scene);

      // Should return MAX_LIGHTS entries with castsShadow = false
      expect(shadowData.length).toBe(MAX_LIGHTS);
      shadowData.forEach((data) => {
        expect(data.castsShadow).toBe(false);
      });
    });

    it('should handle mixed light types in scene', () => {
      const scene = new THREE.Scene();
      scene.add(createMockPointLight([5, 5, 5], true));
      scene.add(createMockDirectionalLight([10, 10, 10], true));
      scene.add(createMockSpotLight([-5, 5, 5], true));

      const shadowData = collectShadowDataFromScene(scene);

      const lightTypes = shadowData.filter((d) => d.castsShadow).map((d) => d.lightType);
      expect(lightTypes).toContain(0); // Point
      expect(lightTypes).toContain(1); // Directional
      expect(lightTypes).toContain(2); // Spot
    });

    it('should extract camera near/far from shadow camera', () => {
      const scene = new THREE.Scene();
      const light = createMockPointLight([5, 5, 5], true);
      light.shadow.camera.near = 1.0;
      light.shadow.camera.far = 200;
      scene.add(light);

      const shadowData = collectShadowDataFromScene(scene);

      expect(shadowData[0]!.cameraNear).toBe(1.0);
      expect(shadowData[0]!.cameraFar).toBe(200);
    });

    it('should order shadow data by store lights when provided', () => {
      const scene = new THREE.Scene();
      // Add lights to scene in one order
      const pointLight = createMockPointLight([5, 5, 5], true);
      const directionalLight = createMockDirectionalLight([10, 10, 10], true);
      scene.add(pointLight);
      scene.add(directionalLight);

      // Store lights in reverse order
      const storeLights = [
        {
          id: 'light-1',
          name: 'Directional',
          type: 'directional' as const,
          enabled: true,
          position: [10, 10, 10] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          color: '#FFFFFF',
          intensity: 1,
          coneAngle: 30,
          penumbra: 0.5,
          range: 0,
          decay: 2,
        },
        {
          id: 'light-2',
          name: 'Point',
          type: 'point' as const,
          enabled: true,
          position: [5, 5, 5] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          color: '#FFFFFF',
          intensity: 1,
          coneAngle: 30,
          penumbra: 0.5,
          range: 0,
          decay: 2,
        },
      ];

      const shadowData = collectShadowDataFromScene(scene, storeLights);

      // Shadow data should be ordered to match store lights
      expect(shadowData[0]!.lightType).toBe(1); // Directional first (from store order)
      expect(shadowData[1]!.lightType).toBe(0); // Point second (from store order)
    });

    it('should handle store lights with no matching scene lights', () => {
      const scene = new THREE.Scene();
      // Add only a point light to scene
      scene.add(createMockPointLight([5, 5, 5], true));

      // Store has a directional light that doesn't exist in scene
      const storeLights = [
        {
          id: 'light-1',
          name: 'Missing Directional',
          type: 'directional' as const,
          enabled: true,
          position: [100, 100, 100] as [number, number, number], // Different position
          rotation: [0, 0, 0] as [number, number, number],
          color: '#FFFFFF',
          intensity: 1,
          coneAngle: 30,
          penumbra: 0.5,
          range: 0,
          decay: 2,
        },
      ];

      const shadowData = collectShadowDataFromScene(scene, storeLights);

      // Should not crash, first entry should have castsShadow = false
      expect(shadowData[0]!.castsShadow).toBe(false);
    });
  });

  describe('blurToPCFSamples', () => {
    it('should return 0 (hard shadows) for blur <= 0', () => {
      expect(blurToPCFSamples(0)).toBe(0);
      expect(blurToPCFSamples(-1)).toBe(0);
    });

    it('should return 1 (3x3 PCF) for blur 1-5', () => {
      expect(blurToPCFSamples(1)).toBe(1);
      expect(blurToPCFSamples(3)).toBe(1);
      expect(blurToPCFSamples(5)).toBe(1);
    });

    it('should return 2 (5x5 PCF) for blur > 5', () => {
      expect(blurToPCFSamples(6)).toBe(2);
      expect(blurToPCFSamples(10)).toBe(2);
    });
  });

  describe('SHADOW_MAP_SIZES', () => {
    it('should have correct sizes for each quality level', () => {
      expect(SHADOW_MAP_SIZES.low).toBe(512);
      expect(SHADOW_MAP_SIZES.medium).toBe(1024);
      expect(SHADOW_MAP_SIZES.high).toBe(2048);
      expect(SHADOW_MAP_SIZES.ultra).toBe(4096);
    });

    it('should have sizes that are powers of 2', () => {
      Object.values(SHADOW_MAP_SIZES).forEach((size) => {
        expect(Math.log2(size) % 1).toBe(0);
      });
    });
  });
});
