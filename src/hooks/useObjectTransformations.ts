import { useMemo } from 'react';
import { useTransformStore } from '@/stores/transformStore';
import { useRotatedVertices } from '@/hooks/useRotatedVertices';
import {
  multiplyMatrixVector,
  createScaleMatrix,
} from '@/lib/math';
import type { VectorND } from '@/lib/math/types';

/**
 * Hook to apply object transformations (scale and rotation).
 *
 * @param vertices - The initial geometry vertices.
 * @param dimension - The current spatial dimension.
 * @returns The transformed vertices (scaled and rotated).
 */
export function useObjectTransformations(vertices: VectorND[], dimension: number) {
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const perAxisScale = useTransformStore((state) => state.perAxisScale);

  // Build scale matrix
  const scaleMatrix = useMemo(() => {
    const scales: number[] = [];
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale);
    }
    return createScaleMatrix(dimension, scales);
  }, [dimension, perAxisScale, uniformScale]);

  // Apply scale
  const scaledVertices = useMemo(() => {
    return vertices.map((v) => multiplyMatrixVector(scaleMatrix, v));
  }, [vertices, scaleMatrix]);

  // Apply rotation
  const rotatedVertices = useRotatedVertices(scaledVertices, dimension);

  return rotatedVertices;
}
