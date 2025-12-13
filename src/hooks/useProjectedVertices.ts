import { useMemo, useRef } from 'react';
import { projectPerspective, projectOrthographic, DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection';
import type { VectorND, Vector3D } from '@/lib/math/types';
import { useProjectionStore } from '@/stores/projectionStore';

/**
 * Calculates a safe projection distance based on vertex data.
 * Ensures the projection plane is always in front of all vertices to prevent
 * inversion artifacts when effectiveDepth > projectionDistance.
 *
 * @param vertices - Array of n-dimensional vertices
 * @param normalizationFactor - Pre-calculated sqrt(dimension - 3)
 * @returns Safe projection distance
 */
function calculateSafeProjectionDistance(
  vertices: VectorND[],
  normalizationFactor: number
): number {
  if (vertices.length === 0 || vertices[0]!.length <= 3) {
    return DEFAULT_PROJECTION_DISTANCE;
  }

  // Find the maximum effectiveDepth across all vertices
  // effectiveDepth = sum of coords[3..n-1] / normalizationFactor
  let maxEffectiveDepth = 0;

  for (const vertex of vertices) {
    let sum = 0;
    for (let d = 3; d < vertex.length; d++) {
      sum += vertex[d]!;
    }
    const effectiveDepth = sum / normalizationFactor;
    maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth);
  }

  // Projection distance must be greater than max effectiveDepth
  // Add a margin to keep perspective effect visible
  const margin = 2.0;
  const safeDistance = Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + margin);

  return safeDistance;
}

/**
 * Hook that projects n-dimensional vertices to 3D space using current projection settings
 *
 * Dynamically calculates projection distance based on vertex extent to prevent
 * inversion artifacts in higher dimensions with large scales.
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

        // Calculate safe projection distance based on actual vertex positions
        // This prevents inversion when effectiveDepth > projectionDistance
        const projectionDistance = calculateSafeProjectionDistance(
          rotatedVertices,
          normalizationFactor
        );

        for (let i = 0; i < rotatedVertices.length; i++) {
          projectPerspective(rotatedVertices[i]!, projectionDistance, cache[i], normalizationFactor);
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
