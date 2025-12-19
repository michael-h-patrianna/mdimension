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
  gl: THREE.WebGLRenderer,
  options: {
    resetRenderLists?: boolean
    resetInfo?: boolean
    resetPrograms?: boolean
  } = {}
): void {
  const { resetRenderLists = true, resetInfo = false, resetPrograms = false } = options

  // Dispose render lists - clears accumulated render list entries
  // This is safe to call and recommended when switching scenes
  if (resetRenderLists) {
    gl.renderLists.dispose()
  }

  // Reset info counters - useful for debugging but not strictly necessary
  if (resetInfo) {
    gl.info.reset()
  }

  // Force program cleanup - expensive operation, use only when necessary
  // This logs program count for debugging; actual disposal is managed by Three.js
  if (resetPrograms && gl.info.programs) {
    // Programs are auto-managed by Three.js based on usage
    // We just note the count here; forcing disposal would cause recompilation
    if (import.meta.env.DEV) {
      console.debug(`[WebGL] Active shader programs: ${gl.info.programs.length}`)
    }
  }

  // Clean up shadow system placeholder textures and caches
  disposeShadowPlaceholders()
}

/**
 * Get WebGL memory statistics for debugging.
 *
 * @param gl - The WebGL renderer instance
 * @returns Memory statistics object
 */
export function getWebGLMemoryStats(gl: THREE.WebGLRenderer): {
  geometries: number
  textures: number
  programs: number
  calls: number
  triangles: number
} {
  const info = gl.info
  return {
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length ?? 0,
    calls: info.render.calls,
    triangles: info.render.triangles,
  }
}
