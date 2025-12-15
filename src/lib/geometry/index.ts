/**
 * N-Dimensional Geometry Library
 *
 * Provides generators for n-dimensional geometric objects:
 *
 * Standard Polytopes:
 * - Hypercube (n-cube): generalization of cube
 * - Simplex (n-simplex): generalization of tetrahedron
 * - Cross-polytope (n-orthoplex): generalization of octahedron
 *
 * Extended Objects:
 * - Root Systems: A, D, and E8 root polytopes
 * - Clifford Torus: flat torus on S³
 * - Mandelbrot: N-dimensional fractal (Mandelbulb/Hyperbulb)
 * - Mandelbox: Box-like fractal with sphere/box folding
 */

// Type exports from types.ts
export type { CrossSectionResult } from './cross-section'
export type { Face } from './faces'
export { isRaymarchingFractal, RAYMARCHING_FRACTAL_TYPES } from './helpers'
export { isExtendedObjectType, isPolytopeType } from './types'
export type {
  ExtendedObjectType,
  GeometryMetadata,
  NdGeometry,
  ObjectType,
  PolytopeGeometry,
  PolytopeProperties,
  PolytopeType,
} from './types'

// Extended object type exports (includes PolytopeConfig for unified API)
export type {
  CliffordTorusConfig,
  CliffordTorusEdgeMode,
  ExtendedObjectParams,
  MandelbrotColorMode,
  MandelbrotConfig,
  MandelbrotPalette,
  MandelbrotQualityPreset,
  MandelbrotRenderStyle,
  MandelbrotSample,
  PolytopeConfig,
  RootSystemConfig,
  RootSystemType,
} from './extended'

// Default configs for all object types
export {
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_EXTENDED_OBJECT_PARAMS,
  DEFAULT_MANDELBROT_CONFIG,
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_ROOT_SYSTEM_CONFIG,
  MANDELBROT_QUALITY_PRESETS,
} from './extended'

// Polytope generator exports
export { generateCrossPolytope } from './cross-polytope'
export { generateHypercube } from './hypercube'
export { generateSimplex } from './simplex'

// Extended object generator exports
export {
  buildCliffordTorusGridEdges,
  // Utility exports
  buildKnnEdges,
  buildShortEdges,
  computeConvexHullFaces,
  filterSamples,
  generateARoots,
  generateCliffordTorus,
  generateCliffordTorusPoints,
  generateDRoots,
  generateE8Roots,
  generateExtendedObject,
  // Mandelbrot exports
  generateMandelbrot,
  generateRootSystem,
  generateSampleGrid,
  getConvexHullStats,
  getMandelbrotStats,
  getRootCount,
  hasValidConvexHull,
  mandelbrotEscapeTime,
  mandelbrotSmoothEscapeTime,
  mandelbrotStep,
  normSquared,
  validateRootSystemType,
  verifyCliffordTorusOnSphere,
  verifyE8Roots,
} from './extended'

// Face detection exports
export { detectFaces } from './faces'

// Cross-section exports
export { computeCrossSection, getWRange, projectCrossSectionTo3D } from './cross-section'

import { generateCrossPolytope } from './cross-polytope'
import type { ExtendedObjectParams } from './extended'
import { DEFAULT_EXTENDED_OBJECT_PARAMS, generateExtendedObject } from './extended'
import { generateHypercube } from './hypercube'
import { generateSimplex } from './simplex'
import type {
  NdGeometry,
  ObjectType,
  PolytopeGeometry,
  PolytopeProperties,
  PolytopeType,
} from './types'
import { isPolytopeType } from './types'

/**
 * Generates a polytope of the specified type and dimension
 *
 * @param type - Type of polytope to generate
 * @param dimension - Dimensionality (must be >= 3)
 * @param scale - Scale factor for the polytope (default: 1.0)
 * @returns PolytopeGeometry representing the polytope
 * @throws {Error} If dimension is less than 3 or type is invalid
 */
export function generatePolytope(
  type: PolytopeType,
  dimension: number,
  scale = 1.0
): PolytopeGeometry {
  switch (type) {
    case 'hypercube':
      return generateHypercube(dimension, scale)
    case 'simplex':
      return generateSimplex(dimension, scale)
    case 'cross-polytope':
      return generateCrossPolytope(dimension, scale)
    default:
      throw new Error(`Unknown polytope type: ${type}`)
  }
}

/**
 * Generates geometry for any object type (polytope or extended)
 *
 * This is the unified dispatcher that handles all object types with
 * consistent parameter handling. Both polytopes and extended objects
 * can be configured through the params object.
 *
 * @param type - Object type to generate
 * @param dimension - Dimensionality of the ambient space
 * @param params - Parameters for all object types (optional, uses defaults)
 * @returns NdGeometry representing the object
 * @throws {Error} If type is invalid or dimension constraints are violated
 *
 * @example
 * ```typescript
 * // Generate a hypercube with custom scale
 * const cube = generateGeometry('hypercube', 4, {
 *   ...DEFAULT_EXTENDED_OBJECT_PARAMS,
 *   polytope: { scale: 1.5 },
 * });
 *
 * // Generate a root system
 * const roots = generateGeometry('root-system', 4, {
 *   ...DEFAULT_EXTENDED_OBJECT_PARAMS,
 *   rootSystem: { rootType: 'D', scale: 2.0 },
 * });
 * ```
 */
