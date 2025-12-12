/**
 * Hook to apply rotation transformations to vertices.
 * Uses the rotationStore state to determine angles.
 */

import { useMemo } from 'react';
import { useRotationStore } from '@/stores/rotationStore';
import { composeRotations, getRotationPlanes } from '@/lib/math/rotation';
import { multiplyMatrixVector } from '@/lib/math/matrix';
import type { VectorND } from '@/lib/math/types';

/**
 * Applies current rotations to a set of vertices
 * @param vertices - The vertices to rotate
 * @param dimension - The spatial dimension
 * @returns The rotated vertices
 */
export function useRotatedVertices(vertices: VectorND[], dimension: number): VectorND[] {
  const rotations = useRotationStore((state) => state.rotations);

  // Memoize rotation matrix calculation
  const rotationMatrix = useMemo(() => {
    // Filter rotations to only include valid planes for the target dimension.
    // This handles the race condition where geometryStore.dimension has changed
    // but rotationStore hasn't been synced yet (useSyncedDimension runs in useLayoutEffect).
    const validPlanes = new Set(getRotationPlanes(dimension).map(p => p.name));
    const filteredRotations = new Map<string, number>();
    for (const [plane, angle] of rotations.entries()) {
      if (validPlanes.has(plane)) {
        filteredRotations.set(plane, angle);
      }
    }
    return composeRotations(dimension, filteredRotations);
  }, [dimension, rotations]);

  // Apply rotation matrix to all vertices
  const rotatedVertices = useMemo(() => {
    return vertices.map((v) => multiplyMatrixVector(rotationMatrix, v));
  }, [vertices, rotationMatrix]);

  return rotatedVertices;
}
