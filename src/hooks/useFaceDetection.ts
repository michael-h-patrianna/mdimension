import type { NdGeometry, ObjectType } from '@/lib/geometry'
import { detectFaces, getFaceDetectionMethod } from '@/lib/geometry'
import { useMemo } from 'react'

/**
 * Hook to detect faces for a given geometry and object type.
 *
 * Uses the registry to determine if the object type supports face detection.
 *
 * @param geometry - The geometry object containing vertices and edges.
 * @param objectType - The type of object being rendered.
 * @returns An array of detected faces.
 */
export function useFaceDetection(geometry: NdGeometry, objectType: ObjectType) {
  return useMemo(() => {
    // Use registry to check if object type supports face rendering
    // Note: Raymarched types (mandelbulb, quaternion-julia) support faces via raymarching,
    // but don't use detectFaces - they render directly in the shader
    const faceDetectionMethod = getFaceDetectionMethod(objectType)
    if (faceDetectionMethod === 'none') {
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
