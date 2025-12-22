/**
 * Clifford Torus Generator
 *
 * Generates flat Clifford tori with grid-like, independent circles.
 * For nested/Hopf tori with coupled angles, use the 'nested-torus' object type.
 *
 * @see docs/research/clifford-tori-guide.md
 */

import type { NdGeometry } from '../../types'
import type { CliffordTorusConfig } from '../types'
import { generateClassicCliffordTorus } from './classic'
import { generateGeneralizedCliffordTorus } from './generalized'
import { generateTorus3D } from './torus3d'

// Re-export specific generators and helpers - Flat mode (classic)
export {
  buildCliffordTorusGridEdges,
  buildCliffordTorusGridFaces,
  generateClassicCliffordTorus,
  generateCliffordTorusPoints,
} from './classic'

// Re-export - Flat mode (generalized)
export {
  buildGeneralizedCliffordTorusEdges,
  buildGeneralizedCliffordTorusFaces,
  generateGeneralizedCliffordTorus,
  generateGeneralizedCliffordTorusPoints,
} from './generalized'

// Re-export - 3D torus surface
export {
  buildTorus3DGridEdges,
  buildTorus3DGridFaces,
  generateTorus3D,
  generateTorus3DPoints,
} from './torus3d'

// Re-export - Nested mode (4D-11D)
export {
  buildHopfTorus4DEdges,
  buildHopfTorus4DFaces,
  buildHopfTorus8DEdges,
  buildHopfTorus8DFaces,
  buildTorus10DEdges,
  buildTorus10DFaces,
  buildTorus11DEdges,
  buildTorus11DFaces,
  buildTorus5DEdges,
  buildTorus5DFaces,
  buildTorus6DEdges,
  buildTorus6DFaces,
  buildTorus7DEdges,
  buildTorus7DFaces,
  buildTorus9DEdges,
  buildTorus9DFaces,
  generateHopfTorus4DPoints,
  generateHopfTorus8DPoints,
  // 4D Hopf
  generateNestedHopfTorus4D,
  // 8D Hopf
  generateNestedHopfTorus8D,
  // 10D 5-torus
  generateNestedTorus10D,
  // 11D twisted 5-torus
  generateNestedTorus11D,
  // 5D twisted 2-torus
  generateNestedTorus5D,
  // 6D 3-torus
  generateNestedTorus6D,
  // 7D twisted 3-torus
  generateNestedTorus7D,
  // 9D twisted 4-torus
  generateNestedTorus9D,
  generateTorus10DPoints,
  generateTorus11DPoints,
  generateTorus5DPoints,
  generateTorus6DPoints,
  generateTorus7DPoints,
  generateTorus9DPoints,
} from './nested'

// Re-export - Verification utilities
export {
  verifyCliffordTorusOnSphere,
  verifyGeneralizedCliffordTorusCircleRadii,
  verifyGeneralizedCliffordTorusOnSphere,
} from './verification'

// Re-export - General utilities
export { getGeneralizedCliffordTorusPointCount, getMaxTorusDimension } from './utils'

/**
 * Generates a Clifford torus geometry (flat mode only)
 *
 * Dispatches to the appropriate generator based on dimension:
 * - 2D: Simple circle (minimal support)
 * - 3D: Standard torus surface
 * - 4D: Classic Clifford torus (T² ⊂ S³)
 * - 5D+: Generalized k-torus (Tᵏ ⊂ S^(2k-1))
 *
 * For nested/Hopf tori with coupled angles, use the 'nested-torus' object type.
 *
 * @param dimension - Dimensionality of the ambient space (2-11)
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the torus
 * @throws {Error} If dimension < 2
 *
 * @example
 * ```typescript
 * // Classic 4D Clifford torus
 * const flatTorus = generateCliffordTorus(4, {
 *   mode: 'classic',
 *   radius: 3.0,
 *   resolutionU: 32,
 *   resolutionV: 32,
 *   edgeMode: 'grid',
 *   ...DEFAULT_CLIFFORD_TORUS_CONFIG,
 * });
 * ```
 */
export function generateCliffordTorus(dimension: number, config: CliffordTorusConfig): NdGeometry {
  if (dimension < 2) {
    throw new Error('Clifford torus requires dimension >= 2')
  }

  // 2D: Just a circle (special case, minimal support)
  if (dimension === 2) {
    // Generate a simple circle
    return generateGeneralizedCliffordTorus(dimension, { ...config, k: 1 })
  }

  // 3D: Standard torus surface
  if (dimension === 3) {
    return generateTorus3D(config)
  }

  // 4D+: Dispatch based on internal mode
  if (config.mode === 'generalized') {
    return generateGeneralizedCliffordTorus(dimension, config)
  }

  // Classic mode for 4D+
  return generateClassicCliffordTorus(dimension, config)
}
