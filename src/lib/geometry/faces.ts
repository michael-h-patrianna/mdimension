/**
 * Face detection for n-dimensional polytopes
 *
 * Detects 2D faces (polygons) from edge lists by building adjacency graphs
 * and finding cycles of length 3-4 that form closed polygons.
 */

import type { Vector3D, VectorND } from '@/lib/math/types';
import { crossProduct3D, dotProduct, subtractVectors } from '@/lib/math';
import type { GeometryMetadata, ObjectType } from './types';
import { generateHypercubeFaces } from './hypercube';
import { computeConvexHullFaces } from './extended/utils/convex-hull-faces';
import {
  buildTorus3DGridFaces,
  buildCliffordTorusGridFaces,
  buildGeneralizedCliffordTorusFaces,
  buildHopfTorus4DFaces,
  buildTorus5DFaces,
  buildTorus6DFaces,
  buildTorus7DFaces,
  buildHopfTorus8DFaces,
  buildTorus9DFaces,
  buildTorus10DFaces,
  buildTorus11DFaces,
} from './extended/clifford-torus';

/**
 * Represents a 2D face (polygon) of a polytope
 */
export interface Face {
  /** Vertex indices forming the face (3 for triangle, 4 for quad) */
  vertices: number[];
  /** Optional computed normal vector in 3D */
  normal?: Vector3D;
}

/**
 * Adjacency list representation for graph traversal
 */
type AdjacencyList = Map<number, Set<number>>;

/**
 * Builds an adjacency list from edge pairs
 *
 * Creates a bidirectional graph where each vertex maps to its connected neighbors.
 *
 * @param edges - Array of edge pairs (vertex index tuples)
 * @returns Adjacency list mapping vertex indices to their neighbors
 *
 * @example
 * ```typescript
 * const edges: [number, number][] = [[0, 1], [1, 2], [2, 0]];
 * const adj = buildAdjacencyList(edges);
 * // adj.get(0) => Set(1, 2)
 * // adj.get(1) => Set(0, 2)
 * ```
 */
function buildAdjacencyList(edges: [number, number][]): AdjacencyList {
  const adjacency: AdjacencyList = new Map();

  for (const [v1, v2] of edges) {
    if (!adjacency.has(v1)) {
      adjacency.set(v1, new Set());
    }
    if (!adjacency.has(v2)) {
      adjacency.set(v2, new Set());
    }
    adjacency.get(v1)!.add(v2);
    adjacency.get(v2)!.add(v1);
  }

  return adjacency;
}

/**
 * Finds all triangular faces (3-cycles) in the graph
 *
 * Searches for all unique triangles where each pair of vertices is connected.
 * Returns vertices in consistent order (sorted).
 *
 * @param adjacency - Adjacency list representing the graph
 * @param vertexCount - Total number of vertices in the polytope
 * @returns Array of triangular faces
 *
 * @example
 * ```typescript
 * const adj = buildAdjacencyList([[0, 1], [1, 2], [2, 0]]);
 * const triangles = findTriangles(adj, 3);
 * // triangles = [{ vertices: [0, 1, 2] }]
 * ```
 */
function findTriangles(adjacency: AdjacencyList, vertexCount: number): Face[] {
  const faces: Face[] = [];
  const faceSet = new Set<string>();

  // Find all triangles: for each vertex v1, check if any two neighbors are also connected
  for (let v1 = 0; v1 < vertexCount; v1++) {
    const neighbors = adjacency.get(v1);
    if (!neighbors || neighbors.size < 2) continue;

    const neighborArray = Array.from(neighbors);

    // Check all pairs of neighbors
    for (let i = 0; i < neighborArray.length; i++) {
      for (let j = i + 1; j < neighborArray.length; j++) {
        const v2 = neighborArray[i]!;
        const v3 = neighborArray[j]!;

        // Check if v2 and v3 are connected
        if (adjacency.get(v2)?.has(v3)) {
          // Use sorted key for deduplication only
          const sortedKey = [v1, v2, v3].sort((a, b) => a - b).join(',');

          if (!faceSet.has(sortedKey)) {
            faceSet.add(sortedKey);
            // Store vertices in winding order: v1 -> v2 -> v3 -> v1
            // This preserves the cycle order for proper triangulation
            faces.push({ vertices: [v1, v2, v3] });
          }
        }
      }
    }
  }

  return faces;
}

