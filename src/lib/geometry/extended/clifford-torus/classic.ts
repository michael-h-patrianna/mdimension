/**
 * Classic Clifford Torus (4D)
 *
 * Implements generation logic for the classic Clifford torus in 4D.
 */

import type { VectorND } from '@/lib/math/types';
import type { NdGeometry } from '../../types';
import type { CliffordTorusConfig } from '../types';

/**
 * Generates points on the classic Clifford torus
 *
 * @param dimension - Ambient dimension (must be >= 4)
 * @param config - Clifford torus configuration
 * @returns Array of n-dimensional points on the torus
 * @throws {Error} If dimension < 4
 */
export function generateCliffordTorusPoints(
  dimension: number,
  config: CliffordTorusConfig
): VectorND[] {
  if (dimension < 4) {
    throw new Error('Clifford torus requires ambient dimension >= 4');
  }

  const { radius, resolutionU, resolutionV } = config;
  const points: VectorND[] = [];
  const factor = radius / Math.sqrt(2);

  for (let i = 0; i < resolutionU; i++) {
    const u = (2 * Math.PI * i) / resolutionU;
    const cu = Math.cos(u);
    const su = Math.sin(u);

    for (let j = 0; j < resolutionV; j++) {
      const v = (2 * Math.PI * j) / resolutionV;
      const cv = Math.cos(v);
      const sv = Math.sin(v);

      // Create n-dimensional point
      const p: VectorND = new Array(dimension).fill(0);
      p[0] = factor * cu;
      p[1] = factor * su;
      p[2] = factor * cv;
      p[3] = factor * sv;
      // Coordinates 4..(n-1) remain 0

      points.push(p);
    }
  }

  return points;
}

/**
 * Builds grid edges for the Clifford torus with wrap-around connectivity
 *
 * Creates edges connecting each point to its neighbors in both u and v directions.
 *
 * @param resolutionU - Number of steps in the u direction
 * @param resolutionV - Number of steps in the v direction
 * @returns Array of edge pairs (vertex indices)
 */
export function buildCliffordTorusGridEdges(
  resolutionU: number,
  resolutionV: number
): [number, number][] {
  const edges: [number, number][] = [];

  // Index function: (i, j) -> linear index
  const index = (i: number, j: number): number => i * resolutionV + j;

  for (let i = 0; i < resolutionU; i++) {
    for (let j = 0; j < resolutionV; j++) {
      const iNext = (i + 1) % resolutionU;
      const jNext = (j + 1) % resolutionV;

      const idx = index(i, j);
      const idxU = index(iNext, j);
      const idxV = index(i, jNext);

      // Edge along u direction
      // Only add if it creates a valid edge (avoid duplicates)
      if (i < resolutionU - 1) {
        edges.push([idx, idxU]);
      } else {
        // Wraparound edge for u
        edges.push([index(iNext, j), idx]);
      }

      // Edge along v direction
      if (j < resolutionV - 1) {
        edges.push([idx, idxV]);
      } else {
        // Wraparound edge for v
        edges.push([index(i, jNext), idx]);
      }
    }
  }

  // Remove any edges where first index > second index and dedupe
  const normalizedEdges: [number, number][] = [];
  const edgeSet = new Set<string>();

  for (const [a, b] of edges) {
    const minIdx = Math.min(a, b);
    const maxIdx = Math.max(a, b);
    const key = `${minIdx},${maxIdx}`;

    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      normalizedEdges.push([minIdx, maxIdx]);
    }
  }

  return normalizedEdges;
}

/**
 * Generates a classic Clifford torus geometry (T² ⊂ S³ ⊂ ℝ⁴)
 *
 * @param dimension - Dimensionality of the ambient space (must be >= 4)
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the classic Clifford torus
 * @throws {Error} If dimension < 4
 */
export function generateClassicCliffordTorus(
  dimension: number,
  config: CliffordTorusConfig
): NdGeometry {
  if (dimension < 4) {
    throw new Error('Classic Clifford torus requires dimension >= 4');
  }

  const { radius, resolutionU, resolutionV, edgeMode } = config;

  // Generate points
  const vertices = generateCliffordTorusPoints(dimension, config);

  // Generate edges based on mode
  const edges: [number, number][] = edgeMode === 'grid'
    ? buildCliffordTorusGridEdges(resolutionU, resolutionV)
    : [];

  const pointCount = resolutionU * resolutionV;

  return {
    dimension,
    type: 'clifford-torus',
    vertices,
    edges,
    isPointCloud: edgeMode === 'none',
    metadata: {
      name: 'Clifford Torus (flat torus T² on S³)',
      formula: `x₁² + x₂² + x₃² + x₄² = ${(radius * radius).toFixed(2)}`,
      properties: {
        mode: 'classic',
        radius,
        resolutionU,
        resolutionV,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        // The torus lies on S³ with radius R
        sphereRadius: radius,
        intrinsicDimension: 4,
      },
    },
  };
}
