/**
 * Hook for applying rotation transformations to vertices
 * Memoizes computation for performance
 */

import { useMemo, useRef } from 'react';
import { useRotationStore } from '@/stores';
import { multiplyMatrixVector, composeRotations, createIdentityMatrix, parsePlaneName } from '@/lib/math';
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

    for (const [plane, angle] of rotations.entries()) {
      try {
        const [axis1, axis2] = parsePlaneName(plane);
        
        // Only include if both axes are within the target dimension
        if (axis1 >= 0 && axis1 < dimension && axis2 >= 0 && axis2 < dimension) {
          validRotations.set(plane, angle);
        }
      } catch (e) {
        // Ignore invalid plane names
        console.warn(`Ignoring invalid rotation plane: ${plane}`);
      }
    }

    if (validRotations.size === 0) {
      return createIdentityMatrix(dimension);
    }

    return composeRotations(dimension, validRotations);
  }, [rotations, dimension]);

  // Apply rotation to all vertices - reuse cache arrays to minimize allocation
  const cacheRef = useRef<VectorND[]>([]);

  const rotatedVertices = useMemo(() => {
    if (vertices.length === 0) {
      return [];
    }

    const numVertices = vertices.length;
    const vertexDim = vertices[0]!.length;

    // Check if we need to rebuild cache (count or dimension changed)
    let cache = cacheRef.current;
    if (cache.length !== numVertices || (numVertices > 0 && cache[0]?.length !== vertexDim)) {
      cache = vertices.map(v => new Array(v.length).fill(0));
      cacheRef.current = cache;
    }

    // Apply rotation in-place to cached arrays
    for (let i = 0; i < numVertices; i++) {
      multiplyMatrixVector(rotationMatrix, vertices[i]!, cache[i]);
    }

    // Return new array reference to trigger downstream updates
    // The inner arrays are reused (cache[i]), only outer array is new
    return [...cache];
  }, [vertices, rotationMatrix]);

  return rotatedVertices;
}