/**
 * Finds all quadrilateral faces (4-cycles) in the graph
 *
 * Searches for all unique quads where vertices form a closed loop.
 * Uses depth-first search to find 4-cycles efficiently.
 *
 * @param adjacency - Adjacency list representing the graph
 * @param vertices - Array of vertex positions for planarity checking
 * @param vertexCount - Total number of vertices in the polytope
 * @returns Array of quadrilateral faces
 *
 * @example
 * ```typescript
 * const edges = [[0,1], [1,2], [2,3], [3,0]];
 * const adj = buildAdjacencyList(edges);
 * const quads = findQuads(adj, vertices, 4);
 * // quads = [{ vertices: [0, 1, 2, 3] }]
 * ```
 *
 * @remarks
 * This implementation finds simple 4-cycles by checking if four vertices
 * form a closed loop where each consecutive pair is connected.
 */
export function findQuads(
  adjacency: AdjacencyList,
  vertices: number[][],
  vertexCount: number
): Face[] {
  const faces: Face[] = [];
  const faceSet = new Set<string>();

  // Find all quads by checking 4-vertex cycles
  for (let v1 = 0; v1 < vertexCount; v1++) {
    const neighbors1 = adjacency.get(v1);
    if (!neighbors1 || neighbors1.size < 2) continue;

    const n1Array = Array.from(neighbors1);

    for (let i = 0; i < n1Array.length; i++) {
      const v2 = n1Array[i]!;
      if (v2 <= v1) continue; // Avoid duplicates

      const neighbors2 = adjacency.get(v2);
      if (!neighbors2) continue;

      for (const v3 of neighbors2) {
        if (v3 <= v1 || v3 === v2) continue; // Avoid duplicates and self

        const neighbors3 = adjacency.get(v3);
        if (!neighbors3) continue;

        for (const v4 of neighbors3) {
          if (v4 <= v1 || v4 === v2 || v4 === v3) continue;

          // Check if v4 connects back to v1 to complete the quad
          if (adjacency.get(v4)?.has(v1)) {
            // Found a potential quad: v1-v2-v3-v4-v1
            // Verify it's a proper quad (not just a 4-cycle with diagonals)
            const hasDiagonal1 = adjacency.get(v1)?.has(v3);
            const hasDiagonal2 = adjacency.get(v2)?.has(v4);

            // For a proper quad face, we don't want diagonals
            if (!hasDiagonal1 && !hasDiagonal2) {
              // Use sorted key for deduplication only
              const sortedKey = [v1, v2, v3, v4].sort((a, b) => a - b).join(',');

              if (!faceSet.has(sortedKey)) {
                // Store vertices in winding order: v1 -> v2 -> v3 -> v4 -> v1
                // This preserves the perimeter walk for proper triangulation
                const windingOrder = [v1, v2, v3, v4];

                // Additional planarity check for quads
                if (isCoplanarQuad(windingOrder, vertices)) {
                  faceSet.add(sortedKey);
                  faces.push({ vertices: windingOrder });
                }
              }
            }
          }
        }
      }
    }
  }

  return faces;
}

/**
 * Extracts the first 3 coordinates of a vertex as a 3D vector
 * @param v - N-dimensional vertex
 * @returns 3D vector [x, y, z]
 */
function to3D(v: number[]): VectorND {
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
}

/**
 * Checks if four vertices form a planar quadrilateral
 *
 * Verifies that all four vertices lie in the same plane by checking
 * if the fourth vertex lies in the plane defined by the first three.
 *
 * For 3D: Uses the scalar triple product: if (e1 × e2) · e3 ≈ 0, points are coplanar.
 * For N-D: Checks if e3 lies in the span of {e1, e2} using orthogonal projection.
 *
 * @param vertexIndices - Array of 4 vertex indices
 * @param vertices - Array of all vertex positions
 * @returns True if the quad is coplanar (within epsilon)
 */
