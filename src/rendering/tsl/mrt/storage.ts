/**
 * MRT Storage Node Factory
 *
 * Creates storage nodes that must be declared OUTSIDE Fn() per MKB-001
 * to avoid WebGPU pipeline errors.
 *
 * @module rendering/tsl/mrt/storage
 */

import { vec3, float, mrt, vec4, output } from 'three/tsl'
import type { MRTStorageNodes, VarNodeType } from './types'

/**
 * Create MRT storage nodes.
 *
 * CRITICAL: Must be called OUTSIDE Fn() per MKB-001 constraint.
 * These nodes store raymarching results for MRT output.
 *
 * @returns Storage nodes with default values (far plane, no hit)
 *
 * @example
 * ```typescript
 * // In compose function, BEFORE any Fn() calls:
 * const mrtStorage = createMRTStorage()
 * ```
 */
export function createMRTStorage(): MRTStorageNodes {
  return {
    mrtNormalView: vec3(0, 0, 1).toVar('mrtNormalView') as VarNodeType,
    mrtHasHit: float(0).toVar('mrtHasHit') as VarNodeType,
    mrtClipDepth: float(1).toVar('mrtClipDepth') as VarNodeType, // Far plane default
    mrtWorldPos: vec3(0).toVar('mrtWorldPos') as VarNodeType,
  }
}

/**
 * Create the mrt() node configuration for a material.
 *
 * Uses standard attachment names that match render target configuration:
 * - 'output': Color output (uses built-in output node from colorNode)
 * - 'normal': View-space normal encoded to [0,1], hit flag in alpha
 * - 'position': World position, hit flag in alpha
 *
 * @param storage - Storage nodes created by createMRTStorage()
 * @returns mrt() node for material.mrtNode
 */
export function createMRTNode(storage: MRTStorageNodes) {
  return mrt({
    // 'output' uses the built-in output node which references colorNode
    output: output,
    // 'normal': View-space normal encoded from [-1,1] to [0,1]
    // Alpha channel stores hit flag (1 = valid normal, 0 = background)
    normal: vec4(
      storage.mrtNormalView.mul(0.5).add(0.5),
      storage.mrtHasHit
    ),
    // 'position': World position for temporal reprojection
    // Alpha channel stores hit flag for consistency
    position: vec4(storage.mrtWorldPos, storage.mrtHasHit),
  })
}
