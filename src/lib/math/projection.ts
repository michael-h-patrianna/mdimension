/**
 * N-dimensional to 3D projection operations
 * Supports both perspective and orthographic projections
 */

import type { VectorND, Vector3D } from './types';

/**
 * Default projection distance for perspective projection
 * A larger value creates less extreme perspective effects
 */
export const DEFAULT_PROJECTION_DISTANCE = 4.0;

/**
 * Minimum safe distance from projection plane to avoid division issues
 */
export const MIN_SAFE_DISTANCE = 0.01;

/**
 * Projects an n-dimensional point to 3D using perspective projection
 *
 * Uses a SINGLE-STEP projection as recommended in the math guide:
 * - First 3 coordinates (x, y, z) are used directly
 * - All higher dimensions are combined into ONE effective depth value
 * - Perspective division is applied ONCE
 *
 * For nD → 3D:
 *   effectiveDepth = sum of all coordinates in dimensions 4+
 *   Formula: (x', y', z') = (x/(d-w), y/(d-w), z/(d-w))
 *   where w = effectiveDepth / sqrt(n-3) to normalize across dimensions
 *
 * This avoids the exponential shrinking that occurs with recursive projection.
 *
 * @param vertex - N-dimensional vertex (n ≥ 3)
 * @param projectionDistance - Distance from projection plane (default: 4.0)
 * @param out - Optional output vector to avoid allocation
 * @param normalizationFactor - Optional pre-calculated Math.sqrt(n-3) for performance
 * @returns 3D projected point
 * @throws {Error} If vertex has less than 3 dimensions
 */
export function projectPerspective(
  vertex: VectorND,
  projectionDistance: number = DEFAULT_PROJECTION_DISTANCE,
  out?: Vector3D,
  normalizationFactor?: number
): Vector3D {
  if (vertex.length < 2) {
    throw new Error(`Cannot project ${vertex.length}D vertex to 3D: need at least 2 dimensions`);
  }

  if (projectionDistance <= 0) {
    throw new Error('Projection distance must be positive');
  }

  const result = out ?? [0, 0, 0];

  // For 2D, map [x, z] to [x, 0, z] (X-Z plane at Y=0)
  // Apply same perspective scaling for consistency with higher dimensions
  if (vertex.length === 2) {
    const scale = 1 / projectionDistance;
    result[0] = vertex[0]! * scale;
    result[1] = 0;
    result[2] = vertex[1]! * scale;
    return result;
  }

  const x = vertex[0]!;
  const y = vertex[1]!;
  const z = vertex[2]!;

  // Calculate effective depth from all higher dimensions (0 for 3D)
  // Use signed sum to preserve direction (like standard 4D projection uses w directly)
  // Normalize by number of extra dimensions to keep consistent scale
  const numHigherDims = vertex.length - 3;
  let effectiveDepth = 0;

  if (numHigherDims > 0) {
    for (let d = 3; d < vertex.length; d++) {
      effectiveDepth += vertex[d]!;
    }

    // Normalize: divide by sqrt of number of higher dimensions
    // This keeps the effective depth in a similar range regardless of dimension count
    const norm = normalizationFactor ?? Math.sqrt(numHigherDims);
    effectiveDepth = effectiveDepth / norm;
  }

  // Apply single perspective division
  const denominator = projectionDistance - effectiveDepth;

  // Check for singularity
  if (Math.abs(denominator) < MIN_SAFE_DISTANCE) {
    const safeDistance = denominator >= 0 ? MIN_SAFE_DISTANCE : -MIN_SAFE_DISTANCE;
    const scale = 1 / safeDistance;
    result[0] = x * scale;
    result[1] = y * scale;
    result[2] = z * scale;
    return result;
  }

  const scale = 1 / denominator;
  result[0] = x * scale;
  result[1] = y * scale;
  result[2] = z * scale;
  return result;
}

/**
 * Projects an n-dimensional point to 3D using orthographic projection
 * Simply extracts the first three coordinates (x, y, z)
 *
 * This is useful for debugging or when perspective distortion is not desired
 *
 * @param vertex - N-dimensional vertex (n ≥ 3)
 * @param out
 * @returns 3D projected point (first three coordinates)
 * @throws {Error} If vertex has less than 3 dimensions
 */
export function projectOrthographic(vertex: VectorND, out?: Vector3D): Vector3D {
  if (vertex.length < 2) {
    throw new Error(`Cannot project ${vertex.length}D vertex to 3D: need at least 2 dimensions`);
  }

  const result = out ?? [0, 0, 0];

  // For 2D, map [x, z] to [x, 0, z] (X-Z plane at Y=0)
  if (vertex.length === 2) {
    result[0] = vertex[0]!;
    result[1] = 0;
    result[2] = vertex[1]!;
    return result;
  }

  result[0] = vertex[0]!;
  result[1] = vertex[1]!;
  result[2] = vertex[2]!;
  return result;
}

