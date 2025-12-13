/**
 * Hook to apply rotation transformations to vertices.
 * Uses the rotationStore state to determine angles.
 */

import { useMemo, useRef } from 'react';
import { useRotationStore } from '@/stores/rotationStore';
import { composeRotations, getRotationPlanes } from '@/lib/math/rotation';
import { multiplyMatrixVector } from '@/lib/math/matrix';
import type { VectorND } from '@/lib/math/types';

// Module-level cache for valid plane name Sets per dimension
// Avoids recreating Set + map() on every rotation change
const validPlanesCache = new Map<number, Set<string>>();

function getValidPlanesSet(dimension: number): Set<string> {
  let cached = validPlanesCache.get(dimension);
  if (!cached) {
    cached = new Set(getRotationPlanes(dimension).map(p => p.name));
    validPlanesCache.set(dimension, cached);
  }
  return cached;
}

/**
 * Applies current rotations to a set of vertices
 * @param vertices - The vertices to rotate
 * @param dimension - The spatial dimension
 * @returns The rotated vertices
 */
export function useRotatedVertices(vertices: VectorND[], dimension: number): VectorND[] {
  const rotations = useRotationStore((state) => state.rotations);
  // Reusable Map for filtered rotations (avoids allocation on every rotation change)
  const filteredRotationsRef = useRef(new Map<string, number>());

  // Memoize rotation matrix calculation
  const rotationMatrix = useMemo(() => {
    // Filter rotations to only include valid planes for the target dimension.
    // This handles the race condition where geometryStore.dimension has changed
    // but rotationStore hasn't been synced yet (useSyncedDimension runs in useLayoutEffect).
    const validPlanes = getValidPlanesSet(dimension);
    const filteredRotations = filteredRotationsRef.current;
    filteredRotations.clear();
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
