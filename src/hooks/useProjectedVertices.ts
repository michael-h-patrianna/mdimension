import { useMemo } from 'react';
import { projectPerspective, projectOrthographic } from '@/lib/math/projection';
import type { VectorND, Vector3D } from '@/lib/math/types';
import { useProjectionStore } from '@/stores/projectionStore';

/**
 * Hook that projects n-dimensional vertices to 3D space using current projection settings
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
  const distance = useProjectionStore((state) => state.distance);

  return useMemo(() => {
    if (rotatedVertices.length === 0) {
      return [];
    }

    // Validate all vertices have at least 3 dimensions
    const dimension = rotatedVertices[0]?.length ?? 0;
    if (dimension < 3) {
      console.warn(`Cannot project ${dimension}D vertices: need at least 3 dimensions`);
      return [];
    }

    try {
      if (type === 'perspective') {
        return rotatedVertices.map((vertex) =>
          projectPerspective(vertex, distance)
        );
      } else {
        return rotatedVertices.map((vertex) =>
          projectOrthographic(vertex)
        );
      }
    } catch (error) {
      console.error('Projection error:', error);
      return [];
    }
  }, [rotatedVertices, type, distance]);
}
