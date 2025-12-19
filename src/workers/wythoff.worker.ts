/**
 * Web Worker for Wythoff Polytope Generation
 *
 * Offloads expensive polytope computation to a background thread,
 * keeping the main thread responsive during generation.
 *
 * Features:
 * - Non-blocking generation for complex polytopes
 * - Progress reporting for long operations
 * - Error handling with descriptive messages
 *
 * @see https://vitejs.dev/guide/features.html#web-workers
 */

import { flattenGeometry, type TransferablePolytopeGeometry } from '@/lib/geometry/transfer'
import type { PolytopeGeometry } from '@/lib/geometry/types'
import {
  generateWythoffPolytopeWithWarnings,
  type WythoffPolytopeConfig,
} from '@/lib/geometry/wythoff'

/**
 * Request message from main thread to worker
 */
export interface WorkerRequest {
  type: 'generate'
  /** Unique request ID for matching responses */
  id: string
  /** Dimension of the polytope (3-11) */
  dimension: number
  /** Wythoff polytope configuration */
  config: Partial<WythoffPolytopeConfig>
}

/**
 * Response message from worker to main thread
 */
export interface WorkerResponse {
  type: 'result' | 'progress' | 'error'
  /** Request ID this response is for */
  id: string
  /** Generated geometry (legacy, used if transfer not supported) */
  geometry?: PolytopeGeometry
  /** Transferable geometry (preferred) */
  transferableGeometry?: TransferablePolytopeGeometry
  /** Warnings from generation (for 'result' type) */
  warnings?: string[]
  /** Progress percentage 0-100 (for 'progress' type) */
  progress?: number
  /** Error message (for 'error' type) */
  error?: string
}

/**
 * Handle incoming messages from main thread
 * @param event
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, id, dimension, config } = event.data

  if (type !== 'generate') {
    sendError(id, `Unknown message type: ${type}`)
    return
  }

  try {
    // Send initial progress
    sendProgress(id, 0)

    // Generate the polytope
    const result = generateWythoffPolytopeWithWarnings(dimension, config)

    // Send progress update for completion
    sendProgress(id, 100)

    // Flatten for efficient transfer
    const { transferable, buffers } = flattenGeometry(result.geometry)

    // Send the result with zero-copy transfer
    const response: WorkerResponse = {
      type: 'result',
      id,
      transferableGeometry: transferable,
      warnings: result.warnings,
    }

    self.postMessage(response, { transfer: buffers })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendError(id, message)
  }
}

/**
 * Send progress update to main thread
 * @param id
 * @param progress
 */
function sendProgress(id: string, progress: number): void {
  const response: WorkerResponse = {
    type: 'progress',
    id,
    progress,
  }
  self.postMessage(response)
}

/**
 * Send error message to main thread
 * @param id
 * @param error
 */
function sendError(id: string, error: string): void {
  const response: WorkerResponse = {
    type: 'error',
    id,
    error,
  }
  self.postMessage(response)
}

// Signal that the worker is ready
if (import.meta.env.DEV) {
  console.log('[WythoffWorker] Worker initialized')
}