function isCoplanarQuad(vertexIndices: number[], vertices: number[][]): boolean {
  if (vertexIndices.length !== 4) return false;

  const [i0, i1, i2, i3] = vertexIndices;
  const v0 = vertices[i0!];
  const v1 = vertices[i1!];
  const v2 = vertices[i2!];
  const v3 = vertices[i3!];

  if (!v0 || !v1 || !v2 || !v3) return false;

  // Get the minimum dimension across all vertices
  const dim = Math.min(v0.length, v1.length, v2.length, v3.length);

  // For 3D, use library functions for clarity and efficiency
  if (dim === 3) {
    // Create edge vectors from v0 to other points (first 3 coords only)
    const p0 = to3D(v0);
    const e1 = subtractVectors(to3D(v1), p0);
    const e2 = subtractVectors(to3D(v2), p0);
    const e3 = subtractVectors(to3D(v3), p0);

    // Compute normal via cross product, then check if e3 is perpendicular
    const normal = crossProduct3D(e1, e2);
    const scalarTripleProduct = dotProduct(normal, e3);

    return Math.abs(scalarTripleProduct) < 1e-6;
  }

  // For N-D: Check if edge vectors e1, e2, e3 have rank ≤ 2
  // (i.e., e3 lies in the span of {e1, e2})
  // Uses Gram-Schmidt orthogonalization to project e3 onto span{e1, e2}
  return isCoplanarND(v0, v1, v2, v3);
}

/**
 * N-dimensional coplanarity check using Gram-Schmidt projection
 *
 * Four points are coplanar if the three edge vectors from v0 to v1, v2, v3
 * span at most a 2D subspace. This is verified by:
 * 1. Orthonormalizing e1, e2 to form basis {u1, u2}
 * 2. Projecting e3 onto span{u1, u2}
 * 3. Checking if the residual (orthogonal component) is near zero
 *
 * @param v0 - First vertex (reference point)
 * @param v1 - Second vertex
 * @param v2 - Third vertex
 * @param v3 - Fourth vertex
 * @returns True if all four points are coplanar
 */
function isCoplanarND(
  v0: number[],
  v1: number[],
  v2: number[],
  v3: number[]
): boolean {
  const dim = v0.length;
  const epsilon = 1e-6;

  // Compute edge vectors e1 = v1 - v0, e2 = v2 - v0, e3 = v3 - v0
  const e1 = new Array(dim);
  const e2 = new Array(dim);
  const e3 = new Array(dim);

  for (let i = 0; i < dim; i++) {
    e1[i] = (v1[i] ?? 0) - (v0[i] ?? 0);
    e2[i] = (v2[i] ?? 0) - (v0[i] ?? 0);
    e3[i] = (v3[i] ?? 0) - (v0[i] ?? 0);
  }

  // Gram-Schmidt: orthonormalize e1, e2
  // u1 = normalize(e1)
  let norm1Sq = 0;
  for (let i = 0; i < dim; i++) {
    norm1Sq += e1[i] * e1[i];
  }

  // Degenerate case: e1 is zero vector
  if (norm1Sq < epsilon * epsilon) {
    return true; // Points v0, v1 coincide - trivially coplanar
  }

  const invNorm1 = 1 / Math.sqrt(norm1Sq);
  const u1 = e1.map((x: number) => x * invNorm1);

  // e2_perp = e2 - (e2 · u1) * u1
  let e2DotU1 = 0;
  for (let i = 0; i < dim; i++) {
    e2DotU1 += e2[i] * u1[i];
  }

  const e2Perp = new Array(dim);
  for (let i = 0; i < dim; i++) {
    e2Perp[i] = e2[i] - e2DotU1 * u1[i];
  }

  // u2 = normalize(e2_perp)
  let norm2Sq = 0;
  for (let i = 0; i < dim; i++) {
    norm2Sq += e2Perp[i] * e2Perp[i];
  }

  // If e2_perp is near zero, e1 and e2 are parallel (1D span)
  // In this case, we need to check if e3 is also in the same direction
  if (norm2Sq < epsilon * epsilon) {
    // e1 and e2 are parallel; check if e3 is parallel to e1
    // e3_perp = e3 - (e3 · u1) * u1
    let e3DotU1 = 0;
    for (let i = 0; i < dim; i++) {
      e3DotU1 += e3[i] * u1[i];
    }
    let e3PerpNormSq = 0;
    for (let i = 0; i < dim; i++) {
      const comp = e3[i] - e3DotU1 * u1[i];
      e3PerpNormSq += comp * comp;
    }
    // Coplanar if e3 is also in the 1D span (collinear)
    return e3PerpNormSq < epsilon * epsilon * norm1Sq;
  }

  const invNorm2 = 1 / Math.sqrt(norm2Sq);
  const u2 = e2Perp.map((x: number) => x * invNorm2);

  // Project e3 onto span{u1, u2} and compute residual
  // projection = (e3 · u1) * u1 + (e3 · u2) * u2
  // residual = e3 - projection
  let e3DotU1 = 0;
  let e3DotU2 = 0;
  for (let i = 0; i < dim; i++) {
    e3DotU1 += e3[i] * u1[i];
    e3DotU2 += e3[i] * u2[i];
  }

  // Compute ||e3 - projection||² = ||e3||² - (e3·u1)² - (e3·u2)²
  let e3NormSq = 0;
  for (let i = 0; i < dim; i++) {
    e3NormSq += e3[i] * e3[i];
  }

  const residualSq = e3NormSq - e3DotU1 * e3DotU1 - e3DotU2 * e3DotU2;

  // Points are coplanar if residual is small relative to edge lengths
  // Use relative tolerance based on the maximum edge length
  const maxEdgeLengthSq = Math.max(norm1Sq, norm2Sq, e3NormSq);

  return residualSq < epsilon * epsilon * maxEdgeLengthSq;
}

