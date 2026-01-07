/**
 * WebGL Cleanup Utilities
 *
 * Provides functions to clean up WebGL state to prevent memory accumulation
 * when switching render modes, scenes, or styles.
 */

import type * as THREE from 'three'

import { disposeShadowPlaceholders } from '@/rendering/shadows'

/**
 * Clean up accumulated WebGL state.
 *
 * Call this when switching render modes or loading presets to prevent
 * memory accumulation from orphaned render lists and cached programs.
 *
 * @param gl - The WebGL renderer instance
 * @param options - Cleanup options
 * @param options.resetRenderLists - Reset render lists (recommended on scene switch)
 * @param options.resetInfo - Reset GL info counters (useful for debugging)
 * @param options.resetPrograms - Force program cache cleanup (expensive, use sparingly)
 */
export function cleanupWebGLState(
  gl: THREE.WebGLRenderer | unknown,
  options: {
    resetRenderLists?: boolean
    resetInfo?: boolean
    resetPrograms?: boolean
  } = {}
): void {
  const { resetRenderLists = true, resetInfo = false, resetPrograms = false } = options

  // Guard: Check if renderer exists and has expected properties
  // WebGPU renderer doesn't have renderLists, so skip if not available
  if (!gl || typeof gl !== 'object') {
    return
  }

  const renderer = gl as THREE.WebGLRenderer

  // Dispose render lists - clears accumulated render list entries
  // This is safe to call and recommended when switching scenes
  // Note: WebGPU renderer doesn't have renderLists, so check before calling
  if (resetRenderLists && renderer.renderLists?.dispose) {
    renderer.renderLists.dispose()
  }

  // Reset info counters - useful for debugging but not strictly necessary
  // Note: WebGPU renderer may have different info structure
  if (resetInfo && renderer.info?.reset) {
    renderer.info.reset()
  }

  // Force program cleanup - expensive operation, use only when necessary
  // This logs program count for debugging; actual disposal is managed by Three.js
  // Note: WebGPU renderer may not have programs property
  if (resetPrograms && renderer.info?.programs) {
    // Programs are auto-managed by Three.js based on usage
    // We just note the count here; forcing disposal would cause recompilation
    if (import.meta.env.DEV) {
      console.debug(`[WebGL] Active shader programs: ${renderer.info.programs.length}`)
    }
  }

  // Clean up shadow system placeholder textures and caches
  disposeShadowPlaceholders()
}

/**
 * Get WebGL/WebGPU memory statistics for debugging.
 *
 * @param gl - The renderer instance (WebGL or WebGPU)
 * @returns Memory statistics object
 */
export function getWebGLMemoryStats(gl: THREE.WebGLRenderer | unknown): {
  geometries: number
  textures: number
  programs: number
  calls: number
  triangles: number
} {
  // Guard: Handle null/undefined renderer or WebGPU renderer without info
  if (!gl || typeof gl !== 'object') {
    return { geometries: 0, textures: 0, programs: 0, calls: 0, triangles: 0 }
  }

  const renderer = gl as THREE.WebGLRenderer
  const info = renderer.info

  // WebGPU renderer may have different info structure
  if (!info) {
    return { geometries: 0, textures: 0, programs: 0, calls: 0, triangles: 0 }
  }

  return {
    geometries: info.memory?.geometries ?? 0,
    textures: info.memory?.textures ?? 0,
    programs: info.programs?.length ?? 0,
    calls: info.render?.calls ?? 0,
    triangles: info.render?.triangles ?? 0,
  }
}