/**
 * Projects an array of n-dimensional vertices to 3D
 * Applies the same projection to all vertices
 *
 * @param vertices - Array of n-dimensional vertices
 * @param projectionDistance - Distance from projection plane
 * @param usePerspective - If true, use perspective projection; if false, use orthographic
 * @returns Array of 3D projected points
 * @throws {Error} If any vertex has less than 3 dimensions
 */
export function projectVertices(
  vertices: VectorND[],
  projectionDistance: number = DEFAULT_PROJECTION_DISTANCE,
  usePerspective = true
): Vector3D[] {
  if (vertices.length === 0) {
    return [];
  }

  // Validate all vertices have same dimension
  const dimension = vertices[0]!.length;
  for (let i = 1; i < vertices.length; i++) {
    if (vertices[i]!.length !== dimension) {
      throw new Error(
        `All vertices must have same dimension: vertex 0 has ${dimension}, vertex ${i} has ${vertices[i]!.length}`
      );
    }
  }

  // Project each vertex
  if (usePerspective) {
    return vertices.map(v => projectPerspective(v, projectionDistance));
  } else {
    return vertices.map(v => projectOrthographic(v));
  }
}

/**
 * Calculates the depth of a point in n-dimensional space
 * For perspective rendering, points further from the viewer should be drawn first
 *
 * Depth is calculated as the Euclidean distance in the higher dimensions (4D+)
 * For 3D, returns 0 (no higher dimensions)
 * For 4D+, returns √(w² + v² + u² + ...)
 *
 * @param vertex - N-dimensional vertex
 * @returns Depth value (0 for 3D, distance in higher dims for 4D+)
 */
export function calculateDepth(vertex: VectorND): number {
  if (vertex.length <= 3) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = 3; i < vertex.length; i++) {
    sumSquares += vertex[i]! * vertex[i]!;
  }

  return Math.sqrt(sumSquares);
}

/**
 * Sorts vertices by depth (furthest first) for proper rendering order
 * In perspective rendering, distant objects should be drawn before near objects
 *
 * @param vertices - Array of n-dimensional vertices
 * @returns Array of indices sorted by depth (furthest first)
 */
export function sortByDepth(vertices: VectorND[]): number[] {
  // Calculate depth for each vertex
  const depthIndices = vertices.map((vertex, index) => ({
    index,
    depth: calculateDepth(vertex),
  }));

  // Sort by depth (descending - furthest first)
  depthIndices.sort((a, b) => b.depth - a.depth);

  // Return sorted indices
  return depthIndices.map(item => item.index);
}

/**
 * Calculates an appropriate projection distance based on the bounding box of vertices
 * The projection distance should be larger than the maximum extent in higher dimensions
 * to avoid singularities
 *
 * @param vertices - Array of n-dimensional vertices
 * @param margin - Safety margin factor (default: 2.0)
 * @returns Recommended projection distance
 */
export function calculateProjectionDistance(vertices: VectorND[], margin = 2.0): number {
  if (vertices.length === 0) {
    return DEFAULT_PROJECTION_DISTANCE;
  }

  const dimension = vertices[0]!.length;

  if (dimension <= 3) {
    return DEFAULT_PROJECTION_DISTANCE;
  }

  // Find maximum absolute value in higher dimensions (4D+)
  let maxHigherDim = 0;
  for (const vertex of vertices) {
    for (let i = 3; i < vertex.length; i++) {
      maxHigherDim = Math.max(maxHigherDim, Math.abs(vertex[i]!));
    }
  }

  // Add margin to ensure we don't get too close to singularities
  return maxHigherDim * margin + 1.0;
}

/**
 * Clips a line segment against the projection plane to prevent rendering artifacts
 * If a line crosses the projection plane, it should be clipped
 *
 * @param v1 - First vertex
 * @param v2 - Second vertex
 * @param projectionDistance - Distance from projection plane
 * @returns Tuple of [shouldDraw, clippedV1, clippedV2] or null if line should not be drawn
 */
export function clipLine(
  v1: VectorND,
  v2: VectorND,
  projectionDistance: number
): { shouldDraw: boolean; v1: VectorND; v2: VectorND } | null {
  if (v1.length !== v2.length) {
    throw new Error('Vertices must have same dimension');
  }

  if (v1.length <= 3) {
    // No clipping needed for 3D
    return { shouldDraw: true, v1, v2 };
  }

  // Check if both vertices are on the visible side
  // For simplicity, we check the highest dimension coordinate
  const dim = v1.length - 1;
  const w1 = v1[dim]!;
  const w2 = v2[dim]!;

  const d1 = projectionDistance - w1;
  const d2 = projectionDistance - w2;

  // Both behind projection plane - don't draw
  if (d1 <= MIN_SAFE_DISTANCE && d2 <= MIN_SAFE_DISTANCE) {
    return null;
  }

  // Both in front - draw as is
  if (d1 > MIN_SAFE_DISTANCE && d2 > MIN_SAFE_DISTANCE) {
    return { shouldDraw: true, v1, v2 };
  }

  // Line crosses projection plane - would need clipping
  // For now, we'll skip drawing lines that cross the plane
  // A full implementation would interpolate to find the intersection point
  return null;
}
