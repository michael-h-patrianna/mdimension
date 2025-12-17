/**
 * Wythoff Polytope Generation
 * Generalization of Wythoff construction to n dimensions (3-11D)
 *
 * The Wythoff construction creates uniform polytopes by reflecting a seed point
 * through a system of mirrors (hyperplanes) arranged according to a Coxeter-Dynkin diagram.
 *
 * This implementation supports:
 * - Simplex symmetry group (A_n): Regular and truncated simplices
 * - Hypercube/Cross-polytope symmetry group (B_n): Hypercubes, cross-polytopes, and rectifications
 * - Demihypercube symmetry group (D_n): Half-hypercubes and related forms
 *
 * @see https://en.wikipedia.org/wiki/Wythoff_construction
 * @see https://en.wikipedia.org/wiki/Uniform_polytope
 * @see https://en.wikipedia.org/wiki/Octahedral_symmetry
 */

import type { VectorND } from '@/lib/math'
import { createVector, dotProduct, subtractVectors, scaleVector } from '@/lib/math'
import type { PolytopeGeometry } from './types'

/**
 * Wythoff symbol specifies which vertices are "ringed" in the Coxeter-Dynkin diagram.
 */
export type WythoffSymbol = boolean[]

/**
 * Symmetry group type for Wythoff construction
 * - A: Simplex symmetry (An) - n! symmetry operations
 * - B: Hypercube/Orthoplex symmetry (Bn/Cn) - 2^n * n! symmetry operations
 * - D: Demihypercube symmetry (Dn) - 2^(n-1) * n! symmetry operations
 */
export type WythoffSymmetryGroup = 'A' | 'B' | 'D'

/**
 * Preset Wythoff polytope types with descriptive names
 */
export type WythoffPreset =
  | 'regular'        // Regular polytope (first node ringed)
  | 'rectified'      // Rectified (second node ringed)
  | 'truncated'      // Truncated (first two nodes ringed)
  | 'cantellated'    // Cantellated (first and third nodes ringed)
  | 'runcinated'     // Runcinated (first and last nodes ringed)
  | 'omnitruncated'  // All nodes ringed
  | 'custom'         // Custom Wythoff symbol

/**
 * Configuration for Wythoff polytope generation
 */
export interface WythoffPolytopeConfig {
  /** Symmetry group (A, B, or D) */
  symmetryGroup: WythoffSymmetryGroup
  /** Preset type or custom */
  preset: WythoffPreset
  /** Custom Wythoff symbol (only used when preset is 'custom') */
  customSymbol: boolean[]
  /** Scale factor for the polytope */
  scale: number
  /** Snub variant (alternated omnitruncation) - only for some configurations */
  snub: boolean
}

/**
 * Default Wythoff polytope configuration
 */
export const DEFAULT_WYTHOFF_POLYTOPE_CONFIG: WythoffPolytopeConfig = {
  symmetryGroup: 'B',
  preset: 'regular',
  customSymbol: [],
  scale: 2.0,
  snub: false,
}

/**
 * Get human-readable name for a Wythoff preset
 *
 * @param preset - The Wythoff preset type
 * @param symmetryGroup - The symmetry group (A, B, or D)
 * @param dimension - The dimension of the polytope
 * @returns Human-readable name for the configuration
 */
export function getWythoffPresetName(preset: WythoffPreset, symmetryGroup: WythoffSymmetryGroup, dimension: number): string {
  const baseNames: Record<WythoffPreset, string> = {
    regular: 'Regular',
    rectified: 'Rectified',
    truncated: 'Truncated',
    cantellated: 'Cantellated',
    runcinated: 'Runcinated',
    omnitruncated: 'Omnitruncated',
    custom: 'Custom',
  }

  const groupNames: Record<WythoffSymmetryGroup, string> = {
    A: 'Simplex',
    B: 'Hypercube',
    D: 'Demihypercube',
  }

  return `${baseNames[preset]} ${dimension}D ${groupNames[symmetryGroup]}`
}

/**
 * Result type for vertex/edge/face generation
 */
interface PolytopeData {
  vertices: VectorND[]
  edges: [number, number][]
  faces: number[][] // Each face is a list of vertex indices (triangles or quads)
}

/**
 * Generate all vertices of a hypercube {4,3,...,3} in n dimensions.
 * Vertices are at all combinations of ±1 in each coordinate.
 */
