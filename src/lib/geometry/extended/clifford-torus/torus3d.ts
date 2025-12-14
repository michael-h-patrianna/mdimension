/**
 * 3D Torus Surface Generator
 *
 * Generates a standard 3D torus surface as the 3D equivalent of the Clifford torus.
 * This is a regular torus in R^3, not the Clifford embedding which requires 4D.
 */

import type { VectorND } from '@/lib/math/types'
import type { NdGeometry } from '../../types'
import type { CliffordTorusConfig } from '../types'

/**
 * Generates points on a 3D torus surface
 *
 * Uses the parametric equations:
 *   x = (R + r*cos(v)) * cos(u)
 *   y = (R + r*cos(v)) * sin(u)
 *   z = r * sin(v)
 *
 * Where R is the major radius and r is the minor radius.
 *
 * @param config - Clifford torus configuration (uses radius, resolutionU, resolutionV)
 * @returns Array of 3D points on the torus surface
 */
export function generateTorus3DPoints(config: CliffordTorusConfig): VectorND[] {
  const { radius, resolutionU, resolutionV } = config
  const points: VectorND[] = []

  // Major radius (distance from center to tube center)
  const R = radius
  // Minor radius (tube radius) - 40% of major radius for good visual balance
  const r = radius * 0.4

  for (let i = 0; i < resolutionU; i++) {
    const u = (2 * Math.PI * i) / resolutionU
    const cu = Math.cos(u)
    const su = Math.sin(u)

    for (let j = 0; j < resolutionV; j++) {
      const v = (2 * Math.PI * j) / resolutionV
      const cv = Math.cos(v)
      const sv = Math.sin(v)

      // 3D point on the torus
      const p: VectorND = [(R + r * cv) * cu, (R + r * cv) * su, r * sv]

      points.push(p)
    }
  }

  return points
}

/**
 * Builds grid edges for the 3D torus with wrap-around connectivity
 *
 * Creates edges connecting each point to its neighbors in both u and v directions.
 * Both u and v directions wrap around (torus topology).
 *
 * @param resolutionU - Number of steps in the u direction (around the major circle)
 * @param resolutionV - Number of steps in the v direction (around the tube)
 * @returns Array of edge pairs (vertex indices)
 */
export function buildTorus3DGridEdges(
  resolutionU: number,
  resolutionV: number
): [number, number][] {
  const edges: [number, number][] = []

  // Index function: (i, j) -> linear index
  const index = (i: number, j: number): number => i * resolutionV + j

  for (let i = 0; i < resolutionU; i++) {
    for (let j = 0; j < resolutionV; j++) {
      const iNext = (i + 1) % resolutionU
      const jNext = (j + 1) % resolutionV

      const idx = index(i, j)

      // Edge along u direction (around major circle)
      edges.push([idx, index(iNext, j)])

      // Edge along v direction (around tube)
      edges.push([idx, index(i, jNext)])
    }
  }

  // Normalize edges (smaller index first) and dedupe
  const normalizedEdges: [number, number][] = []
  const edgeSet = new Set<string>()

  for (const [a, b] of edges) {
    const minIdx = Math.min(a, b)
    const maxIdx = Math.max(a, b)
    const key = `${minIdx},${maxIdx}`

    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      normalizedEdges.push([minIdx, maxIdx])
    }
  }

  return normalizedEdges
}

/**
 * Builds quad faces for the 3D torus surface
 *
 * Each grid cell (i, j) forms a quad with corners:
 * - (i, j), (i+1, j), (i+1, j+1), (i, j+1)
 * Both u and v directions wrap around (torus topology).
 *
 * @param resolutionU - Number of steps in the u direction (around the major circle)
 * @param resolutionV - Number of steps in the v direction (around the tube)
 * @returns Array of quad faces (4 vertex indices each, counter-clockwise winding)
 */
export function buildTorus3DGridFaces(resolutionU: number, resolutionV: number): number[][] {
  const faces: number[][] = []

  // Index function: (i, j) -> linear index
  const index = (i: number, j: number): number => i * resolutionV + j

  for (let i = 0; i < resolutionU; i++) {
    for (let j = 0; j < resolutionV; j++) {
      const iNext = (i + 1) % resolutionU
      const jNext = (j + 1) % resolutionV

      // Quad vertices in counter-clockwise winding order
      faces.push([index(i, j), index(iNext, j), index(iNext, jNext), index(i, jNext)])
    }
  }

  return faces
}

/**
 * Generates a 3D torus surface geometry
 *
 * This is a standard torus in R^3, not the Clifford torus which requires 4D.
 * The 3D torus is the natural "degraded" representation when dimension=3.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 3D torus surface
 */
export function generateTorus3D(config: CliffordTorusConfig): NdGeometry {
  const { radius, resolutionU, resolutionV, edgeMode } = config

  // Generate points
  const vertices = generateTorus3DPoints(config)

  // Generate edges based on mode
  const edges: [number, number][] =
    edgeMode === 'grid' ? buildTorus3DGridEdges(resolutionU, resolutionV) : []

  const pointCount = resolutionU * resolutionV

  // Minor radius (tube radius)
  const r = radius * 0.4

  return {
    dimension: 3,
    type: 'clifford-torus',
    vertices,
    edges,

    metadata: {
      name: 'Torus Surface (3D)',
      formula: `(R - √(x² + y²))² + z² = r², R=${radius.toFixed(2)}, r=${r.toFixed(2)}`,
      properties: {
        mode: '3d-torus',
        majorRadius: radius,
        minorRadius: r,
        resolutionU,
        resolutionV,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 3,
      },
    },
  }
}
