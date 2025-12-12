/**
 * Edge Generation for Mandelbrot Visualization
 *
 * Generates grid-based edge connectivity for Mandelbrot point clouds,
 * enabling wireframe and dual outline shader support.
 */

// import type { MandelbrotEdgeMode } from '../types';

/**
 * Generate grid-based edges for a 3D grid of samples
 *
 * Connects adjacent points in the sampling grid (6-connectivity: up/down/left/right/front/back).
 * This enables wireframe and shader effects that require edge data.
 *
 * @param resolution - Grid resolution (samples per axis)
 * @param _edgeMode - Deprecated: Edge generation mode (unused)
 * @returns Array of edge pairs (vertex indices)
 */
export function generateMandelbrotEdges(
  resolution: number,
  _edgeMode: 'none' | 'grid'
): [number, number][] {
  if (_edgeMode === 'none') {
    return [];
  }

  const edges: [number, number][] = [];

  // Convert 3D grid coordinates to 1D index
  const toIndex = (ix: number, iy: number, iz: number): number =>
    ix * resolution * resolution + iy * resolution + iz;

  // Generate edges along each axis for grid connectivity
  for (let ix = 0; ix < resolution; ix++) {
    for (let iy = 0; iy < resolution; iy++) {
      for (let iz = 0; iz < resolution; iz++) {
        const currentIdx = toIndex(ix, iy, iz);

        // Connect to next point in X direction
        if (ix < resolution - 1) {
          edges.push([currentIdx, toIndex(ix + 1, iy, iz)]);
        }

        // Connect to next point in Y direction
        if (iy < resolution - 1) {
          edges.push([currentIdx, toIndex(ix, iy + 1, iz)]);
        }

        // Connect to next point in Z direction
        if (iz < resolution - 1) {
          edges.push([currentIdx, toIndex(ix, iy, iz + 1)]);
        }
      }
    }
  }

  return edges;
}

/**
 * Generate grid-based edges for a 2D grid of samples
 *
 * Connects adjacent points in the 2D sampling grid (4-connectivity: up/down/left/right).
 * This enables wireframe effects for the classic 2D Mandelbrot visualization.
 *
 * @param resolution - Grid resolution (samples per axis)
 * @returns Array of edge pairs (vertex indices)
 */
export function generateMandelbrot2DEdges(resolution: number): [number, number][] {
  const edges: [number, number][] = [];

  // Convert 2D grid coordinates to 1D index
  const toIndex = (ix: number, iy: number): number => ix * resolution + iy;

  // Generate edges along each axis for grid connectivity
  for (let ix = 0; ix < resolution; ix++) {
    for (let iy = 0; iy < resolution; iy++) {
      const currentIdx = toIndex(ix, iy);

      // Connect to next point in X direction
      if (ix < resolution - 1) {
        edges.push([currentIdx, toIndex(ix + 1, iy)]);
      }

      // Connect to next point in Y direction
      if (iy < resolution - 1) {
        edges.push([currentIdx, toIndex(ix, iy + 1)]);
      }
    }
  }

  return edges;
}

/**
 * Calculate expected edge count for 2D grid connectivity
 *
 * For a resolution^2 grid with 4-connectivity:
 * - X edges: (res-1) * res
 * - Y edges: res * (res-1)
 * Total: 2 * res * (res-1)
 *
 * @param resolution - Grid resolution
 * @returns Expected number of edges
 */
export function calculate2DGridEdgeCount(resolution: number): number {
  return 2 * resolution * (resolution - 1);
}

/**
 * Calculate expected edge count for grid connectivity
 *
 * For a resolution^3 grid with 6-connectivity:
 * - X edges: (res-1) * res * res
 * - Y edges: res * (res-1) * res
 * - Z edges: res * res * (res-1)
 * Total: 3 * res^2 * (res-1)
 *
 * @param resolution - Grid resolution
 * @returns Expected number of edges
 */
export function calculateGridEdgeCount(resolution: number): number {
  return 3 * resolution * resolution * (resolution - 1);
}
