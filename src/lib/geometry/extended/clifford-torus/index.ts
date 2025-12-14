/**
 * Clifford Torus Generator
 *
 * Exports logic for generating Clifford tori with two visualization modes:
 * - Flat (2D-11D): Grid-like, independent circles (classic/generalized)
 * - Nested (4D-11D): Coupled tori with Hopf-like structure
 *
 * @see docs/prd/clifford-torus-modes.md
 */

import type { NdGeometry } from '../../types';
import type { CliffordTorusConfig } from '../types';
import { generateClassicCliffordTorus } from './classic';
import { generateGeneralizedCliffordTorus } from './generalized';
import {
  generateNestedHopfTorus4D,
  generateNestedTorus5D,
  generateNestedTorus6D,
  generateNestedTorus7D,
  generateNestedHopfTorus8D,
  generateNestedTorus9D,
  generateNestedTorus10D,
  generateNestedTorus11D,
} from './nested';
import { generateTorus3D } from './torus3d';

// Re-export specific generators and helpers - Flat mode (classic)
export {
  generateClassicCliffordTorus,
  generateCliffordTorusPoints,
  buildCliffordTorusGridEdges,
  buildCliffordTorusGridFaces,
} from './classic';

// Re-export - Flat mode (generalized)
export {
  generateGeneralizedCliffordTorus,
  generateGeneralizedCliffordTorusPoints,
  buildGeneralizedCliffordTorusEdges,
  buildGeneralizedCliffordTorusFaces,
} from './generalized';

// Re-export - 3D torus surface
export {
  generateTorus3D,
  generateTorus3DPoints,
  buildTorus3DGridEdges,
  buildTorus3DGridFaces,
} from './torus3d';

// Re-export - Nested mode (4D-11D)
export {
  // 4D Hopf
  generateNestedHopfTorus4D,
  generateHopfTorus4DPoints,
  buildHopfTorus4DEdges,
  buildHopfTorus4DFaces,
  // 5D twisted 2-torus
  generateNestedTorus5D,
  generateTorus5DPoints,
  buildTorus5DEdges,
  buildTorus5DFaces,
  // 6D 3-torus
  generateNestedTorus6D,
  generateTorus6DPoints,
  buildTorus6DEdges,
  buildTorus6DFaces,
  // 7D twisted 3-torus
  generateNestedTorus7D,
  generateTorus7DPoints,
  buildTorus7DEdges,
  buildTorus7DFaces,
  // 8D Hopf
  generateNestedHopfTorus8D,
  generateHopfTorus8DPoints,
  buildHopfTorus8DEdges,
  buildHopfTorus8DFaces,
  // 9D twisted 4-torus
  generateNestedTorus9D,
  generateTorus9DPoints,
  buildTorus9DEdges,
  buildTorus9DFaces,
  // 10D 5-torus
  generateNestedTorus10D,
  generateTorus10DPoints,
  buildTorus10DEdges,
  buildTorus10DFaces,
  // 11D twisted 5-torus
  generateNestedTorus11D,
  generateTorus11DPoints,
  buildTorus11DEdges,
  buildTorus11DFaces,
} from './nested';

// Re-export - Verification utilities
export {
  verifyCliffordTorusOnSphere,
  verifyGeneralizedCliffordTorusOnSphere,
  verifyGeneralizedCliffordTorusCircleRadii,
} from './verification';

// Re-export - General utilities
export {
  getMaxTorusDimension,
  getGeneralizedCliffordTorusPointCount,
} from './utils';

/**
 * Generates a Clifford torus geometry (dispatcher for all visualization modes)
 *
 * Dispatches to the appropriate generator based on visualization mode and dimension:
 *
 * - **Flat mode** (default, 2D-11D):
 *   - 3D: Standard torus surface
 *   - 4D: Classic Clifford torus (T² ⊂ S³)
 *   - 5D+: Generalized k-torus (Tᵏ ⊂ S^(2k-1))
 *
 * - **Nested mode** (4D-11D):
 *   - 4D: Hopf fibration torus (S³ → S²)
 *   - 5D: Twisted 2-torus (T² + helix)
 *   - 6D: 3-torus (T³) with coupled angles
 *   - 7D: Twisted 3-torus (T³ + helix)
 *   - 8D: Quaternionic Hopf torus (S⁷ → S⁴)
 *   - 9D: Twisted 4-torus (T⁴ + helix)
 *   - 10D: 5-torus (T⁵) with coupled angles
 *   - 11D: Twisted 5-torus (T⁵ + helix)
 *
 * @param dimension - Dimensionality of the ambient space (2-11)
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the torus variant
 * @throws {Error} If dimension < 2 or mode unavailable for dimension
 *
 * @example
 * ```typescript
 * // Flat mode: Classic 4D Clifford torus
 * const flatTorus = generateCliffordTorus(4, {
 *   visualizationMode: 'flat',
 *   mode: 'classic',
 *   radius: 3.0,
 *   resolutionU: 32,
 *   resolutionV: 32,
 *   edgeMode: 'grid',
 *   ...DEFAULT_CLIFFORD_TORUS_CONFIG,
 * });
 *
 * // Nested mode: 4D Hopf fibration torus
 * const hopfTorus = generateCliffordTorus(4, {
 *   visualizationMode: 'nested',
 *   eta: Math.PI / 4,
 *   resolutionXi1: 48,
 *   resolutionXi2: 48,
 *   ...DEFAULT_CLIFFORD_TORUS_CONFIG,
 * });
 * ```
 */
