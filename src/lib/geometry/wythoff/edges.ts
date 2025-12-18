/**
 * Edge generation utilities for Wythoff polytopes.
 *
 * Uses spatial hashing for O(V * k) complexity instead of O(V^2).
 */

import type { VectorND } from '@/lib/math'
import { generateEdgesWithSpatialHash } from '../utils/spatial-hash'

/**
 * Generate edges by connecting vertices within minimum distance.
 *
 * Uses spatial hashing for O(V * k) complexity instead of O(V^2).
 * This is critical for large polytopes (10K+ vertices).
 *
 * @param vertices - Array of vertex positions
 * @returns Array of edge pairs (vertex indices)
 */
export function generateEdgesByMinDistance(vertices: VectorND[]): [number, number][] {
  // Delegate to spatial hash implementation for O(V * k) performance
  return generateEdgesWithSpatialHash(vertices)
}
