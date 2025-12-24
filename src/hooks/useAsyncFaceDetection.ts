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
import { inflateFaces, flattenVerticesOnly, flattenEdges } from '@/lib/geometry/transfer'
import { detectFaces, getFaceDetectionMethod } from '@/lib/geometry'
import { OBJECT_TYPE_REGISTRY } from '@/lib/geometry/registry/registry'
import type { Face } from '@/lib/geometry/faces'
import type { NdGeometry, ObjectType } from '@/lib/geometry/types'
import type { WorkerFaceMethod, GridFaceProps } from '@/workers/types'
import type { FaceDetectionMethod } from '@/lib/geometry/registry/types'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Maps registry face detection method to worker method.
 * Returns undefined for methods that should run synchronously.
 *
 * Worker methods: convex-hull, triangles, grid (potentially expensive)
 * Sync methods: analytical-quad, metadata (fast O(1) or O(n) operations)
 */
function getWorkerMethod(faceMethod: FaceDetectionMethod): WorkerFaceMethod | undefined {
  switch (faceMethod) {
    case 'convex-hull':
      return 'convex-hull'
    case 'triangles':
      return 'triangles'
    case 'grid':
      return 'grid'
    default:
      // analytical-quad, metadata, none - run sync
      return undefined
  }
}

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
    async (geo: NdGeometry, method: WorkerFaceMethod) => {
      const requestId = generateRequestId('faces')
      currentRequestId.current = requestId

      // Reset state
      setIsLoading(true)
      setError(null)

      try {
        // Flatten vertices for transfer
        const { flatVertices, buffer: vertexBuffer } = flattenVerticesOnly(
          geo.vertices as number[][],
          geo.dimension
        )

        // Prepare transfer buffers
        const transferBuffers: ArrayBuffer[] = [vertexBuffer]

        // Build request based on method
        let flatEdges: Uint32Array | undefined
        let gridProps: GridFaceProps | undefined

        if (method === 'triangles') {
          // Triangle detection needs edges
          const { flatEdges: edges, buffer: edgeBuffer } = flattenEdges(geo.edges)
          flatEdges = edges
          transferBuffers.push(edgeBuffer)
        } else if (method === 'grid') {
          // Grid detection needs metadata properties
          const registryEntry = OBJECT_TYPE_REGISTRY.get(objectType)
          const configKey = registryEntry?.configStoreKey as 'cliffordTorus' | 'nestedTorus' | undefined

          if (configKey && geo.metadata?.properties) {
            const props = geo.metadata.properties
            gridProps = {
              visualizationMode: props.visualizationMode as string | undefined,
              mode: props.mode as string | undefined,
              resolutionU: props.resolutionU as number | undefined,
              resolutionV: props.resolutionV as number | undefined,
              resolutionXi1: props.resolutionXi1 as number | undefined,
              resolutionXi2: props.resolutionXi2 as number | undefined,
              k: props.k as number | undefined,
              stepsPerCircle: props.stepsPerCircle as number | undefined,
              intrinsicDimension: props.intrinsicDimension as number | undefined,
              torusCount: props.torusCount as number | undefined,
            }
          }
        }

        const response = await sendRequest(
          {
            type: 'compute-faces',
            id: requestId,
            method,
            vertices: flatVertices,
            dimension: geo.dimension,
            objectType,
            edges: flatEdges,
            gridProps: gridProps ? { ...gridProps, configKey: OBJECT_TYPE_REGISTRY.get(objectType)?.configStoreKey as 'cliffordTorus' | 'nestedTorus' } : undefined,
          },
          undefined, // no progress callback
          transferBuffers // zero-copy transfer
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

    // Map registry face method to worker method
    // Worker handles: convex-hull, triangles, grid
    // Sync handles: analytical-quad, metadata (fast operations)
    const workerMethod = getWorkerMethod(faceMethod)

    if (workerMethod) {
      // Async path via worker
      detectViaWorker(geometry, workerMethod)
    } else {
      // Sync path for fast detection methods (analytical-quad, metadata)
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
