/**
 * MRT Helper for Mesh Objects
 *
 * Provides MRT configuration for standard mesh objects that use
 * TSL built-in nodes (normalView, positionWorld) rather than
 * raymarched custom calculations.
 *
 * @module rendering/tsl/mrt/mesh
 */

import { mrt, output, vec4, float, normalView, positionWorld } from 'three/tsl'

/**
 * Create MRT node configuration for mesh materials.
 *
 * Uses TSL built-in nodes for normal and position data:
 * - `normalView`: View-space normal from vertex shader
 * - `positionWorld`: World-space position from vertex shader
 *
 * Mesh objects always have valid surface data, so hit flag is always 1.
 *
 * @returns mrt() node for material.mrtNode
 *
 * @example
 * ```typescript
 * const material = new MeshBasicNodeMaterial()
 * material.colorNode = myColorNode
 * material.mrtNode = createMeshMRTNode()
 * ```
 */
export function createMeshMRTNode() {
  return mrt({
    // 'output' uses the built-in output node which references colorNode
    output: output,
    // View-space normal encoded from [-1,1] to [0,1]
    // Alpha = 1.0 (mesh always has valid surface)
    normal: vec4(normalView.mul(0.5).add(0.5), float(1.0)),
    // World position for temporal reprojection
    // Alpha = 1.0 (mesh always has valid surface)
    position: vec4(positionWorld, float(1.0)),
  })
}
