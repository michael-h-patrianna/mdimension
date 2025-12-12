/**
 * N-Dimensional Mandelbrot Set Generator
 *
 * Exports logic for generating n-dimensional Mandelbrot-like fractals.
 * Supports optional grid-based edge connectivity for wireframe rendering.
 */

import type { NdGeometry } from '../../types';
import type { VectorND } from '@/lib/math';
import type { MandelbrotConfig } from '../types';
import { generateSampleGrid, filterSamples } from './sampling';
import { generateMandelbrotEdges } from './edges';

export { mandelbrotStep, normSquared, mandelbrotEscapeTime, mandelbrotSmoothEscapeTime } from './math';
export { generateSampleGrid, filterSamples, type MandelbrotSample } from './sampling';
export { getMandelbrotStats } from './utils';
export { generateMandelbrotEdges, calculateGridEdgeCount } from './edges';

/**
 * Main generator function - returns point cloud geometry with optional edges
 *
 * Generates an n-dimensional Mandelbrot set visualization as a point cloud.
 * The geometry can be rendered using PointCloudRenderer or PointCloudWithEdges.
 *
 * The fractal structure emerges from the COLOR pattern based on escape times,
 * not from filtering points. All sampled points are kept and colored
 * according to their normalized escape time (0 = escaped immediately, 1 = bounded).
 *
 * Edge Modes:
 * - 'none': Point cloud only (default)
 * - 'grid': Connect adjacent points in the 3D sampling grid, enabling
 *   wireframe and dual outline shader effects
 *
 * @param dimension - Dimensionality of the Mandelbrot space (3-11)
 * @param config - Mandelbrot configuration parameters
 * @returns NdGeometry representing the Mandelbrot point cloud with escape values
 */
export function generateMandelbrot(
  dimension: number,
  config: MandelbrotConfig
): NdGeometry {
  // Validate dimension
  if (dimension < 3) {
    throw new Error(`Mandelbrot requires dimension >= 3, got ${dimension}`);
  }

  // Generate all samples
  const allSamples = generateSampleGrid(dimension, config);

  // Filter based on color mode (usually keeps all points)
  const filteredSamples = filterSamples(allSamples, config);

  // Extract vertices and escape values
  const vertices: VectorND[] = filteredSamples.map(s => s.cVector);
  const escapeValues: number[] = filteredSamples.map(s => s.escapeTime);

  // Normalize escape values to [0, 1] for coloring
  // 0 = escaped immediately (outside set), 1 = bounded (inside set)
  const normalizedEscapeValues: number[] = escapeValues.map(
    t => t / config.maxIterations
  );

  // Generate edges based on edge mode
  // Note: Edge generation uses the UNFILTERED sample count to maintain grid connectivity
  // If filtering removes points, grid edges may connect to non-existent points - handle in renderer
  const edges = config.edgeMode === 'grid' && config.colorMode !== 'interiorOnly'
    ? generateMandelbrotEdges(config.resolution, config.edgeMode)
    : [];

  return {
    dimension,
    type: 'mandelbrot',
    vertices,
    edges,
    isPointCloud: true,
    metadata: {
      name: `${dimension}D Mandelbrot Set`,
      formula: 'z_{n+1} = f(z_n, c), |z| bounded',
      properties: {
        maxIterations: config.maxIterations,
        escapeRadius: config.escapeRadius,
        resolution: config.resolution,
        edgeMode: config.edgeMode,
        sampleCount: allSamples.length,
        filteredCount: vertices.length,
        edgeCount: edges.length,
        escapeValues, // Raw escape times
        normalizedEscapeValues, // 0-1 values for coloring
      },
    },
  };
}
