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
      // 2 is now valid (MIN_DIMENSION is 2)
      const state1 = deserializeState('d=2&t=hypercube');
      expect(state1.dimension).toBe(2);

      // 1 is invalid (below MIN_DIMENSION)
      const state1b = deserializeState('d=1&t=hypercube');
      expect(state1b.dimension).toBeUndefined();

      // 7 is valid (MAX_DIMENSION is 11)
      const state2 = deserializeState('d=7&t=hypercube');
      expect(state2.dimension).toBe(7);

      // 15 is invalid
      const state3 = deserializeState('d=15&t=hypercube');
      expect(state3.dimension).toBeUndefined();

      const state4 = deserializeState('d=5&t=hypercube');
      expect(state4.dimension).toBe(5);
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

  describe('visual settings serialization (PRD Story 1 AC6)', () => {
    it('should not serialize default shader type (surface)', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        shaderType: 'surface', // surface is the default shader type
      };

      const serialized = serializeState(state);
      expect(serialized).not.toContain('sh=');
    });

    it('should serialize non-default shader type (wireframe)', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        shaderType: 'wireframe', // wireframe is NOT the default
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('sh=wireframe');
    });

    it('should serialize edge color', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        edgeColor: '#FF00FF',
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('ec=FF00FF');
    });

    it('should serialize vertex color', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        vertexColor: '#00FF00',
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('vc=00FF00');
    });

    it('should serialize background color', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        backgroundColor: '#1A1A2E',
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('bg=1A1A2E');
    });

    it('should serialize bloom disabled', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        bloomEnabled: false,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('be=0');
    });

    it('should not serialize bloom enabled (default)', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        bloomEnabled: true,
      };

      const serialized = serializeState(state);
      expect(serialized).not.toContain('be=');
    });

    it('should serialize bloom intensity when not default', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        bloomIntensity: 1.5,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('bi=1.50');
    });

    it('should deserialize shader type', () => {
      const state = deserializeState('d=4&t=hypercube&sh=surface');
      expect(state.shaderType).toBe('surface');
    });

    it('should validate shader type', () => {
      const state = deserializeState('d=4&t=hypercube&sh=invalid');
      expect(state.shaderType).toBeUndefined();
    });

    it('should deserialize colors', () => {
      const state = deserializeState('d=4&t=hypercube&ec=FF00FF&vc=00FF00&bg=1A1A2E');
      expect(state.edgeColor).toBe('#FF00FF');
      expect(state.vertexColor).toBe('#00FF00');
      expect(state.backgroundColor).toBe('#1A1A2E');
    });

    it('should validate color format', () => {
      const state = deserializeState('d=4&t=hypercube&ec=invalid&vc=12345&bg=1234567');
      expect(state.edgeColor).toBeUndefined();
      expect(state.vertexColor).toBeUndefined();
      expect(state.backgroundColor).toBeUndefined();
    });

    it('should deserialize bloom settings', () => {
      const state = deserializeState('d=4&t=hypercube&be=1&bi=1.50');
      expect(state.bloomEnabled).toBe(true);
      expect(state.bloomIntensity).toBe(1.5);
    });

    it('should validate bloom intensity range', () => {
      const state = deserializeState('d=4&t=hypercube&bi=5.00');
      expect(state.bloomIntensity).toBeUndefined();
    });
  });

  describe('per-shader settings serialization (PRD Story 7 AC7)', () => {
    it('should serialize surface settings', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        shaderType: 'surface',
        shaderSettings: {
          wireframe: { lineThickness: 2 },
          surface: { faceOpacity: 0.5, specularIntensity: 0.5, specularPower: 64, fresnelEnabled: false },
        },
      };

      const serialized = serializeState(state);
      const decoded = decodeURIComponent(serialized);
      expect(decoded).toContain('ss=');
      expect(decoded).toContain('faceOpacity:0.5');
      expect(decoded).toContain('specularIntensity:0.5');
      expect(decoded).toContain('specularPower:64');
      expect(decoded).toContain('fresnelEnabled:0');
    });

    it('should deserialize per-shader settings for surface', () => {
      const state = deserializeState('d=4&t=hypercube&sh=surface&ss=faceOpacity:0.5,specularIntensity:0.5,specularPower:64,fresnelEnabled:0');
      expect(state.shaderSettings).toBeDefined();
      expect(state.shaderSettings?.surface.faceOpacity).toBe(0.5);
      expect(state.shaderSettings?.surface.specularIntensity).toBe(0.5);
      expect(state.shaderSettings?.surface.specularPower).toBe(64);
      expect(state.shaderSettings?.surface.fresnelEnabled).toBe(false);
    });

    it('should round-trip visual settings', () => {
      // Use wireframe (non-default shader type) to ensure it gets serialized
      const original: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        shaderType: 'wireframe',
        edgeColor: '#FF00FF',
        vertexColor: '#00FF00',
        backgroundColor: '#1A1A2E',
        bloomEnabled: false,
        bloomIntensity: 1.5,
      };

      const serialized = serializeState(original);
      const deserialized = deserializeState(serialized);

      expect(deserialized.shaderType).toBe('wireframe');
      expect(deserialized.edgeColor).toBe('#FF00FF');
      expect(deserialized.vertexColor).toBe('#00FF00');
      expect(deserialized.backgroundColor).toBe('#1A1A2E');
      expect(deserialized.bloomEnabled).toBe(false);
      expect(deserialized.bloomIntensity).toBeCloseTo(1.5, 2);
    });
  });

  describe('render mode toggles serialization (PRD: Render Mode Toggles)', () => {
    it('should serialize edgesVisible when false', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        edgesVisible: false,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('ev=0');
    });

    it('should not serialize edgesVisible when true (default)', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        edgesVisible: true,
      };

      const serialized = serializeState(state);
      expect(serialized).not.toContain('ev=');
    });

    it('should serialize facesVisible when true', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        facesVisible: true,
      };

      const serialized = serializeState(state);
      expect(serialized).toContain('fv=1');
    });

    it('should not serialize facesVisible when false (default)', () => {
      const state: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        facesVisible: false,
      };

      const serialized = serializeState(state);
      expect(serialized).not.toContain('fv=');
    });

    it('should deserialize edgesVisible false', () => {
      const state = deserializeState('d=4&t=hypercube&ev=0');
      expect(state.edgesVisible).toBe(false);
    });

    it('should deserialize edgesVisible true', () => {
      const state = deserializeState('d=4&t=hypercube&ev=1');
      expect(state.edgesVisible).toBe(true);
    });

    it('should deserialize facesVisible true', () => {
      const state = deserializeState('d=4&t=hypercube&fv=1');
      expect(state.facesVisible).toBe(true);
    });

    it('should deserialize facesVisible false', () => {
      const state = deserializeState('d=4&t=hypercube&fv=0');
      expect(state.facesVisible).toBe(false);
    });

    it('should round-trip render mode toggles', () => {
      const original: ShareableState = {
        dimension: 4,
        objectType: 'hypercube',
        edgesVisible: false,
        facesVisible: true,
      };

      const serialized = serializeState(original);
      const deserialized = deserializeState(serialized);

      expect(deserialized.edgesVisible).toBe(false);
      expect(deserialized.facesVisible).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    it('should map legacy dualOutline shader type to wireframe', () => {
      const state = deserializeState('d=4&t=hypercube&sh=dualOutline');
      expect(state.shaderType).toBe('wireframe');
    });

    it('should still accept valid shader types', () => {
      const stateWireframe = deserializeState('d=4&t=hypercube&sh=wireframe');
      expect(stateWireframe.shaderType).toBe('wireframe');

      const stateSurface = deserializeState('d=4&t=hypercube&sh=surface');
      expect(stateSurface.shaderType).toBe('surface');
    });

    it('should reject invalid shader types', () => {
      const state = deserializeState('d=4&t=hypercube&sh=invalid');
      expect(state.shaderType).toBeUndefined();
    });
  });
});