function generateHypercubeVertices(dimension: number): VectorND[] {
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
 */
function generateHypercubeData(dimension: number): PolytopeData {
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
 */
function generateCrossPolytopeVertices(dimension: number): VectorND[] {
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
 */
function generateSimplexVertices(dimension: number): VectorND[] {
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
 */
function generateSimplexData(dimension: number): PolytopeData {
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
 */
function generateRectifiedHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new Set<string>()
  
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
      
      const key = vertex.map(v => v.toFixed(6)).join(',')
      if (!seen.has(key)) {
        seen.add(key)
        vertices.push(vertex)
      }
    }
  }
  
  return vertices
}

/**
 * Generate triangular faces from edges by finding 3-cycles in the adjacency graph.
 */
function generateTriangleFacesFromEdges(vertices: VectorND[], edges: [number, number][]): number[][] {
  const adjacency = new Map<number, Set<number>>()
  
  // Build adjacency list
  for (const [v1, v2] of edges) {
    if (!adjacency.has(v1)) adjacency.set(v1, new Set())
    if (!adjacency.has(v2)) adjacency.set(v2, new Set())
    adjacency.get(v1)!.add(v2)
    adjacency.get(v2)!.add(v1)
  }
  
  const faces: number[][] = []
  const faceSet = new Set<string>()
  
  // Find all triangles
  for (let v1 = 0; v1 < vertices.length; v1++) {
    const neighbors = adjacency.get(v1)
    if (!neighbors || neighbors.size < 2) continue
    
    const neighborArray = Array.from(neighbors)
    for (let i = 0; i < neighborArray.length; i++) {
      for (let j = i + 1; j < neighborArray.length; j++) {
        const v2 = neighborArray[i]!
        const v3 = neighborArray[j]!
        
        // Check if v2 and v3 are connected
        if (adjacency.get(v2)?.has(v3)) {
          const sorted = [v1, v2, v3].sort((a, b) => a - b)
          const key = sorted.join(',')
          
          if (!faceSet.has(key)) {
            faceSet.add(key)
            faces.push([v1, v2, v3])
          }
        }
      }
    }
  }
  
  return faces
}

/**
 * Generate quad faces from edges by finding 4-cycles without diagonals.
 */
function generateQuadFacesFromEdges(vertices: VectorND[], edges: [number, number][]): number[][] {
  const adjacency = new Map<number, Set<number>>()
  
  // Build adjacency list
  for (const [v1, v2] of edges) {
    if (!adjacency.has(v1)) adjacency.set(v1, new Set())
    if (!adjacency.has(v2)) adjacency.set(v2, new Set())
    adjacency.get(v1)!.add(v2)
    adjacency.get(v2)!.add(v1)
  }
  
  const faces: number[][] = []
  const faceSet = new Set<string>()
  
  // Find all quads (4-cycles without diagonals)
  for (let v1 = 0; v1 < vertices.length; v1++) {
    const neighbors1 = adjacency.get(v1)
    if (!neighbors1 || neighbors1.size < 2) continue
    
    const n1Array = Array.from(neighbors1)
    
    for (const v2 of n1Array) {
      if (v2 <= v1) continue
      
      const neighbors2 = adjacency.get(v2)
      if (!neighbors2) continue
      
      for (const v3 of neighbors2) {
        if (v3 <= v1 || v3 === v2 || neighbors1.has(v3)) continue
        
        const neighbors3 = adjacency.get(v3)
        if (!neighbors3) continue
        
        for (const v4 of neighbors3) {
          if (v4 <= v1 || v4 === v2 || v4 === v3) continue
          
          // Check if v4 connects back to v1 and v4 is not connected to v2
          if (adjacency.get(v4)?.has(v1) && !adjacency.get(v4)?.has(v2)) {
            const sorted = [v1, v2, v3, v4].sort((a, b) => a - b)
            const key = sorted.join(',')
            
            if (!faceSet.has(key)) {
              faceSet.add(key)
              // Triangulate the quad
              faces.push([v1, v2, v3])
              faces.push([v1, v3, v4])
            }
          }
        }
      }
    }
  }
  
  return faces
}

/**
 * Generate truncated hypercube vertices.
 * Vertices are at positions like (±1, ±1, ..., ±(sqrt(2)-1)).
 */
function generateTruncatedHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new Set<string>()
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
      
      const key = vertex.map(v => v.toFixed(6)).join(',')
      if (!seen.has(key)) {
        seen.add(key)
        vertices.push(vertex)
      }
    }
  }
  
  return vertices
}

/**
 * Generate cantellated hypercube vertices (rhombicuboctahedron analog).
 */
function generateCantellatedHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new Set<string>()
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
        
        const key = vertex.map(v => v.toFixed(6)).join(',')
        if (!seen.has(key)) {
          seen.add(key)
          vertices.push(vertex)
        }
      }
    }
  }
  
  return vertices
}

