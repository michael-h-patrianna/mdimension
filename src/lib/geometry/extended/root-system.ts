/**
 * Root System Polytope Generators
 *
 * Generates vertices and edges for root system polytopes:
 * - Type A_{n-1}: e_i - e_j for i != j → n(n-1) roots
 * - Type D_n: ±e_i ± e_j for i < j → 2n(n-1) roots (requires n >= 4)
 * - Type E_8: 240 roots in 8D (requires n = 8)
 *
 * @see docs/research/nd-extended-objects-guide.md Section 2
 */

import type { VectorND } from '@/lib/math/types'
import type { NdGeometry } from '../types'
import { generateE8Roots } from './e8-roots'
import type { RootSystemConfig, RootSystemType } from './types'
import { buildShortEdges } from './utils/short-edges'

/**
 * Generates Type A_{n-1} root system in R^n
 *
 * A_{n-1} roots are vectors e_i - e_j for all i != j
 * This produces n(n-1) roots of length sqrt(2)
 *
 * @param dimension - Ambient dimension n
 * @param scale - Scale factor for the roots
 * @returns Array of n(n-1) root vectors
 *
 * @example
 * ```typescript
 * const roots = generateARoots(4, 1.0);
 * // Returns 12 roots (4*3) for A_3
 * ```
 */
export function generateARoots(dimension: number, scale: number = 1.0): VectorND[] {
  const n = dimension
  const roots: VectorND[] = []
  const normalizer = Math.sqrt(2) // Normalize to unit length

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue

      const v: VectorND = new Array(n).fill(0)
      v[i] = 1
      v[j] = -1

      // Normalize and scale
      for (let k = 0; k < n; k++) {
        v[k] = (v[k]! / normalizer) * scale
      }

      roots.push(v)
    }
  }

  return roots
}

/**
 * Generates Type D_n root system in R^n
 *
 * D_n roots are vectors ±e_i ± e_j for i < j
 * This produces 2n(n-1) roots of length sqrt(2)
 *
 * @param dimension - Ambient dimension n (must be >= 4)
 * @param scale - Scale factor for the roots
 * @returns Array of 2n(n-1) root vectors
 * @throws {Error} If dimension is less than 4
 *
 * @example
 * ```typescript
 * const roots = generateDRoots(4, 1.0);
 * // Returns 24 roots (2*4*3) for D_4
 * ```
 */
export function generateDRoots(dimension: number, scale: number = 1.0): VectorND[] {
  if (dimension < 4) {
    throw new Error('D_n root system requires dimension >= 4')
  }

  const n = dimension
  const roots: VectorND[] = []
  const normalizer = Math.sqrt(2)

  const signPairs: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (const [si, sj] of signPairs) {
        const v: VectorND = new Array(n).fill(0)
        v[i] = si
        v[j] = sj

        // Normalize and scale
        for (let k = 0; k < n; k++) {
          v[k] = (v[k]! / normalizer) * scale
        }

        roots.push(v)
      }
    }
  }

  return roots
}

/**
 * Generates a root system geometry
 *
 * @param dimension - Dimensionality of the ambient space (3-11)
 * @param config - Root system configuration options
 * @returns NdGeometry representing the root system polytope
 * @throws {Error} If dimension constraints are violated
 *
 * @example
 * ```typescript
 * const rootSystem = generateRootSystem(4, {
 *   rootType: 'A',
 *   scale: 1.0,
 *   edgeMode: 'short-edges',
 * });
 * ```
 */
export function generateRootSystem(dimension: number, config: RootSystemConfig): NdGeometry {
  if (dimension < 3) {
    throw new Error('Root system dimension must be at least 3')
  }

  const { rootType, scale } = config

  // Generate roots based on type
  let vertices: VectorND[]
  let rootTypeName: string
  let rootFormula: string
  let expectedCount: number

  switch (rootType) {
    case 'E8':
      if (dimension !== 8) {
        throw new Error('E8 root system requires dimension = 8')
      }
      vertices = generateE8Roots(scale)
      rootTypeName = 'E₈'
      rootFormula = '240 roots'
      expectedCount = 240
      break

    case 'D':
      if (dimension < 4) {
        throw new Error('D_n root system requires dimension >= 4')
      }
      vertices = generateDRoots(dimension, scale)
      rootTypeName = `D_${dimension}`
      rootFormula = `2n(n-1) = ${2 * dimension * (dimension - 1)}`
      expectedCount = 2 * dimension * (dimension - 1)
      break

    case 'A':
    default:
      vertices = generateARoots(dimension, scale)
      rootTypeName = `A_${dimension - 1}`
      rootFormula = `n(n-1) = ${dimension * (dimension - 1)}`
      expectedCount = dimension * (dimension - 1)
      break
  }

  // Always generate edges (root systems behave like polytopes)
  const edges: [number, number][] = buildShortEdges(vertices)

  return {
    dimension,
    type: 'root-system',
    vertices,
    edges,
    metadata: {
      name: `${rootTypeName} Root System`,
      formula: rootFormula,
      properties: {
        rootType,
        scale,
        rootCount: vertices.length,
        expectedCount,
        edgeCount: edges.length,
      },
    },
  }
}

/**
 * Gets the root count for a given root system type and dimension
 *
 * @param rootType - Type of root system
 * @param dimension - Ambient dimension
 * @returns Expected number of roots
 */
export function getRootCount(rootType: RootSystemType, dimension: number): number {
  switch (rootType) {
    case 'E8':
      return 240
    case 'D':
      return 2 * dimension * (dimension - 1)
    case 'A':
    default:
      return dimension * (dimension - 1)
  }
}

/**
 * Checks if a root system type is valid for a given dimension
 *
 * @param rootType - Type of root system
 * @param dimension - Ambient dimension
 * @returns Object with valid flag and error message if invalid
 */
export function validateRootSystemType(
  rootType: RootSystemType,
  dimension: number
): { valid: boolean; message?: string } {
  if (rootType === 'E8' && dimension !== 8) {
    return {
      valid: false,
      message: 'E₈ is only defined in 8 dimensions',
    }
  }

  if (rootType === 'D' && dimension < 4) {
    return {
      valid: false,
      message: 'D_n requires dimension >= 4',
    }
  }

  return { valid: true }
}
