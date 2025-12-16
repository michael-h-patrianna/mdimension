/**
 * Mandelbulb Fractal Module
 *
 * Mandelbulb uses GPU raymarching exclusively - no CPU geometry needed.
 * This module provides the generator that returns minimal geometry to signal
 * the renderer to use MandelbulbMesh for GPU-based raymarching.
 */

import type { NdGeometry } from '../../types'
import type { MandelbulbConfig } from '../types'

/**
 * Generate minimal geometry for Mandelbulb raymarching
 *
 * Returns empty geometry that signals to UnifiedRenderer to use MandelbulbMesh.
 * All fractal computation happens on the GPU via raymarching shaders.
 *
 * @param dimension - Dimensionality (3-11)
 * @param _config - Configuration (used by shader, not CPU)
 * @returns Minimal NdGeometry for raymarching
 */
export function generateMandelbulb(dimension: number, _config: MandelbulbConfig): NdGeometry {
  if (dimension < 3) {
    throw new Error(`Mandelbulb requires dimension >= 3, got ${dimension}`)
  }

  const name = dimension === 3 ? 'Mandelbulb' : `${dimension}D Mandelbulb`

  return {
    dimension,
    type: 'mandelbulb',
    vertices: [], // Empty - GPU raymarching handles rendering
    edges: [],
    metadata: {
      name,
      properties: {
        renderMode: 'raymarching',
      },
    },
  }
}
