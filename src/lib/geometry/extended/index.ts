/**
 * Extended N-Dimensional Objects Library
 *
 * Provides generators for extended n-dimensional geometric objects:
 * - Root Systems: A, D, and E8 root polytopes
 * - Clifford Torus: Flat torus on S³
 * - Mandelbrot: N-dimensional fractal (Mandelbulb/Hyperbulb)
 * - Mandelbox: Box-like fractal with sphere/box folding
 *
 * @see docs/prd/extended-objects.md
 * @see docs/research/nd-extended-objects-guide.md
 */

// Type exports
export type {
  PolytopeConfig,
  RootSystemType,
  RootSystemConfig,
  CliffordTorusEdgeMode,
  CliffordTorusMode,
  CliffordTorusConfig,
  MandelbrotColorMode,
  MandelbrotPalette,
  MandelbrotQualityPreset,
  MandelbrotRenderStyle,
  MandelbrotConfig,
  ExtendedObjectParams,
} from './types';

// Default configs
export {
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_ROOT_SYSTEM_CONFIG,
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_MANDELBROT_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
  DEFAULT_EXTENDED_OBJECT_PARAMS,
} from './types';

// Root system exports
export {
  generateRootSystem,
  generateARoots,
  generateDRoots,
  getRootCount,
  validateRootSystemType,
} from './root-system';

// E8 roots exports
export {
  generateE8Roots,
  verifyE8Roots,
} from './e8-roots';

// Clifford Torus
export {
  generateCliffordTorus,
  generateCliffordTorusPoints,
  buildCliffordTorusGridEdges,
  verifyCliffordTorusOnSphere,
} from './clifford-torus';


// Mandelbrot
export {
  generateMandelbrot,
  mandelbrotStep,
  mandelbrotEscapeTime,
  mandelbrotSmoothEscapeTime,
  normSquared,
  generateSampleGrid,
  filterSamples,
  getMandelbrotStats,
} from './mandelbrot';
export type { MandelbrotSample } from './mandelbrot';

// Utility exports
export { buildKnnEdges } from './utils/knn-edges';
export { buildShortEdges } from './utils/short-edges';
export {
  computeConvexHullFaces,
  hasValidConvexHull,
  getConvexHullStats,
} from './utils/convex-hull-faces';

// Re-import for unified generator
import type { NdGeometry, ObjectType } from '../types';
import { isPolytopeType } from '../types';
import type { ExtendedObjectParams } from './types';
import { DEFAULT_EXTENDED_OBJECT_PARAMS } from './types';
import { generateRootSystem } from './root-system';
import { generateCliffordTorus } from './clifford-torus';
import { generateMandelbrot } from './mandelbrot';

/**
 * Generates geometry for an extended object type
 *
 * This is the unified dispatcher for all extended object types.
 *
 * @param type - Extended object type
 * @param dimension - Dimensionality of the ambient space
 * @param params - Extended object parameters (optional, uses defaults if not provided)
 * @returns NdGeometry representing the object
 * @throws {Error} If type is not an extended object type or dimension constraints are violated
 *
 * @example
 * ```typescript
 * // Generate a Mandelbrot set
 * const mandelbrot = generateExtendedObject('mandelbrot', 4, {
 *   ...DEFAULT_EXTENDED_OBJECT_PARAMS,
 *   mandelbrot: { maxIterations: 100, resolution: 48, ... },
 * });
 *
 * // Generate a root system
 * const roots = generateExtendedObject('root-system', 4, {
 *   ...DEFAULT_EXTENDED_OBJECT_PARAMS,
 *   rootSystem: { rootType: 'D', scale: 2.0 },
 * });
 * ```
 */
export function generateExtendedObject(
  type: ObjectType,
  dimension: number,
  params: ExtendedObjectParams = DEFAULT_EXTENDED_OBJECT_PARAMS
): NdGeometry {
  // Validate that this is an extended object type
  if (isPolytopeType(type)) {
    throw new Error(`${type} is a polytope type, not an extended object type. Use generatePolytope instead.`);
  }

  switch (type) {
    case 'root-system':
      return generateRootSystem(dimension, params.rootSystem);

    case 'clifford-torus':
      return generateCliffordTorus(dimension, params.cliffordTorus);

    case 'mandelbrot':
      return generateMandelbrot(dimension, params.mandelbrot ?? DEFAULT_EXTENDED_OBJECT_PARAMS.mandelbrot);

    case 'mandelbox':
      // Mandelbox uses GPU raymarching exclusively - no CPU geometry needed
      // Return minimal geometry that signals to UnifiedRenderer to use MandelboxMesh
      return {
        dimension,
        type: 'mandelbox',
        vertices: [],
        edges: [],
        isPointCloud: false,
        metadata: {
          name: 'Mandelbox',
          properties: {
            renderMode: 'raymarching',
          },
        },
      };

    default:
      throw new Error(`Unknown extended object type: ${type}`);
  }
}
