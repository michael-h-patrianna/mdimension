/**
 * Hook to apply rotation transformations to vertices.
 * Uses the rotationStore state to determine angles.
 */

import { multiplyMatrixVector } from '@/lib/math/matrix'
import { composeRotations, getRotationPlanes } from '@/lib/math/rotation'
import type { VectorND } from '@/lib/math/types'
import { useRotationStore } from '@/stores/rotationStore'
import { useMemo, useRef } from 'react'

// Module-level cache for valid plane name Sets per dimension
// Avoids recreating Set + map() on every rotation change
const validPlanesCache = new Map<number, Set<string>>()

function getValidPlanesSet(dimension: number): Set<string> {
  let cached = validPlanesCache.get(dimension)
  if (!cached) {
    cached = new Set(getRotationPlanes(dimension).map((p) => p.name))
    validPlanesCache.set(dimension, cached)
  }
  return cached
}

/**
 * Applies current rotations to a set of vertices
 * @param vertices - The vertices to rotate
 * @param dimension - The spatial dimension
 * @returns The rotated vertices
 */
export function useRotatedVertices(vertices: VectorND[], dimension: number): VectorND[] {
  const rotations = useRotationStore((state) => state.rotations)
  // Reusable Map for filtered rotations (avoids allocation on every rotation change)
  const filteredRotationsRef = useRef(new Map<string, number>())
  // Scratch buffer for rotated vertices (avoids allocation per frame)
  const scratchVerticesRef = useRef<VectorND[]>([])

  // Memoize rotation matrix calculation
  // Note: composeRotations internally uses scratch buffers, so no allocation here
  const rotationMatrix = useMemo(() => {
    // Filter rotations to only include valid planes for the target dimension.
    // This handles the race condition where geometryStore.dimension has changed
    // but rotationStore hasn't been synced yet (useSyncedDimension runs in useLayoutEffect).
    const validPlanes = getValidPlanesSet(dimension)
    const filteredRotations = filteredRotationsRef.current
    filteredRotations.clear()
    for (const [plane, angle] of rotations.entries()) {
      if (validPlanes.has(plane)) {
        filteredRotations.set(plane, angle)
      }
    }
    return composeRotations(dimension, filteredRotations)
  }, [dimension, rotations])

  // Apply rotation matrix to all vertices using scratch buffers
  const rotatedVertices = useMemo(() => {
    const numVertices = vertices.length
    if (numVertices === 0) return []

    const vertexDim = vertices[0]?.length ?? 0
    const scratch = scratchVerticesRef.current

    // Resize scratch buffer if needed
    if (scratch.length !== numVertices || (numVertices > 0 && scratch[0]?.length !== vertexDim)) {
      scratchVerticesRef.current = vertices.map((v) => new Array(v.length).fill(0))
    }

    const buffer = scratchVerticesRef.current

    // Apply rotation to each vertex using out parameter
    for (let i = 0; i < numVertices; i++) {
      multiplyMatrixVector(rotationMatrix, vertices[i]!, buffer[i])
    }

    // Return new array reference for React to detect changes
    return [...buffer]
  }, [vertices, rotationMatrix])

  return rotatedVertices
}
