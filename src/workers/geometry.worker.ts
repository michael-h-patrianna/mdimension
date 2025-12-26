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
import init, {
  detect_faces_wasm,
  generate_root_system_wasm,
  generate_wythoff_wasm,
  start,
} from 'mdimension-core'

import { computeGridFaces, type GridFacePropsWorker } from '@/lib/geometry/faces'
import { flattenFaces, flattenGeometry } from '@/lib/geometry/transfer'
import type { NdGeometry } from '@/lib/geometry/types'
import {
  generateWythoffPolytopeWithWarnings,
  getWythoffPresetName,
  type WythoffPreset,
  type WythoffSymmetryGroup,
} from '@/lib/geometry/wythoff'
import type {
  CancelledResponse,
  ComputeFacesRequest,
  ErrorResponse,
  GenerateRootSystemRequest,
  GenerateWythoffRequest,
  GenerationStage,
  InitErrorResponse,
  ProgressResponse,
  ReadyResponse,
  ResultResponse,
  WorkerRequest,
} from './types'

// ============================================================================
// WASM Initialization State
// ============================================================================

/**
 * Flag indicating whether WASM module has been initialized.
 * Requests received before initialization are queued.
 */
let wasmReady = false

/**
 * Queue of requests received before WASM initialization completed.
 * Processed in order once WASM is ready.
 */
const pendingQueue: WorkerRequest[] = []

// ============================================================================
// Constants
// ============================================================================

/** Minimum supported dimension for polytopes */
const MIN_DIMENSION = 3

/** Maximum supported dimension for polytopes */
const MAX_DIMENSION = 11

/** Maximum number of faces to prevent memory exhaustion */
const MAX_FACE_COUNT = 500000

/** Minimum vertices required for convex hull (tetrahedron) - used in validateVertexCount */
const MIN_CONVEX_HULL_VERTICES = 4

/**
 * Validates vertex count meets minimum requirements for convex hull
 * @param vertexCount
 */