/**
 * Detects 2D faces (polygons) from an edge list of a polytope
 *
 * Analyzes the connectivity graph of a polytope and identifies all 2D faces.
 * The algorithm:
 * 1. Builds an adjacency graph from edges
 * 2. For simplices and cross-polytopes: finds all triangles (3-cycles)
 * 3. For hypercubes: finds all quads (4-cycles)
 * 4. Returns face definitions as vertex index arrays
 *
 * @param vertices - Array of vertex positions in n-dimensional space
 * @param edges - Array of edge pairs (vertex indices)
 * @param objectType - Type of object (determines face finding strategy)
 * @returns Array of detected faces with vertex indices
 *
 * @throws {Error} If vertices or edges array is empty
 * @throws {Error} If edge indices reference non-existent vertices
 *
 * @example
 * ```typescript
 * // Detect faces of a 3D cube
 * const cube = generateHypercube(3);
 * const faces = detectFaces(cube.vertices, cube.edges, 'hypercube');
 * console.log(faces.length); // 6 faces
 *
 * // Detect faces of a tetrahedron
 * const tetrahedron = generateSimplex(3);
 * const faces = detectFaces(tetrahedron.vertices, tetrahedron.edges, 'simplex');
 * console.log(faces.length); // 4 triangular faces
 *
 * // Detect faces of a root system
 * const rootSystem = generateRootSystem(4, config);
 * const faces = detectFaces(rootSystem.vertices, rootSystem.edges, 'root-system');
 * ```
 *
 * @remarks
 * - Hypercube: All faces are quads (4 vertices)
 * - Simplex: All faces are triangles (3 vertices)
 * - Cross-polytope: All faces are triangles (3 vertices)
 * - Root-system: Triangular faces from short-edge connections
 * - Clifford-torus: Quad faces from u/v grid (requires metadata for resolution)
 * - Other extended objects: No faces (point clouds)
 *
 * The algorithm uses cycle detection in the connectivity graph.
 * For hypercubes, it specifically looks for 4-cycles without diagonals.
 * For simplices, cross-polytopes, and root-systems, it finds all 3-cycles (triangles).
 * For clifford-torus, analytical face generation from the u/v grid structure.
 */
