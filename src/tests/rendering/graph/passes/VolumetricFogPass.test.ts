/**
 * Tests for VolumetricFogPass.
 *
 * Tests volumetric fog post-processing effect with half-resolution rendering
 * and bilateral upsampling.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

import { VolumetricFogPass } from '@/rendering/graph/passes/VolumetricFogPass';

// Mock the store hooks since they use React context
vi.mock('@/stores/environmentStore', () => ({
  useEnvironmentStore: {
    getState: () => ({
      fog: {
        enabled: true,
        color: { r: 0.5, g: 0.5, b: 0.6 },
        density: 0.02,
        near: 10,
        far: 100,
        height: 50,
        falloff: 1.0,
        scatteringIntensity: 1.0,
        noiseScale: 1.0,
        noiseSpeed: 0.5,
        noiseDensityInfluence: 0.3,
      },
      fogHeight: 50,
      fogFalloff: 1.0,
      fogDensity: 0.02,
      fogColor: '#888899',
      fogNoiseScale: 1.0,
      fogNoiseSpeed: [0.1, 0.0, 0.1],
      fogScattering: 1.0,
      volumetricShadows: true,
    }),
  },
}));

vi.mock('@/stores/lightingStore', () => ({
  useLightingStore: {
    getState: () => ({
      lights: [],
      shadowMapBias: 0.0001,
    }),
  },
}));

vi.mock('@/stores/performanceStore', () => ({
  usePerformanceStore: {
    getState: () => ({
      options: {
        volumetricFogResolution: 0.5,
      },
      isInteracting: false,
    }),
  },
}));

describe('VolumetricFogPass', () => {
  let pass: VolumetricFogPass;
  let mockNoiseTexture: THREE.Texture;

  beforeEach(() => {
    mockNoiseTexture = new THREE.Texture();
    pass = new VolumetricFogPass({
      id: 'volumetricFog',
      colorInput: 'sceneColor',
      depthInput: 'sceneDepth',
      outputResource: 'fogOutput',
      noiseTexture: mockNoiseTexture,
      use3DNoise: true,
    });
  });

  describe('initialization', () => {
    it('should create pass with correct ID', () => {
      expect(pass.id).toBe('volumetricFog');
    });

    it('should configure color and depth inputs', () => {
      expect(pass.config.inputs).toHaveLength(2);
      expect(pass.config.inputs[0]!.resourceId).toBe('sceneColor');
      expect(pass.config.inputs[1]!.resourceId).toBe('sceneDepth');
    });

    it('should configure correct output', () => {
      expect(pass.config.outputs).toHaveLength(1);
      expect(pass.config.outputs[0]!.resourceId).toBe('fogOutput');
    });

    it('should accept 2D noise fallback', () => {
      const pass2D = new VolumetricFogPass({
        id: 'fog2d',
        colorInput: 'sceneColor',
        depthInput: 'sceneDepth',
        outputResource: 'fogOutput',
        noiseTexture: mockNoiseTexture,
        use3DNoise: false,
      });
      expect(pass2D.id).toBe('fog2d');
    });
  });

  describe('setNoiseTexture', () => {
    it('should update noise texture', () => {
      const newTexture = new THREE.Texture();
      expect(() => pass.setNoiseTexture(newTexture)).not.toThrow();
    });
  });

  describe('disposal', () => {
    it('should dispose without error', () => {
      expect(() => pass.dispose()).not.toThrow();
    });

    it('should be safe to call dispose multiple times', () => {
      pass.dispose();
      expect(() => pass.dispose()).not.toThrow();
    });
  });
});
