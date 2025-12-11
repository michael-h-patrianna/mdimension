/**
 * Tests for geometryStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGeometryStore, MIN_DIMENSION, MAX_DIMENSION, DEFAULT_DIMENSION, DEFAULT_OBJECT_TYPE } from '@/stores/geometryStore';

describe('geometryStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useGeometryStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have default dimension of 4', () => {
      const state = useGeometryStore.getState();
      expect(state.dimension).toBe(DEFAULT_DIMENSION);
      expect(state.dimension).toBe(4);
    });

    it('should have default object type of hypercube', () => {
      const state = useGeometryStore.getState();
      expect(state.objectType).toBe(DEFAULT_OBJECT_TYPE);
      expect(state.objectType).toBe('hypercube');
    });
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

    it('should throw error for invalid object type', () => {
      const { setObjectType } = useGeometryStore.getState();
      // @ts-expect-error Testing invalid input
      expect(() => setObjectType('invalid')).toThrow('Invalid polytope type');
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
      expect(useGeometryStore.getState().objectType).toBe(DEFAULT_OBJECT_TYPE);
    });

    it('should reset both dimension and object type', () => {
      const { setDimension, setObjectType, reset } = useGeometryStore.getState();

      setDimension(5);
      setObjectType('cross-polytope');

      reset();

      const state = useGeometryStore.getState();
      expect(state.dimension).toBe(DEFAULT_DIMENSION);
      expect(state.objectType).toBe(DEFAULT_OBJECT_TYPE);
    });
  });

  describe('constants', () => {
    it('should have MIN_DIMENSION of 3', () => {
      expect(MIN_DIMENSION).toBe(3);
    });

    it('should have MAX_DIMENSION of 11', () => {
      expect(MAX_DIMENSION).toBe(11);
    });

    it('should have DEFAULT_DIMENSION of 4', () => {
      expect(DEFAULT_DIMENSION).toBe(4);
    });

    it('should have DEFAULT_OBJECT_TYPE of hypercube', () => {
      expect(DEFAULT_OBJECT_TYPE).toBe('hypercube');
    });
  });
});
