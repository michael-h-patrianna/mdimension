/**
 * Projection Distance Utilities for N-D Renderers
 *
 * Provides utilities for calculating safe projection distances that ensure
 * all vertices remain visible without singularities. Used by PolytopeScene
 * and TubeWireframe to avoid vertices crossing the projection plane.
 *
 * @module rendering/renderers/base/projectionUtils
 */

import { useRef } from 'react'

import { DEFAULT_PROJECTION_DISTANCE } from '@/lib/math/projection'
import type { VectorND } from '@/lib/math/types'

// Re-export for convenience
export { DEFAULT_PROJECTION_DISTANCE }

/**
 * Safety margin added to projection distance to prevent near-singularities.
 * This ensures vertices don't get too close to the projection plane.
 */
const PROJECTION_MARGIN = 2.0

/**
 * Calculate a safe projection distance that ensures all vertices are visible.
 *
 * The projection distance is calculated as:
 * 1. Find the maximum effective depth (sum of higher dimensions)
 * 2. Normalize by sqrt(dimension - 3) for consistent scale
 * 3. Add safety margin
 * 4. Optionally scale by max scale factor
 *
 * @param vertices - Array of N-dimensional vertices
 * @param dimension - Current dimension of the object
 * @param scales - Per-axis scale factors (optional)
 * @returns Safe projection distance
 */
export function calculateSafeProjectionDistance(
  vertices: VectorND[],
  dimension: number,
  scales?: number[]
): number {
  // Early exit for 3D objects or empty vertex arrays
  if (vertices.length === 0 || dimension <= 3) {
    return DEFAULT_PROJECTION_DISTANCE
  }

  const firstVertex = vertices[0]
  if (!firstVertex || firstVertex.length <= 3) {
    return DEFAULT_PROJECTION_DISTANCE
  }

  // Normalization factor for consistent scale across dimensions
  const normalizationFactor = dimension > 3 ? Math.sqrt(dimension - 3) : 1

  // Find maximum effective depth
  let maxEffectiveDepth = 0
  for (const vertex of vertices) {
    let sum = 0
    for (let d = 3; d < vertex.length; d++) {
      sum += vertex[d] ?? 0
    }
    const effectiveDepth = sum / normalizationFactor
    maxEffectiveDepth = Math.max(maxEffectiveDepth, effectiveDepth)
  }

  // Calculate raw distance with margin
  const rawDistance = Math.max(DEFAULT_PROJECTION_DISTANCE, maxEffectiveDepth + PROJECTION_MARGIN)

  // Apply scale adjustment if scales provided
  if (scales && scales.length > 0) {
    let maxScale = 1
    for (const s of scales) {
      maxScale = Math.max(maxScale, s)
    }

    // Adjust projection distance by max scale to prevent near-clipping when object grows
    // rawDistance includes the margin, so we scale the "content" part and add margin back
    const contentRadius = Math.max(0, rawDistance - PROJECTION_MARGIN)
    return contentRadius * maxScale + PROJECTION_MARGIN
  }

  return rawDistance
}

/**
 * Cache entry for projection distance calculations.
 */
interface ProjectionDistanceCache {
  /** Vertex count when distance was calculated */
  count: number
  /** Cached projection distance */
  distance: number
  /** Sum of scales for change detection */
  scaleSum: number
}

/**
 * Result from useProjectionDistanceCache hook.
 */
export interface UseProjectionDistanceCacheResult {
  /**
   * Get the current projection distance.
   * Recalculates only when vertex count or scale sum changes significantly.
   *
   * @param vertices - Current vertices
   * @param dimension - Current dimension
   * @param scales - Current scale factors
   * @returns Cached or newly calculated projection distance
   */
  getProjectionDistance: (vertices: VectorND[], dimension: number, scales: number[]) => number

  /**
   * Force recalculation on next call.
   */
  invalidate: () => void
}

/**
 * Hook for caching projection distance calculations.
 *
 * Projection distance only needs to be recalculated when:
 * - Vertex count changes (geometry changed)
 * - Scale sum changes significantly (transform changed)
 *
 * This avoids O(N) vertex iteration every frame.
 *
 * @returns Projection distance cache utilities
 *
 * @example
 * ```tsx
 * function MyRenderer({ vertices, dimension }) {
 *   const projCache = useProjectionDistanceCache();
 *
 *   useFrame(() => {
 *     const scales = [uniformScale, ...perAxisScale];
 *     const projectionDistance = projCache.getProjectionDistance(vertices, dimension, scales);
 *     // Use projectionDistance in uniform updates
 *   });
 * }
 * ```
 */
export function useProjectionDistanceCache(): UseProjectionDistanceCacheResult {
  const cacheRef = useRef<ProjectionDistanceCache>({
    count: -1,
    distance: DEFAULT_PROJECTION_DISTANCE,
    scaleSum: 0,
  })

  const getProjectionDistance = (
    vertices: VectorND[],
    dimension: number,
    scales: number[]
  ): number => {
    const cache = cacheRef.current
    const numVertices = vertices.length

    // Calculate current scale sum for change detection
    let currentScaleSum = 0
    for (const s of scales) {
      currentScaleSum += s
    }

    // Check if we need to recalculate
    const countChanged = numVertices !== cache.count
    const scaleChanged = Math.abs(currentScaleSum - cache.scaleSum) > 0.01

    if (countChanged || scaleChanged) {
      const distance = calculateSafeProjectionDistance(vertices, dimension, scales)

      cache.count = numVertices
      cache.distance = distance
      cache.scaleSum = currentScaleSum

      return distance
    }

    return cache.distance
  }

  const invalidate = () => {
    cacheRef.current.count = -1
  }

  return {
    getProjectionDistance,
    invalidate,
  }
}



