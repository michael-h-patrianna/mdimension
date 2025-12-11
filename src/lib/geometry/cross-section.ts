/**
 * Cross-Section Computation
 * Computes the intersection of n-dimensional polytopes with hyperplanes
 */

import type { VectorND } from '@/lib/math/types';
import type { PolytopeGeometry } from './types';

/**
 * Result of a cross-section computation
 */
export interface CrossSectionResult {
  /** 3D points forming the cross-section (W coordinate dropped) */
  points: VectorND[];
  /** Edges connecting the cross-section points */
  edges: [number, number][];
  /** Whether the slice intersects the polytope */
  hasIntersection: boolean;
}

/**
 * Computes the cross-section of a polytope at a given W position
 *
 * For each edge of the polytope, checks if it crosses the hyperplane W = sliceW.
 * If so, computes the intersection point using linear interpolation.
 *
 * @param geometry - The polytope geometry (must be 4D or higher)
 * @param sliceW - The W coordinate of the slicing hyperplane
 * @returns CrossSectionResult with intersection points and edges
 */
export function computeCrossSection(
  geometry: PolytopeGeometry,
  sliceW: number
): CrossSectionResult {
  if (geometry.dimension < 4) {
    return { points: [], edges: [], hasIntersection: false };
  }

  const intersectionPoints: VectorND[] = [];
  const pointMap = new Map<string, number>(); // Edge key -> point index

  // For each edge, check if it crosses the W = sliceW plane
  for (const [v1Idx, v2Idx] of geometry.edges) {
    const v1 = geometry.vertices[v1Idx];
    const v2 = geometry.vertices[v2Idx];

    if (!v1 || !v2) continue;

    const w1 = v1[3] ?? 0; // W coordinate of first vertex
    const w2 = v2[3] ?? 0; // W coordinate of second vertex

    // Check if edge crosses the slice plane
    if ((w1 <= sliceW && w2 >= sliceW) || (w1 >= sliceW && w2 <= sliceW)) {
      // Skip if both points are exactly on the plane (edge lies in plane)
      if (Math.abs(w1 - sliceW) < 1e-10 && Math.abs(w2 - sliceW) < 1e-10) {
        continue;
      }

      // Compute intersection point using linear interpolation
      const t = Math.abs(w2 - w1) < 1e-10 ? 0 : (sliceW - w1) / (w2 - w1);

      // Clamp t to [0, 1] for numerical stability
      const tClamped = Math.max(0, Math.min(1, t));

      // Interpolate all coordinates (we'll use X, Y, Z for the 3D result)
      const intersectionPoint: VectorND = [];
      for (let i = 0; i < geometry.dimension; i++) {
        const coord1 = v1[i] ?? 0;
        const coord2 = v2[i] ?? 0;
        intersectionPoint[i] = coord1 + tClamped * (coord2 - coord1);
      }

      // Create a key for this edge to track the point
      const edgeKey = v1Idx < v2Idx ? `${v1Idx}-${v2Idx}` : `${v2Idx}-${v1Idx}`;

      if (!pointMap.has(edgeKey)) {
        pointMap.set(edgeKey, intersectionPoints.length);
        intersectionPoints.push(intersectionPoint);
      }
    }
  }

  if (intersectionPoints.length === 0) {
    return { points: [], edges: [], hasIntersection: false };
  }

  // Build edges for the cross-section
  // Two cross-section points are connected if their original edges share a face
  const crossSectionEdges: [number, number][] = [];
  const edgeKeys = Array.from(pointMap.keys());

  // For simplicity, connect points that came from edges sharing a vertex
  for (let i = 0; i < edgeKeys.length; i++) {
    for (let j = i + 1; j < edgeKeys.length; j++) {
      const key1 = edgeKeys[i]!;
      const key2 = edgeKeys[j]!;

      const [a1, b1] = key1.split('-').map(Number);
      const [a2, b2] = key2.split('-').map(Number);

      // Check if edges share a vertex (they're part of the same face)
      if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) {
        const idx1 = pointMap.get(key1)!;
        const idx2 = pointMap.get(key2)!;
        crossSectionEdges.push([idx1, idx2]);
      }
    }
  }

  return {
    points: intersectionPoints,
    edges: crossSectionEdges,
    hasIntersection: true,
  };
}

/**
 * Projects cross-section points to 3D by dropping the W coordinate
 *
 * @param result - Cross-section result
 * @returns Array of 3D points [x, y, z]
 */
export function projectCrossSectionTo3D(result: CrossSectionResult): VectorND[] {
  return result.points.map((point) => [
    point[0] ?? 0,
    point[1] ?? 0,
    point[2] ?? 0,
  ]);
}

/**
 * Computes the W-coordinate range of a polytope
 *
 * @param geometry - The polytope geometry
 * @returns [minW, maxW] tuple
 */
export function getWRange(geometry: PolytopeGeometry): [number, number] {
  if (geometry.dimension < 4 || geometry.vertices.length === 0) {
    return [0, 0];
  }

  let minW = Infinity;
  let maxW = -Infinity;

  for (const vertex of geometry.vertices) {
    const w = vertex[3] ?? 0;
    minW = Math.min(minW, w);
    maxW = Math.max(maxW, w);
  }

  return [minW, maxW];
}
