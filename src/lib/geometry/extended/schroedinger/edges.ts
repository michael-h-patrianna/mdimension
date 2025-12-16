/**
 * Edge Generation for Schroedinger Visualization
 *
 * Generates grid-based edge connectivity for Schroedinger point clouds,
 * enabling wireframe and dual outline shader support.
 */

/**
 * Generate grid-based edges for a 3D grid of samples
 *
 * Connects adjacent points in the sampling grid (6-connectivity).
 *
 * @param resolution - Grid resolution (samples per axis)
 * @param _edgeMode - Edge generation mode
 * @returns Array of edge pairs (vertex indices)
 */
export function generateSchroedingerEdges(
  resolution: number,
  _edgeMode: 'none' | 'grid'
): [number, number][] {
  if (_edgeMode === 'none') {
    return []
  }

  const edges: [number, number][] = []

  // Convert 3D grid coordinates to 1D index
  const toIndex = (ix: number, iy: number, iz: number): number =>
    ix * resolution * resolution + iy * resolution + iz

  // Generate edges along each axis for grid connectivity
  for (let ix = 0; ix < resolution; ix++) {
    for (let iy = 0; iy < resolution; iy++) {
      for (let iz = 0; iz < resolution; iz++) {
        const currentIdx = toIndex(ix, iy, iz)

        // Connect to next point in X direction
        if (ix < resolution - 1) {
          edges.push([currentIdx, toIndex(ix + 1, iy, iz)])
        }

        // Connect to next point in Y direction
        if (iy < resolution - 1) {
          edges.push([currentIdx, toIndex(ix, iy + 1, iz)])
        }

        // Connect to next point in Z direction
        if (iz < resolution - 1) {
          edges.push([currentIdx, toIndex(ix, iy, iz + 1)])
        }
      }
    }
  }

  return edges
}

/**
 * Calculate expected edge count for grid connectivity
 *
 * @param resolution - Grid resolution
 * @returns Expected number of edges
 */
export function calculateGridEdgeCount(resolution: number): number {
  return 3 * resolution * resolution * (resolution - 1)
}