export function generateGeometry(
  type: ObjectType,
  dimension: number,
  params?: ExtendedObjectParams
): NdGeometry {
  const effectiveParams = params ?? DEFAULT_EXTENDED_OBJECT_PARAMS

  if (isPolytopeType(type)) {
    // Convert PolytopeGeometry to NdGeometry, using polytope config for scale
    const scale = effectiveParams.polytope?.scale ?? 1.0
    const polytope = generatePolytope(type, dimension, scale)
    return {
      dimension: polytope.dimension,
      type: polytope.type,
      vertices: polytope.vertices,
      edges: polytope.edges,
      metadata: {
        name: getTypeName(type),
        properties: {
          scale,
        },
      },
    }
  } else {
    // Use extended object generator
    return generateExtendedObject(type, dimension, effectiveParams)
  }
}

/**
 * Calculates mathematical properties of a polytope geometry
 *
 * @param geometry - Polytope geometry to analyze
 * @returns Properties including counts and formulas
 */
export function getPolytopeProperties(geometry: PolytopeGeometry): PolytopeProperties {
  let vertexFormula: string
  let edgeFormula: string

  switch (geometry.type) {
    case 'hypercube':
      vertexFormula = '2^n'
      edgeFormula = 'n·2^(n-1)'
      break
    case 'simplex':
      vertexFormula = 'n+1'
      edgeFormula = '(n+1)·n/2'
      break
    case 'cross-polytope':
      vertexFormula = '2n'
      edgeFormula = '2n(n-1)'
      break
  }

  return {
    vertexCount: geometry.vertices.length,
    edgeCount: geometry.edges.length,
    vertexFormula,
    edgeFormula,
  }
}

/**
 * Gets the display name for an object type
 *
 * @param type - Object type
 * @returns Human-readable name
 */
function getTypeName(type: ObjectType): string {
  const typeNames: Record<ObjectType, string> = {
    hypercube: 'Hypercube',
    simplex: 'Simplex',
    'cross-polytope': 'Cross-Polytope',
    'root-system': 'Root System',
    'clifford-torus': 'Clifford Torus',
    'nested-torus': 'Nested Torus',
    mandelbrot: 'Mandelbulb',
    mandelbox: 'Mandelbox',
    menger: 'Menger Sponge',
  }
  return typeNames[type] ?? type
}

/**
 * Returns metadata about all available object types
 *
 * @param dimension - Current dimension (for filtering dimension-constrained types)
 * @returns Array of object type information with availability status
 */
export function getAvailableTypes(dimension?: number): Array<{
  type: ObjectType
  name: string
  description: string
  available: boolean
  disabledReason?: string
}> {
  const types: Array<{
    type: ObjectType
    name: string
    description: string
    minDimension?: number
    maxDimension?: number
  }> = [
    {
      type: 'hypercube',
      name: 'Hypercube',
      description: 'Generalization of a cube to n dimensions (n-cube)',
      minDimension: 3,
    },
    {
      type: 'simplex',
      name: 'Simplex',
      description: 'Generalization of a tetrahedron to n dimensions (n-simplex)',
      minDimension: 3,
    },
    {
      type: 'cross-polytope',
      name: 'Cross-Polytope',
      description: 'Generalization of an octahedron to n dimensions (n-orthoplex)',
      minDimension: 3,
    },
    {
      type: 'root-system',
      name: 'Root System',
      description: 'Root polytopes from Lie algebra (A, D, or E₈)',
      minDimension: 3,
    },
    {
      type: 'clifford-torus',
      name: 'Clifford Torus',
      description: 'Flat torus with independent circles (3D: torus surface, 4D+: Clifford torus)',
      minDimension: 3,
    },
    {
      type: 'nested-torus',
      name: 'Nested Torus',
      description: 'Coupled tori with Hopf-like structure (4D: Hopf fibration, 5D-11D: n-tori)',
      minDimension: 4,
      maxDimension: 11,
    },
    {
      type: 'mandelbrot',
      name: 'Mandelbulb',
      description: 'Fractal via escape-time iteration (3D: Mandelbulb, 4D+: n-dimensional)',
      minDimension: 3,
      maxDimension: 11,
    },
    {
      type: 'mandelbox',
      name: 'Mandelbox',
      description: 'Fractal with box/sphere folding (3D-11D raymarched)',
      minDimension: 3,
      maxDimension: 11,
    },
    {
      type: 'menger',
      name: 'Menger Sponge',
      description: 'Geometric IFS fractal with recursive cube subdivision (3D-11D raymarched)',
      minDimension: 3,
      maxDimension: 11,
    },
  ]

  return types.map((t) => {
    let available = true
    let disabledReason: string | undefined

    if (dimension !== undefined) {
      if (t.minDimension && dimension < t.minDimension) {
        available = false
        disabledReason = `Requires dimension >= ${t.minDimension}`
      } else if (t.maxDimension && dimension > t.maxDimension) {
        available = false
        disabledReason = `Requires dimension <= ${t.maxDimension}`
      }
    }

    return {
      type: t.type,
      name: t.name,
      description: t.description,
      available,
      disabledReason,
    }
  })
}
