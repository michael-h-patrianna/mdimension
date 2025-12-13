/**
 * Clifford Torus Generator
 *
 * Exports logic for generating classic and generalized Clifford tori:
 * - 3D: Standard torus surface
 * - 4D+: Classic or generalized Clifford torus
 */

import type { NdGeometry } from '../../types';
import type { CliffordTorusConfig } from '../types';
import { generateClassicCliffordTorus } from './classic';
import { generateGeneralizedCliffordTorus } from './generalized';
import { generateTorus3D } from './torus3d';

// Re-export specific generators and helpers
export {
  generateClassicCliffordTorus,
  generateCliffordTorusPoints,
  buildCliffordTorusGridEdges,
  buildCliffordTorusGridFaces,
} from './classic';

export {
  generateGeneralizedCliffordTorus,
  generateGeneralizedCliffordTorusPoints,
  buildGeneralizedCliffordTorusEdges,
  buildGeneralizedCliffordTorusFaces,
} from './generalized';

export {
  generateTorus3D,
  generateTorus3DPoints,
  buildTorus3DGridEdges,
  buildTorus3DGridFaces,
} from './torus3d';

export {
  verifyCliffordTorusOnSphere,
  verifyGeneralizedCliffordTorusOnSphere,
  verifyGeneralizedCliffordTorusCircleRadii,
} from './verification';

export {
  getMaxTorusDimension,
  getGeneralizedCliffordTorusPointCount,
} from './utils';

/**
 * Generates a Clifford torus geometry (dispatcher for all dimensions)
 *
 * Dispatches to the appropriate generator based on dimension:
 * - 3D: Standard torus surface
 * - 4D+: Classic or generalized Clifford torus
 *
 * @param dimension - Dimensionality of the ambient space (3-11)
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the torus variant
 * @throws {Error} If dimension < 3
 *
 * @example
 * ```typescript
 * // 3D torus surface
 * const torus3d = generateCliffordTorus(3, {
 *   mode: 'classic',
 *   radius: 1.0,
 *   resolutionU: 32,
 *   resolutionV: 32,
 *   edgeMode: 'grid',
 *   k: 2,
 *   stepsPerCircle: 16,
 * });
 *
 * // Classic 4D Clifford torus
 * const classicTorus = generateCliffordTorus(4, {
 *   mode: 'classic',
 *   radius: 1.0,
 *   resolutionU: 32,
 *   resolutionV: 32,
 *   edgeMode: 'grid',
 *   k: 2,
 *   stepsPerCircle: 16,
 * });
 *
 * // Generalized 3-torus in 6D
 * const generalizedTorus = generateCliffordTorus(6, {
 *   mode: 'generalized',
 *   radius: 1.0,
 *   resolutionU: 32,
 *   resolutionV: 32,
 *   edgeMode: 'none',
 *   k: 3,
 *   stepsPerCircle: 12,
 * });
 * ```
 */
export function generateCliffordTorus(
  dimension: number,
  config: CliffordTorusConfig
): NdGeometry {
  if (dimension < 3) {
    throw new Error('Clifford torus requires dimension >= 3');
  }

  // 3D: Generate standard torus surface
  if (dimension === 3) {
    return generateTorus3D(config);
  }

  // 4D+: Dispatch based on mode
  if (config.mode === 'generalized') {
    return generateGeneralizedCliffordTorus(dimension, config);
  }

  // Classic mode (default) for 4D+
  return generateClassicCliffordTorus(dimension, config);
}
