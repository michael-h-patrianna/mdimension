/**
 * Vertex generation functions for Wythoff polytopes.
 *
 * Each function generates vertices for a specific polytope type:
 * - Hypercube/Tesseract: Binary coordinate combinations (±1)
 * - Cross-polytope: Unit vectors along each axis
 * - Simplex: Regular simplex construction
 * - Rectified/Truncated/Cantellated/etc: Various Wythoff constructions
 */

import type { VectorND } from '@/lib/math'
import { createVector, scaleVector } from '@/lib/math'
import { VertexHashSet } from '../utils/vertex-hash'
import type { PolytopeData } from './types'

/**
 * Generate all vertices of a hypercube {4,3,...,3} in n dimensions.
 * Vertices are at all combinations of ±1 in each coordinate.
 * @param dimension
 */
export function generateHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const numVertices = Math.pow(2, dimension)

  for (let i = 0; i < numVertices; i++) {
    const vertex = createVector(dimension, 0)
    for (let j = 0; j < dimension; j++) {
      vertex[j] = (i & (1 << j)) ? 1 : -1
    }
    vertices.push(vertex)
  }

  return vertices
}

/**
 * Generate complete hypercube data including analytically correct faces.
 * @param dimension
 */
export function generateHypercubeData(dimension: number): PolytopeData {
  const vertices = generateHypercubeVertices(dimension)
  const edges: [number, number][] = []
  const faces: number[][] = []

  const numVertices = Math.pow(2, dimension)

  // Generate edges: connect vertices that differ in exactly one coordinate
  for (let i = 0; i < numVertices; i++) {
    for (let j = i + 1; j < numVertices; j++) {
      const diff = i ^ j
      // Check if diff is a power of 2 (exactly one bit set)
      if ((diff & (diff - 1)) === 0) {
        edges.push([i, j])
      }
    }
  }

  // Generate 2D faces: fix (d-2) coordinates, vary 2 coordinates
  // Each face is a quad with 4 vertices
  for (let axis1 = 0; axis1 < dimension; axis1++) {
    for (let axis2 = axis1 + 1; axis2 < dimension; axis2++) {
      // For each combination of fixed coordinates
      const numFixed = Math.pow(2, dimension - 2)

      for (let fixed = 0; fixed < numFixed; fixed++) {
        // Expand fixed bits to skip axis1 and axis2
        let baseVertex = 0
        let fixedBit = 0
        for (let d = 0; d < dimension; d++) {
          if (d !== axis1 && d !== axis2) {
            if (fixed & (1 << fixedBit)) {
              baseVertex |= (1 << d)
            }
            fixedBit++
          }
        }

        // Create the 4 corners of this face in winding order
        const v00 = baseVertex
        const v10 = baseVertex | (1 << axis1)
        const v11 = baseVertex | (1 << axis1) | (1 << axis2)
        const v01 = baseVertex | (1 << axis2)

        // Add as two triangles (proper triangulation of quad)
        faces.push([v00, v10, v11])
        faces.push([v00, v11, v01])
      }
    }
  }

  return { vertices, edges, faces }
}

/**
 * Generate all vertices of a cross-polytope {3,3,...,4} in n dimensions.
 * Vertices are at ±1 along each axis.
 * @param dimension
 */
export function generateCrossPolytopeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []

  for (let i = 0; i < dimension; i++) {
    const posVertex = createVector(dimension, 0)
    const negVertex = createVector(dimension, 0)
    posVertex[i] = 1
    negVertex[i] = -1
    vertices.push(posVertex)
    vertices.push(negVertex)
  }

  return vertices
}

/**
 * Generate all vertices of a regular simplex in n dimensions.
 * Uses standard construction with n+1 vertices.
 * @param dimension
 */
export function generateSimplexVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []

  // Standard simplex construction
  // First vertex at origin
  const v0 = createVector(dimension, 0)
  for (let i = 0; i < dimension; i++) {
    v0[i] = -1 / Math.sqrt(2 * (i + 1) * (i + 2))
  }
  vertices.push(v0)

  // Remaining n vertices
  for (let k = 0; k < dimension; k++) {
    const v = createVector(dimension, 0)
    for (let i = 0; i < dimension; i++) {
      if (i < k) {
        v[i] = -1 / Math.sqrt(2 * (i + 1) * (i + 2))
      } else if (i === k) {
        v[i] = (k + 1) / Math.sqrt(2 * (k + 1) * (k + 2))
      } else {
        v[i] = -1 / Math.sqrt(2 * (i + 1) * (i + 2))
      }
    }
    vertices.push(v)
  }

  return vertices
}

