/**
 * Tests for URL state serializer
 */

import { describe, it, expect } from 'vitest';
import {
  serializeState,
  deserializeState,
  generateShareUrl,
  type ShareableState,
} from '@/lib/url/state-serializer';

describe('URL state serializer', () => {
  describe('serializeState', () => {
    it('should serialize basic state', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('d=4');
      expect(serialized).toContain('t=hypercube');
    });

    it('should serialize projection distance', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'simplex',
        projectionDistance: 5.5,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('pd=5.50');
    });

    it('should serialize uniform scale when not 1', () => {
      const state: ShareableState = {
        dimension: 3,
        objectType: 'cross-polytope',
        uniformScale: 2.5,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('s=2.50');
    });

    it('should not serialize uniform scale when 1', () => {
      const state: ShareableState = {
        dimension: 3,
        objectType: 'hypercube',
        uniformScale: 1,
      };

      const serialized = serializeState(state);
      expect(serialized).not.toContain('s=');
    });

    it('should serialize rotation angles', () => {
      const rotationAngles = new Map<string, number>();
      rotationAngles.set('XY', 0.5);
      rotationAngles.set('XZ', 1.2);

      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        rotationAngles,
      };

      const serialized = serializeState(state);
      const decoded = decodeURIComponent(serialized);
      expect(decoded).toContain('r=');
      expect(decoded).toContain('XY:0.500');
      expect(decoded).toContain('XZ:1.200');
    });

    it('should skip zero rotation angles', () => {
      const rotationAngles = new Map<string, number>();
      rotationAngles.set('XY', 0);
      rotationAngles.set('XZ', 0.5);

      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        rotationAngles,
      };

      const serialized = serializeState(state);
      const decoded = decodeURIComponent(serialized);
      expect(decoded).not.toContain('XY');
      expect(decoded).toContain('XZ:0.500');
    });

    it('should serialize isPlaying', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        isPlaying: true,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('p=1');
    });

    it('should serialize speed when not 1', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        speed: 2.0,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('sp=2.00');
    });
  });

  describe('deserializeState', () => {
    it('should deserialize basic state', () => {
      const state = deserializeState('d=4&t=hypercube');
      expect(state.dimension).toBe(4);
      expect(state.objectType).toBe('hypercube');
    });

    it('should validate dimension range', () => {
      const state1 = deserializeState('d=2&t=hypercube');
      expect(state1.dimension).toBeUndefined();

      const state2 = deserializeState('d=7&t=hypercube');
      expect(state2.dimension).toBeUndefined();

      const state3 = deserializeState('d=5&t=hypercube');
      expect(state3.dimension).toBe(5);
    });

    it('should validate object type', () => {
      const state1 = deserializeState('d=4&t=invalid');
      expect(state1.objectType).toBeUndefined();

      const state2 = deserializeState('d=4&t=simplex');
      expect(state2.objectType).toBe('simplex');
    });

    it('should deserialize projection distance', () => {
      const state = deserializeState('d=4&t=hypercube&pd=5.50');
      expect(state.projectionDistance).toBe(5.5);
    });

    it('should deserialize uniform scale', () => {
      const state = deserializeState('d=4&t=hypercube&s=2.50');
      expect(state.uniformScale).toBe(2.5);
    });

    it('should deserialize rotation angles', () => {
      const state = deserializeState('d=4&t=hypercube&r=XY:0.500,XZ:1.200');
      expect(state.rotationAngles).toBeDefined();
      expect(state.rotationAngles?.get('XY')).toBe(0.5);
      expect(state.rotationAngles?.get('XZ')).toBe(1.2);
    });

    it('should deserialize isPlaying', () => {
      const state = deserializeState('d=4&t=hypercube&p=1');
      expect(state.isPlaying).toBe(true);
    });

    it('should deserialize speed', () => {
      const state = deserializeState('d=4&t=hypercube&sp=2.00');
      expect(state.speed).toBe(2.0);
    });

    it('should handle empty params', () => {
      const state = deserializeState('');
      expect(state).toEqual({});
    });

    it('should handle invalid values gracefully', () => {
      const state = deserializeState('d=abc&pd=-5&s=invalid');
      expect(state.dimension).toBeUndefined();
      expect(state.projectionDistance).toBeUndefined();
      expect(state.uniformScale).toBeUndefined();
    });
  });

  describe('generateShareUrl', () => {
    it('should generate URL with state', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
      };

      const url = generateShareUrl(state);
      expect(url).toContain('d=4');
      expect(url).toContain('t=hypercube');
    });
  });

  describe('round trip', () => {
    it('should maintain state through serialize/deserialize', () => {
      const rotationAngles = new Map<string, number>();
      rotationAngles.set('XY', 0.5);
      rotationAngles.set('XZ', 1.2);

      const original: ShareableState = {
        dimension: 5,
        objectType: 'simplex',
        projectionDistance: 4.5,
        uniformScale: 1.5,
        rotationAngles,
        isPlaying: true,
        speed: 1.5,
      };

      const serialized = serializeState(original);
      const deserialized = deserializeState(serialized);

      expect(deserialized.dimension).toBe(original.dimension);
      expect(deserialized.objectType).toBe(original.objectType);
      expect(deserialized.projectionDistance).toBeCloseTo(
        original.projectionDistance!,
        2
      );
      expect(deserialized.uniformScale).toBeCloseTo(original.uniformScale!, 2);
      expect(deserialized.isPlaying).toBe(original.isPlaying);
      expect(deserialized.speed).toBeCloseTo(original.speed!, 2);
      expect(deserialized.rotationAngles?.get('XY')).toBeCloseTo(
        original.rotationAngles!.get('XY')!,
        3
      );
      expect(deserialized.rotationAngles?.get('XZ')).toBeCloseTo(
        original.rotationAngles!.get('XZ')!,
        3
      );
    });
  });
});