function validateVertexCount(vertexCount: number): void {
  if (vertexCount < MIN_CONVEX_HULL_VERTICES) {
    throw new Error(
      `Vertex count ${vertexCount} is below minimum ${MIN_CONVEX_HULL_VERTICES} required for convex hull`
    )
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates dimension is within supported range
 * @param dimension
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
 * @param faceCount
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
 * @param gridProps - Properties to validate
 * @returns True if valid GridFacePropsWorker
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

/**
 * Set of request IDs that were cancelled while in the pending queue.
 * When processing the pending queue after WASM init, we check this set
 * to skip requests that were cancelled before they could be processed.
 * This prevents the race condition where both 'cancelled' and 'result'
 * responses are sent for the same request ID.
 */
const cancelledWhilePending = new Set<string>()

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Dispatch a request to the appropriate handler
 * @param request
 */
function handleRequest(request: WorkerRequest): void {
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

    default: {
      // Type guard ensures this is unreachable, but handle gracefully
      // Extract ID if available to allow main thread to match the error
      const unknownRequest = request as { type: string; id?: string }
      const errorId = unknownRequest.id ?? 'unknown'
      sendError(errorId, `Unknown request type: ${unknownRequest.type}`)
    }
  }
}

/**
 * Handle incoming messages from main thread.
 * Queues requests if WASM is not yet initialized.
 * @param event
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  // Cancel requests can be processed immediately (they just remove from activeRequests)
  if (request.type === 'cancel') {
    handleRequest(request)
    return
  }

  // If WASM isn't ready, queue the request
  if (!wasmReady) {
    pendingQueue.push(request)
    if (import.meta.env.DEV) {
      console.log(`[GeometryWorker] WASM not ready, queuing request: ${request.id}`)
    }
    return
  }

  // WASM is ready, handle immediately
  handleRequest(request)
}

// ============================================================================
// Wythoff Polytope Generation
// ============================================================================

/**
 * Handle Wythoff polytope generation request
 * @param request
 */
function handleWythoffGeneration(request: GenerateWythoffRequest): void {
  const { id, dimension, config } = request

  // Register request as active
  activeRequests.add(id)

  try {
    // Validate dimension first (applies to both WASM and fallback paths)
    validateDimension(dimension)

    // Stage: initializing
    sendProgress(id, 0, 'initializing')

    // Check cancellation
    if (!activeRequests.has(id)) {
      return
    }

    // --- WASM PATH ---
    // Use WASM for supported types (all valid configs should be supported by now or fallback gracefully)

    // Stage: vertices (WASM)
    sendProgress(id, 10, 'vertices')

    // Calculate max vertices based on dimension and preset
    // Omnitruncated now uses O(V × n) combinatorial edge generation (not O(V²))
    // so we can allow higher vertex counts
    const isOmnitruncated = config.preset === 'omnitruncated'
    const maxVertices = isOmnitruncated
      ? Math.min(20000, 2000 + dimension * 2000) // 2000-20000 based on dimension
      : 40000

    const wasmConfig = {
      symmetry_group: config.symmetryGroup || 'B',
      preset: config.preset || 'regular',
      dimension,
      scale: config.scale || 1.0,
      custom_symbol: config.customSymbol,
      max_vertices: maxVertices,
    }

    // WASM is guaranteed ready at this point (handled by message queue)
    const wasmResult = generate_wythoff_wasm(wasmConfig)

    if (wasmResult && wasmResult.vertices.length > 0) {
      // Success path via WASM
      // Stage: edges (Included in WASM generation)
      sendProgress(id, 60, 'edges')

      const { warnings } = wasmResult

      // serde_wasm_bindgen returns plain JS arrays, not TypedArrays
      // Wrap them in TypedArrays for efficient zero-copy transfer
      const vertices = new Float64Array(wasmResult.vertices)
      const edges = new Uint32Array(wasmResult.edges)

      // Stage: faces - now generated directly in WASM
      sendProgress(id, 70, 'faces')

      // WASM now returns faces directly - convert flat array to nested for metadata
      // wasmResult.faces is flat [v0, v1, v2, v0, v1, v2, ...]
      const analyticalFaces: number[][] = []
      const wasmFaces = wasmResult.faces || []
      // Only process complete triangles (length must be divisible by 3)
      const completeTriangleCount = Math.floor(wasmFaces.length / 3)
      for (let i = 0; i < completeTriangleCount; i++) {
        const idx = i * 3
        analyticalFaces.push([wasmFaces[idx]!, wasmFaces[idx + 1]!, wasmFaces[idx + 2]!])
      }

      // Construct TransferablePolytopeGeometry directly
      const transferable = {
        vertices,
        edges,
        dimension,
        type: 'wythoff-polytope' as const,
        metadata: {
          name: getWythoffPresetName(
            wasmConfig.preset as WythoffPreset,
            wasmConfig.symmetry_group as WythoffSymmetryGroup,
            dimension
          ),
          properties: {
            ...config,
            scale: wasmConfig.scale,
            analyticalFaces,
          },
        },
      }

      const buffers = [vertices.buffer, edges.buffer]

      // Check cancellation
      if (!activeRequests.has(id)) {
        return
      }

      // Stage: complete
      sendProgress(id, 100, 'complete')

      const response: ResultResponse = {
        type: 'result',
        id,
        geometry: transferable,
        warnings,
      }

      activeRequests.delete(id)
      self.postMessage(response, { transfer: buffers })
      return
    }

    // --- FALLBACK PATH ---
    // WASM returned empty result (unsupported config or generation failed)
    if (import.meta.env.DEV) {
      console.warn(
        `[GeometryWorker] WASM returned empty for ${config.preset ?? 'regular'} ` +
          `(${config.symmetryGroup ?? 'B'}${dimension}), using JS fallback`
      )
    }

    // Generate the polytope using JS implementation
    const result = generateWythoffPolytopeWithWarnings(dimension, config)

    // ... (rest of legacy handler)
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
 * @param request
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

    // Use WASM to generate the complete root system (vertices + edges)
    let wasmResult: {
      vertices: number[]
      edges: number[]
      dimension: number
      vertex_count: number
      edge_count: number
    }

    try {
      wasmResult = generate_root_system_wasm(
        config.rootType,
        dimension,
        config.scale
      ) as typeof wasmResult
    } catch (wasmError) {
      // WASM threw an error, fall through to error handling
      throw new Error(`WASM root system generation failed: ${wasmError}`)
    }

    // Validate WASM result
    if (!wasmResult || wasmResult.vertex_count === 0 || wasmResult.vertices.length === 0) {
      throw new Error(
        `WASM returned empty root system for type=${config.rootType} dim=${dimension}`
      )
    }

    // Convert flat vertices to 2D array for NdGeometry
    const vertices: number[][] = []
    for (let i = 0; i < wasmResult.vertex_count; i++) {
      const start = i * dimension
      vertices.push(Array.from(wasmResult.vertices.slice(start, start + dimension)))
    }

    // Convert flat edges to pairs (only complete edge pairs)
    const edges: [number, number][] = []
    const completeEdgeCount = Math.floor(wasmResult.edges.length / 2)
    for (let i = 0; i < completeEdgeCount; i++) {
      const idx = i * 2
      edges.push([wasmResult.edges[idx]!, wasmResult.edges[idx + 1]!])
    }

    // Generate faces using WASM triangle detection
    const flatVertices = new Float64Array(wasmResult.vertices)
    const flatEdges = new Uint32Array(wasmResult.edges)
    const flatFaces = detect_faces_wasm(flatVertices, flatEdges, dimension, 'triangles')

    // Convert flat faces to triangles (only complete triangles)
    const faces: number[][] = []
    const completeFaceCount = Math.floor(flatFaces.length / 3)
    for (let i = 0; i < completeFaceCount; i++) {
      const idx = i * 3
      faces.push([flatFaces[idx]!, flatFaces[idx + 1]!, flatFaces[idx + 2]!])
    }

    // Build NdGeometry object - dimension and type must be at top level
    // Faces go in metadata.properties.analyticalFaces (not at top level)
    const geometry: NdGeometry = {
      dimension,
      type: 'root-system',
      vertices,
      edges,
      metadata: {
        name:
          config.rootType === 'E8'
            ? 'E₈ Root System'
            : `${config.rootType}_${config.rootType === 'A' ? dimension - 1 : dimension} Root System`,
        properties: {
          rootType: config.rootType,
          vertexCount: wasmResult.vertex_count,
          edgeCount: wasmResult.edge_count,
          faceCount: faces.length,
          analyticalFaces: faces,
        },
      },
    }

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
 * @param request
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

    if (method === 'convex-hull' || method === 'triangles') {
      // --- WASM PATH (Unified) ---

      // Validate vertex count for convex hull (needs at least 4 vertices for tetrahedron)
      if (method === 'convex-hull') {
        const vertexCount = flatVertices.length / dimension
        validateVertexCount(vertexCount)
      }

      if (method === 'triangles') {
        if (!flatEdges || flatEdges.length === 0) {
          throw new Error('Edges required for triangle face detection')
        }
      }

      // Call unified WASM function
      // Note: we pass flatEdges for triangles; for hull it ignores it (or we pass empty)
      const edgesToPass = flatEdges || new Uint32Array(0)

      const flatFaces = detect_faces_wasm(flatVertices, edgesToPass, dimension, method)

      // Stage: complete
      sendProgress(id, 90, 'complete')

      const response: ResultResponse = {
        type: 'result',
        id,
        faces: flatFaces,
      }

      const buffer = flatFaces.buffer
      activeRequests.delete(id)
      self.postMessage(response, { transfer: [buffer] })
      return
    }

    let faces: [number, number, number][] | number[][] = []

    switch (method) {
      case 'grid': {
        // Validate grid properties using type guard
        if (!validateGridProps(gridProps)) {
          throw new Error('Invalid grid properties: missing configKey or resolution parameters')
        }

        // For nested tori, validate dimension >= 4
        if (gridProps.configKey === 'nestedTorus' || gridProps.visualizationMode === 'nested') {
          const intrinsicDim = gridProps.intrinsicDimension ?? dimension
          if (intrinsicDim < 4) {
            throw new Error(`Nested torus requires dimension >= 4, got ${intrinsicDim}`)
          }
        }

        // Grid faces are computed directly from properties
        faces = computeGridFaces(gridProps)
        break
      }

      default:
        throw new Error(`Unknown face detection method: ${method}`)
    }

    // Check cancellation after expensive operation (for JS path)
    if (!activeRequests.has(id)) {
      return
    }

    // Stage: complete
    sendProgress(id, 90, 'complete')

    // Flatten faces for transfer (Quad splitting)
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

    // Validate face count
    validateFaceCount(triangleFaces.length)

    const { flatFaces, buffer } = flattenFaces(triangleFaces)

    // Send the result
    const response: ResultResponse = {
      type: 'result',
      id,
      faces: flatFaces,
    }

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
 * @param id
 */
function handleCancellation(id: string): void {
  // Remove from active requests (ongoing operations will check this)
  const wasActive = activeRequests.delete(id)

  // If the request wasn't active, it might be in the pending queue
  // Track it so we can skip it when processing the queue
  if (!wasActive) {
    cancelledWhilePending.add(id)
  }

  // Send confirmation
  const response: CancelledResponse = {
    type: 'cancelled',
    id,
  }

  self.postMessage(response)

  if (import.meta.env.DEV) {
    if (wasActive) {
      console.log(`[GeometryWorker] Cancelled active request: ${id}`)
    } else {
      console.log(`[GeometryWorker] Cancelled pending request: ${id}`)
    }
  }
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Send progress update to main thread
 * @param id
 * @param progress
 * @param stage
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
 * @param id
 * @param error
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

/**
 * Initialize WASM module, process queued requests, and notify main thread.
 */
init()
  .then(() => {
    // Initialize panic hook for better error messages
    start()

    if (import.meta.env.DEV) {
      console.log('[GeometryWorker] WASM initialized')
    }

    // Mark WASM as ready
    wasmReady = true

    // Process any queued requests, skipping those that were cancelled
    if (pendingQueue.length > 0) {
      if (import.meta.env.DEV) {
        console.log(`[GeometryWorker] Processing ${pendingQueue.length} queued request(s)`)
      }
      for (const request of pendingQueue) {
        // Skip requests that were cancelled while in the pending queue
        if ('id' in request && cancelledWhilePending.has(request.id)) {
          if (import.meta.env.DEV) {
            console.log(`[GeometryWorker] Skipping cancelled request: ${request.id}`)
          }
          continue
        }
        handleRequest(request)
      }
      pendingQueue.length = 0 // Clear the queue
      cancelledWhilePending.clear() // Clear the cancelled set
    }

    // Notify main thread that worker is ready
    const readyResponse: ReadyResponse = { type: 'ready' }
    self.postMessage(readyResponse)

    if (import.meta.env.DEV) {
      console.log('[GeometryWorker] Worker initialized and ready')
    }
  })
  .catch((err: unknown) => {
    console.error('[GeometryWorker] Failed to initialize WASM:', err)

    // Notify main thread of initialization failure
    const errorResponse: InitErrorResponse = {
      type: 'init-error',
      error: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(errorResponse)

    // Reject all queued requests
    for (const request of pendingQueue) {
      if ('id' in request) {
        sendError(request.id, 'WASM initialization failed')
      }
    }
    pendingQueue.length = 0
  })