export function detectFaces(
  vertices: number[][],
  edges: [number, number][],
  objectType: ObjectType,
  metadata?: GeometryMetadata
): Face[] {
  // Validate inputs
  if (vertices.length === 0) {
    throw new Error('Vertices array cannot be empty');
  }

  if (edges.length === 0) {
    throw new Error('Edges array cannot be empty');
  }

  // Validate edge indices
  for (const [v1, v2] of edges) {
    if (v1 < 0 || v1 >= vertices.length || v2 < 0 || v2 >= vertices.length) {
      throw new Error(`Edge [${v1}, ${v2}] references non-existent vertex`);
    }
  }

  // Build adjacency list
  const adjacency = buildAdjacencyList(edges);

  // Detect faces based on object type
  if (objectType === 'hypercube') {
    // Hypercubes have quadrilateral faces - use optimized analytical generation
    const faceIndices = generateHypercubeFaces(Math.log2(vertices.length));
    return faceIndices.map(indices => ({ vertices: indices }));
  } else if (objectType === 'simplex' || objectType === 'cross-polytope') {
    // Simplices and cross-polytopes have triangular faces
    return findTriangles(adjacency, vertices.length);
  } else if (objectType === 'root-system') {
    // Root systems use convex hull for proper face detection
    // This handles the complex face structure of root polytopes (A_n, D_n, E_8)
    const hullFaces = computeConvexHullFaces(vertices);
    return hullFaces.map(([v0, v1, v2]) => ({ vertices: [v0, v1, v2] }));
  } else if (objectType === 'clifford-torus') {
    // Clifford torus faces require metadata for resolution info
    if (!metadata?.properties) {
      return [];
    }

    const props = metadata.properties;
    const visualizationMode = props.visualizationMode as string | undefined;
    const mode = props.mode as string;

    let faceIndices: number[][] = [];

    // First check for new visualization modes
    if (visualizationMode === 'nested') {
      // Nested mode - all dimensions use same 2D grid structure
      const dimension = props.intrinsicDimension as number;
      const resXi1 = props.resolutionXi1 as number;
      const resXi2 = props.resolutionXi2 as number;

      switch (dimension) {
        case 4: {
          const torusCount = props.torusCount as number ?? 1;
          // Generate faces for each nested torus
          for (let t = 0; t < torusCount; t++) {
            const offset = t * resXi1 * resXi2;
            const torusFaces = buildHopfTorus4DFaces(resXi1, resXi2, offset);
            faceIndices = faceIndices.concat(torusFaces);
          }
          break;
        }
        case 5:
          faceIndices = buildTorus5DFaces(resXi1, resXi2);
          break;
        case 6:
          faceIndices = buildTorus6DFaces(resXi1, resXi2);
          break;
        case 7:
          faceIndices = buildTorus7DFaces(resXi1, resXi2);
          break;
        case 8:
          faceIndices = buildHopfTorus8DFaces(resXi1, resXi2);
          break;
        case 9:
          faceIndices = buildTorus9DFaces(resXi1, resXi2);
          break;
        case 10:
          faceIndices = buildTorus10DFaces(resXi1, resXi2);
          break;
        case 11:
          faceIndices = buildTorus11DFaces(resXi1, resXi2);
          break;
      }
    } else {
      // Flat mode or legacy mode - check internal mode
      if (mode === '3d-torus') {
        const resU = props.resolutionU as number;
        const resV = props.resolutionV as number;
        faceIndices = buildTorus3DGridFaces(resU, resV);
      } else if (mode === 'classic') {
        const resU = props.resolutionU as number;
        const resV = props.resolutionV as number;
        faceIndices = buildCliffordTorusGridFaces(resU, resV);
      } else if (mode === 'generalized') {
        const k = props.k as number;
        const stepsPerCircle = props.stepsPerCircle as number;
        faceIndices = buildGeneralizedCliffordTorusFaces(k, stepsPerCircle);
      }
    }

    return faceIndices.map(indices => ({ vertices: indices }));
  } else {
    // Extended objects don't have faces (point clouds)
    return [];
  }
}
