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

// Import WASM module - Vite handles the loading and initialization
import init, { add_wasm, greet, start } from 'mdimension-core'

import { computeConvexHullFaces } from '@/lib/geometry/extended/utils/convex-hull-faces'
import { generateRootSystem } from '@/lib/geometry/extended/root-system'
import { computeGridFaces, computeTriangleFaces, type GridFacePropsWorker } from '@/lib/geometry/faces'
import { flattenFaces, flattenGeometry, inflateEdges, inflateVerticesOnly } from '@/lib/geometry/transfer'
import { generateWythoffPolytopeWithWarnings } from '@/lib/geometry/wythoff'
import type {
    CancelledResponse,
    ComputeFacesRequest,
    ErrorResponse,
    GenerateRootSystemRequest,
    GenerateWythoffRequest,
    GenerationStage,
    ProgressResponse,
    ResultResponse,
    WorkerRequest,
} from './types'

// ============================================================================
// Constants
// ============================================================================

/** Minimum supported dimension for polytopes */
const MIN_DIMENSION = 3

/** Maximum supported dimension for polytopes */
const MAX_DIMENSION = 11

/** Maximum number of faces to prevent memory exhaustion */
const MAX_FACE_COUNT = 500000

/** Minimum vertices required for convex hull (tetrahedron) */
const MIN_CONVEX_HULL_VERTICES = 4

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates dimension is within supported range
 */
function validateDimension(dimension: number): void {
  if (dimension < MIN_DIMENSION || dimension > MAX_DIMENSION) {
    throw new Error(
      `Dimension ${dimension} out of range. Supported: ${MIN_DIMENSION}-${MAX_DIMENSION}`
    )
  }
  if (!Number.isInteger(dimension)) {
    throw new Error(`Dimension must be an integer, got ${dimension}`)
  }
}

/**
 * Validates face count doesn't exceed memory limit
 */
function validateFaceCount(faceCount: number): void {
  if (faceCount > MAX_FACE_COUNT) {
    throw new Error(
      `Face count ${faceCount} exceeds maximum ${MAX_FACE_COUNT}. ` +
      `Try reducing resolution or dimension.`
    )
  }
}

/**
 * Validates grid properties have required fields
 */
function validateGridProps(gridProps: unknown): gridProps is GridFacePropsWorker {
  if (!gridProps || typeof gridProps !== 'object') {
    return false
  }

  const props = gridProps as Record<string, unknown>

  // Must have a valid configKey
  if (props.configKey !== 'cliffordTorus' && props.configKey !== 'nestedTorus') {
    return false
  }

  // Must have some resolution parameters
  const hasResolution =
    (typeof props.resolutionU === 'number' && typeof props.resolutionV === 'number') ||
    (typeof props.resolutionXi1 === 'number' && typeof props.resolutionXi2 === 'number') ||
    (typeof props.k === 'number' && typeof props.stepsPerCircle === 'number')

  return hasResolution
}

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

    case 'generate-root-system':
      handleRootSystemGeneration(request)
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
// Root System Generation
// ============================================================================

/**
 * Handle root system polytope generation request
 */
function handleRootSystemGeneration(request: GenerateRootSystemRequest): void {
  const { id, dimension, config } = request

  // Register request as active
  activeRequests.add(id)

  try {
    // Validate dimension
    validateDimension(dimension)

    // Stage: initializing
    sendProgress(id, 0, 'initializing')

    // Check cancellation
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: vertices
    sendProgress(id, 10, 'vertices')

    // Generate the root system (includes vertices, edges, and faces)
    const geometry = generateRootSystem(dimension, config)

    // Check cancellation after expensive operation
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: edges
    sendProgress(id, 60, 'edges')

    // Flatten for efficient transfer (includes faces from metadata)
    const { transferable, buffers } = flattenGeometry(geometry)

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

    // Validate dimension (applies to all methods)
    validateDimension(dimension)

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

        // Validate minimum vertices for convex hull
        if (vertices.length < MIN_CONVEX_HULL_VERTICES) {
          throw new Error(
            `Convex hull requires at least ${MIN_CONVEX_HULL_VERTICES} vertices, got ${vertices.length}`
          )
        }

        faces = computeConvexHullFaces(vertices)
        break
      }

      case 'triangles': {
        if (!flatEdges) {
          throw new Error('Edges required for triangle face detection')
        }

        // Validate edges array is not empty
        if (flatEdges.length === 0) {
          throw new Error('Edges array is empty, cannot detect triangles')
        }

        // Reconstruct vertices and edges from flat arrays
        const vertices = inflateVerticesOnly(flatVertices, dimension)
        const edges = inflateEdges(flatEdges)

        // Validate vertices array is not empty
        if (vertices.length === 0) {
          throw new Error('Vertices array is empty')
        }

        faces = computeTriangleFaces(vertices, edges)
        break
      }

      case 'grid': {
        // Validate grid properties using type guard
        if (!validateGridProps(gridProps)) {
          throw new Error(
            'Invalid grid properties: missing configKey or resolution parameters'
          )
        }

        // For nested tori, validate dimension >= 4
        if (gridProps.configKey === 'nestedTorus' || gridProps.visualizationMode === 'nested') {
          const intrinsicDim = gridProps.intrinsicDimension ?? dimension
          if (intrinsicDim < 4) {
            throw new Error(
              `Nested torus requires dimension >= 4, got ${intrinsicDim}`
            )
          }
        }

        // Grid faces are computed directly from properties
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

    // Validate face count to prevent memory exhaustion
    validateFaceCount(triangleFaces.length)

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
// Signal that the worker is ready
// Initialize WASM
init().then(() => {
  // Initialize panic hook
  start()

  if (import.meta.env.DEV) {
    console.log('[GeometryWorker] WASM initialized')
    // Sanity check
    greet('Worker')
    const sum = add_wasm(10, 20)
    console.log(`[GeometryWorker] WASM Sanity Check: 10 + 20 = ${sum}`)
    if (sum !== 30) console.error('[GeometryWorker] WASM Sanity Check FAILED')
    console.log('[GeometryWorker] Worker initialized and ready')
  }
}).catch((err: unknown) => {
  console.error('[GeometryWorker] Failed to initialize WASM:', err)
})