/**
 * Generate complete simplex data including analytically correct faces.
 * A simplex has (n+1 choose 3) triangular faces.
 * @param dimension
 */
export function generateSimplexData(dimension: number): PolytopeData {
  const vertices = generateSimplexVertices(dimension)
  const edges: [number, number][] = []
  const faces: number[][] = []
  const n = vertices.length // n+1 vertices for n-simplex

  // All pairs of vertices are connected by edges
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push([i, j])
    }
  }

  // All triples of vertices form triangular faces
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        faces.push([i, j, k])
      }
    }
  }

  return { vertices, edges, faces }
}

/**
 * Generate rectified hypercube (n-dimensional cuboctahedron analog).
 * Vertices at midpoints of edges of the hypercube.
 * @param dimension
 */
export function generateRectifiedHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new VertexHashSet()

  // Midpoints of hypercube edges: all permutations of (±1, ±1, ..., 0, ..., 0)
  // with exactly (dimension-1) non-zero coordinates
  for (let zeroIdx = 0; zeroIdx < dimension; zeroIdx++) {
    const numConfigs = Math.pow(2, dimension - 1)
    for (let config = 0; config < numConfigs; config++) {
      const vertex = createVector(dimension, 0)
      let bitIdx = 0
      for (let j = 0; j < dimension; j++) {
        if (j === zeroIdx) {
          vertex[j] = 0
        } else {
          vertex[j] = (config & (1 << bitIdx)) ? 1 : -1
          bitIdx++
        }
      }

      if (seen.add(vertex)) {
        vertices.push(vertex)
      }
    }
  }

  return vertices
}

/**
 * Generate truncated hypercube vertices.
 * Vertices are at positions like (±1, ±1, ..., ±(sqrt(2)-1)).
 * @param dimension
 */
export function generateTruncatedHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new VertexHashSet()
  const t = Math.sqrt(2) - 1 // Truncation parameter

  // For each position where we put the truncation coordinate
  for (let truncIdx = 0; truncIdx < dimension; truncIdx++) {
    const numConfigs = Math.pow(2, dimension)
    for (let config = 0; config < numConfigs; config++) {
      const vertex = createVector(dimension, 0)
      for (let j = 0; j < dimension; j++) {
        if (j === truncIdx) {
          vertex[j] = (config & (1 << j)) ? t : -t
        } else {
          vertex[j] = (config & (1 << j)) ? 1 : -1
        }
      }

      if (seen.add(vertex)) {
        vertices.push(vertex)
      }
    }
  }

  return vertices
}

/**
 * Generate cantellated hypercube vertices (rhombicuboctahedron analog).
 * @param dimension
 */
export function generateCantellatedHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new VertexHashSet()
  const phi = 1 + Math.sqrt(2) // Golden-like ratio for cantellation

  // Generate vertices with two different coordinate magnitudes
  // Permutations of (±1, ±1, ±φ, ...)
  if (dimension >= 3) {
    for (let largeIdx = 0; largeIdx < dimension; largeIdx++) {
      const numConfigs = Math.pow(2, dimension)
      for (let config = 0; config < numConfigs; config++) {
        const vertex = createVector(dimension, 0)
        for (let j = 0; j < dimension; j++) {
          const sign = (config & (1 << j)) ? 1 : -1
          vertex[j] = (j === largeIdx) ? sign * phi : sign
        }

        if (seen.add(vertex)) {
          vertices.push(vertex)
        }
      }
    }
  }

  return vertices
}

/**
 * Generator function that yields permutations one at a time using Heap's algorithm.
 * This avoids building the entire n! array in memory.
 * @param arr
 */
export function* permutationGenerator(arr: number[]): Generator<number[], void, unknown> {
  const n = arr.length
  const c = new Array(n).fill(0)
  const a = [...arr]

  yield [...a]

  let i = 0
  while (i < n) {
    if (c[i]! < i) {
      if (i % 2 === 0) {
        // Swap a[0] and a[i]
        const temp = a[0]!
        a[0] = a[i]!
        a[i] = temp
      } else {
        // Swap a[c[i]] and a[i]
        const temp = a[c[i]!]!
        a[c[i]!] = a[i]!
        a[i] = temp
      }
      yield [...a]
      c[i]!++
      i = 0
    } else {
      c[i] = 0
      i++
    }
  }
}

/**
 * Generate omnitruncated hypercube vertices (truncated cuboctahedron analog).
 * Uses lazy permutation generation with early termination to avoid memory exhaustion.
 *
 * @param dimension - Number of dimensions
 * @param maxVertices - Maximum vertices to generate before stopping
 */
