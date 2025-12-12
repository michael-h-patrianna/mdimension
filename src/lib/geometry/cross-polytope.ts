/**
 * Cross-polytope (n-orthoplex) generation
 * Generalization of an octahedron to n dimensions
 */

import type { VectorND } from '@/lib/math';
import { createVector } from '@/lib/math';
import type { PolytopeGeometry } from './types';

/**
 * Generates a cross-polytope in n-dimensional space
 *
 * A cross-polytope has:
 * - Vertices: 2n (±scale along each axis)
 * - Edges: 2n(n-1) (connect vertices NOT on the same axis)
 *
 * For 2D, this generates a diamond (square rotated 45°) with 4 vertices at
 * (±1, 0) and (0, ±1), and 4 edges.
 *
 * @param dimension - Dimensionality of the cross-polytope (must be >= 2)
 * @param scale - Scale factor for vertex coordinates (default: 1.0)
 * @returns PolytopeGeometry representing the cross-polytope
 * @throws {Error} If dimension is less than 2
 */
export function generateCrossPolytope(dimension: number, scale = 1.0): PolytopeGeometry {
  if (dimension < 2) {
    throw new Error('Cross-polytope dimension must be at least 2');
  }

  const vertices: VectorND[] = [];

  // Generate 2n vertices: ±scale along each axis
  for (let axis = 0; axis < dimension; axis++) {
    // Positive vertex
    const posVertex = createVector(dimension, 0);
    posVertex[axis] = scale;
    vertices.push(posVertex);

    // Negative vertex
    const negVertex = createVector(dimension, 0);
    negVertex[axis] = -scale;
    vertices.push(negVertex);
  }

  // Generate edges: connect vertices NOT on the same axis
  const edges: [number, number][] = [];
  const vertexCount = 2 * dimension;

  for (let i = 0; i < vertexCount; i++) {
    for (let j = i + 1; j < vertexCount; j++) {
      // Determine which axes these vertices are on
      const axisI = Math.floor(i / 2);
      const axisJ = Math.floor(j / 2);

      // Connect if on different axes
      if (axisI !== axisJ) {
        edges.push([i, j]);
      }
    }
  }

  return {
    vertices,
    edges,
    dimension,
    type: 'cross-polytope',
  };
}
