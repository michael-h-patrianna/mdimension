import { useMemo } from 'react';
import { useTransformStore } from '@/stores/transformStore';
import { useRotatedVertices } from '@/hooks/useRotatedVertices';
import { useTransformedVertices } from '@/hooks/useTransformedVertices';
import {
  multiplyMatrixVector,
  multiplyMatrices,
  createIdentityMatrix,
  createScaleMatrix,
  createShearMatrix,
} from '@/lib/math';
import { parseShearPlane } from '@/utils/axisUtils';
import type { VectorND } from '@/lib/math/types';

/**
 * Hook to apply all object transformations (scale, rotation, shear, translation).
 *
 * @param vertices - The initial geometry vertices.
 * @param dimension - The current spatial dimension.
 * @returns The fully transformed vertices.
 */
export function useObjectTransformations(vertices: VectorND[], dimension: number) {
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const perAxisScale = useTransformStore((state) => state.perAxisScale);
  const shears = useTransformStore((state) => state.shears);
  const translation = useTransformStore((state) => state.translation);

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

  // Build shear matrix
  const shearMatrix = useMemo(() => {
    if (shears.size === 0) {
      return createIdentityMatrix(dimension);
    }

    let result = createIdentityMatrix(dimension);
    for (const [plane, amount] of shears.entries()) {
      const axes = parseShearPlane(plane, dimension);
      if (axes) {
        const [axis1, axis2] = axes;
        const shearMat = createShearMatrix(dimension, axis1, axis2, amount);
        result = multiplyMatrices(result, shearMat);
      }
    }
    return result;
  }, [dimension, shears]);

  // Normalize translation vector
  const effectiveTranslation = useMemo(() => {
    const t = new Array(dimension).fill(0);
    for (let i = 0; i < dimension; i++) {
      if (i < translation.length) {
        t[i] = translation[i];
      }
    }
    return t;
  }, [dimension, translation]);

  // Apply shear and translation
  const transformedVertices = useTransformedVertices(
    rotatedVertices,
    shearMatrix,
    effectiveTranslation
  );

  return transformedVertices;
}