export function generateOmnitruncatedHypercubeVertices(
  dimension: number,
  maxVertices: number = 40000
): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new VertexHashSet()

  // Omnitruncation produces all permutations of distinct coordinates
  // For n dimensions, use coordinates 1, 2, 3, ..., n
  const coords = Array.from({ length: dimension }, (_, i) => i + 1)

  const numSigns = Math.pow(2, dimension)

  // Use generator to stream permutations one at a time
  // This prevents memory exhaustion for high dimensions (11! = 40M permutations)
  for (const perm of permutationGenerator(coords)) {
    // For each permutation, generate all sign combinations
    for (let signConfig = 0; signConfig < numSigns; signConfig++) {
      const vertex = createVector(dimension, 0)
      for (let j = 0; j < dimension; j++) {
        const sign = (signConfig & (1 << j)) ? 1 : -1
        vertex[j] = sign * (perm[j] ?? 1)
      }

      if (seen.add(vertex)) {
        vertices.push(vertex)

        // Early termination once we hit the vertex limit
        if (vertices.length >= maxVertices) {
          return vertices
        }
      }
    }
  }

  return vertices
}

/**
 * Generate runcinated hypercube vertices (first and last node ringed).
 * @param dimension
 */
export function generateRuncinatedHypercubeVertices(dimension: number): VectorND[] {
  // Combine hypercube vertices with scaled versions
  const vertices: VectorND[] = []
  const seen = new VertexHashSet()

  // Original hypercube vertices
  const hypercube = generateHypercubeVertices(dimension)
  for (const v of hypercube) {
    if (seen.add(v)) {
      vertices.push(v)
    }
  }

  // Cross-polytope vertices scaled
  const scale = 1 + Math.sqrt(2)
  const cross = generateCrossPolytopeVertices(dimension)
  for (const v of cross) {
    const scaled = scaleVector(v, scale)
    if (seen.add(scaled)) {
      vertices.push(scaled)
    }
  }

  return vertices
}

/**
 * Generate half-hypercube (demihypercube) vertices.
 * Takes alternating vertices of the hypercube.
 * @param dimension
 */
export function generateDemihypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const numVertices = Math.pow(2, dimension)

  for (let i = 0; i < numVertices; i++) {
    // Count number of 1s (positive coordinates)
    let count = 0
    for (let j = 0; j < dimension; j++) {
      if (i & (1 << j)) count++
    }

    // Only include vertices with even number of positive coordinates
    if (count % 2 === 0) {
      const vertex = createVector(dimension, 0)
      for (let j = 0; j < dimension; j++) {
        vertex[j] = (i & (1 << j)) ? 1 : -1
      }
      vertices.push(vertex)
    }
  }

  return vertices
}

/**
 * Center and scale the vertices to fit within [-scale, scale].
 *
 * Optimized single-pass implementation that:
 * 1. Computes centroid
 * 2. Centers vertices in place
 * 3. Finds max extent
 * 4. Scales in place
 *
 * Memory efficient: modifies input array in place, returns same reference.
 *
 * @param vertices - Array of vertex positions (modified in place)
 * @param scale - Target scale factor
 * @returns Same vertices array (for chaining)
 */
export function centerAndScale(vertices: VectorND[], scale: number): VectorND[] {
  if (vertices.length === 0) return vertices

  const dimension = vertices[0]!.length
  const n = vertices.length

  // Pass 1: Calculate centroid
  const centroid = createVector(dimension, 0)
  for (let v = 0; v < n; v++) {
    const vertex = vertices[v]!
    for (let i = 0; i < dimension; i++) {
      centroid[i] = (centroid[i] ?? 0) + (vertex[i] ?? 0)
    }
  }
  for (let i = 0; i < dimension; i++) {
    centroid[i] = (centroid[i] ?? 0) / n
  }

  // Pass 2: Center in place AND find max extent simultaneously
  let maxExtent = 0
  for (let v = 0; v < n; v++) {
    const vertex = vertices[v]!
    for (let i = 0; i < dimension; i++) {
      const centered = (vertex[i] ?? 0) - (centroid[i] ?? 0)
      vertex[i] = centered
      maxExtent = Math.max(maxExtent, Math.abs(centered))
    }
  }

  // Pass 3: Scale in place (only if needed)
  if (maxExtent > 0 && Math.abs(maxExtent - scale) > 1e-9) {
    const scaleFactor = scale / maxExtent
    for (let v = 0; v < n; v++) {
      const vertex = vertices[v]!
      for (let i = 0; i < dimension; i++) {
        vertex[i] = (vertex[i] ?? 0) * scaleFactor
      }
    }
  }

  return vertices
}
