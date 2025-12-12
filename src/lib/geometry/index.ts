/**
 * N-Dimensional Polytope Geometry Library
 *
 * Provides generators for standard n-dimensional geometric objects:
 * - Hypercube (n-cube): generalization of cube
 * - Simplex (n-simplex): generalization of tetrahedron
 * - Cross-polytope (n-orthoplex): generalization of octahedron
 */

// Type exports
export type { PolytopeType, PolytopeGeometry, PolytopeProperties } from './types';
export type { CrossSectionResult } from './cross-section';
export type { Face } from './faces';

// Generator exports
export { generateHypercube } from './hypercube';
export { generateSimplex } from './simplex';
export { generateCrossPolytope } from './cross-polytope';

// Face detection exports
export { detectFaces } from './faces';

// Cross-section exports
export {
  computeCrossSection,
  projectCrossSectionTo3D,
  getWRange,
} from './cross-section';

import type { PolytopeType, PolytopeGeometry, PolytopeProperties } from './types';
import { generateHypercube } from './hypercube';
import { generateSimplex } from './simplex';
import { generateCrossPolytope } from './cross-polytope';

/**
 * Generates a polytope of the specified type and dimension
 *
 * @param type - Type of polytope to generate
 * @param dimension - Dimensionality (must be >= 3)
 * @returns PolytopeGeometry representing the polytope
 * @throws {Error} If dimension is less than 3 or type is invalid
 */
export function generatePolytope(type: PolytopeType, dimension: number): PolytopeGeometry {
  switch (type) {
    case 'hypercube':
      return generateHypercube(dimension);
    case 'simplex':
      return generateSimplex(dimension);
    case 'cross-polytope':
      return generateCrossPolytope(dimension);
    default:
      throw new Error(`Unknown polytope type: ${type}`);
  }
}

/**
 * Calculates mathematical properties of a polytope geometry
 *
 * @param geometry - Polytope geometry to analyze
 * @returns Properties including counts and formulas
 */
export function getPolytopeProperties(geometry: PolytopeGeometry): PolytopeProperties {
  let vertexFormula: string;
  let edgeFormula: string;

  switch (geometry.type) {
    case 'hypercube':
      vertexFormula = '2^n';
      edgeFormula = 'n·2^(n-1)';
      break;
    case 'simplex':
      vertexFormula = 'n+1';
      edgeFormula = '(n+1)·n/2';
      break;
    case 'cross-polytope':
      vertexFormula = '2n';
      edgeFormula = '2n(n-1)';
      break;
  }

  return {
    vertexCount: geometry.vertices.length,
    edgeCount: geometry.edges.length,
    vertexFormula,
    edgeFormula,
  };
}

/**
 * Returns metadata about all available polytope types
 *
 * @returns Array of polytope type information
 */
export function getAvailableTypes(): Array<{
  type: PolytopeType;
  name: string;
  description: string;
}> {
  return [
    {
      type: 'hypercube',
      name: 'Hypercube',
      description: 'Generalization of a cube to n dimensions (n-cube)',
    },
    {
      type: 'simplex',
      name: 'Simplex',
      description: 'Generalization of a tetrahedron to n dimensions (n-simplex)',
    },
    {
      type: 'cross-polytope',
      name: 'Cross-Polytope',
      description: 'Generalization of an octahedron to n dimensions (n-orthoplex)',
    },
  ];
}
