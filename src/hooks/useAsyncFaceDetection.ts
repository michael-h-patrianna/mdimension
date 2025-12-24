/**
 * Async Face Detection Hook
 *
 * Provides React state management for asynchronous face detection
 * using the geometry Web Worker.
 *
 * For convex-hull face detection (used by root-system and wythoff-polytope),
 * computation happens in the worker thread.
 * For other face detection methods, falls back to synchronous detection.
 *
 * @example
 * ```tsx
 * function FaceViewer({ geometry, objectType }) {
 *   const { faces, isLoading } = useAsyncFaceDetection(geometry, objectType)
 *
 *   if (isLoading) {
 *     return <div>Computing faces...</div>
 *   }
 *
 *   return <FaceRenderer faces={faces} />
 * }
 * ```
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useGeometryWorker, generateRequestId } from './useGeometryWorker'
import { inflateFaces, flattenVerticesOnly } from '@/lib/geometry/transfer'
import { detectFaces, getFaceDetectionMethod } from '@/lib/geometry'
import type { Face } from '@/lib/geometry/faces'
import type { NdGeometry, ObjectType } from '@/lib/geometry/types'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of the useAsyncFaceDetection hook
 */
export interface AsyncFaceDetectionResult {
  /** Detected faces */
  faces: Face[]
  /** Whether face detection is in progress */
  isLoading: boolean
  /** Error if detection failed */
  error: Error | null
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for asynchronous face detection.
 *
 * Uses Web Worker for convex-hull method to prevent UI blocking.
 * Falls back to synchronous detection for other methods.
 *
 * @param geometry - The geometry to detect faces for
 * @param objectType - The type of object (determines detection method)
 * @returns Async face detection result with loading state
 */
export function useAsyncFaceDetection(
  geometry: NdGeometry | null,
  objectType: ObjectType
): AsyncFaceDetectionResult {
  const { sendRequest, cancelRequest } = useGeometryWorker()

  // State
  const [faces, setFaces] = useState<Face[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track current request for cancellation
  const currentRequestId = useRef<string | null>(null)

  // Stable geometry reference for dependency tracking
  // Use vertex count and first vertex as a proxy for geometry identity
  const geometryKey = useMemo(() => {
    if (!geometry || geometry.vertices.length === 0) return 'empty'
    const firstVertex = geometry.vertices[0]
    return `${geometry.vertices.length}-${geometry.dimension}-${firstVertex?.join(',')}`
  }, [geometry])

  /**
   * Detect faces synchronously (for non-worker methods or as fallback)
   */
  const detectSync = useCallback(
    (geo: NdGeometry) => {
      setIsLoading(true)
      setError(null)

      try {
        // Use the existing synchronous detector
        const detected = detectFaces(
          geo.vertices as number[][],
          geo.edges,
          objectType,
          geo.metadata
        )

        setFaces(detected)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        setFaces([])
      } finally {
        setIsLoading(false)
      }
    },
    [objectType]
  )

  /**
   * Detect faces via Web Worker (async)
   * Falls back to synchronous detection if worker is unavailable.
   */
  const detectViaWorker = useCallback(
    async (geo: NdGeometry) => {
      const requestId = generateRequestId('faces')
      currentRequestId.current = requestId

      // Reset state
      setIsLoading(true)
      setError(null)

      try {
        // Flatten vertices for transfer
        const { flatVertices } = flattenVerticesOnly(
          geo.vertices as number[][],
          geo.dimension
        )

        const response = await sendRequest(
          {
            type: 'compute-faces',
            id: requestId,
            vertices: flatVertices,
            dimension: geo.dimension,
            objectType,
          },
          undefined, // no progress callback
          [flatVertices.buffer] // zero-copy transfer
        )

        // Check if this response is for the current request
        if (currentRequestId.current !== requestId) {
          return // Stale response, ignore
        }

        if (response.type === 'result' && response.faces) {
          // Inflate the face data
          const inflated = inflateFaces(response.faces)

          // Convert to Face objects
          const faceObjects: Face[] = inflated.map(([v0, v1, v2]) => ({
            vertices: [v0, v1, v2],
          }))

          setFaces(faceObjects)
        } else if (response.type === 'cancelled') {
          // Request was cancelled, don't update state
          return
        }
      } catch (err) {
        // Only handle if this is still the current request
        if (currentRequestId.current === requestId) {
          const errorMessage = err instanceof Error ? err.message : String(err)

          // Fallback to sync detection if worker is unavailable
          if (errorMessage.includes('Worker not available')) {
            if (import.meta.env.DEV) {
              console.warn('[useAsyncFaceDetection] Worker unavailable, using sync fallback')
            }
            // Use sync detection as fallback
            try {
              const detected = detectFaces(
                geo.vertices as number[][],
                geo.edges,
                objectType,
                geo.metadata
              )
              setFaces(detected)
              setError(null)
            } catch (syncErr) {
              setError(syncErr instanceof Error ? syncErr : new Error(String(syncErr)))
              setFaces([])
            } finally {
              setIsLoading(false)
              currentRequestId.current = null
            }
            return
          }

          // For other errors, set error state
          setError(err instanceof Error ? err : new Error(errorMessage))
          setFaces([])
        }
      } finally {
        // Only update loading state if this is still the current request
        if (currentRequestId.current === requestId) {
          setIsLoading(false)
          currentRequestId.current = null
        }
      }
    },
    [objectType, sendRequest]
  )

  // Detect faces when geometry changes
  // NOTE: This effect must be defined AFTER all callbacks it uses
  useEffect(() => {
    // Cancel any previous request
    if (currentRequestId.current) {
      cancelRequest(currentRequestId.current)
      currentRequestId.current = null
    }

    // Handle null geometry
    if (!geometry || geometry.vertices.length === 0) {
      setFaces([])
      setIsLoading(false)
      setError(null)
      return
    }

    // CRITICAL: Clear stale faces immediately when geometry changes
    // This prevents rendering old faces (with invalid vertex indices) against new geometry
    setFaces([])

    // Get face detection method from registry
    const faceMethod = getFaceDetectionMethod(objectType)

    // If no face detection needed, return empty
    if (faceMethod === 'none') {
      setFaces([])
      setIsLoading(false)
      return
    }

    // Check if this method should use the worker
    const useWorker = faceMethod === 'convex-hull'

    if (useWorker) {
      // Async path via worker
      detectViaWorker(geometry)
    } else {
      // Sync path for other detection methods
      detectSync(geometry)
    }

    // Cleanup on unmount or param change
    return () => {
      if (currentRequestId.current) {
        cancelRequest(currentRequestId.current)
        currentRequestId.current = null
      }
    }
  }, [geometryKey, objectType, geometry, detectViaWorker, detectSync, cancelRequest])

  return {
    faces,
    isLoading,
    error,
  }
}
