/**
 * Tests for multi-light type definitions and factory functions
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultLight,
  createNewLight,
  cloneLight,
  rotationToDirection,
  clampIntensity,
  clampConeAngle,
  clampPenumbra,
  MAX_LIGHTS,
  MIN_LIGHTS,
  LIGHT_TYPE_TO_INT,
  DEFAULT_NEW_LIGHT_POSITIONS,
  type LightSource,
} from '@/lib/lights/types';

describe('Light Types', () => {
  describe('constants', () => {
    it('should have correct MAX_LIGHTS value', () => {
      expect(MAX_LIGHTS).toBe(4);
    });

    it('should have correct MIN_LIGHTS value', () => {
      expect(MIN_LIGHTS).toBe(1);
    });

    it('should have correct LIGHT_TYPE_TO_INT mapping', () => {
      expect(LIGHT_TYPE_TO_INT.point).toBe(0);
      expect(LIGHT_TYPE_TO_INT.directional).toBe(1);
      expect(LIGHT_TYPE_TO_INT.spot).toBe(2);
    });

    it('should have 4 default light positions', () => {
      expect(DEFAULT_NEW_LIGHT_POSITIONS).toHaveLength(4);
      DEFAULT_NEW_LIGHT_POSITIONS.forEach((pos) => {
        expect(pos).toHaveLength(3);
        pos.forEach((val) => {
          expect(typeof val).toBe('number');
        });
      });
    });
  });

  describe('createDefaultLight', () => {
    it('should create a default light matching single-light behavior', () => {
      const light = createDefaultLight();

      expect(light.id).toBe('light-default');
      expect(light.name).toBe('Main Light');
      expect(light.type).toBe('point');
      expect(light.enabled).toBe(true);
      expect(light.color).toBe('#FFFFFF');
      expect(light.intensity).toBe(1.0);
    });

    it('should have position derived from h=45, v=30, d=10', () => {
      const light = createDefaultLight();
      // Expected: x~6.12, y=5, z~6.12
      expect(light.position[0]).toBeCloseTo(6.12, 1);
      expect(light.position[1]).toBeCloseTo(5, 1);
      expect(light.position[2]).toBeCloseTo(6.12, 1);
    });

    it('should have zero rotation', () => {
      const light = createDefaultLight();
      expect(light.rotation).toEqual([0, 0, 0]);
    });

    it('should have default spot light properties', () => {
      const light = createDefaultLight();
      expect(light.coneAngle).toBe(30);
      expect(light.penumbra).toBe(0.5);
    });
  });

  describe('createNewLight', () => {
    it('should create a point light', () => {
      const light = createNewLight('point', 0);

      expect(light.type).toBe('point');
      expect(light.enabled).toBe(true);
      expect(light.name).toBe('Point Light 1');
    });

    it('should create a directional light', () => {
      const light = createNewLight('directional', 0);

      expect(light.type).toBe('directional');
      expect(light.name).toBe('Directional Light 1');
    });

    it('should create a spot light with correct defaults', () => {
      const light = createNewLight('spot', 0);

      expect(light.type).toBe('spot');
      expect(light.name).toBe('Spot Light 1');
      expect(light.penumbra).toBe(0.2); // Spot-specific default
    });

    it('should generate unique IDs', () => {
      const light1 = createNewLight('point', 0);
      const light2 = createNewLight('point', 0);

      expect(light1.id).not.toBe(light2.id);
    });

    it('should use different positions based on existing count', () => {
      const light0 = createNewLight('point', 0);
      const light1 = createNewLight('point', 1);
      const light2 = createNewLight('point', 2);
      const light3 = createNewLight('point', 3);

      expect(light0.position).toEqual(DEFAULT_NEW_LIGHT_POSITIONS[0]);
      expect(light1.position).toEqual(DEFAULT_NEW_LIGHT_POSITIONS[1]);
      expect(light2.position).toEqual(DEFAULT_NEW_LIGHT_POSITIONS[2]);
      expect(light3.position).toEqual(DEFAULT_NEW_LIGHT_POSITIONS[3]);
    });

    it('should handle count beyond available positions', () => {
      const light = createNewLight('point', 10);
      // Should use last position
      expect(light.position).toEqual(DEFAULT_NEW_LIGHT_POSITIONS[3]);
    });

    it('should increment name based on existing count', () => {
      const light2 = createNewLight('point', 1);
      const light3 = createNewLight('directional', 2);

      expect(light2.name).toBe('Point Light 2');
      expect(light3.name).toBe('Directional Light 3');
    });
  });

  describe('cloneLight', () => {
    it('should create a copy with new ID', () => {
      const original: LightSource = {
        id: 'original-id',
        name: 'Original Light',
        type: 'point',
        enabled: true,
        position: [1, 2, 3],
        rotation: [0.1, 0.2, 0.3],
        color: '#FF0000',
        intensity: 2.0,
        coneAngle: 45,
        penumbra: 0.3,
      };

      const clone = cloneLight(original);

      expect(clone.id).not.toBe(original.id);
      expect(clone.id).toMatch(/^light-\d+-/);
    });

    it('should append (Copy) to name', () => {
      const original: LightSource = {
        id: 'test',
        name: 'Test Light',
        type: 'point',
        enabled: true,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color: '#FFFFFF',
        intensity: 1.0,
        coneAngle: 30,
        penumbra: 0.5,
      };

      const clone = cloneLight(original);

      expect(clone.name).toBe('Test Light (Copy)');
    });

    it('should offset position by 1 on X axis', () => {
      const original: LightSource = {
        id: 'test',
        name: 'Test',
        type: 'point',
        enabled: true,
        position: [5, 10, 15],
        rotation: [0, 0, 0],
        color: '#FFFFFF',
        intensity: 1.0,
        coneAngle: 30,
        penumbra: 0.5,
      };

      const clone = cloneLight(original);

      expect(clone.position).toEqual([6, 10, 15]);
    });

    it('should copy all other properties unchanged', () => {
      const original: LightSource = {
        id: 'test',
        name: 'Test',
        type: 'spot',
        enabled: false,
        position: [0, 0, 0],
        rotation: [1, 2, 3],
        color: '#00FF00',
        intensity: 2.5,
        coneAngle: 60,
        penumbra: 0.8,
      };

      const clone = cloneLight(original);

      expect(clone.type).toBe('spot');
      expect(clone.enabled).toBe(false);
      expect(clone.rotation).toEqual([1, 2, 3]);
      expect(clone.color).toBe('#00FF00');
      expect(clone.intensity).toBe(2.5);
      expect(clone.coneAngle).toBe(60);
      expect(clone.penumbra).toBe(0.8);
    });
  });

  describe('rotationToDirection', () => {
    it('should return forward direction for zero rotation', () => {
      const dir = rotationToDirection([0, 0, 0]);

      // Forward is -Z
      expect(dir[0]).toBeCloseTo(0, 5);
      expect(dir[1]).toBeCloseTo(0, 5);
      expect(dir[2]).toBeCloseTo(-1, 5);
    });

    it('should handle Y rotation (yaw)', () => {
      // 90 degree Y rotation should point in -X direction
      const dir = rotationToDirection([0, Math.PI / 2, 0]);

      expect(dir[0]).toBeCloseTo(-1, 5);
      expect(dir[1]).toBeCloseTo(0, 5);
      expect(dir[2]).toBeCloseTo(0, 1);
    });

    it('should handle X rotation (pitch)', () => {
      // 90 degree X rotation should point up
      const dir = rotationToDirection([Math.PI / 2, 0, 0]);

      expect(dir[0]).toBeCloseTo(0, 5);
      expect(dir[1]).toBeCloseTo(1, 5);
      expect(dir[2]).toBeCloseTo(0, 1);
    });

    it('should return normalized vector', () => {
      const dir = rotationToDirection([0.5, 0.5, 0.5]);
      const length = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);

      expect(length).toBeCloseTo(1, 5);
    });
  });

  describe('validation functions', () => {
    describe('clampIntensity', () => {
      it('should clamp values to 0-3 range', () => {
        expect(clampIntensity(-1)).toBe(0);
        expect(clampIntensity(0)).toBe(0);
        expect(clampIntensity(1.5)).toBe(1.5);
        expect(clampIntensity(3)).toBe(3);
        expect(clampIntensity(5)).toBe(3);
      });
    });

    describe('clampConeAngle', () => {
      it('should clamp values to 1-120 range', () => {
        expect(clampConeAngle(-10)).toBe(1);
        expect(clampConeAngle(0)).toBe(1);
        expect(clampConeAngle(45)).toBe(45);
        expect(clampConeAngle(120)).toBe(120);
        expect(clampConeAngle(180)).toBe(120);
      });
    });

    describe('clampPenumbra', () => {
      it('should clamp values to 0-1 range', () => {
        expect(clampPenumbra(-0.5)).toBe(0);
        expect(clampPenumbra(0)).toBe(0);
        expect(clampPenumbra(0.5)).toBe(0.5);
        expect(clampPenumbra(1)).toBe(1);
        expect(clampPenumbra(2)).toBe(1);
      });
    });
  });
});
