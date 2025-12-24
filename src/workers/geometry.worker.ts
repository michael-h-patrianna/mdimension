/**
 * Unified Geometry Web Worker
 *
 * Offloads expensive geometry computations to a background thread,
 * keeping the main thread responsive during generation.
 *
 * Supported operations:
 * - generate-wythoff: Generate Wythoff polytope geometry
 * - compute-faces: Compute convex hull faces from vertices
 * - cancel: Cancel a pending operation
 *
 * Features:
 * - Non-blocking generation for complex polytopes
 * - Progress reporting for long operations
 * - Request cancellation support
 * - Zero-copy transfer using Transferable objects
 *
 * @see https://vitejs.dev/guide/features.html#web-workers
 */

import { flattenGeometry, flattenFaces, inflateVerticesOnly, inflateEdges } from '@/lib/geometry/transfer'
import { generateWythoffPolytopeWithWarnings } from '@/lib/geometry/wythoff'
import { computeConvexHullFaces } from '@/lib/geometry/extended/utils/convex-hull-faces'
import { computeTriangleFaces, computeGridFaces } from '@/lib/geometry/faces'
import type {
  WorkerRequest,
  GenerateWythoffRequest,
  ComputeFacesRequest,
  ProgressResponse,
  ErrorResponse,
  CancelledResponse,
  ResultResponse,
  GenerationStage,
} from './types'

// ============================================================================
// Active Request Tracking (for cancellation)
// ============================================================================

/**
 * Set of active request IDs.
 * Used to check if a request has been cancelled mid-operation.
 */
const activeRequests = new Set<string>()

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle incoming messages from main thread
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  switch (request.type) {
    case 'generate-wythoff':
      handleWythoffGeneration(request)
      break

    case 'compute-faces':
      handleFaceComputation(request)
      break

    case 'cancel':
      handleCancellation(request.id)
      break

    default:
      // Type guard ensures this is unreachable, but handle gracefully
      sendError('unknown', `Unknown request type: ${(request as { type: string }).type}`)
  }
}

// ============================================================================
// Wythoff Polytope Generation
// ============================================================================

/**
 * Handle Wythoff polytope generation request
 */
function handleWythoffGeneration(request: GenerateWythoffRequest): void {
  const { id, dimension, config } = request

  // Register request as active
  activeRequests.add(id)

  try {
    // Stage: initializing
    sendProgress(id, 0, 'initializing')

    // Check cancellation
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: vertices
    sendProgress(id, 10, 'vertices')

    // Generate the polytope (includes vertices and edges)
    const result = generateWythoffPolytopeWithWarnings(dimension, config)

    // Check cancellation after expensive operation
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: edges
    sendProgress(id, 60, 'edges')

    // Flatten for efficient transfer
    const { transferable, buffers } = flattenGeometry(result.geometry)

    // Check cancellation
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: complete
    sendProgress(id, 100, 'complete')

    // Send the result with zero-copy transfer
    const response: ResultResponse = {
      type: 'result',
      id,
      geometry: transferable,
      warnings: result.warnings,
    }

    // Clean up and send
    activeRequests.delete(id)
    self.postMessage(response, { transfer: buffers })
  } catch (error) {
    activeRequests.delete(id)
    const message = error instanceof Error ? error.message : String(error)
    sendError(id, message)
  }
}

// ============================================================================
// Face Computation
// ============================================================================

/**
 * Handle face computation request
 * Dispatches to appropriate algorithm based on method
 */
function handleFaceComputation(request: ComputeFacesRequest): void {
  const { id, method, vertices: flatVertices, dimension, edges: flatEdges, gridProps } = request

  // Register request as active
  activeRequests.add(id)

  try {
    // Stage: initializing
    sendProgress(id, 0, 'initializing')

    // Check cancellation
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: faces
    sendProgress(id, 20, 'faces')

    let faces: [number, number, number][] | number[][]

    switch (method) {
      case 'convex-hull': {
        // Reconstruct vertices from flat array
        const vertices = inflateVerticesOnly(flatVertices, dimension)
        faces = computeConvexHullFaces(vertices)
        break
      }

      case 'triangles': {
        if (!flatEdges) {
          throw new Error('Edges required for triangle face detection')
        }
        // Reconstruct vertices and edges from flat arrays
        const vertices = inflateVerticesOnly(flatVertices, dimension)
        const edges = inflateEdges(flatEdges)
        faces = computeTriangleFaces(vertices, edges)
        break
      }

      case 'grid': {
        if (!gridProps) {
          throw new Error('Grid properties required for grid face detection')
        }
        // Grid faces are computed directly from properties, no vertex data needed
        faces = computeGridFaces(gridProps)
        break
      }

      default:
        throw new Error(`Unknown face detection method: ${method}`)
    }

    // Check cancellation after expensive operation
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: complete
    sendProgress(id, 90, 'complete')

    // Flatten faces for transfer
    // Handle both triangle and quad faces by splitting quads into triangles
    const triangleFaces: [number, number, number][] = []
    for (const f of faces) {
      if (f.length === 3) {
        triangleFaces.push([f[0]!, f[1]!, f[2]!])
      } else if (f.length === 4) {
        // Split quad into two triangles: (0,1,2) and (0,2,3)
        triangleFaces.push([f[0]!, f[1]!, f[2]!])
        triangleFaces.push([f[0]!, f[2]!, f[3]!])
      }
    }

    const { flatFaces, buffer } = flattenFaces(triangleFaces)

    // Send the result with zero-copy transfer
    const response: ResultResponse = {
      type: 'result',
      id,
      faces: flatFaces,
    }

    // Clean up and send
    activeRequests.delete(id)
    self.postMessage(response, { transfer: [buffer] })
  } catch (error) {
    activeRequests.delete(id)
    const message = error instanceof Error ? error.message : String(error)
    sendError(id, message)
  }
}

// ============================================================================
// Cancellation
// ============================================================================

/**
 * Handle cancellation request
 */
function handleCancellation(id: string): void {
  // Remove from active requests (ongoing operations will check this)
  const wasActive = activeRequests.delete(id)

  // Send confirmation
  const response: CancelledResponse = {
    type: 'cancelled',
    id,
  }

  self.postMessage(response)

  if (import.meta.env.DEV && wasActive) {
    console.log(`[GeometryWorker] Cancelled request: ${id}`)
  }
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Send progress update to main thread
 */
function sendProgress(id: string, progress: number, stage: GenerationStage): void {
  const response: ProgressResponse = {
    type: 'progress',
    id,
    progress,
    stage,
  }
  self.postMessage(response)
}

/**
 * Send error message to main thread
 */
function sendError(id: string, error: string): void {
  const response: ErrorResponse = {
    type: 'error',
    id,
    error,
  }
  self.postMessage(response)
}

// ============================================================================
// Initialization
// ============================================================================

// Signal that the worker is ready
if (import.meta.env.DEV) {
  console.log('[GeometryWorker] Worker initialized and ready')
}
