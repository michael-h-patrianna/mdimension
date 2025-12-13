import { useMemo, useRef } from 'react';
import type { VectorND, MatrixND } from '@/lib/math/types';
import { multiplyMatrixVector } from '@/lib/math/matrix';
import { addVectors } from '@/lib/math/vector';

/**
 * Hook that applies shear and translation transformations to vertices
 * Optimized for performance using object pooling
 *
 * @param vertices - Input vertices (e.g. from rotation)
 * @param shearMatrix - Shear transformation matrix
 * @param translation - Translation vector
 * @returns Transformed vertices
 */
export function useTransformedVertices(
  vertices: VectorND[],
  shearMatrix: MatrixND,
  translation: VectorND
): VectorND[] {
  const cacheRef = useRef<VectorND[]>([]);

  return useMemo(() => {
    if (vertices.length === 0) {
      return [];
    }

    // Rebuild cache if size or dimension changes
    const numVertices = vertices.length;
    // Safe: we've verified vertices.length > 0 above
    const firstVertex = vertices[0];
    if (!firstVertex) {
      return [];
    }
    const dimension = firstVertex.length;
    
    if (
      cacheRef.current.length !== numVertices ||
      (numVertices > 0 && cacheRef.current[0]?.length !== dimension)
    ) {
      cacheRef.current = vertices.map((v) => new Array(v.length).fill(0));
    }

    const cache = cacheRef.current;

    // Apply transformations
    for (let i = 0; i < numVertices; i++) {
      // 1. Apply Shear: v' = M * v
      // Write result directly into cache
      multiplyMatrixVector(shearMatrix, vertices[i]!, cache[i]);

      // 2. Apply Translation: v'' = v' + t
      // Update cache in-place
      // Note: translation might have different length if dimension changed but store update is pending
      // We assume translation matches dimension or treat missing as 0
      
      // We manually add here to handle potential dimension mismatch gracefully (optional safety)
      // or just use addVectors if we trust types.
      // addVectors checks length. Let's trust it but ensure translation is correct size.
      
      if (translation.length === dimension) {
        addVectors(cache[i]!, translation, cache[i]);
      }
    }

    return [...cache];
  }, [vertices, shearMatrix, translation]);
}
