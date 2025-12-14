import { useRotatedVertices } from '@/hooks/useRotatedVertices'
import { createScaleMatrix, multiplyMatrixVector } from '@/lib/math'
import type { VectorND } from '@/lib/math/types'
import { useTransformStore } from '@/stores/transformStore'
import { useMemo, useRef } from 'react'

/**
 * Hook to apply object transformations (scale and rotation).
 *
 * @param vertices - The initial geometry vertices.
 * @param dimension - The current spatial dimension.
 * @returns The transformed vertices (scaled and rotated).
 */
export function useObjectTransformations(vertices: VectorND[], dimension: number) {
  const uniformScale = useTransformStore((state) => state.uniformScale)
  const perAxisScale = useTransformStore((state) => state.perAxisScale)
  // Scratch buffer for scaled vertices (avoids allocation per frame)
  const scratchVerticesRef = useRef<VectorND[]>([])

  // Build scale matrix
  const scaleMatrix = useMemo(() => {
    const scales: number[] = []
    for (let i = 0; i < dimension; i++) {
      scales.push(perAxisScale[i] ?? uniformScale)
    }
    return createScaleMatrix(dimension, scales)
  }, [dimension, perAxisScale, uniformScale])

  // Apply scale using scratch buffers
  const scaledVertices = useMemo(() => {
    const numVertices = vertices.length
    if (numVertices === 0) return []

    const vertexDim = vertices[0]?.length ?? 0
    const scratch = scratchVerticesRef.current

    // Resize scratch buffer if needed
    if (scratch.length !== numVertices || (numVertices > 0 && scratch[0]?.length !== vertexDim)) {
      scratchVerticesRef.current = vertices.map((v) => new Array(v.length).fill(0))
    }

    const buffer = scratchVerticesRef.current

    // Apply scale to each vertex using out parameter
    for (let i = 0; i < numVertices; i++) {
      multiplyMatrixVector(scaleMatrix, vertices[i]!, buffer[i])
    }

    // Return new array reference for React to detect changes
    return [...buffer]
  }, [vertices, scaleMatrix])

  // Apply rotation
  const rotatedVertices = useRotatedVertices(scaledVertices, dimension)

  return rotatedVertices
}
