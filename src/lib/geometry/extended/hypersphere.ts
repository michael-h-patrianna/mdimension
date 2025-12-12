/**
 * Hypersphere Generator
 *
 * Generates n-dimensional hyperspheres:
 * - Surface mode: Points uniformly distributed on the (n-1)-sphere boundary
 * - Solid mode: Points uniformly distributed throughout the n-ball interior
 *
 * Uses Gaussian normalization for uniform surface sampling and proper
 * radial distribution for solid sampling.
 *
 * @see docs/research/nd-extended-objects-guide.md Section 1
 */

import type { VectorND } from '@/lib/math/types';
import type { NdGeometry } from '../types';
import type { HypersphereConfig } from './types';
import { buildKnnEdges } from './utils/knn-edges';

/**
 * Generates a random number from standard normal distribution N(0,1)
 * using the Box-Muller transform
 *
 * @returns A random number from N(0,1)
 */
function randomNormal(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  // Box-Muller transform
  const r = Math.sqrt(-2 * Math.log(u1 + 1e-10)); // Add small epsilon to avoid log(0)
  const theta = 2 * Math.PI * u2;
  return r * Math.cos(theta);
}

/**
 * Samples points uniformly distributed on the surface of an n-dimensional hypersphere
 *
 * Algorithm: Gaussian normalization
 * 1. Sample each coordinate from N(0,1)
 * 2. Normalize the vector to have the desired radius
 *
 * @param dimension - Dimensionality of the ambient space
 * @param sampleCount - Number of points to sample
 * @param radius - Radius of the hypersphere
 * @returns Array of n-dimensional points on the sphere surface
 */
export function sampleHypersphereSurface(
  dimension: number,
  sampleCount: number,
  radius: number = 1.0
): VectorND[] {
  const points: VectorND[] = [];

  for (let k = 0; k < sampleCount; k++) {
    // Sample from n-dimensional Gaussian
    const g: number[] = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
      g[i] = randomNormal();
    }

    // Compute norm
    let normSq = 0;
    for (let i = 0; i < dimension; i++) {
      normSq += g[i]! * g[i]!;
    }
    const norm = Math.sqrt(normSq) || 1e-10; // Avoid division by zero

    // Normalize to radius
    const point: VectorND = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
      point[i] = (radius * g[i]!) / norm;
    }

    points.push(point);
  }

  return points;
}

/**
 * Samples points uniformly distributed inside an n-dimensional ball (solid hypersphere)
 *
 * Algorithm:
 * 1. Sample a unit surface point using Gaussian normalization
 * 2. Sample t ~ U(0,1)
 * 3. Set r = R * t^(1/n) for proper radial distribution
 * 4. Scale the surface point by r
 *
 * @param dimension - Dimensionality of the ambient space
 * @param sampleCount - Number of points to sample
 * @param radius - Radius of the ball
 * @returns Array of n-dimensional points inside the ball
 */
export function sampleHypersphereSolid(
  dimension: number,
  sampleCount: number,
  radius: number = 1.0
): VectorND[] {
  const points: VectorND[] = [];

  for (let k = 0; k < sampleCount; k++) {
    // 1. Sample unit surface point
    const g: number[] = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
      g[i] = randomNormal();
    }

    let normSq = 0;
    for (let i = 0; i < dimension; i++) {
      normSq += g[i]! * g[i]!;
    }
    const norm = Math.sqrt(normSq) || 1e-10;

    // Normalize to unit sphere
    const u: number[] = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
      u[i] = g[i]! / norm;
    }

    // 2. Random radius with correct distribution
    const t = Math.random();
    const r = radius * Math.pow(t, 1 / dimension);

    // 3. Scale
    const point: VectorND = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
      point[i] = r * u[i]!;
    }

    points.push(point);
  }

  return points;
}

/**
 * Generates a hypersphere geometry
 *
 * @param dimension - Dimensionality of the ambient space (3-11)
 * @param config - Hypersphere configuration options
 * @returns NdGeometry representing the hypersphere
 * @throws {Error} If dimension is less than 3
 *
 * @example
 * ```typescript
 * const sphere = generateHypersphere(4, {
 *   mode: 'surface',
 *   sampleCount: 2000,
 *   radius: 1.0,
 *   wireframeEnabled: false,
 *   neighborCount: 4,
 * });
 * ```
 */
export function generateHypersphere(
  dimension: number,
  config: HypersphereConfig
): NdGeometry {
  if (dimension < 3) {
    throw new Error('Hypersphere dimension must be at least 3');
  }

  const { mode, sampleCount, radius, wireframeEnabled, neighborCount } = config;

  // Generate points based on mode
  const vertices = mode === 'surface'
    ? sampleHypersphereSurface(dimension, sampleCount, radius)
    : sampleHypersphereSolid(dimension, sampleCount, radius);

  // Generate k-NN edges when wireframe is enabled (controlled by Edges toggle)
  const edges: [number, number][] = wireframeEnabled
    ? buildKnnEdges(vertices, neighborCount)
    : [];

  // Determine the name based on mode and dimension
  const sphereName = mode === 'surface'
    ? `S^${dimension - 1}` // (n-1)-sphere
    : `B^${dimension}`; // n-ball

  return {
    dimension,
    type: 'hypersphere',
    vertices,
    edges,
    isPointCloud: true,
    metadata: {
      name: `${dimension}D Hypersphere (${sphereName})`,
      formula: mode === 'surface'
        ? `||x|| = ${radius}`
        : `||x|| <= ${radius}`,
      properties: {
        mode,
        sampleCount,
        radius,
        wireframeEnabled,
        neighborCount: wireframeEnabled ? neighborCount : undefined,
      },
    },
  };
}
