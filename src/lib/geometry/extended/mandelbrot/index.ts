/**
 * N-Dimensional Mandelbrot Set Generator
 *
 * Exports logic for generating n-dimensional Mandelbrot-like fractals.
 * Supports optional grid-based edge connectivity for wireframe rendering.
 */

import type { NdGeometry } from '../../types';
import type { VectorND } from '@/lib/math';
import type { MandelbrotConfig } from '../types';
import { generateSampleGrid, generateSampleGrid2D, filterSamples } from './sampling';

export { mandelbulbStep, mandelbrotStep, normSquared, mandelbrotEscapeTime, mandelbrotSmoothEscapeTime } from './math';
export { generateSampleGrid, generateSampleGrid2D, filterSamples, type MandelbrotSample } from './sampling';
export { getMandelbrotStats } from './utils';
export {
  toHyperspherical,
  fromHyperspherical,
  powMap,
  hyperbulbStep,
  hyperbulbEscapeTime,
  hyperbulbSmoothEscapeTime,
  norm,
  clamp,
  type HypersphericalCoords,
} from './hyperspherical';
export { generateMandelbrotEdges, generateMandelbrot2DEdges, calculateGridEdgeCount, calculate2DGridEdgeCount } from './edges';
export {
  generatePalette,
  generatePointColors,
  mapEscapeToColor,
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  interpolateColor,
  getComplementaryColor,
  shiftHue,
  darkenColor,
  lightenColor,
} from './colors';

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
 * - 'grid': Connect adjacent points in the sampling grid, enabling
 *   wireframe and dual outline shader effects
 *
 * For 2D, this generates the classic Mandelbrot set on the complex plane.
 *
 * @param dimension - Dimensionality of the Mandelbrot space (2-11)
 * @param config - Mandelbrot configuration parameters
 * @returns NdGeometry representing the Mandelbrot point cloud with escape values
 */
export function generateMandelbrot(
  dimension: number,
  config: MandelbrotConfig
): NdGeometry {
  // Validate dimension
  if (dimension < 2) {
    throw new Error(`Mandelbrot requires dimension >= 2, got ${dimension}`);
  }

  // Generate all samples - use 2D sampling for dimension 2
  const allSamples =
    dimension === 2
      ? generateSampleGrid2D(config)
      : generateSampleGrid(dimension, config);

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

  // No Edges for Mandelbrot (Point Cloud / Ray Marching only)
  // Edges are visually chaotic and computationally expensive for fractals
  const edges: [number, number][] = [];

  // Name based on dimension using proper fractal terminology
  // - 2D: Mandelbrot Set (classic complex plane)
  // - 3D: Mandelbulb (spherical coordinates)
  // - 4D+: Hyperbulb (hyperspherical coordinates)
  const name =
    dimension === 2
      ? 'Mandelbrot Set'
      : dimension === 3
        ? 'Mandelbulb'
        : `${dimension}D Hyperbulb`;

  // Formula description based on dimension
  const formula =
    dimension === 2
      ? 'z_{n+1} = z_n² + c (complex)'
      : dimension === 3
        ? 'z_{n+1} = powMap(z_n, p) + c (spherical)'
        : `z_{n+1} = powMap(z_n, p) + c (hyperspherical, ${dimension - 1} angles)`;

  return {
    dimension,
    type: 'mandelbrot',
    vertices,
    edges,
    isPointCloud: true,
    metadata: {
      name,
      formula,
      properties: {
        maxIterations: config.maxIterations,
        escapeRadius: config.escapeRadius,
        resolution: config.resolution,
        sampleCount: allSamples.length,
        filteredCount: vertices.length,
        edgeCount: edges.length,
        escapeValues, // Raw escape times
        normalizedEscapeValues, // 0-1 values for coloring
      },
    },
  };
}
