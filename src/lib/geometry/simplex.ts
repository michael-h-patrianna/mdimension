/**
 * Simplex (n-simplex) generation
 * Generalization of a tetrahedron to n dimensions
 */

import type { VectorND } from '@/lib/math';
import { createVector } from '@/lib/math';
import type { PolytopeGeometry } from './types';

/**
 * Generates a regular simplex in n-dimensional space
 *
 * A simplex has:
 * - Vertices: n+1 (forms a complete graph)
 * - Edges: (n+1)*n/2 (all pairs of vertices are connected)
 *
 * Construction uses standard simplex vertices then centers and normalizes:
 * - v_0 = origin
 * - v_i = unit vector along axis i (for i = 1 to n)
 * - Center at origin and scale to fit in [-1, 1]
 *
 * @param dimension - Dimensionality of the space (must be >= 3)
 * @returns PolytopeGeometry representing the simplex
 * @throws {Error} If dimension is less than 3
 */
export function generateSimplex(dimension: number): PolytopeGeometry {
  if (dimension < 3) {
    throw new Error('Simplex dimension must be at least 3');
  }

  const vertexCount = dimension + 1;
  const vertices: VectorND[] = [];

  // Generate standard simplex vertices
  // First vertex at origin
  vertices.push(createVector(dimension, 0));

  // Remaining vertices along each axis
  for (let i = 0; i < dimension; i++) {
    const vertex = createVector(dimension, 0);
    vertex[i] = 1;
    vertices.push(vertex);
  }

  // Calculate centroid
  const centroid = createVector(dimension, 0);
  for (const vertex of vertices) {
    for (let i = 0; i < dimension; i++) {
      centroid[i]! += vertex[i]!;
    }
  }
  for (let i = 0; i < dimension; i++) {
    centroid[i]! /= vertexCount;
  }

  // Center vertices at origin
  for (let i = 0; i < vertices.length; i++) {
    for (let j = 0; j < dimension; j++) {
      vertices[i]![j]! -= centroid[j]!;
    }
  }

  // Find max coordinate value for normalization
  let maxCoord = 0;
  for (const vertex of vertices) {
    for (const coord of vertex) {
      maxCoord = Math.max(maxCoord, Math.abs(coord));
    }
  }

  // Normalize to fit in [-1, 1]
  if (maxCoord > 0) {
    for (const vertex of vertices) {
      for (let i = 0; i < dimension; i++) {
        vertex[i]! /= maxCoord;
      }
    }
  }

  // Generate edges: connect all pairs (complete graph)
  const edges: [number, number][] = [];
  for (let i = 0; i < vertexCount; i++) {
    for (let j = i + 1; j < vertexCount; j++) {
      edges.push([i, j]);
    }
  }

  return {
    vertices,
    edges,
    dimension,
    type: 'simplex',
  };
}
