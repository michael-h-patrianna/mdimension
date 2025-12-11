/**
 * Hook for applying rotation transformations to vertices
 * Memoizes computation for performance
 */

import { useMemo } from 'react';
import { useRotationStore } from '@/stores';
import { multiplyMatrixVector, composeRotations, createIdentityMatrix } from '@/lib/math';
import type { VectorND } from '@/lib/math';

/**
 * Applies the current rotation matrix to a set of vertices
 * @param vertices - Array of n-dimensional vertices
 * @param targetDimension - Optional dimension to use (overrides store dimension for sync)
 * @returns Array of rotated vertices
 */
export function useRotatedVertices(vertices: VectorND[], targetDimension?: number): VectorND[] {
  // Subscribe to the rotations map to trigger re-renders when it changes
  const rotations = useRotationStore((state) => state.rotations);
  const storeDimension = useRotationStore((state) => state.dimension);

  // Use provided dimension or fall back to store dimension
  const dimension = targetDimension ?? storeDimension;

  // Build rotation matrix for the target dimension
  // This ensures matrix matches vertex dimension even during store sync
  const rotationMatrix = useMemo(() => {
    if (rotations.size === 0) {
      return createIdentityMatrix(dimension);
    }

    // Filter rotations to only include valid planes for this dimension
    const validRotations = new Map<string, number>();
    const AXIS_NAMES = ['X', 'Y', 'Z', 'W', 'V', 'U'];

    const parseAxisIndex = (name: string): number => {
      const idx = AXIS_NAMES.indexOf(name);
      if (idx !== -1) return idx;
      if (name.startsWith('A')) {
        const num = parseInt(name.slice(1), 10);
        if (!isNaN(num)) return num;
      }
      return -1;
    };

    for (const [plane, angle] of rotations.entries()) {
      // Parse plane name to get axis indices
      const parts = plane.length === 2
        ? [plane[0], plane[1]]
        : plane.match(/[A-Z][0-9]*/g);

      if (parts && parts.length === 2) {
        const axis1 = parseAxisIndex(parts[0]!);
        const axis2 = parseAxisIndex(parts[1]!);

        // Only include if both axes are within the target dimension
        if (axis1 >= 0 && axis1 < dimension && axis2 >= 0 && axis2 < dimension) {
          validRotations.set(plane, angle);
        }
      }
    }

    if (validRotations.size === 0) {
      return createIdentityMatrix(dimension);
    }

    return composeRotations(dimension, validRotations);
  }, [rotations, dimension]);

  // Apply rotation to all vertices
  const rotatedVertices = useMemo(() => {
    return vertices.map((vertex) => multiplyMatrixVector(rotationMatrix, vertex));
  }, [vertices, rotationMatrix]);

  return rotatedVertices;
}
