import { describe, it, expect, beforeEach } from 'vitest';
import { useRotationStore } from '@/stores/rotationStore';
import { createIdentityMatrix, matricesEqual } from '@/lib/math';

describe('rotationStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useRotationStore.getState().resetAllRotations();
    useRotationStore.getState().setDimension(3);
  });

  describe('initial state', () => {
    it('should have correct default dimension', () => {
      const { dimension } = useRotationStore.getState();
      expect(dimension).toBe(3);
    });

    it('should have empty rotations map', () => {
      const { rotations } = useRotationStore.getState();
      expect(rotations.size).toBe(0);
    });

    it('should return identity matrix when no rotations', () => {
      const { getComposedRotationMatrix } = useRotationStore.getState();
      const matrix = getComposedRotationMatrix();
      const identity = createIdentityMatrix(3);
      expect(matricesEqual(matrix, identity)).toBe(true);
    });
  });

  describe('setDimension', () => {
    it('should update dimension', () => {
      const { setDimension } = useRotationStore.getState();
      setDimension(4);
      expect(useRotationStore.getState().dimension).toBe(4);
    });

    it('should clear invalid rotations when dimension changes', () => {
      const { setDimension, setRotation } = useRotationStore.getState();

      // Set to 4D and add a 4D rotation
      setDimension(4);
      setRotation('XW', Math.PI / 4);
      expect(useRotationStore.getState().rotations.has('XW')).toBe(true);

      // Change to 3D - XW should be removed
      setDimension(3);
      expect(useRotationStore.getState().rotations.has('XW')).toBe(false);
    });

    it('should keep valid rotations when dimension changes', () => {
      const { setDimension, setRotation } = useRotationStore.getState();

      // Set rotation in 3D
      setRotation('XY', Math.PI / 4);

      // Change to 4D - XY should still be there
      setDimension(4);
      expect(useRotationStore.getState().rotations.has('XY')).toBe(true);
      expect(useRotationStore.getState().rotations.get('XY')).toBeCloseTo(Math.PI / 4);
    });

    it('should throw error for dimension < 2', () => {
      const { setDimension } = useRotationStore.getState();
      expect(() => setDimension(1)).toThrow('Dimension must be at least 2');
    });
  });

  describe('setRotation', () => {
    it('should set rotation for valid plane', () => {
      const { setRotation } = useRotationStore.getState();
      const angle = Math.PI / 4;

      setRotation('XY', angle);

      const { rotations } = useRotationStore.getState();
      expect(rotations.has('XY')).toBe(true);
      expect(rotations.get('XY')).toBeCloseTo(angle);
    });

    it('should update existing rotation', () => {
      const { setRotation } = useRotationStore.getState();

      setRotation('XY', Math.PI / 4);
      setRotation('XY', Math.PI / 2);

      const { rotations } = useRotationStore.getState();
      expect(rotations.get('XY')).toBeCloseTo(Math.PI / 2);
    });

    it('should normalize angles to [0, 2π)', () => {
      const { setRotation } = useRotationStore.getState();

      // Test angle > 2π
      setRotation('XY', 3 * Math.PI);
      expect(useRotationStore.getState().rotations.get('XY')).toBeCloseTo(Math.PI);

      // Test negative angle
      setRotation('XZ', -Math.PI / 2);
      const expected = (3 * Math.PI) / 2;
      expect(useRotationStore.getState().rotations.get('XZ')).toBeCloseTo(expected);
    });

    it('should throw error for invalid plane in current dimension', () => {
      const { setRotation, setDimension } = useRotationStore.getState();
      setDimension(3);

      // XW doesn't exist in 3D
      expect(() => setRotation('XW', Math.PI / 4)).toThrow(
        'Invalid plane "XW" for 3D space'
      );
    });

    it('should allow valid planes for 4D', () => {
      const { setRotation, setDimension } = useRotationStore.getState();
      setDimension(4);

      // All these should work in 4D
      expect(() => setRotation('XY', 0.5)).not.toThrow();
      expect(() => setRotation('XZ', 0.5)).not.toThrow();
      expect(() => setRotation('YZ', 0.5)).not.toThrow();
      expect(() => setRotation('XW', 0.5)).not.toThrow();
      expect(() => setRotation('YW', 0.5)).not.toThrow();
      expect(() => setRotation('ZW', 0.5)).not.toThrow();

      expect(useRotationStore.getState().rotations.size).toBe(6);
    });
  });

  describe('resetRotation', () => {
    it('should remove rotation for a specific plane', () => {
      const { setRotation, resetRotation } = useRotationStore.getState();

      setRotation('XY', Math.PI / 4);
      setRotation('XZ', Math.PI / 3);

      resetRotation('XY');

      const { rotations } = useRotationStore.getState();
      expect(rotations.has('XY')).toBe(false);
      expect(rotations.has('XZ')).toBe(true);
    });

    it('should not error when resetting non-existent plane', () => {
      const { resetRotation } = useRotationStore.getState();
      expect(() => resetRotation('XY')).not.toThrow();
    });
  });

  describe('resetAllRotations', () => {
    it('should clear all rotations', () => {
      const { setRotation, resetAllRotations } = useRotationStore.getState();

      setRotation('XY', Math.PI / 4);
      setRotation('XZ', Math.PI / 3);
      setRotation('YZ', Math.PI / 6);

      expect(useRotationStore.getState().rotations.size).toBe(3);

      resetAllRotations();

      expect(useRotationStore.getState().rotations.size).toBe(0);
    });
  });

  describe('getComposedRotationMatrix', () => {
    it('should return identity matrix when no rotations', () => {
      const { getComposedRotationMatrix } = useRotationStore.getState();
      const matrix = getComposedRotationMatrix();
      const identity = createIdentityMatrix(3);
      expect(matricesEqual(matrix, identity)).toBe(true);
    });

    it('should return valid rotation matrix for single rotation', () => {
      const { setRotation, getComposedRotationMatrix } = useRotationStore.getState();

      setRotation('XY', Math.PI / 2);
      const matrix = getComposedRotationMatrix();

      // Matrix should be 3x3
      expect(matrix.length).toBe(3);
      expect(matrix[0]!.length).toBe(3);

      // For a 90-degree rotation in XY:
      // [cos -sin 0]   [0 -1 0]
      // [sin  cos 0] = [1  0 0]
      // [0    0   1]   [0  0 1]
      expect(matrix[0]![0]).toBeCloseTo(0, 5);
      expect(matrix[0]![1]).toBeCloseTo(-1, 5);
      expect(matrix[1]![0]).toBeCloseTo(1, 5);
      expect(matrix[1]![1]).toBeCloseTo(0, 5);
      expect(matrix[2]![2]).toBeCloseTo(1, 5);
    });

    it('should compose multiple rotations', () => {
      const { setRotation, getComposedRotationMatrix, setDimension } = useRotationStore.getState();
      setDimension(4);

      setRotation('XY', Math.PI / 4);
      setRotation('ZW', Math.PI / 6);

      const matrix = getComposedRotationMatrix();

      // Matrix should be 4x4
      expect(matrix.length).toBe(4);
      expect(matrix[0]!.length).toBe(4);

      // Should be a valid rotation matrix (not identity)
      const identity = createIdentityMatrix(4);
      expect(matricesEqual(matrix, identity)).toBe(false);
    });
  });

  describe('getRotationDegrees', () => {
    it('should return 0 for unset plane', () => {
      const { getRotationDegrees } = useRotationStore.getState();
      expect(getRotationDegrees('XY')).toBe(0);
    });

    it('should convert radians to degrees', () => {
      const { setRotation, getRotationDegrees } = useRotationStore.getState();

      setRotation('XY', Math.PI / 2);
      expect(getRotationDegrees('XY')).toBeCloseTo(90);

      setRotation('XZ', Math.PI);
      expect(getRotationDegrees('XZ')).toBeCloseTo(180);

      setRotation('YZ', (3 * Math.PI) / 4);
      expect(getRotationDegrees('YZ')).toBeCloseTo(135);
    });
  });

  describe('getActivePlanes', () => {
    it('should return empty array when no rotations', () => {
      const { getActivePlanes } = useRotationStore.getState();
      expect(getActivePlanes()).toEqual([]);
    });

    it('should return planes with non-zero rotation', () => {
      const { setRotation, getActivePlanes } = useRotationStore.getState();

      setRotation('XY', Math.PI / 4);
      setRotation('XZ', Math.PI / 6);

      const activePlanes = getActivePlanes();
      expect(activePlanes).toHaveLength(2);
      expect(activePlanes).toContain('XY');
      expect(activePlanes).toContain('XZ');
    });

    it('should not include planes with near-zero rotation', () => {
      const { setRotation, getActivePlanes } = useRotationStore.getState();

      setRotation('XY', Math.PI / 4);
      setRotation('XZ', 1e-7); // Very small, should be ignored

      const activePlanes = getActivePlanes();
      expect(activePlanes).toHaveLength(1);
      expect(activePlanes).toContain('XY');
      expect(activePlanes).not.toContain('XZ');
    });
  });
});