/**
 * Generate omnitruncated hypercube vertices (truncated cuboctahedron analog).
 */
function generateOmnitruncatedHypercubeVertices(dimension: number): VectorND[] {
  const vertices: VectorND[] = []
  const seen = new Set<string>()
  
  // Omnitruncation produces all permutations of distinct coordinates
  // For n dimensions, use coordinates 1, 2, 3, ..., n
  const coords = Array.from({ length: dimension }, (_, i) => i + 1)
  
  // Generate all permutations using iterative approach
  function getPermutations(arr: number[]): number[][] {
    const results: number[][] = []
    
    function heapPermute(n: number, arr: number[]) {
      if (n === 1) {
        results.push([...arr])
        return
      }
      
      for (let i = 0; i < n; i++) {
        heapPermute(n - 1, arr)
        if (n % 2 === 0) {
          // Swap arr[i] and arr[n-1]
          const temp = arr[i]!
          arr[i] = arr[n - 1]!
          arr[n - 1] = temp
        } else {
          // Swap arr[0] and arr[n-1]
          const temp = arr[0]!
          arr[0] = arr[n - 1]!
          arr[n - 1] = temp
        }
      }
    }
    
    heapPermute(arr.length, [...arr])
    return results
  }
  
  const permutations = getPermutations(coords)
  
  // For each permutation, generate all sign combinations
  for (const perm of permutations) {
    const numSigns = Math.pow(2, dimension)
    for (let signConfig = 0; signConfig < numSigns; signConfig++) {
      const vertex = createVector(dimension, 0)
      for (let j = 0; j < dimension; j++) {
        const sign = (signConfig & (1 << j)) ? 1 : -1
        vertex[j] = sign * (perm[j] ?? 1)
      }
      
      const key = vertex.map(v => v.toFixed(6)).join(',')
      if (!seen.has(key)) {
        seen.add(key)
        vertices.push(vertex)
      }
    }
  }
  
  return vertices
}

/**
 * Generate runcinated hypercube vertices (first and last node ringed).
 */
function generateRuncinatedHypercubeVertices(dimension: number): VectorND[] {
  // Combine hypercube vertices with scaled versions
  const vertices: VectorND[] = []
  const seen = new Set<string>()
  
  // Original hypercube vertices
  const hypercube = generateHypercubeVertices(dimension)
  for (const v of hypercube) {
    const key = v.map(x => x.toFixed(6)).join(',')
    if (!seen.has(key)) {
      seen.add(key)
      vertices.push(v)
    }
  }
  
  // Cross-polytope vertices scaled
  const scale = 1 + Math.sqrt(2)
  const cross = generateCrossPolytopeVertices(dimension)
  for (const v of cross) {
    const scaled = scaleVector(v, scale)
    const key = scaled.map(x => x.toFixed(6)).join(',')
    if (!seen.has(key)) {
      seen.add(key)
      vertices.push(scaled)
    }
  }
  
  return vertices
}

/**
 * Generate half-hypercube (demihypercube) vertices.
 * Takes alternating vertices of the hypercube.
 */
