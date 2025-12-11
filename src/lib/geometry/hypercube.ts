/**
 * Hypercube (n-cube) generation
 * Generalization of a cube to n dimensions
 */

import type { VectorND } from '@/lib/math';
import { createVector } from '@/lib/math';
import type { PolytopeGeometry } from './types';

/**
 * Generates a hypercube in n-dimensional space
 *
 * A hypercube has:
 * - Vertices: 2^n (all combinations of ±1 in each coordinate)
 * - Edges: n * 2^(n-1) (connect vertices differing in exactly 1 coordinate)
 *
 * @param dimension - Dimensionality of the hypercube (must be >= 3)
 * @returns PolytopeGeometry representing the hypercube
 * @throws {Error} If dimension is less than 3
 */
export function generateHypercube(dimension: number): PolytopeGeometry {
  if (dimension < 3) {
    throw new Error('Hypercube dimension must be at least 3');
  }

  const vertices: VectorND[] = [];
  const vertexCount = Math.pow(2, dimension);

  // Generate all 2^n vertices (all combinations of ±1)
  for (let i = 0; i < vertexCount; i++) {
    const vertex = createVector(dimension);
    for (let j = 0; j < dimension; j++) {
      // Use bit j of i to determine sign
      vertex[j] = (i & (1 << j)) ? 1 : -1;
    }
    vertices.push(vertex);
  }

  // Generate edges: connect vertices that differ in exactly one coordinate
  const edges: [number, number][] = [];
  for (let i = 0; i < vertexCount; i++) {
    for (let j = i + 1; j < vertexCount; j++) {
      // Count how many coordinates differ
      let diffCount = 0;
      for (let k = 0; k < dimension; k++) {
        if (vertices[i]![k] !== vertices[j]![k]) {
          diffCount++;
        }
      }

      // Connect if exactly one coordinate differs
      if (diffCount === 1) {
        edges.push([i, j]);
      }
    }
  }

  return {
    vertices,
    edges,
    dimension,
    type: 'hypercube',
  };
}
