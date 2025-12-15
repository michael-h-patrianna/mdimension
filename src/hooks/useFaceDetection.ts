import type { NdGeometry, ObjectType } from '@/lib/geometry'
import { detectFaces, isPolytopeType } from '@/lib/geometry'
import { useMemo } from 'react'

/**
 * Hook to detect faces for a given geometry and object type.
 *
 * @param geometry - The geometry object containing vertices and edges.
 * @param objectType - The type of object being rendered.
 * @returns An array of detected faces.
 */
export function useFaceDetection(geometry: NdGeometry, objectType: ObjectType) {
  return useMemo(() => {
    // Polytopes, root-system, clifford-torus, and nested-torus support face detection
    const supportsFaces =
      isPolytopeType(objectType) ||
      objectType === 'root-system' ||
      objectType === 'clifford-torus' ||
      objectType === 'nested-torus'
    if (!supportsFaces) {
      return []
    }

    // Root-system needs edges to detect faces
    if (objectType === 'root-system' && geometry.edges.length === 0) {
      return []
    }

    // Clifford-torus and nested-torus need metadata for resolution info
    if (
      (objectType === 'clifford-torus' || objectType === 'nested-torus') &&
      !geometry.metadata?.properties
    ) {
      return []
    }

    try {
      return detectFaces(geometry.vertices, geometry.edges, objectType, geometry.metadata)
    } catch (e) {
      console.warn('Face detection failed:', e)
      return []
    }
  }, [geometry, objectType])
}
