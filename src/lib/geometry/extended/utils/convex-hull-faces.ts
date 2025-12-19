/**
 * Convex Hull Face Extraction
 *
 * Computes the triangular faces of n-dimensional polytopes using convex hull.
 * Used for proper face detection in root systems and other convex polytopes.
 *
 * @see https://github.com/mikolalysenko/convex-hull
 */

import { dotProduct, magnitude, scaleVector, subtractVectors } from '@/lib/math'
import type { VectorND } from '@/lib/math/types'
import convexHull from 'convex-hull'

/**
 * Corrects the winding order of a triangle so that its normal points outward
 * (away from the centroid of the polytope).
 *
 * This is CRITICAL for proper FrontSide/BackSide rendering of transparent faces.
 * Without correct winding, some faces will render with the wrong pass.
 *
 * @param v0 - First vertex index
 * @param v1 - Second vertex index
 * @param v2 - Third vertex index
 * @param vertices - Array of all vertex positions
 * @param polytopeCentroid - Center of the polytope (for outward direction reference)
 * @returns Triangle indices with corrected winding order [v0, v1, v2] or [v0, v2, v1]
 */
function correctWindingOrder(
  v0: number,
  v1: number,
  v2: number,
  vertices: number[][],
  polytopeCentroid: number[]
): [number, number, number] {
  const p0 = vertices[v0]!
  const p1 = vertices[v1]!
  const p2 = vertices[v2]!

  // Compute edges
  const edge1: number[] = []
  const edge2: number[] = []
  for (let i = 0; i < Math.min(p0.length, 3); i++) {
    edge1.push((p1[i] ?? 0) - (p0[i] ?? 0))
    edge2.push((p2[i] ?? 0) - (p0[i] ?? 0))
  }
  // Pad to 3D if needed
  while (edge1.length < 3) edge1.push(0)
  while (edge2.length < 3) edge2.push(0)

  // Compute normal via cross product (3D)
  const normal = [
    edge1[1]! * edge2[2]! - edge1[2]! * edge2[1]!,
    edge1[2]! * edge2[0]! - edge1[0]! * edge2[2]!,
    edge1[0]! * edge2[1]! - edge1[1]! * edge2[0]!,
  ]

  // Compute triangle centroid
  const triCentroid: number[] = []
  for (let i = 0; i < Math.min(p0.length, 3); i++) {
    triCentroid.push(((p0[i] ?? 0) + (p1[i] ?? 0) + (p2[i] ?? 0)) / 3)
  }
  while (triCentroid.length < 3) triCentroid.push(0)

  // Vector from polytope centroid to triangle centroid (outward direction)
  const outward: number[] = []
  for (let i = 0; i < 3; i++) {
    outward.push(triCentroid[i]! - (polytopeCentroid[i] ?? 0))
  }

  // If normal points in same direction as outward vector, winding is correct
  // Otherwise, flip the winding by swapping v1 and v2
  const dot = normal[0]! * outward[0]! + normal[1]! * outward[1]! + normal[2]! * outward[2]!

  return dot >= 0 ? [v0, v1, v2] : [v0, v2, v1]
}

/**
 * Computes the centroid of a set of vertices
 * @param vertices - Array of n-dimensional vertices
 * @returns Centroid coordinates
 */
function computeCentroid(vertices: number[][]): number[] {
  if (vertices.length === 0) return []
  const dim = vertices[0]!.length
  const centroid = new Array(dim).fill(0)

  for (const v of vertices) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += v[i] ?? 0
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= vertices.length
  }

  return centroid
}

/**
 * Projects points to their affine hull (removes degeneracy)
 *
 * Some point sets (like A_n roots) lie in a hyperplane. This function
 * projects them to their actual dimension for proper convex hull computation.
 *
 * Uses Gram-Schmidt orthogonalization to find basis vectors from point differences.
 * @param vertices - Array of n-dimensional vertices
 * @returns Projected vertices and their actual dimension
 */
function projectToAffineHull(vertices: number[][]): {
  projected: number[][]
  actualDimension: number
} {
  if (vertices.length < 2) {
    return { projected: vertices, actualDimension: vertices[0]?.length ?? 0 }
  }

  const n = vertices.length
  const d = vertices[0]!.length
  const origin = vertices[0]! as VectorND

  // Compute differences from first point using library function
  const diffs: VectorND[] = []
  for (let i = 1; i < n; i++) {
    diffs.push(subtractVectors(vertices[i]! as VectorND, origin))
  }

  // Find orthonormal basis using Gram-Schmidt (find ALL linearly independent vectors)
  const basis: VectorND[] = []
  const epsilon = 1e-10

  for (const diff of diffs) {
    // Project out existing basis vectors using library functions
    let projected: VectorND = [...diff]
    for (const b of basis) {
      const dot = dotProduct(projected, b)
      const projection = scaleVector(b, dot)
      projected = subtractVectors(projected, projection)
    }

    // Check if there's a new direction
    const norm = magnitude(projected)
    if (norm > epsilon) {
      // Normalize and add to basis
      basis.push(scaleVector(projected, 1 / norm))
    }

    // Stop if we've found a full basis (d vectors for d dimensions)
    if (basis.length >= d) break
  }

  const actualDimension = basis.length

  // If points span the full space (found d linearly independent vectors),
  // return original vertices - no projection needed
  if (actualDimension >= d) {
    return { projected: vertices, actualDimension: d }
  }

  // Points lie in a lower-dimensional subspace - project to that subspace
  const projectedPoints: number[][] = []
  for (const vertex of vertices) {
    const centered = subtractVectors(vertex as VectorND, origin)
    const coords: number[] = []
    for (const b of basis) {
      coords.push(dotProduct(centered, b))
    }
    projectedPoints.push(coords)
  }

  return { projected: projectedPoints, actualDimension }
}

