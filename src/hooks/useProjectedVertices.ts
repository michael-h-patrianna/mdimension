import { useMemo, useRef } from 'react';
import { projectPerspective, projectOrthographic, DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection';
import type { VectorND, Vector3D } from '@/lib/math/types';
import { useProjectionStore } from '@/stores/projectionStore';

/**
 * Hook that projects n-dimensional vertices to 3D space using current projection settings
 *
 * Uses a fixed projection distance (4.0) for consistent sizing across all dimensions.
 * Camera zoom should be used to adjust overall object scale.
 *
 * @param rotatedVertices - Array of n-dimensional vertices (after rotation)
 * @returns Array of 3D projected vertices ready for rendering
 *
 * @example
 * ```tsx
 * const rotatedVertices = useRotatedVertices(vertices); // from rotation system
 * const projectedVertices = useProjectedVertices(rotatedVertices);
 * // Use projectedVertices for Three.js rendering
 * ```
 */
export function useProjectedVertices(
  rotatedVertices: VectorND[]
): Vector3D[] {
  const type = useProjectionStore((state) => state.type);
  const cacheRef = useRef<Vector3D[]>([]);

  return useMemo(() => {
    if (rotatedVertices.length === 0) {
      return [];
    }

    // Validate all vertices have at least 2 dimensions
    const dimension = rotatedVertices[0]?.length ?? 0;
    if (dimension < 2) {
      console.warn(`Cannot project ${dimension}D vertices: need at least 2 dimensions`);
      return [];
    }

    // Update cache size if needed
    if (cacheRef.current.length !== rotatedVertices.length) {
      cacheRef.current = rotatedVertices.map(() => [0, 0, 0]);
    }
    const cache = cacheRef.current;

    try {
      if (type === 'perspective') {
        // Pre-calculate normalization factor for performance
        // Math.sqrt(dimension - 3) is constant for all vertices
        const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1;

        for (let i = 0; i < rotatedVertices.length; i++) {
          projectPerspective(rotatedVertices[i]!, DEFAULT_PROJECTION_DISTANCE, cache[i], normalizationFactor);
        }
      } else {
        for (let i = 0; i < rotatedVertices.length; i++) {
          projectOrthographic(rotatedVertices[i]!, cache[i]);
        }
      }
      // Return new array reference to trigger downstream updates
      // The inner arrays are reused (cache[i]), only outer array is new
      return [...cache];
    } catch (error) {
      console.error('Projection error:', error);
      return [];
    }
  }, [rotatedVertices, type]);
}
