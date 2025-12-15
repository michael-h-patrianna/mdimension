/**
 * Nested Torus Generator
 *
 * Generates nested (Hopf-like) tori for dimensions 4-11.
 * These tori have coupled angle structures that create flowing, interlinked patterns.
 *
 * Supported dimensions:
 * - 4D: Hopf fibration (S³ → S²)
 * - 5D: Twisted 2-torus (T² + helix)
 * - 6D: 3-torus (T³) with coupled angles
 * - 7D: Twisted 3-torus (T³ + helix)
 * - 8D: Quaternionic Hopf (S⁷ → S⁴)
 * - 9D: Twisted 4-torus (T⁴ + helix)
 * - 10D: 5-torus (T⁵) with coupled angles
 * - 11D: Twisted 5-torus (T⁵ + helix)
 *
 * @see docs/research/clifford-tori-guide.md
 */

import type { NdGeometry } from '../../types'
import type { NestedTorusConfig } from '../types'

// Import the existing nested torus generators from clifford-torus module
import {
  generateNestedHopfTorus4D,
  generateNestedHopfTorus8D,
  generateNestedTorus10D,
  generateNestedTorus11D,
  generateNestedTorus5D,
  generateNestedTorus6D,
  generateNestedTorus7D,
  generateNestedTorus9D,
} from '../clifford-torus/nested'

// Re-export helpers for use elsewhere
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
  // 4D Hopf
  generateHopfTorus4DPoints,
  // 8D Hopf
  generateHopfTorus8DPoints,
  // 10D 5-torus
  generateTorus10DPoints,
  // 11D twisted 5-torus
  generateTorus11DPoints,
  // 5D twisted 2-torus
  generateTorus5DPoints,
  // 6D 3-torus
  generateTorus6DPoints,
  // 7D twisted 3-torus
  generateTorus7DPoints,
  // 9D twisted 4-torus
  generateTorus9DPoints,
} from '../clifford-torus/nested'

/**
 * Generates a Nested Torus geometry
 *
 * Dispatches to the appropriate generator based on dimension:
 * - 4D: Hopf fibration (S³ → S²)
 * - 5D: Twisted 2-torus (T² + helix)
 * - 6D: 3-torus (T³) with coupled angles
 * - 7D: Twisted 3-torus (T³ + helix)
 * - 8D: Quaternionic Hopf (S⁷ → S⁴)
 * - 9D: Twisted 4-torus (T⁴ + helix)
 * - 10D: 5-torus (T⁵) with coupled angles
 * - 11D: Twisted 5-torus (T⁵ + helix)
 *
 * @param dimension - Dimensionality of the ambient space (4-11)
 * @param config - Nested torus configuration
 * @returns NdGeometry representing the nested torus
 * @throws {Error} If dimension is not in range 4-11
 *
 * @example
 * ```typescript
 * // Generate a 4D Hopf fibration torus
 * const hopfTorus = generateNestedTorus(4, {
 *   radius: 3.0,
 *   eta: Math.PI / 4,
 *   resolutionXi1: 48,
 *   resolutionXi2: 48,
 *   ...DEFAULT_NESTED_TORUS_CONFIG,
 * });
 * ```
 */
export function generateNestedTorus(dimension: number, config: NestedTorusConfig): NdGeometry {
  if (dimension < 4 || dimension > 11) {
    throw new Error(`Nested torus requires dimension 4-11, got ${dimension}.`)
  }

  // Generate the geometry
  let geometry: NdGeometry

  switch (dimension) {
    case 4:
      geometry = generateNestedHopfTorus4D(config)
      break
    case 5:
      geometry = generateNestedTorus5D(config)
      break
    case 6:
      geometry = generateNestedTorus6D(config)
      break
    case 7:
      geometry = generateNestedTorus7D(config)
      break
    case 8:
      geometry = generateNestedHopfTorus8D(config)
      break
    case 9:
      geometry = generateNestedTorus9D(config)
      break
    case 10:
      geometry = generateNestedTorus10D(config)
      break
    case 11:
      geometry = generateNestedTorus11D(config)
      break
    default:
      throw new Error(`Nested torus requires dimension 4-11, got ${dimension}.`)
  }

  // Update the type to 'nested-torus'
  return {
    ...geometry,
    type: 'nested-torus',
  }
}
