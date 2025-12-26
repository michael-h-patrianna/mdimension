/**
 * Shared types for geometry Web Worker communication.
 *
 * Uses discriminated unions for type-safe message passing between
 * main thread and worker.
 *
 * @see https://vitejs.dev/guide/features.html#web-workers
 */

import type { TransferablePolytopeGeometry } from '@/lib/geometry/transfer'
import type { WythoffPolytopeConfig } from '@/lib/geometry/wythoff/types'
import type { RootSystemConfig } from '@/lib/geometry/extended/types'
import type { ObjectType } from '@/lib/geometry/types'

// ============================================================================
// Request Types (Main Thread -> Worker)
// ============================================================================

/**
 * Request to generate a Wythoff polytope
 */
export interface GenerateWythoffRequest {
  type: 'generate-wythoff'
  /** Unique request ID for matching responses */
  id: string
  /** Dimension of the polytope (3-11) */
  dimension: number
  /** Wythoff polytope configuration */
  config: Partial<WythoffPolytopeConfig>
}

/**
 * Request to generate a root system polytope
 */
export interface GenerateRootSystemRequest {
  type: 'generate-root-system'
  /** Unique request ID for matching responses */
  id: string
  /** Dimension of the polytope (3-11) */
  dimension: number
  /** Root system configuration */
  config: RootSystemConfig
}

/**
 * Face detection methods supported by the worker
 */
export type WorkerFaceMethod = 'convex-hull' | 'triangles' | 'grid'

/**
 * Request to compute faces from vertices using specified method
 */
export interface ComputeFacesRequest {
  type: 'compute-faces'
  /** Unique request ID for matching responses */
  id: string
  /** Face detection method to use */
  method: WorkerFaceMethod
  /** Flattened vertex data [v0_d0, v0_d1, ..., v1_d0, ...] */
  vertices: Float64Array
  /** Dimensionality of the vertices */
  dimension: number
  /** Object type for face detection method selection */
  objectType: ObjectType
  /** Flattened edge data [e0_v0, e0_v1, e1_v0, e1_v1, ...] (required for 'triangles') */
  edges?: Uint32Array
  /** Grid metadata properties (required for 'grid') */
  gridProps?: GridFaceProps
}

/**
 * Properties needed for grid-based face detection (clifford-torus, nested-torus)
 */
export interface GridFaceProps {
  /** Visualization mode ('flat' | 'nested') */
  visualizationMode?: string
  /** Internal mode ('classic' | 'generalized' | '3d-torus') */
  mode?: string
  /** U resolution for grid */
  resolutionU?: number
  /** V resolution for grid */
  resolutionV?: number
  /** Xi1 resolution for nested tori */
  resolutionXi1?: number
  /** Xi2 resolution for nested tori */
  resolutionXi2?: number
  /** K parameter for generalized mode */
  k?: number
  /** Steps per circle for generalized mode */
  stepsPerCircle?: number
  /** Intrinsic dimension for nested tori */
  intrinsicDimension?: number
  /** Number of tori for nested visualization */
  torusCount?: number
  /** Config store key to determine grid type */
  configKey: 'cliffordTorus' | 'nestedTorus'
}

/**
 * Request to cancel a pending operation
 */
export interface CancelRequest {
  type: 'cancel'
  /** ID of the request to cancel */
  id: string
}

/**
 * Union of all worker request types
 */
export type WorkerRequest =
  | GenerateWythoffRequest
  | GenerateRootSystemRequest
  | ComputeFacesRequest
  | CancelRequest

// ============================================================================
// Response Types (Worker -> Main Thread)
// ============================================================================

/**
 * Generation stage for progress reporting
 */
export type GenerationStage = 'initializing' | 'vertices' | 'edges' | 'faces' | 'complete'

/**
 * Successful result response
 */
