/**
 * N-Dimensional Schroedinger Set Generator
 *
 * Exports logic for generating n-dimensional Schroedinger-like fractals.
 * Supports optional grid-based edge connectivity for wireframe rendering.
 */

import type { VectorND } from '@/lib/math'
import type { NdGeometry } from '../../types'
import type { SchroedingerConfig } from '../types'
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
export { calculateGridEdgeCount, generateSchroedingerEdges } from './edges'
export {
  clamp,
  fromHyperspherical,
  schroedingerHyperbulbEscapeTime,
  schroedingerHyperbulbSmoothEscapeTime,
  schroedingerHyperbulbStep,
  norm,
  powMap,
  toHyperspherical,
  type HypersphericalCoords,
} from './hyperspherical'
export {
  schroedinger3DStep,
  schroedingerEscapeTime,
  schroedingerSmoothEscapeTime,
  schroedingerStep,
  normSquared,
} from './math'
export { filterSamples, generateSampleGrid, type SchroedingerSample } from './sampling'
export { getSchroedingerStats } from './utils'

/**
 * Main generator function - returns point cloud geometry with optional edges
 *
 * Generates an n-dimensional Schroedinger set visualization as a point cloud.
 *
 * @param dimension - Dimensionality of the Schroedinger space (3-11)
 * @param config - Schroedinger configuration parameters
 * @returns NdGeometry representing the Schroedinger point cloud with escape values
 */
export function generateSchroedinger(dimension: number, config: SchroedingerConfig): NdGeometry {
  // Validate dimension
  if (dimension < 3) {
    throw new Error(`Schroedinger requires dimension >= 3, got ${dimension}`)
  }

  // Generate all samples
  const allSamples = generateSampleGrid(dimension, config)

  // Filter based on color mode (usually keeps all points)
  const filteredSamples = filterSamples(allSamples, config)

  // Extract vertices and escape values
  const vertices: VectorND[] = filteredSamples.map((s) => s.cVector)
  const escapeValues: number[] = filteredSamples.map((s) => s.escapeTime)

  // Normalize escape values to [0, 1] for coloring
  const normalizedEscapeValues: number[] = escapeValues.map((t) => t / config.maxIterations)

  // No Edges for Schroedinger (Point Cloud / Ray Marching only)
  const edges: [number, number][] = []

  // Name based on dimension
  const name = dimension === 3 ? 'Schroedinger' : `${dimension}D Schroedinger`

  // Formula description based on dimension
  const formula =
    dimension === 3
      ? 'z_{n+1} = powMap(z_n, p) + c (spherical)'
      : `z_{n+1} = powMap(z_n, p) + c (hyperspherical, ${dimension - 1} angles)`

  return {
    dimension,
    type: 'schroedinger',
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
        escapeValues,
        normalizedEscapeValues,
      },
    },
  }
}
