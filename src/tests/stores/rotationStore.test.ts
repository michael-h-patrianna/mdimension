/**
 * Tests for rotationStore
 * Verifies rotation state management and dimension-based plane filtering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useRotationStore } from '@/stores/rotationStore';

describe('rotationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useRotationStore.setState({
      rotations: new Map(),
      dimension: 4,
    });
  });

  describe('setRotation', () => {
    it('should set rotation for valid plane', () => {
      const { setRotation } = useRotationStore.getState();

      setRotation('XY', Math.PI / 4);

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(Math.PI / 4);
    });

    it('should normalize angles to [0, 2π)', () => {
      const { setRotation } = useRotationStore.getState();

      // Test negative angle
      setRotation('XY', -Math.PI / 4);
      let rotations = useRotationStore.getState().rotations;
      expect(rotations.get('XY')).toBeCloseTo(2 * Math.PI - Math.PI / 4);

      // Test angle > 2π
      setRotation('XZ', 3 * Math.PI);
      rotations = useRotationStore.getState().rotations;
      expect(rotations.get('XZ')).toBeCloseTo(Math.PI);
    });

    it('should ignore invalid planes for current dimension', () => {
      // Set dimension to 3D
      useRotationStore.setState({ dimension: 3 });
      const { setRotation } = useRotationStore.getState();

      // Try to set a 4D plane (ZW is not valid in 3D)
      setRotation('ZW', Math.PI / 2);

      const { rotations } = useRotationStore.getState();
      expect(rotations.has('ZW')).toBe(false);
    });

    it('should allow ZW plane in 4D', () => {
      // Dimension is 4D by default
      const { setRotation } = useRotationStore.getState();

      setRotation('ZW', Math.PI / 2);

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('ZW')).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('updateRotations', () => {
    it('should update multiple rotations at once', () => {
      const { updateRotations } = useRotationStore.getState();

      const updates = new Map([
        ['XY', Math.PI / 4],
        ['XZ', Math.PI / 2],
      ]);
      updateRotations(updates);

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(Math.PI / 4);
      expect(rotations.get('XZ')).toBeCloseTo(Math.PI / 2);
    });

    it('should filter out invalid planes based on current dimension', () => {
      // Set dimension to 3D
      useRotationStore.setState({ dimension: 3 });
      const { updateRotations } = useRotationStore.getState();

      // Try to update with both valid and invalid planes
      const updates = new Map([
        ['XY', Math.PI / 4],  // Valid for 3D
        ['ZW', Math.PI / 2],  // Invalid for 3D (4D only)
        ['XZ', Math.PI / 3],  // Valid for 3D
      ]);
      updateRotations(updates);

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(Math.PI / 4);
      expect(rotations.get('XZ')).toBeCloseTo(Math.PI / 3);
      expect(rotations.has('ZW')).toBe(false);
    });

    it('should preserve existing rotations when adding new ones', () => {
      const { setRotation, updateRotations } = useRotationStore.getState();

      setRotation('XY', Math.PI);
      updateRotations(new Map([['XZ', Math.PI / 2]]));

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(Math.PI);
      expect(rotations.get('XZ')).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('setDimension', () => {
    it('should filter out invalid planes when dimension decreases', () => {
      const { setRotation, setDimension } = useRotationStore.getState();

      // Set some 4D rotations
      setRotation('XY', Math.PI / 4);
      setRotation('ZW', Math.PI / 2);
      setRotation('XW', Math.PI / 3);

      // Decrease to 3D
      setDimension(3);

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(Math.PI / 4);
      expect(rotations.has('ZW')).toBe(false);  // ZW is 4D only
      expect(rotations.has('XW')).toBe(false);  // XW is 4D only
    });

    it('should preserve valid planes when dimension increases', () => {
      // Start in 3D
      useRotationStore.setState({ dimension: 3 });
      const { setRotation, setDimension } = useRotationStore.getState();

      // Set 3D rotations
      setRotation('XY', Math.PI / 4);
      setRotation('XZ', Math.PI / 2);

      // Increase to 4D
      setDimension(4);

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(Math.PI / 4);
      expect(rotations.get('XZ')).toBeCloseTo(Math.PI / 2);
    });

    it('should reject invalid dimensions', () => {
      const { setDimension } = useRotationStore.getState();

      // Try dimension below minimum
      setDimension(1);
      expect(useRotationStore.getState().dimension).toBe(4); // Should stay at 4

      // Try dimension above maximum
      setDimension(100);
      expect(useRotationStore.getState().dimension).toBe(4); // Should stay at 4
    });
  });

  describe('resetAllRotations', () => {
    it('should clear all rotations', () => {
      const { setRotation, resetAllRotations } = useRotationStore.getState();

      setRotation('XY', Math.PI / 4);
      setRotation('XZ', Math.PI / 2);

      resetAllRotations();

      const { rotations } = useRotationStore.getState();
      expect(rotations.size).toBe(0);
    });
  });

  describe('race condition prevention', () => {
    it('should not allow 4D planes to be set when dimension is 3D', () => {
      // Simulate race condition: dimension set to 3D but animation tries to update 4D plane
      useRotationStore.setState({ dimension: 3 });
      const { updateRotations } = useRotationStore.getState();

      // This simulates what would happen if animation loop tries to update
      // ZW plane after dimension has been changed to 3D
      updateRotations(new Map([
        ['XY', 0.1],
        ['YZ', 0.2],
        ['ZW', 0.3],  // Invalid for 3D
      ]));

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(0.1);
      expect(rotations.get('YZ')).toBeCloseTo(0.2);
      expect(rotations.has('ZW')).toBe(false);  // Should be filtered out
    });
  });
});