export interface ResultResponse {
  type: 'result'
  /** Request ID this response is for */
  id: string
  /** Generated geometry (for Wythoff generation) */
  geometry?: TransferablePolytopeGeometry
  /** Computed faces as flattened triangles [v0, v1, v2, v0, v1, v2, ...] */
  faces?: Uint32Array
  /** Warnings from generation */
  warnings?: string[]
}

/**
 * Progress update response
 */
export interface ProgressResponse {
  type: 'progress'
  /** Request ID this response is for */
  id: string
  /** Progress percentage 0-100 */
  progress: number
  /** Current generation stage */
  stage: GenerationStage
}

/**
 * Error response
 */
export interface ErrorResponse {
  type: 'error'
  /** Request ID this response is for */
  id: string
  /** Error message */
  error: string
}

/**
 * Cancellation confirmation response
 */
export interface CancelledResponse {
  type: 'cancelled'
  /** Request ID that was cancelled */
  id: string
}

/**
 * Worker ready notification (sent after WASM initialization)
 */
export interface ReadyResponse {
  type: 'ready'
}

/**
 * Worker initialization error response
 */
export interface InitErrorResponse {
  type: 'init-error'
  /** Error message from initialization failure */
  error: string
}

/**
 * Union of all worker response types
 */
export type WorkerResponse =
  | ResultResponse
  | ProgressResponse
  | ErrorResponse
  | CancelledResponse
  | ReadyResponse
  | InitErrorResponse

// ============================================================================
// Transfer Data Types
// ============================================================================

/**
 * Face data in transfer-optimized format.
 * Each triangle is 3 consecutive Uint32 indices.
 */
export interface TransferableFaceData {
  /** Flattened face indices [v0, v1, v2, v0, v1, v2, ...] */
  indices: Uint32Array
  /** Number of triangles (indices.length / 3) */
  triangleCount: number
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for GenerateWythoffRequest
 * @param req - The worker request
 * @returns True if it's a GenerateWythoffRequest
 */
export function isGenerateWythoffRequest(req: WorkerRequest): req is GenerateWythoffRequest {
  return req.type === 'generate-wythoff'
}

/**
 * Type guard for GenerateRootSystemRequest
 * @param req - The worker request
 * @returns True if it's a GenerateRootSystemRequest
 */
export function isGenerateRootSystemRequest(req: WorkerRequest): req is GenerateRootSystemRequest {
  return req.type === 'generate-root-system'
}

/**
 * Type guard for ComputeFacesRequest
 * @param req - The worker request
 * @returns True if it's a ComputeFacesRequest
 */
export function isComputeFacesRequest(req: WorkerRequest): req is ComputeFacesRequest {
  return req.type === 'compute-faces'
}

/**
 * Type guard for CancelRequest
 * @param req - The worker request
 * @returns True if it's a CancelRequest
 */
export function isCancelRequest(req: WorkerRequest): req is CancelRequest {
  return req.type === 'cancel'
}

/**
 * Type guard for ResultResponse
 * @param res - The worker response
 * @returns True if it's a ResultResponse
 */
export function isResultResponse(res: WorkerResponse): res is ResultResponse {
  return res.type === 'result'
}

/**
 * Type guard for ProgressResponse
 * @param res - The worker response
 * @returns True if it's a ProgressResponse
 */
export function isProgressResponse(res: WorkerResponse): res is ProgressResponse {
  return res.type === 'progress'
}

/**
 * Type guard for ErrorResponse
 * @param res - The worker response
 * @returns True if it's an ErrorResponse
 */
export function isErrorResponse(res: WorkerResponse): res is ErrorResponse {
  return res.type === 'error'
}

/**
 * Type guard for ReadyResponse
 * @param res - The worker response
 * @returns True if it's a ReadyResponse
 */
export function isReadyResponse(res: WorkerResponse): res is ReadyResponse {
  return res.type === 'ready'
}

/**
 * Type guard for InitErrorResponse
 * @param res - The worker response
 * @returns True if it's an InitErrorResponse
 */
export function isInitErrorResponse(res: WorkerResponse): res is InitErrorResponse {
  return res.type === 'init-error'
}
