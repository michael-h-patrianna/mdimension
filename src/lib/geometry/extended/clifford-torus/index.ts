/**
 * Clifford Torus Generator
 *
 * Exports logic for generating classic and generalized Clifford tori.
 */

import type { NdGeometry } from '../../types';
import type { CliffordTorusConfig } from '../types';
import { generateClassicCliffordTorus } from './classic';
import { generateGeneralizedCliffordTorus } from './generalized';

// Re-export specific generators and helpers
export {
  generateClassicCliffordTorus,
  generateCliffordTorusPoints,
  buildCliffordTorusGridEdges,
} from './classic';

export {
  generateGeneralizedCliffordTorus,
  generateGeneralizedCliffordTorusPoints,
  buildGeneralizedCliffordTorusEdges,
} from './generalized';

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
 * Generates a Clifford torus geometry (dispatcher for both classic and generalized modes)
 *
 * @param dimension - Dimensionality of the ambient space
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the Clifford torus
 * @throws {Error} If dimension constraints are violated for the selected mode
 *
 * @example
 * ```typescript
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
  // Dispatch based on mode
  if (config.mode === 'generalized') {
    return generateGeneralizedCliffordTorus(dimension, config);
  }

  // Classic mode (default)
  return generateClassicCliffordTorus(dimension, config);
}
