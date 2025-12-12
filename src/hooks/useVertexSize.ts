import { useVisualStore } from '@/stores/visualStore';
import {
  VERTEX_SIZE_DIVISOR,
  DENSITY_SCALING_THRESHOLD,
  DENSITY_SCALING_BASE,
  DENSITY_SCALING_EXPONENT,
  DENSITY_SCALING_MIN,
} from '@/lib/shaders/constants';

/**
 * Hook that calculates the appropriate vertex size based on the total vertex count.
 * Reduces size for denser geometries to prevent visual clutter.
 *
 * The scaling formula ensures that:
 * - Small objects (≤16 vertices like cubes) render at full size
 * - Dense objects (1000+ vertices like hyperspheres) scale down proportionally
 * - All objects use the same baseline from visualStore for user control
 *
 * This creates visual consistency across different object types by adapting
 * vertex size to the geometry's density rather than a fixed value.
 *
 * @param vertexCount - The number of vertices in the geometry.
 * @returns The calculated vertex size in 3D scale units (e.g., 0.04 for default settings).
 *
 * @example
 * ```tsx
 * // In a renderer component:
 * const vertices = [...]; // Array of projected vertices
 * const vertexSize = useVertexSize(vertices.length);
 *
 * // vertexSize will be:
 * // - 0.04 for 8 vertices (default cube)
 * // - 0.014 for 256 vertices
 * // - 0.009 for 2000 vertices (typical hypersphere)
 * ```
 *
 * @see DEFAULT_BASE_VERTEX_SIZE for the baseline value
 * @see DENSITY_SCALING_THRESHOLD for when scaling kicks in
 */
export function useVertexSize(vertexCount: number) {
  const vertexSize = useVisualStore((state) => state.vertexSize);
  // Convert from store value (1-10) to 3D scale using shared constant
  const baseVertexSize = vertexSize / VERTEX_SIZE_DIVISOR;

  // Scale down vertex size for dense geometries
  // For 8 vertices (cube): factor = 1.0
  // For 256 vertices: factor ≈ 0.35
  // For 1024 vertices: factor ≈ 0.25
  // For 4096 vertices: factor ≈ 0.18
  const densityScaleFactor = vertexCount > DENSITY_SCALING_THRESHOLD
    ? Math.max(
        DENSITY_SCALING_MIN,
        1.0 / Math.pow(vertexCount / DENSITY_SCALING_BASE, DENSITY_SCALING_EXPONENT)
      )
    : 1.0;

  return baseVertexSize * densityScaleFactor;
}
