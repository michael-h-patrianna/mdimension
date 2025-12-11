/**
 * Type definitions for n-dimensional polytope geometry
 */

import type { VectorND } from '@/lib/math';

/**
 * Supported polytope types
 */
export type PolytopeType = 'hypercube' | 'simplex' | 'cross-polytope';

/**
 * Geometric representation of an n-dimensional polytope
 */
export interface PolytopeGeometry {
  /** Array of vertex positions in n-dimensional space */
  vertices: VectorND[];
  /** Array of edge pairs (vertex indices) */
  edges: [number, number][];
  /** Dimensionality of the polytope */
  dimension: number;
  /** Type of polytope */
  type: PolytopeType;
}

/**
 * Mathematical properties of a polytope
 */
export interface PolytopeProperties {
  /** Number of vertices in the polytope */
  vertexCount: number;
  /** Number of edges in the polytope */
  edgeCount: number;
  /** Formula for vertex count as function of dimension */
  vertexFormula: string;
  /** Formula for edge count as function of dimension */
  edgeFormula: string;
}
