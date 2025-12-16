/**
 * Extended N-Dimensional Objects Library
 *
 * Provides generators for extended n-dimensional geometric objects:
 * - Root Systems: A, D, and E8 root polytopes
 * - Clifford Torus: Flat torus on S³
 * - Mandelbulb: N-dimensional fractal (Mandelbulb/Mandelbulb)
 * - Quaternion Julia: Julia set fractal using quaternion algebra
 *
 * @see docs/prd/extended-objects.md
 * @see docs/research/nd-extended-objects-guide.md
 */

// Type exports
export type {
  CliffordTorusConfig,
  CliffordTorusEdgeMode,
  CliffordTorusMode,
  ExtendedObjectParams,
  MandelbulbColorMode,
  MandelbulbConfig,
  MandelbulbPalette,
  MandelbulbQualityPreset,
  MandelbulbRenderStyle,
  PolytopeConfig,
  RootSystemConfig,
  RootSystemType,
} from './types'

// Default configs
export {
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_EXTENDED_OBJECT_PARAMS,
  DEFAULT_MANDELBROT_CONFIG,
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_ROOT_SYSTEM_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
} from './types'

// Root system exports
export {
  generateARoots,
  generateDRoots,
  generateRootSystem,
  getRootCount,
  validateRootSystemType,
} from './root-system'

// E8 roots exports
export { generateE8Roots, verifyE8Roots } from './e8-roots'

// Clifford Torus
export {
  buildCliffordTorusGridEdges,
  generateCliffordTorus,
  generateCliffordTorusPoints,
  verifyCliffordTorusOnSphere,
} from './clifford-torus'

// Mandelbulb
export {
  filterSamples,
  generateMandelbulb,
  generateSampleGrid,
  getMandelbulbStats,
  mandelbulbEscapeTime,
  mandelbulbSmoothEscapeTime,
  mandelbulbStep,
  normSquared,
} from './mandelbulb'
export type { MandelbulbSample } from './mandelbulb'

// Utility exports
export {
  computeConvexHullFaces,
  getConvexHullStats,
  hasValidConvexHull,
} from './utils/convex-hull-faces'
export { buildKnnEdges } from './utils/knn-edges'
export { buildShortEdges } from './utils/short-edges'

// Re-import for unified generator
import type { NdGeometry, ObjectType } from '../types'
import { isPolytopeType } from '../types'
import { generateCliffordTorus } from './clifford-torus'
import { generateMandelbulb } from './mandelbulb'
import { generateNestedTorus } from './nested-torus'
import { generateRootSystem } from './root-system'
import type { ExtendedObjectParams } from './types'
import { DEFAULT_EXTENDED_OBJECT_PARAMS } from './types'

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
 * // Generate a Mandelbulb set
 * const mandelbulb = generateExtendedObject('mandelbulb', 4, {
 *   ...DEFAULT_EXTENDED_OBJECT_PARAMS,
 *   mandelbulb: { maxIterations: 100, resolution: 48, ... },
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
    throw new Error(
      `${type} is a polytope type, not an extended object type. Use generatePolytope instead.`
    )
  }

  switch (type) {
    case 'root-system':
      return generateRootSystem(dimension, params.rootSystem)

    case 'clifford-torus':
      return generateCliffordTorus(dimension, params.cliffordTorus)

    case 'nested-torus':
      return generateNestedTorus(dimension, params.nestedTorus)

    case 'mandelbulb':
      return generateMandelbulb(
        dimension,
        params.mandelbulb ?? DEFAULT_EXTENDED_OBJECT_PARAMS.mandelbulb
      )

    case 'quaternion-julia':
      // Quaternion Julia uses GPU raymarching exclusively - no CPU geometry needed
      // Return minimal geometry that signals to UnifiedRenderer to use QuaternionJuliaMesh
      return {
        dimension,
        type: 'quaternion-julia',
        vertices: [],
        edges: [],
        metadata: {
          name: 'Quaternion Julia',
          properties: {
            renderMode: 'raymarching',
          },
        },
      }

    default:
      throw new Error(`Unknown extended object type: ${type}`)
  }
}
