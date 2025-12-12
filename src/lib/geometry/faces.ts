/**
 * Face detection for n-dimensional polytopes
 *
 * Detects 2D faces (polygons) from edge lists by building adjacency graphs
 * and finding cycles of length 3-4 that form closed polygons.
 */

import type { Vector3D } from '@/lib/math/types';
import type { PolytopeType } from './types';
import { generateHypercubeFaces } from './hypercube';

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
 * Checks if four vertices form a planar quadrilateral
 *
 * Verifies that all four vertices lie in the same plane by checking
 * if the fourth vertex lies in the plane defined by the first three.
 *
 * @param vertexIndices - Array of 4 vertex indices
 * @param vertices - Array of all vertex positions
 * @returns True if the quad is coplanar (within epsilon)
 *
 * @remarks
 * Uses the scalar triple product to check if the fourth point
 * lies in the plane of the first three points.
 */
function isCoplanarQuad(vertexIndices: number[], vertices: number[][]): boolean {
  if (vertexIndices.length !== 4) return false;

  const [i0, i1, i2, i3] = vertexIndices;
  const v0 = vertices[i0!];
  const v1 = vertices[i1!];
  const v2 = vertices[i2!];
  const v3 = vertices[i3!];

  if (!v0 || !v1 || !v2 || !v3) return false;

  // Get the minimum dimension (handle both 3D and higher dimensions)
  const dim = Math.min(v0.length, v1.length, v2.length, v3.length, 3);

  // Create vectors from v0 to other points (using only first 3 coords)
  const e1 = Array(dim).fill(0).map((_, i) => v1[i]! - v0[i]!);
  const e2 = Array(dim).fill(0).map((_, i) => v2[i]! - v0[i]!);
  const e3 = Array(dim).fill(0).map((_, i) => v3[i]! - v0[i]!);

  // For 3D, compute cross product e1 × e2
  if (dim === 3) {
    const normal = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];

    // Dot product with e3 should be ~0 if coplanar
    const dotProduct = normal[0]! * e3[0]! + normal[1]! * e3[1]! + normal[2]! * e3[2]!;
    return Math.abs(dotProduct) < 1e-6;
  }

  // For higher dimensions, assume coplanar (simplified check)
  return true;
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
 * @param objectType - Type of polytope (determines face finding strategy)
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
 * ```
 *
 * @remarks
 * - Hypercube: All faces are quads (4 vertices)
 * - Simplex: All faces are triangles (3 vertices)
 * - Cross-polytope: All faces are triangles (3 vertices)
 *
 * The algorithm uses cycle detection in the connectivity graph.
 * For hypercubes, it specifically looks for 4-cycles without diagonals.
 * For simplices and cross-polytopes, it finds all 3-cycles (triangles).
 */
export function detectFaces(
  vertices: number[][],
  edges: [number, number][],
  objectType: PolytopeType
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
  } else {
    // Simplices and cross-polytopes have triangular faces
    return findTriangles(adjacency, vertices.length);
  }
}
