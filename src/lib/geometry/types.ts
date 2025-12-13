/**
 * Type definitions for n-dimensional geometry
 *
 * Supports both traditional polytopes (hypercube, simplex, cross-polytope)
 * and extended objects (root systems, Clifford torus, Mandelbrot, Mandelbox)
 */

import type { VectorND } from '@/lib/math';

/**
 * Supported polytope types (traditional finite vertex/edge objects)
 */
export type PolytopeType = 'hypercube' | 'simplex' | 'cross-polytope';

/**
 * Extended object types (point clouds and special mathematical objects)
 */
export type ExtendedObjectType = 'root-system' | 'clifford-torus' | 'mandelbrot' | 'mandelbox';

/**
 * All supported object types
 */
export type ObjectType = PolytopeType | ExtendedObjectType;

/**
 * Type guard for polytope types
 * Accepts string to allow validation of unknown inputs
 * @param type - String or ObjectType to check
 */
export function isPolytopeType(type: string): type is PolytopeType {
  return type === 'hypercube' || type === 'simplex' || type === 'cross-polytope';
}

/**
 * Type guard for extended object types
 * Accepts string to allow validation of unknown inputs
 * @param type - String or ObjectType to check
 */
export function isExtendedObjectType(type: string): type is ExtendedObjectType {
  return type === 'root-system' || type === 'clifford-torus' || type === 'mandelbrot' || type === 'mandelbox';
}

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
 * Metadata for geometry objects
 */
export interface GeometryMetadata {
  /** Display name for the object */
  name?: string;
  /** Mathematical formula or description */
  formula?: string;
  /** Additional properties specific to the object type */
  properties?: Record<string, unknown>;
}

/**
 * Unified geometry representation for all n-dimensional objects
 * Supports both polytopes (finite vertex sets) and point clouds
 */
export interface NdGeometry {
  /** Dimensionality of the object */
  dimension: number;
  /** Type of object */
  type: ObjectType;
  /** Array of vertex/point positions in n-dimensional space */
  vertices: VectorND[];
  /** Array of edge pairs (vertex indices) - may be empty for point clouds */
  edges: [number, number][];
  /** Whether this is a point cloud (no natural edge structure) */
  isPointCloud?: boolean;
  /** Optional metadata about the geometry */
  metadata?: GeometryMetadata;
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
