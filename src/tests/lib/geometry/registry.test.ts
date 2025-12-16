/**
 * Object Type Registry Tests
 *
 * Tests for the centralized object type registry and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  // Registry data
  OBJECT_TYPE_REGISTRY,
  getAllObjectTypes,
  // Core lookups
  getObjectTypeEntry,
  // Rendering capabilities
  canRenderFaces,
  canRenderEdges,
  isRaymarchingType,
  isRaymarchingFractal,
  getRenderingCapabilities,
  getFaceDetectionMethod,
  determineRenderMode,
  // Dimension constraints
  getDimensionConstraints,
  isAvailableForDimension,
  getAvailableTypesForDimension,
  getRecommendedDimension,
  // Animation
  getAnimationCapabilities,
  hasTypeSpecificAnimations,
  getAvailableAnimationSystems,
  // UI
  getControlsComponentKey,
  hasTimelineControls,
  // Validation
  getValidObjectTypes,
  isValidObjectType,
  getTypeName,
  getTypeDescription,
} from '@/lib/geometry/registry';

describe('Object Type Registry', () => {
  describe('Registry Structure', () => {
    it('contains all 9 object types', () => {
      const types = getAllObjectTypes();
      expect(types).toHaveLength(9);
      expect(types).toContain('hypercube');
      expect(types).toContain('simplex');
      expect(types).toContain('cross-polytope');
      expect(types).toContain('root-system');
      expect(types).toContain('clifford-torus');
      expect(types).toContain('nested-torus');
      expect(types).toContain('mandelbrot');
      expect(types).toContain('quaternion-julia');
      expect(types).toContain('kali');
    });

    it('returns valid entry for each object type', () => {
      const types = getAllObjectTypes();
      for (const type of types) {
        const entry = getObjectTypeEntry(type);
        expect(entry).toBeDefined();
        expect(entry?.type).toBe(type);
        expect(entry?.name).toBeTruthy();
        expect(entry?.description).toBeTruthy();
      }
    });

    it('returns undefined for invalid object type', () => {
      const entry = getObjectTypeEntry('invalid-type' as never);
      expect(entry).toBeUndefined();
    });
  });

  describe('Rendering Capabilities', () => {
    it('polytopes support faces and edges', () => {
      expect(canRenderFaces('hypercube')).toBe(true);
      expect(canRenderFaces('simplex')).toBe(true);
      expect(canRenderFaces('cross-polytope')).toBe(true);
      expect(canRenderEdges('hypercube')).toBe(true);
    });

    it('raymarched fractals support faces via raymarching', () => {
      expect(canRenderFaces('mandelbrot')).toBe(true);
      expect(canRenderFaces('quaternion-julia')).toBe(true);
    });

    it('isRaymarchingType identifies raymarched types', () => {
      expect(isRaymarchingType('mandelbrot')).toBe(true);
      expect(isRaymarchingType('quaternion-julia')).toBe(true);
      expect(isRaymarchingType('hypercube')).toBe(false);
      expect(isRaymarchingType('root-system')).toBe(false);
    });

    it('isRaymarchingFractal checks dimension', () => {
      expect(isRaymarchingFractal('mandelbrot', 3)).toBe(true);
      expect(isRaymarchingFractal('mandelbrot', 4)).toBe(true);
      expect(isRaymarchingFractal('hypercube', 4)).toBe(false);
    });

    it('returns correct face detection method', () => {
      expect(getFaceDetectionMethod('hypercube')).toBe('analytical-quad');
      expect(getFaceDetectionMethod('simplex')).toBe('triangles');
      expect(getFaceDetectionMethod('root-system')).toBe('convex-hull');
      expect(getFaceDetectionMethod('clifford-torus')).toBe('grid');
      expect(getFaceDetectionMethod('mandelbrot')).toBe('none');
    });

    it('determineRenderMode returns correct mode', () => {
      expect(determineRenderMode('hypercube', 4, true)).toBe('polytope');
      expect(determineRenderMode('mandelbrot', 4, true)).toBe('raymarch-mandelbrot');
      expect(determineRenderMode('quaternion-julia', 4, true)).toBe('raymarch-quaternion-julia');
      expect(determineRenderMode('quaternion-julia', 4, false)).toBe('none');
    });
  });

  describe('Dimension Constraints', () => {
    it('returns dimension constraints for each type', () => {
      const cubeConstraints = getDimensionConstraints('hypercube');
      expect(cubeConstraints?.min).toBe(3);
      expect(cubeConstraints?.max).toBe(11);

      const juliaConstraints = getDimensionConstraints('quaternion-julia');
      expect(juliaConstraints?.min).toBe(3);
      expect(juliaConstraints?.recommended).toBe(4);
    });

    it('isAvailableForDimension checks constraints', () => {
      expect(isAvailableForDimension('hypercube', 3)).toBe(true);
      expect(isAvailableForDimension('hypercube', 11)).toBe(true);
      expect(isAvailableForDimension('nested-torus', 3)).toBe(false);
      expect(isAvailableForDimension('nested-torus', 4)).toBe(true);
    });

    it('getAvailableTypesForDimension returns filtered list', () => {
      const typesAt4D = getAvailableTypesForDimension(4);
      expect(typesAt4D.length).toBeGreaterThan(0);
      expect(typesAt4D.find((t) => t.type === 'nested-torus')?.available).toBe(true);
    });

    it('getRecommendedDimension returns value for fractal types', () => {
      expect(getRecommendedDimension('quaternion-julia')).toBe(4);
      expect(getRecommendedDimension('mandelbrot')).toBe(4);
      expect(getRecommendedDimension('hypercube')).toBeUndefined();
    });
  });

  describe('Animation Capabilities', () => {
    it('hasTypeSpecificAnimations returns true for fractals', () => {
      expect(hasTypeSpecificAnimations('mandelbrot')).toBe(true);
      expect(hasTypeSpecificAnimations('quaternion-julia')).toBe(true);
      expect(hasTypeSpecificAnimations('hypercube')).toBe(false);
    });

    it('getAnimationCapabilities returns animation config', () => {
      const mandelbrotAnim = getAnimationCapabilities('mandelbrot');
      expect(mandelbrotAnim?.hasTypeSpecificAnimations).toBe(true);
      expect(Object.keys(mandelbrotAnim?.systems ?? {})).toContain('powerAnimation');
    });

    it('getAvailableAnimationSystems filters by dimension', () => {
      const systems4D = getAvailableAnimationSystems('mandelbrot', 4);
      expect(Object.keys(systems4D)).toContain('sliceAnimation');

      const systems3D = getAvailableAnimationSystems('mandelbrot', 3);
      expect(Object.keys(systems3D)).not.toContain('sliceAnimation');
    });
  });

  describe('UI Components', () => {
    it('returns controls component key for each type', () => {
      expect(getControlsComponentKey('hypercube')).toBe('PolytopeSettings');
      expect(getControlsComponentKey('mandelbrot')).toBe('MandelbrotControls');
      expect(getControlsComponentKey('quaternion-julia')).toBe('QuaternionJuliaControls');
    });

    it('hasTimelineControls returns true for fractals', () => {
      expect(hasTimelineControls('mandelbrot')).toBe(true);
      expect(hasTimelineControls('quaternion-julia')).toBe(true);
      expect(hasTimelineControls('hypercube')).toBe(false);
    });
  });

  describe('Validation', () => {
    it('getValidObjectTypes returns all types', () => {
      const validTypes = getValidObjectTypes();
      expect(validTypes).toHaveLength(9);
    });

    it('isValidObjectType validates correctly', () => {
      expect(isValidObjectType('hypercube')).toBe(true);
      expect(isValidObjectType('mandelbrot')).toBe(true);
      expect(isValidObjectType('invalid')).toBe(false);
      expect(isValidObjectType('')).toBe(false);
    });

    it('getTypeName returns display name', () => {
      expect(getTypeName('hypercube')).toBe('Hypercube');
      expect(getTypeName('cross-polytope')).toBe('Cross-Polytope');
      expect(getTypeName('quaternion-julia')).toBe('Quaternion Julia');
    });

    it('getTypeDescription returns description', () => {
      const desc = getTypeDescription('hypercube');
      expect(desc).toBeTruthy();
      expect(typeof desc).toBe('string');
    });
  });
});