function generateDemihypercubeVertices(dimension: number): VectorND[] {
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
 * Generate edges by connecting vertices within a distance threshold.
 * Finds the minimum distance and connects all pairs at that distance.
 *
 * @param vertices - Array of vertex positions
 * @returns Array of edge pairs (vertex indices)
 */
function generateEdgesByMinDistance(vertices: VectorND[]): [number, number][] {
  if (vertices.length < 2) return []

  // Find minimum pairwise distance
  let minDist = Infinity
  
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const diff = subtractVectors(vertices[i]!, vertices[j]!)
      const dist = Math.sqrt(dotProduct(diff, diff))
      if (dist > 1e-9 && dist < minDist) {
        minDist = dist
      }
    }
  }

  if (minDist === Infinity) return []

  // Find all edges at minimum distance (with small tolerance)
  const tolerance = 0.01
  const maxDist = minDist * (1 + tolerance)
  const edges: [number, number][] = []
  const edgeSet = new Set<string>()

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const diff = subtractVectors(vertices[i]!, vertices[j]!)
      const dist = Math.sqrt(dotProduct(diff, diff))

      if (dist <= maxDist) {
        const key = `${i}-${j}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push([i, j])
        }
      }
    }
  }

  return edges
}

/**
 * Center and scale the vertices to fit within [-scale, scale].
 *
 * @param vertices - Array of vertex positions
 * @param scale - Target scale
 * @returns Centered and scaled vertices
 */
function centerAndScale(vertices: VectorND[], scale: number): VectorND[] {
  if (vertices.length === 0) return []

  const dimension = vertices[0]!.length

  // Calculate centroid
  const centroid = createVector(dimension, 0)
  for (const vertex of vertices) {
    for (let i = 0; i < dimension; i++) {
      centroid[i] = (centroid[i] ?? 0) + (vertex[i] ?? 0)
    }
  }
  for (let i = 0; i < dimension; i++) {
    centroid[i] = (centroid[i] ?? 0) / vertices.length
  }

  // Center vertices
  const centered = vertices.map((v) => subtractVectors(v, centroid))

  // Find maximum extent
  let maxExtent = 0
  for (const vertex of centered) {
    for (let i = 0; i < dimension; i++) {
      maxExtent = Math.max(maxExtent, Math.abs(vertex[i] ?? 0))
    }
  }

  // Scale to fit
  if (maxExtent > 0) {
    const scaleFactor = scale / maxExtent
    return centered.map((v) => scaleVector(v, scaleFactor))
  }

  return centered
}

/**
 * Calculate maximum vertices based on dimension.
 *
 * @param dimension - The dimension of the polytope
 * @param _symmetryGroup - The symmetry group (unused, kept for API compatibility)
 * @returns Maximum number of vertices allowed
 */
function getMaxVertices(dimension: number, _symmetryGroup: WythoffSymmetryGroup): number {
  // Conservative limits to prevent memory issues
  const limits: Record<number, number> = {
    3: 500,
    4: 2000,
    5: 5000,
    6: 10000,
    7: 15000,
    8: 20000,
    9: 25000,
    10: 30000,
    11: 40000,
  }
  return limits[dimension] ?? 10000
}

/**
 * Maximum number of polytopes to keep in cache
 */
const MAX_CACHE_SIZE = 20;

/**
 * Cache for generated polytopes to avoid expensive regeneration
 */
const polytopeCache = new Map<string, PolytopeGeometry>();

/**
 * Generate a cache key for Wythoff polytope configuration
 */
function getCacheKey(dimension: number, config: WythoffPolytopeConfig): string {
  return JSON.stringify({
    d: dimension,
    s: config.symmetryGroup,
    p: config.preset,
    c: config.customSymbol,
    sc: config.scale,
    sn: config.snub
  });
}

/**
 * Generates a Wythoff polytope in n-dimensional space.
 *
 * The Wythoff construction creates uniform polytopes using the symmetry groups:
 * - A_n: Generates simplex-family polytopes
 * - B_n: Generates hypercube/cross-polytope family
 * - D_n: Generates demihypercube family
 *
 * @param dimension - Dimensionality of the space (3-11)
 * @param config - Configuration options
 * @returns PolytopeGeometry representing the Wythoff polytope
 * @throws {Error} If dimension is out of range
 *
 * @example
 * ```typescript
 * // Generate a truncated 4D hypercube
 * const polytope = generateWythoffPolytope(4, {
 *   symmetryGroup: 'B',
 *   preset: 'truncated',
 *   scale: 2.0,
 * });
 * ```
 */
export function generateWythoffPolytope(
  dimension: number,
  config: Partial<WythoffPolytopeConfig> = {}
): PolytopeGeometry {
  if (dimension < 3 || dimension > 11) {
    throw new Error(`Wythoff polytope dimension must be between 3 and 11 (got ${dimension})`)
  }

  const fullConfig: WythoffPolytopeConfig = {
    ...DEFAULT_WYTHOFF_POLYTOPE_CONFIG,
    ...config,
  }

  // Check cache
  const cacheKey = getCacheKey(dimension, fullConfig);
  if (polytopeCache.has(cacheKey)) {
    return polytopeCache.get(cacheKey)!;
  }

  const { symmetryGroup, preset, scale, snub } = fullConfig

  // Validate D_n symmetry requires dimension >= 4
  if (symmetryGroup === 'D' && dimension < 4) {
    throw new Error('D_n symmetry requires dimension >= 4')
  }

  let polytopeData: PolytopeData
  const maxVerts = getMaxVertices(dimension, symmetryGroup)

  // Generate vertices, edges, and faces based on symmetry group and preset
  switch (symmetryGroup) {
    case 'A':
      // Simplex symmetry - use analytical simplex generation
      polytopeData = generateSimplexData(dimension)
      break

    case 'B':
      // Hypercube/cross-polytope symmetry
      switch (preset) {
        case 'regular':
          // First node ringed = hypercube (analytical faces)
          polytopeData = generateHypercubeData(dimension)
          break
        case 'rectified':
          // Second node ringed = rectified hypercube
          // Uses edge-based triangle detection (cuboctahedron analog has triangular and quad faces)
          polytopeData = generateGenericPolytopeData(generateRectifiedHypercubeVertices(dimension), 'mixed')
          break
        case 'truncated':
          // First two nodes = truncated hypercube (has triangular and larger faces)
          polytopeData = generateGenericPolytopeData(generateTruncatedHypercubeVertices(dimension), 'mixed')
          break
        case 'cantellated':
          // First and third nodes = cantellated (rhombicuboctahedron analog)
          polytopeData = generateGenericPolytopeData(generateCantellatedHypercubeVertices(dimension), 'mixed')
          break
        case 'runcinated':
          // First and last nodes = runcinated
          polytopeData = generateGenericPolytopeData(generateRuncinatedHypercubeVertices(dimension), 'mixed')
          break
        case 'omnitruncated':
          // All nodes = omnitruncated - complex faces, use edge-based detection
          polytopeData = generateGenericPolytopeData(generateOmnitruncatedHypercubeVertices(dimension), 'quads')
          break
        case 'custom':
        default:
          // Default to hypercube for custom
          polytopeData = generateHypercubeData(dimension)
          break
      }
      break

    case 'D':
      // Demihypercube symmetry (requires dimension >= 4)
      // Demihypercube has triangular faces
      polytopeData = generateGenericPolytopeData(generateDemihypercubeVertices(dimension), 'triangles')
      break

    default:
      polytopeData = generateHypercubeData(dimension)
  }

  let { vertices, edges, faces } = polytopeData

  // Limit vertices if needed
  if (vertices.length > maxVerts) {
    vertices = vertices.slice(0, maxVerts)
    // Regenerate edges and faces for truncated vertex set
    const truncData = generateGenericPolytopeData(vertices, 'triangles')
    edges = truncData.edges
    faces = truncData.faces
  }

  // For snub variants, take alternating vertices
  if (snub && vertices.length > 4) {
    vertices = vertices.filter((_, i) => i % 2 === 0)
    const snubData = generateGenericPolytopeData(vertices, 'triangles')
    edges = snubData.edges
    faces = snubData.faces
  }

  // Center and scale
  vertices = centerAndScale(vertices, scale)

  const result: PolytopeGeometry = {
    vertices,
    edges,
    dimension,
    type: 'wythoff-polytope' as const,
    metadata: {
      name: getWythoffPresetName(preset, symmetryGroup, dimension),
      properties: {
        ...fullConfig,
        analyticalFaces: faces, // Store analytical faces for later use
      },
    },
  }

  // Update cache
  if (polytopeCache.size >= MAX_CACHE_SIZE) {
    // Simple eviction: remove the first key (oldest inserted in Map)
    const firstKey = polytopeCache.keys().next().value;
    if (firstKey) polytopeCache.delete(firstKey);
  }
  polytopeCache.set(cacheKey, result);

  return result;
}

/**
 * Generate generic polytope data using edge-based face detection.
 * Used for complex Wythoff presets where analytical generation is difficult.
 */
function generateGenericPolytopeData(
  vertices: VectorND[],
  faceType: 'triangles' | 'quads' | 'mixed'
): PolytopeData {
  const edges = generateEdgesByMinDistance(vertices)
  let faces: number[][]
  
  switch (faceType) {
    case 'triangles':
      faces = generateTriangleFacesFromEdges(vertices, edges)
      break
    case 'quads':
      faces = generateQuadFacesFromEdges(vertices, edges)
      break
    case 'mixed':
      // Try to find both triangles and quads
      const triangles = generateTriangleFacesFromEdges(vertices, edges)
      const quads = generateQuadFacesFromEdges(vertices, edges)
      faces = [...triangles, ...quads]
      break
    default:
      faces = generateTriangleFacesFromEdges(vertices, edges)
  }
  
  return { vertices, edges, faces }
}

/**
 * Get information about vertex and edge counts for a Wythoff polytope.
 *
 * @param dimension - The dimension
 * @param config - Configuration options
 * @returns Object with vertex and edge counts
 */
export function getWythoffPolytopeInfo(
  dimension: number,
  config: Partial<WythoffPolytopeConfig> = {}
): { vertexCount: number; edgeCount: number; name: string } {
  const fullConfig = { ...DEFAULT_WYTHOFF_POLYTOPE_CONFIG, ...config }
  const polytope = generateWythoffPolytope(dimension, fullConfig)

  return {
    vertexCount: polytope.vertices.length,
    edgeCount: polytope.edges.length,
    name: getWythoffPresetName(fullConfig.preset, fullConfig.symmetryGroup, dimension),
  }
}

