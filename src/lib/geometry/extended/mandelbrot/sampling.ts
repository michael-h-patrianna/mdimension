/**
 * Sampling and Grid Generation
 *
 * Functions for generating the sample grid and filtering points.
 */

import type { VectorND } from '@/lib/math';
import type { MandelbrotConfig } from '../types';
import { mandelbrotEscapeTime, mandelbrotSmoothEscapeTime } from './math';

/**
 * Sample point data from Mandelbrot computation
 */
export interface MandelbrotSample {
  /** Position in 3D visualization space */
  worldPos: [number, number, number];
  /** Full N-dimensional c vector */
  cVector: VectorND;
  /** Escape time value (or -1 for bounded) */
  escapeTime: number;
}

/**
 * Generate 3D sample grid within extent bounds
 *
 * Creates a grid of sample points in N-dimensional space, with 3 dimensions
 * mapped to the visualization axes and the rest held at parameter values.
 *
 * @param dimension - Dimensionality of the Mandelbrot space
 * @param config - Mandelbrot configuration
 * @returns Array of sample points with world positions and c vectors
 */
export function generateSampleGrid(
  dimension: number,
  config: MandelbrotConfig
): MandelbrotSample[] {
  const { resolution, visualizationAxes, parameterValues, center, extent, maxIterations, escapeRadius, colorMode, mandelbulbPower } = config;
  const [ax, ay, az] = visualizationAxes;
  const samples: MandelbrotSample[] = [];

  // Guard against resolution=1 which would cause division by zero
  // Config validation should prevent this, but add runtime safety
  if (resolution < 2) {
    throw new Error(`Resolution must be >= 2, got ${resolution}`);
  }

  // Initialize center if not set
  const effectiveCenter = center.length === dimension ? center : new Array(dimension).fill(0);

  const useSmooth = colorMode === 'smoothColoring';

  // Denominator for parametric mapping (safe since resolution >= 2)
  const gridDenom = resolution - 1;

  for (let ix = 0; ix < resolution; ix++) {
    for (let iy = 0; iy < resolution; iy++) {
      for (let iz = 0; iz < resolution; iz++) {
        // Map grid indices to parametric [0,1] coordinates
        const tx = ix / gridDenom;
        const ty = iy / gridDenom;
        const tz = iz / gridDenom;

        // Map to world coordinates centered at effectiveCenter with extent
        const x = (effectiveCenter[ax] ?? 0) - extent + 2 * extent * tx;
        const y = (effectiveCenter[ay] ?? 0) - extent + 2 * extent * ty;
        const z = (effectiveCenter[az] ?? 0) - extent + 2 * extent * tz;

        // Build N-dimensional c vector
        const cVector: VectorND = new Array(dimension).fill(0);
        cVector[ax] = x;
        cVector[ay] = y;
        cVector[az] = z;

        // Fill non-visualized dimensions with parameter values
        let paramIdx = 0;
        for (let d = 0; d < dimension; d++) {
          if (d !== ax && d !== ay && d !== az) {
            cVector[d] = parameterValues[paramIdx] ?? 0;
            paramIdx++;
          }
        }

        // Compute escape time (pass mandelbulbPower for 3D Mandelbulb)
        const escapeTime = useSmooth
          ? mandelbrotSmoothEscapeTime(cVector, maxIterations, escapeRadius, mandelbulbPower)
          : mandelbrotEscapeTime(cVector, maxIterations, escapeRadius, mandelbulbPower);

        samples.push({
          worldPos: [x, y, z],
          cVector,
          escapeTime,
        });
      }
    }
  }

  return samples;
}

/**
 * Generate 2D sample grid for classic Mandelbrot on the complex plane
 *
 * Creates a grid of sample points in 2D space, mapping to the classic
 * Mandelbrot set visualization on the complex plane.
 *
 * @param config - Mandelbrot configuration
 * @returns Array of sample points with world positions and c vectors
 */
export function generateSampleGrid2D(config: MandelbrotConfig): MandelbrotSample[] {
  const { resolution, center, extent, maxIterations, escapeRadius, colorMode } = config;
  const samples: MandelbrotSample[] = [];

  // Guard against resolution=1 which would cause division by zero
  if (resolution < 2) {
    throw new Error(`Resolution must be >= 2, got ${resolution}`);
  }

  // Initialize center if not set (default to classic Mandelbrot center at -0.5, 0)
  const effectiveCenter = center.length >= 2 ? center : [-0.5, 0];

  const useSmooth = colorMode === 'smoothColoring';

  // Denominator for parametric mapping (safe since resolution >= 2)
  const gridDenom = resolution - 1;

  for (let ix = 0; ix < resolution; ix++) {
    for (let iy = 0; iy < resolution; iy++) {
      // Map grid indices to parametric [0,1] coordinates
      const tx = ix / gridDenom;
      const ty = iy / gridDenom;

      // Map to complex plane: x = real, y = imaginary
      const x = (effectiveCenter[0] ?? -0.5) - extent + 2 * extent * tx;
      const y = (effectiveCenter[1] ?? 0) - extent + 2 * extent * ty;

      // 2D c vector
      const cVector: VectorND = [x, y];

      // Compute escape time
      const escapeTime = useSmooth
        ? mandelbrotSmoothEscapeTime(cVector, maxIterations, escapeRadius)
        : mandelbrotEscapeTime(cVector, maxIterations, escapeRadius);

      samples.push({
        // Map to 3D world position on X-Z plane at Y=0
        worldPos: [x, 0, y],
        cVector,
        escapeTime,
      });
    }
  }

  return samples;
}

/**
 * Filter samples based on color mode
 *
 * For most modes, we keep ALL points - the fractal structure emerges
 * from the color pattern based on escape time, not from filtering.
 *
 * For 'boundaryOnly' mode (useful for 3D+ visualization), we filter
 * to show only points near the fractal boundary.
 *
 * @param samples - All computed samples
 * @param config - Mandelbrot configuration
 * @returns Filtered array of samples to render
 */
export function filterSamples(
  samples: MandelbrotSample[],
  config: MandelbrotConfig
): MandelbrotSample[] {
  const { maxIterations, colorMode, boundaryThreshold } = config;

  switch (colorMode) {
    case 'interiorOnly':
      // Only show points inside the set (bounded points)
      return samples.filter(s => s.escapeTime >= maxIterations);

    case 'boundaryOnly': {
      // Show only points near the boundary (useful for 3D+ visualization)
      // This reveals the fractal surface structure instead of showing all grid points
      const [minRatio, maxRatio] = boundaryThreshold;
      const minIter = maxIterations * minRatio;
      const maxIter = maxIterations * maxRatio;
      return samples.filter(s =>
        s.escapeTime >= minIter && s.escapeTime <= maxIter
      );
    }

    case 'escapeTime':
    case 'smoothColoring':
    case 'distanceEstimation':
    default:
      // Keep ALL points - fractal structure comes from coloring
      return samples;
  }
}
