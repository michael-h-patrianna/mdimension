/**
 * Hook for Wythoff Polytope Web Worker
 *
 * Provides a React-friendly interface to the Wythoff polytope generation worker.
 * Handles worker lifecycle, message passing, and state management.
 *
 * Usage:
 * ```tsx
 * const { generate, geometry, warnings, isGenerating, progress, error } = useWythoffWorker()
 *
 * useEffect(() => {
 *   generate(4, { symmetryGroup: 'B', preset: 'truncated' })
 * }, [generate])
 * ```
 */

import { inflateGeometry } from '@/lib/geometry/transfer'
import type { PolytopeGeometry } from '@/lib/geometry/types'
import type { WythoffPolytopeConfig } from '@/lib/geometry/wythoff'
import type { WorkerRequest, WorkerResponse } from '@/workers/wythoff.worker'
import { useCallback, useEffect, useRef, useState } from 'react'

// Import worker using Vite's worker import syntax
// The ?worker query tells Vite to create a worker module
import WythoffWorkerModule from '@/workers/wythoff.worker?worker'

/**
 * Generate unique request ID
 * @returns Unique request ID string
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Hook return type
 */
export interface UseWythoffWorkerResult {
  /**
   * Generate a Wythoff polytope with the given parameters.
   * This is memoized and safe to include in dependency arrays.
   */
  generate: (dimension: number, config?: Partial<WythoffPolytopeConfig>) => void

  /**
   * The most recently generated geometry, or null if none
   */
  geometry: PolytopeGeometry | null

  /**
   * Warnings from the most recent generation
   */
  warnings: string[]

  /**
   * Whether generation is currently in progress
   */
  isGenerating: boolean

  /**
   * Progress percentage (0-100) during generation
   */
  progress: number

  /**
   * Error message from the most recent generation attempt, or null
   */
  error: string | null
}

/**
 * React hook for using the Wythoff polytope Web Worker
 * @returns The worker result object with generate function and state
 */
export function useWythoffWorker(): UseWythoffWorkerResult {
  const workerRef = useRef<Worker | null>(null)
  const currentRequestId = useRef<string | null>(null)

  // State
  const [geometry, setGeometry] = useState<PolytopeGeometry | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Initialize worker on mount
  useEffect(() => {
    // Create worker instance
    workerRef.current = new WythoffWorkerModule()

    // Set up message handler
    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data

      // Ignore responses for stale requests
      if (response.id !== currentRequestId.current) {
        return
      }

      switch (response.type) {
        case 'progress':
          setProgress(response.progress ?? 0)
          break

        case 'result':
          if (response.transferableGeometry) {
            // High-performance path: inflate transferable geometry
            setGeometry(inflateGeometry(response.transferableGeometry))
          } else {
            // Legacy path: use structured clone geometry
            setGeometry(response.geometry ?? null)
          }
          setWarnings(response.warnings ?? [])
          setIsGenerating(false)
          setProgress(100)
          setError(null)
          currentRequestId.current = null
          break

        case 'error':
          setError(response.error ?? 'Unknown error')
          setIsGenerating(false)
          setProgress(0)
          currentRequestId.current = null
          break
      }
    }

    // Set up error handler
    workerRef.current.onerror = (event) => {
      console.error('[useWythoffWorker] Worker error:', event)
      setError(`Worker error: ${event.message}`)
      setIsGenerating(false)
      setProgress(0)
      currentRequestId.current = null
    }

    // Cleanup on unmount
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // Generate function - memoized for stable reference
  const generate = useCallback((dimension: number, config: Partial<WythoffPolytopeConfig> = {}) => {
    if (!workerRef.current) {
      setError('Worker not initialized')
      return
    }

    // Generate new request ID
    const requestId = generateRequestId()
    currentRequestId.current = requestId

    // Reset state
    setIsGenerating(true)
    setProgress(0)
    setError(null)

    // Send request to worker
    const request: WorkerRequest = {
      type: 'generate',
      id: requestId,
      dimension,
      config,
    }

    workerRef.current.postMessage(request)
  }, [])

  return {
    generate,
    geometry,
    warnings,
    isGenerating,
    progress,
    error,
  }
}