/**
 * Computes triangular faces from a convex hull of n-dimensional points
 *
 * For 3D points: returns triangles directly
 * For nD points (n > 3): extracts triangular 2-faces from (n-1)-simplices
 *
 * @param vertices - Array of n-dimensional point coordinates
 * @returns Array of triangular faces as vertex index triples
 *
 * @example
 * ```typescript
 * // 4D root system vertices
 * const vertices = generateDRoots(4, 1.0);
 * const triangles = computeConvexHullFaces(vertices);
 * // Returns all triangular faces of the 4D polytope
 * ```
 *
 * @remarks
 * - For 3D, the convex hull gives triangular facets directly
 * - For 4D+, each (d-1)-simplex has d vertices; we extract all C(d,3) triangles
 * - Duplicate triangles are deduplicated using a string key set
 * - Returns empty array for degenerate cases (< 4 points)
 * - Handles degenerate point sets (e.g., A_n roots in a hyperplane) by
 *   projecting to the affine hull first
 */
export function computeConvexHullFaces(vertices: number[][]): [number, number, number][] {
  if (vertices.length < 4) {
    return []
  }

  const originalDimension = vertices[0]?.length ?? 0
  if (originalDimension < 3) {
    return []
  }

  // Project to affine hull to handle degenerate cases (like A_n roots)
  const { projected, actualDimension } = projectToAffineHull(vertices)

  // Need at least 3D for meaningful faces
  if (actualDimension < 3) {
    return []
  }

  // Compute convex hull - returns (d-1)-simplices as boundary facets
  let hull: number[][]
  try {
    hull = convexHull(projected)
  } catch {
    // Degenerate point set
    return []
  }

  if (!hull || hull.length === 0) {
    return []
  }

  // Compute polytope centroid for winding correction
  // Use ORIGINAL vertices (not projected) for correct 3D centroid
  const centroid = computeCentroid(vertices)

  // For 3D (or 3D affine hull), hull contains triangles directly
  if (actualDimension === 3) {
    return hull
      .filter((face) => face.length === 3)
      .map((face) => {
        // Apply winding correction to ensure normals point outward
        return correctWindingOrder(face[0]!, face[1]!, face[2]!, vertices, centroid)
      })
  }

  // For higher dimensions, extract triangular 2-faces from (d-1)-simplices
  // Each (d-1)-simplex has d vertices; triangles are all 3-combinations
  const faceSet = new Set<string>()
  const triangles: [number, number, number][] = []

  for (const simplex of hull) {
    const n = simplex.length

    // Extract all C(n, 3) triangular faces
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const v0 = simplex[i]!
          const v1 = simplex[j]!
          const v2 = simplex[k]!

          // Use sorted key for deduplication
          const sortedKey = [v0, v1, v2].sort((a, b) => a - b).join(',')

          if (!faceSet.has(sortedKey)) {
            faceSet.add(sortedKey)
            // Apply winding correction to ensure normals point outward
            triangles.push(correctWindingOrder(v0, v1, v2, vertices, centroid))
          }
        }
      }
    }
  }

  return triangles
}

/**
 * Checks if a set of points forms a valid convex polytope
 *
 * @param vertices - Array of n-dimensional points
 * @returns True if convex hull can be computed
 */
export function hasValidConvexHull(vertices: number[][]): boolean {
  if (vertices.length < 4) {
    return false
  }

  const dimension = vertices[0]?.length ?? 0
  if (dimension < 3) {
    return false
  }

  try {
    // Project to affine hull to handle degenerate cases
    const { projected, actualDimension } = projectToAffineHull(vertices)
    if (actualDimension < 3) {
      return false
    }

    const hull = convexHull(projected)
    return hull && hull.length > 0
  } catch {
    return false
  }
}

/**
 * Gets convex hull statistics for debugging
 *
 * @param vertices - Array of n-dimensional points
 * @returns Object with hull statistics or null if computation fails
 */
export function getConvexHullStats(vertices: number[][]): {
  facetCount: number
  triangleCount: number
  dimension: number
  actualDimension: number
  vertexCount: number
} | null {
  if (vertices.length < 4) {
    return null
  }

  const dimension = vertices[0]?.length ?? 0

  try {
    // Project to affine hull to handle degenerate cases
    const { projected, actualDimension } = projectToAffineHull(vertices)
    if (actualDimension < 3) {
      return null
    }

    const hull = convexHull(projected)
    if (!hull) return null

    const triangles = computeConvexHullFaces(vertices)

    return {
      facetCount: hull.length,
      triangleCount: triangles.length,
      dimension,
      actualDimension,
      vertexCount: vertices.length,
    }
  } catch {
    return null
  }
}