export function generateCliffordTorus(
  dimension: number,
  config: CliffordTorusConfig
): NdGeometry {
  if (dimension < 2) {
    throw new Error('Clifford torus requires dimension >= 2');
  }

  // Dispatch based on visualization mode
  switch (config.visualizationMode) {
    case 'nested':
      return generateNestedTorus(dimension, config);

    case 'flat':
    default:
      return generateFlatTorus(dimension, config);
  }
}

/**
 * Generates a Flat mode torus (classic/generalized Clifford torus)
 *
 * @param dimension - Ambient dimension
 * @param config - Configuration
 * @returns NdGeometry
 */
function generateFlatTorus(
  dimension: number,
  config: CliffordTorusConfig
): NdGeometry {
  // 2D: Just a circle (special case, minimal support)
  if (dimension === 2) {
    // Generate a simple circle
    return generateGeneralizedCliffordTorus(dimension, { ...config, k: 1 });
  }

  // 3D: Standard torus surface
  if (dimension === 3) {
    return generateTorus3D(config);
  }

  // 4D+: Dispatch based on internal mode
  if (config.mode === 'generalized') {
    return generateGeneralizedCliffordTorus(dimension, config);
  }

  // Classic mode for 4D+
  return generateClassicCliffordTorus(dimension, config);
}

/**
 * Generates a Nested mode torus
 *
 * Valid for all dimensions 4-11:
 * - 4D: Hopf fibration (S³ → S²)
 * - 5D: Twisted 2-torus (T² + helix)
 * - 6D: 3-torus (T³) with coupled angles
 * - 7D: Twisted 3-torus (T³ + helix)
 * - 8D: Quaternionic Hopf (S⁷ → S⁴)
 * - 9D: Twisted 4-torus (T⁴ + helix)
 * - 10D: 5-torus (T⁵) with coupled angles
 * - 11D: Twisted 5-torus (T⁵ + helix)
 *
 * @param dimension - Ambient dimension (must be 4-11)
 * @param config - Configuration
 * @returns NdGeometry
 * @throws {Error} If dimension is not 4-11
 */
function generateNestedTorus(
  dimension: number,
  config: CliffordTorusConfig
): NdGeometry {
  switch (dimension) {
    case 4:
      return generateNestedHopfTorus4D(config);
    case 5:
      return generateNestedTorus5D(config);
    case 6:
      return generateNestedTorus6D(config);
    case 7:
      return generateNestedTorus7D(config);
    case 8:
      return generateNestedHopfTorus8D(config);
    case 9:
      return generateNestedTorus9D(config);
    case 10:
      return generateNestedTorus10D(config);
    case 11:
      return generateNestedTorus11D(config);
    default:
      throw new Error(
        `Nested mode requires dimension 4-11, got ${dimension}.`
      );
  }
}

/**
 * Checks if a visualization mode is available for a given dimension
 *
 * @param mode - Visualization mode to check
 * @param dimension - Ambient dimension
 * @returns True if the mode is available
 */
export function isVisualizationModeAvailable(
  mode: 'flat' | 'nested',
  dimension: number
): boolean {
  switch (mode) {
    case 'flat':
      return dimension >= 2 && dimension <= 11;

    case 'nested':
      // All dimensions 4-11 supported
      return dimension >= 4 && dimension <= 11;

    default:
      return false;
  }
}

/**
 * Returns the reason a visualization mode is unavailable for a dimension
 *
 * @param mode - Visualization mode
 * @param dimension - Ambient dimension
 * @returns Explanation string, or null if mode is available
 */
export function getVisualizationModeUnavailableReason(
  mode: 'flat' | 'nested',
  dimension: number
): string | null {
  if (isVisualizationModeAvailable(mode, dimension)) {
    return null;
  }

  switch (mode) {
    case 'flat':
      return 'Flat mode requires dimension 2-11';

    case 'nested':
      return 'Nested mode requires dimension 4-11';

    default:
      return 'Unknown mode';
  }
}
