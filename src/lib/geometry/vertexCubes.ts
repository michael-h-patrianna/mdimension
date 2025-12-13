/**
 * Vertex Cube Geometry Generator
 *
 * Generates small N-dimensional cubes at each vertex position for rendering
 * vertex markers using the GPU shader pipeline.
 */

import type { VectorND } from '@/lib/math/types';
import type { Face } from './faces';

/**
 * Generated geometry for vertex cubes
 */
export interface VertexCubeGeometry {
  /** 8 corners per input vertex, in N-D space */
  vertices: VectorND[];
  /** 12 edges per cube as index pairs */
  edges: [number, number][];
  /** 6 faces per cube (each face is a quad split into 2 triangles) */
  faces: Face[];
}

/**
 * 3D cube corner offsets (unit cube centered at origin)
 * Order: -X-Y-Z, +X-Y-Z, -X+Y-Z, +X+Y-Z, -X-Y+Z, +X-Y+Z, -X+Y+Z, +X+Y+Z
 */
const CUBE_CORNER_OFFSETS: [number, number, number][] = [
  [-1, -1, -1], // 0
  [+1, -1, -1], // 1
  [-1, +1, -1], // 2
  [+1, +1, -1], // 3
  [-1, -1, +1], // 4
  [+1, -1, +1], // 5
  [-1, +1, +1], // 6
  [+1, +1, +1], // 7
];

/**
 * Cube edges as pairs of corner indices
 * 12 edges total: 4 bottom, 4 top, 4 vertical
 */
const CUBE_EDGE_INDICES: [number, number][] = [
  // Bottom face edges
  [0, 1], [1, 3], [3, 2], [2, 0],
  // Top face edges
  [4, 5], [5, 7], [7, 6], [6, 4],
  // Vertical edges
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/**
 * Cube faces as quads (4 vertex indices each)
 * Each quad will be split into 2 triangles
 * Winding order: counter-clockwise when viewed from outside
 */
const CUBE_FACE_QUADS: [number, number, number, number][] = [
  [0, 2, 3, 1], // -Z face (front)
  [4, 5, 7, 6], // +Z face (back)
  [0, 1, 5, 4], // -Y face (bottom)
  [2, 6, 7, 3], // +Y face (top)
  [0, 4, 6, 2], // -X face (left)
  [1, 3, 7, 5], // +X face (right)
];

/**
 * Generate N-dimensional cube geometry at each vertex position.
 *
 * Each cube is created by adding XYZ offsets to the base vertex while
 * keeping higher dimensions unchanged. This ensures cubes transform
 * correctly under N-D rotation.
 *
 * @param baseVertices - The polytope vertex positions in N-D space
 * @param halfSize - Half the cube edge length
 * @param dimension - Current dimension of the space
 * @returns Cube vertices, edges, and faces for all vertex markers
 */
export function generateVertexCubes(
  baseVertices: VectorND[],
  halfSize: number,
  dimension: number
): VertexCubeGeometry {
  const numBaseVertices = baseVertices.length;
  const vertices: VectorND[] = [];
  const edges: [number, number][] = [];
  const faces: Face[] = [];

  for (let v = 0; v < numBaseVertices; v++) {
    const baseVertex = baseVertices[v]!;
    const baseIndex = v * 8; // 8 corners per cube

    // Generate 8 cube corners
    for (const [dx, dy, dz] of CUBE_CORNER_OFFSETS) {
      const corner: number[] = new Array(dimension);
      // First 3 dimensions get the cube offset
      corner[0] = (baseVertex[0] ?? 0) + dx * halfSize;
      corner[1] = (baseVertex[1] ?? 0) + dy * halfSize;
      corner[2] = (baseVertex[2] ?? 0) + dz * halfSize;
      // Higher dimensions match the base vertex exactly
      for (let d = 3; d < dimension; d++) {
        corner[d] = baseVertex[d] ?? 0;
      }
      vertices.push(corner as VectorND);
    }

    // Generate 12 edges for this cube
    for (const [a, b] of CUBE_EDGE_INDICES) {
      edges.push([baseIndex + a, baseIndex + b]);
    }

    // Generate 6 faces (12 triangles) for this cube
    for (const [a, b, c, d] of CUBE_FACE_QUADS) {
      // Split quad into 2 triangles
      faces.push({ vertices: [baseIndex + a, baseIndex + b, baseIndex + c] });
      faces.push({ vertices: [baseIndex + a, baseIndex + c, baseIndex + d] });
    }
  }

  return { vertices, edges, faces };
}

/**
 * Calculate the number of vertices for vertex cubes
 */
export function getVertexCubeVertexCount(baseVertexCount: number): number {
  return baseVertexCount * 8;
}

/**
 * Calculate the number of edges for vertex cubes
 */
export function getVertexCubeEdgeCount(baseVertexCount: number): number {
  return baseVertexCount * 12;
}

/**
 * Calculate the number of faces (triangles) for vertex cubes
 */
export function getVertexCubeFaceCount(baseVertexCount: number): number {
  return baseVertexCount * 12; // 6 quads * 2 triangles each
}
