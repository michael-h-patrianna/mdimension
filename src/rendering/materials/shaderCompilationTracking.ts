/**
 * Shared shader compilation tracking utilities
 *
 * Provides core logic for tracking shader compilation state and
 * managing the deferred rendering pattern that shows overlay before GPU blocks.
 *
 * This module is the single source of truth for shader compilation tracking,
 * used by both:
 * - TrackedShaderMaterial (declarative JSX pattern)
 * - useTrackedShaderMaterial (imperative hook pattern)
 *
 * @module rendering/materials/shaderCompilationTracking
 */

import { usePerformanceStore } from '@/stores/performanceStore'

/**
 * Mark a shader as compiling and return cleanup function.
 *
 * @param shaderName - Display name for the shader (shown in overlay)
 * @returns Cleanup function to mark shader as no longer compiling
 */
export function trackShaderCompilation(shaderName: string): () => void {
  usePerformanceStore.getState().setShaderCompiling(shaderName, true)

  return () => {
    usePerformanceStore.getState().setShaderCompiling(shaderName, false)
  }
}

/**
 * Execute callback after overlay has painted (double RAF deferred execution).
 *
 * Uses double requestAnimationFrame to ensure the compilation overlay is
 * actually visible before the callback runs. Single RAF fires before paint,
 * so shader compilation would block before the overlay appears.
 *
 * Timeline:
 * 1. First RAF: overlay render is queued for browser paint
 * 2. Second RAF: browser has painted, safe to run blocking work
 *
 * @param callback - Function to execute after overlay has painted
 * @returns Cleanup function to cancel scheduled execution
 */
export function deferredExecute(callback: () => void): () => void {
  let cancelled = false
  const frameId = requestAnimationFrame(() => {
    if (cancelled) return
    requestAnimationFrame(() => {
      if (cancelled) return
      callback()
    })
  })
  return () => {
    cancelled = true
    cancelAnimationFrame(frameId)
  }
}

/**
 * Execute callback after GPU shader compilation completes.
 * Uses double RAF to ensure we're past the blocking GPU work.
 *
 * The first RAF waits for the current frame to finish (which includes GPU work).
 * The second RAF ensures we're fully past the GPU compilation before hiding overlay.
 *
 * @param callback - Function to execute after GPU compile
 * @returns Cleanup function to cancel scheduled execution
 */
export function waitForGPUCompile(callback: () => void): () => void {
  let cancelled = false

  requestAnimationFrame(() => {
    if (cancelled) return
    requestAnimationFrame(() => {
      if (cancelled) return

      callback()
    })
  })

  return () => {
    cancelled = true
  }
}
