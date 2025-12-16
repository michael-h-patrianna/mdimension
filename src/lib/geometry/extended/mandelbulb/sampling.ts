/**
 * Sampling and Grid Generation
 *
 * Functions for generating the sample grid and filtering points.
 */

import type { VectorND } from '@/lib/math';
import type { MandelbulbConfig } from '../types';
import { mandelbulbEscapeTime, mandelbulbSmoothEscapeTime } from './math';

/**
 * Sample point data from Mandelbulb computation
 */
export interface MandelbulbSample {
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
 * @param dimension - Dimensionality of the Mandelbulb space
 * @param config - Mandelbulb configuration
 * @returns Array of sample points with world positions and c vectors
 */
export function generateSampleGrid(
  dimension: number,
  config: MandelbulbConfig
): MandelbulbSample[] {
  const { resolution, visualizationAxes, parameterValues, center, extent, maxIterations, escapeRadius, colorMode, mandelbulbPower } = config;
  const [ax, ay, az] = visualizationAxes;
  const samples: MandelbulbSample[] = [];

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

  // Pre-compute base center values
  const centerAx = effectiveCenter[ax] ?? 0;
  const centerAy = effectiveCenter[ay] ?? 0;
  const centerAz = effectiveCenter[az] ?? 0;

  // Pre-build template cVector with parameter values (reusable)
  // Only the three visualization axes (ax, ay, az) change per sample
  const templateCVector: VectorND = new Array(dimension).fill(0);
  let paramIdx = 0;
  for (let d = 0; d < dimension; d++) {
    if (d !== ax && d !== ay && d !== az) {
      templateCVector[d] = parameterValues[paramIdx] ?? 0;
      paramIdx++;
    }
  }

  // Reusable cVector for escape time computation (avoid allocation per sample)
  const workingCVector: VectorND = [...templateCVector];

  for (let ix = 0; ix < resolution; ix++) {
    // Map grid indices to parametric [0,1] coordinates
    const tx = ix / gridDenom;
    const x = centerAx - extent + 2 * extent * tx;

    for (let iy = 0; iy < resolution; iy++) {
      const ty = iy / gridDenom;
      const y = centerAy - extent + 2 * extent * ty;

      for (let iz = 0; iz < resolution; iz++) {
        const tz = iz / gridDenom;
        const z = centerAz - extent + 2 * extent * tz;

        // Update working cVector in-place (only 3 values change)
        workingCVector[ax] = x;
        workingCVector[ay] = y;
        workingCVector[az] = z;

        // Compute escape time (pass mandelbulbPower for 3D Mandelbulb)
        const escapeTime = useSmooth
          ? mandelbulbSmoothEscapeTime(workingCVector, maxIterations, escapeRadius, mandelbulbPower)
          : mandelbulbEscapeTime(workingCVector, maxIterations, escapeRadius, mandelbulbPower);

        // Create a copy of cVector for storage (samples need their own copy)
        const cVector: VectorND = [...workingCVector];

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
 * Filter samples based on color mode
 *
 * For most modes, we keep ALL points - the fractal structure emerges
 * from the color pattern based on escape time, not from filtering.
 *
 * For 'boundaryOnly' mode (useful for 3D+ visualization), we filter
 * to show only points near the fractal boundary.
 *
 * @param samples - All computed samples
 * @param config - Mandelbulb configuration
 * @returns Filtered array of samples to render
 */
export function filterSamples(
  samples: MandelbulbSample[],
  config: MandelbulbConfig
): MandelbulbSample[] {
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
