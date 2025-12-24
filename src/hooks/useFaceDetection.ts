import type { Face } from '@/lib/geometry/faces'
import type { NdGeometry, ObjectType } from '@/lib/geometry'
import { useAsyncFaceDetection } from './useAsyncFaceDetection'

/**
 * Return type for useFaceDetection hook
 */
export interface FaceDetectionResult {
  /** Detected faces */
  faces: Face[]
  /** Whether face detection is in progress */
  isLoading: boolean
  /** Error if face detection failed */
  error: Error | null
}

/**
 * Hook to detect faces for a given geometry and object type.
 *
 * Uses Web Worker for convex-hull method (root-system, wythoff-polytope)
 * to prevent UI blocking during heavy computation.
 *
 * Falls back to synchronous detection for other methods (grid, none).
 *
 * @param geometry - The geometry object containing vertices and edges (nullable during loading).
 * @param objectType - The type of object being rendered.
 * @returns Object with detected faces and loading state.
 */
export function useFaceDetection(
  geometry: NdGeometry | null,
  objectType: ObjectType
): FaceDetectionResult {
  const { faces, isLoading, error } = useAsyncFaceDetection(geometry, objectType)

  return {
    faces,
    isLoading,
    error,
  }
}
