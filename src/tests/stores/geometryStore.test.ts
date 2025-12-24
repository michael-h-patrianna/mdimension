/**
 * Tests for geometryStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnimationStore } from '@/stores/animationStore';
import { useGeometryStore, MIN_DIMENSION, MAX_DIMENSION, DEFAULT_DIMENSION } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';

describe('geometryStore', () => {
  beforeEach(() => {
    // Reset stores before each test
    useGeometryStore.getState().reset();
    useAnimationStore.getState().reset();
    useRotationStore.getState().setDimension(4);
  });

  describe('setDimension', () => {
    it('should set dimension to valid values', () => {
      const { setDimension } = useGeometryStore.getState();

      setDimension(3);
      expect(useGeometryStore.getState().dimension).toBe(3);

      setDimension(5);
      expect(useGeometryStore.getState().dimension).toBe(5);

      setDimension(6);
      expect(useGeometryStore.getState().dimension).toBe(6);
    });

    it('should clamp dimension below minimum to MIN_DIMENSION', () => {
      const { setDimension } = useGeometryStore.getState();

      setDimension(2);
      expect(useGeometryStore.getState().dimension).toBe(MIN_DIMENSION);

      setDimension(0);
      expect(useGeometryStore.getState().dimension).toBe(MIN_DIMENSION);

      setDimension(-5);
      expect(useGeometryStore.getState().dimension).toBe(MIN_DIMENSION);
    });

    it('should clamp dimension above maximum to MAX_DIMENSION', () => {
      const { setDimension } = useGeometryStore.getState();

      setDimension(12);
      expect(useGeometryStore.getState().dimension).toBe(MAX_DIMENSION);

      setDimension(100);
      expect(useGeometryStore.getState().dimension).toBe(MAX_DIMENSION);
    });

    it('should floor non-integer dimensions', () => {
      const { setDimension } = useGeometryStore.getState();

      setDimension(4.7);
      expect(useGeometryStore.getState().dimension).toBe(4);

      setDimension(5.2);
      expect(useGeometryStore.getState().dimension).toBe(5);
    });
  });

  describe('setObjectType', () => {
    describe('polytope types', () => {
      it('should set object type to hypercube', () => {
        const { setObjectType } = useGeometryStore.getState();
        setObjectType('hypercube');
        expect(useGeometryStore.getState().objectType).toBe('hypercube');
      });

      it('should set object type to simplex', () => {
        const { setObjectType } = useGeometryStore.getState();
        setObjectType('simplex');
        expect(useGeometryStore.getState().objectType).toBe('simplex');
      });

      it('should set object type to cross-polytope', () => {
        const { setObjectType } = useGeometryStore.getState();
        setObjectType('cross-polytope');
        expect(useGeometryStore.getState().objectType).toBe('cross-polytope');
      });
    });

    describe('extended object types', () => {
      it('should set object type to root-system', () => {
        const { setObjectType } = useGeometryStore.getState();
        setObjectType('root-system');
        expect(useGeometryStore.getState().objectType).toBe('root-system');
      });

      it('should set object type to clifford-torus in all dimensions >= 3', () => {
        const { setObjectType, setDimension } = useGeometryStore.getState();

        // Clifford torus generates dimension-appropriate shapes:
        // 3D: torus surface, 4D+: classic Clifford torus
        setDimension(3);
        setObjectType('clifford-torus');
        expect(useGeometryStore.getState().objectType).toBe('clifford-torus');

        setDimension(4);
        setObjectType('clifford-torus');
        expect(useGeometryStore.getState().objectType).toBe('clifford-torus');
      });
    });

    it('should throw error for invalid object type', () => {
      const { setObjectType } = useGeometryStore.getState();
      // @ts-expect-error Testing invalid input
      expect(() => setObjectType('invalid')).toThrow('Invalid object type');
    });
  });

  describe('dimension-type interactions', () => {
    it('should keep clifford-torus when dimension changes (valid in all dimensions >= 3)', () => {
      const { setDimension, setObjectType } = useGeometryStore.getState();

      // Set dimension to 4 and type to clifford-torus
      setDimension(4);
      setObjectType('clifford-torus');
      expect(useGeometryStore.getState().objectType).toBe('clifford-torus');

      // Lower dimension to 3 - should stay clifford-torus (3D torus surface)
      setDimension(3);
      expect(useGeometryStore.getState().objectType).toBe('clifford-torus');
    });

    it('should keep root-system when changing between valid dimensions', () => {
      const { setDimension, setObjectType } = useGeometryStore.getState();

      // Set dimension to 4 and type to root-system
      setDimension(4);
      setObjectType('root-system');
      expect(useGeometryStore.getState().objectType).toBe('root-system');

      // Lower dimension to 3 - should stay root-system
      setDimension(3);
      expect(useGeometryStore.getState().objectType).toBe('root-system');
    });
  });

  describe('reset', () => {
    it('should reset dimension to default', () => {
      const { setDimension, reset } = useGeometryStore.getState();

      setDimension(6);
      expect(useGeometryStore.getState().dimension).toBe(6);

      reset();
      expect(useGeometryStore.getState().dimension).toBe(DEFAULT_DIMENSION);
    });

    it('should reset object type to default', () => {
      const { setObjectType, reset } = useGeometryStore.getState();

      setObjectType('simplex');
      expect(useGeometryStore.getState().objectType).toBe('simplex');

      reset();
      // Just verify reset changes the value back (actual default may change)
      expect(useGeometryStore.getState().objectType).not.toBe('simplex');
    });

    it('should reset both dimension and object type', () => {
      const { setDimension, setObjectType, reset } = useGeometryStore.getState();

      setDimension(5);
      setObjectType('cross-polytope');

      reset();

      const state = useGeometryStore.getState();
      expect(state.dimension).toBe(DEFAULT_DIMENSION);
      // Just verify reset changes the value back (actual default may change)
      expect(state.objectType).not.toBe('cross-polytope');
    });
  });

  describe('dimension-animation synchronization', () => {
    it('should filter animation planes when setDimension is called', () => {
      const { setDimension } = useGeometryStore.getState();

      // Start in 8D with all planes animated
      setDimension(8);
      useAnimationStore.getState().animateAll(8);

      // Should have planes like XV (axis 4 and 5)
      expect(useAnimationStore.getState().animatingPlanes.has('VU')).toBe(true);
      expect(useAnimationStore.getState().animatingPlanes.size).toBe(28); // 8D has 28 planes

      // Switch to 4D
      setDimension(4);

      // Animation planes should be filtered
      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.size).toBe(6); // 4D has 6 planes
      expect(planes.has('VU')).toBe(false); // V and U don't exist in 4D
      expect(planes.has('XY')).toBe(true);
      expect(planes.has('ZW')).toBe(true);
    });

    it('should update rotation store dimension when setDimension is called', () => {
      const { setDimension } = useGeometryStore.getState();

      setDimension(8);
      expect(useRotationStore.getState().dimension).toBe(8);

      setDimension(4);
      expect(useRotationStore.getState().dimension).toBe(4);
    });

    it('should filter animation planes when setObjectType changes dimension (Mandelbulb bug fix)', () => {
      const { setDimension, setObjectType } = useGeometryStore.getState();

      // Start in 8D with all planes animated
      setDimension(8);
      useAnimationStore.getState().animateAll(8);

      // Verify XV plane exists (axis X=0 and V=4)
      expect(useAnimationStore.getState().animatingPlanes.has('XV')).toBe(true);
      expect(useAnimationStore.getState().animatingPlanes.size).toBe(28);

      // Switch to Mandelbulb - which auto-switches to 4D (recommended dimension)
      setObjectType('mandelbulb');

      // Verify dimension changed
      expect(useGeometryStore.getState().dimension).toBe(4);

      // Animation planes should be filtered - XV should NOT exist in 4D
      const planes = useAnimationStore.getState().animatingPlanes;
      expect(planes.has('XV')).toBe(false); // This was the bug!
      expect(planes.size).toBe(6); // 4D has only 6 planes
    });

    it('should update rotation store when setObjectType changes dimension', () => {
      const { setDimension, setObjectType } = useGeometryStore.getState();

      // Start in 8D
      setDimension(8);
      expect(useRotationStore.getState().dimension).toBe(8);

      // Switch to Mandelbulb (auto-switches to 4D)
      setObjectType('mandelbulb');

      // Rotation store should be updated to 4D
      expect(useRotationStore.getState().dimension).toBe(4);
    });

    it('should not filter planes when object type change does not change dimension', () => {
      const { setDimension, setObjectType } = useGeometryStore.getState();

      // Set to 4D with all planes
      setDimension(4);
      useAnimationStore.getState().animateAll(4);
      expect(useAnimationStore.getState().animatingPlanes.size).toBe(6);

      // Switch to hypercube (no recommended dimension, stays at 4D)
      setObjectType('hypercube');

      // Should still have 6 planes
      expect(useAnimationStore.getState().animatingPlanes.size).toBe(6);
    });
  });
});
