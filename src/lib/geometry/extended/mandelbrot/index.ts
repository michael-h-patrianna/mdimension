/**
 * N-Dimensional Mandelbrot Set Generator
 *
 * Exports logic for generating n-dimensional Mandelbrot-like fractals.
 * Supports optional grid-based edge connectivity for wireframe rendering.
 */

import type { VectorND } from '@/lib/math'
import type { NdGeometry } from '../../types'
import type { MandelbrotConfig } from '../types'
import { filterSamples, generateSampleGrid } from './sampling'

export {
  darkenColor,
  generatePalette,
  generatePointColors,
  getComplementaryColor,
  hexToHsl,
  hexToRgb,
  hslToHex,
  interpolateColor,
  lightenColor,
  mapEscapeToColor,
  rgbToHex,
  shiftHue,
} from './colors'
export { calculateGridEdgeCount, generateMandelbrotEdges } from './edges'
export {
  clamp,
  fromHyperspherical,
  hyperbulbEscapeTime,
  hyperbulbSmoothEscapeTime,
  hyperbulbStep,
  norm,
  powMap,
  toHyperspherical,
  type HypersphericalCoords,
} from './hyperspherical'
export {
  mandelbrotEscapeTime,
  mandelbrotSmoothEscapeTime,
  mandelbrotStep,
  mandelbulbStep,
  normSquared,
} from './math'
export { filterSamples, generateSampleGrid, type MandelbrotSample } from './sampling'
export { getMandelbrotStats } from './utils'

/**
 * Main generator function - returns point cloud geometry with optional edges
 *
 * Generates an n-dimensional Mandelbrot set visualization as a point cloud.
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
 * @param dimension - Dimensionality of the Mandelbrot space (3-11)
 * @param config - Mandelbrot configuration parameters
 * @returns NdGeometry representing the Mandelbrot point cloud with escape values
 */
export function generateMandelbrot(dimension: number, config: MandelbrotConfig): NdGeometry {
  // Validate dimension
  if (dimension < 3) {
    throw new Error(`Mandelbrot requires dimension >= 3, got ${dimension}`)
  }

  // Generate all samples
  const allSamples = generateSampleGrid(dimension, config)

  // Filter based on color mode (usually keeps all points)
  const filteredSamples = filterSamples(allSamples, config)

  // Extract vertices and escape values
  const vertices: VectorND[] = filteredSamples.map((s) => s.cVector)
  const escapeValues: number[] = filteredSamples.map((s) => s.escapeTime)

  // Normalize escape values to [0, 1] for coloring
  // 0 = escaped immediately (outside set), 1 = bounded (inside set)
  const normalizedEscapeValues: number[] = escapeValues.map((t) => t / config.maxIterations)

  // No Edges for Mandelbrot (Point Cloud / Ray Marching only)
  // Edges are visually chaotic and computationally expensive for fractals
  const edges: [number, number][] = []

  // Name based on dimension using proper fractal terminology
  // - 3D: Mandelbulb (spherical coordinates)
  // - 4D+: Hyperbulb (hyperspherical coordinates)
  const name = dimension === 3 ? 'Mandelbulb' : `${dimension}D Hyperbulb`

  // Formula description based on dimension
  const formula =
    dimension === 3
      ? 'z_{n+1} = powMap(z_n, p) + c (spherical)'
      : `z_{n+1} = powMap(z_n, p) + c (hyperspherical, ${dimension - 1} angles)`

  return {
    dimension,
    type: 'mandelbrot',
    vertices,
    edges,
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
  }
}
