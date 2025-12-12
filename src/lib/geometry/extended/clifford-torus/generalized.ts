/**
 * Generalized Clifford Torus (Tᵏ ⊂ S^(2k-1) ⊂ ℝ^(2k))
 *
 * Implements generation logic for generalized k-tori.
 */

import type { VectorND } from '@/lib/math/types';
import type { NdGeometry } from '../../types';
import type { CliffordTorusConfig } from '../types';

/**
 * Configuration for generalized Clifford torus point generation
 */
export interface GeneralizedCliffordConfig {
  /** Ambient dimension n (must satisfy 2k ≤ n) */
  n: number;
  /** Torus dimension k (k ≥ 1) */
  k: number;
  /** Number of steps per circular parameter (total points = stepsPerCircle^k) */
  stepsPerCircle: number;
  /** Overall radius scale (default 1.0) */
  radiusScale: number;
}

/**
 * Generates points on a generalized Clifford k-torus Tᵏ ⊂ S^(2k-1) ⊂ ℝ^(2k)
 *
 * The generalized Clifford torus is the set where all |zₘ| are equal:
 * |z₁| = |z₂| = ... = |zₖ| = 1/√k
 *
 * Parametrized by k angles θ₁,...,θₖ:
 * - zₘ = (1/√k) e^(iθₘ)
 *
 * In real coordinates for m = 1...k:
 * - x_{2m-1} = (R/√k) cos(θₘ)
 * - x_{2m} = (R/√k) sin(θₘ)
 *
 * @param config - Generation configuration
 * @returns Array of n-dimensional points on the generalized torus
 * @throws {Error} If k < 1 or 2k > n
 */
export function generateGeneralizedCliffordTorusPoints(
  config: GeneralizedCliffordConfig
): VectorND[] {
  const { n, k, stepsPerCircle, radiusScale } = config;

  if (k < 1) {
    throw new Error('Generalized Clifford torus requires k >= 1');
  }
  if (2 * k > n) {
    throw new Error(`Generalized Clifford torus with k=${k} requires n >= ${2 * k}, but n=${n}`);
  }

  const points: VectorND[] = [];
  const baseRadius = 1 / Math.sqrt(k); // Each |zₘ| = 1/√k
  const R = baseRadius * radiusScale; // Optional global scale

  /**
   * Recursively builds the k-dimensional grid over angles θ₁...θₖ
   * @param level
   * @param angles
   */
  function recurse(level: number, angles: number[]): void {
    if (level === k) {
      const p: VectorND = new Array(n).fill(0);

      for (let m = 0; m < k; m++) {
        const theta = angles[m]!;
        p[2 * m] = R * Math.cos(theta); // x_{2m} (0-indexed: x₀, x₂, x₄, ...)
        p[2 * m + 1] = R * Math.sin(theta); // x_{2m+1} (0-indexed: x₁, x₃, x₅, ...)
      }
      // Coordinates 2k..n-1 remain 0

      points.push(p);
      return;
    }

    for (let s = 0; s < stepsPerCircle; s++) {
      const theta = (2 * Math.PI * s) / stepsPerCircle;
      recurse(level + 1, [...angles, theta]);
    }
  }

  recurse(0, []);

  return points;
}

/**
 * Builds grid edges for a generalized Clifford k-torus
 *
 * Connects neighbors in each θₘ direction with wrap-around.
 * Warning: Edge count grows as k × stepsPerCircle^k, which can be very large.
 *
 * @param k - Torus dimension
 * @param stepsPerCircle - Resolution per circular parameter
 * @returns Array of edge pairs (vertex indices)
 */
export function buildGeneralizedCliffordTorusEdges(
  k: number,
  stepsPerCircle: number
): [number, number][] {
  if (k < 1) {
    return [];
  }

  const edges: [number, number][] = [];
  const totalPoints = Math.pow(stepsPerCircle, k);

  /**
   * Converts multi-index [i₁, i₂, ..., iₖ] to linear index
   * @param indices
   */
  function multiIndexToLinear(indices: number[]): number {
    let idx = 0;
    for (let m = 0; m < k; m++) {
      idx = idx * stepsPerCircle + indices[m]!;
    }
    return idx;
  }

  /**
   * Converts linear index to multi-index
   * @param idx
   */
  function linearToMultiIndex(idx: number): number[] {
    const indices: number[] = new Array(k);
    let remaining = idx;
    for (let m = k - 1; m >= 0; m--) {
      indices[m] = remaining % stepsPerCircle;
      remaining = Math.floor(remaining / stepsPerCircle);
    }
    return indices;
  }

  const edgeSet = new Set<string>();

  // For each point, connect to neighbors in each dimension
  for (let idx = 0; idx < totalPoints; idx++) {
    const multiIdx = linearToMultiIndex(idx);

    for (let dim = 0; dim < k; dim++) {
      // Create neighbor by incrementing in dimension `dim` with wrap-around
      const neighborMultiIdx = [...multiIdx];
      neighborMultiIdx[dim] = (neighborMultiIdx[dim]! + 1) % stepsPerCircle;
      const neighborIdx = multiIndexToLinear(neighborMultiIdx);

      // Add edge in canonical order
      const minIdx = Math.min(idx, neighborIdx);
      const maxIdx = Math.max(idx, neighborIdx);
      const key = `${minIdx},${maxIdx}`;

      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([minIdx, maxIdx]);
      }
    }
  }

  return edges;
}

/**
 * Builds quad faces for a generalized Clifford k-torus
 *
 * Only generates faces when k=2 (the manifold is a 2D surface).
 * For k>2, the torus is a higher-dimensional manifold where
 * 2D faces are not geometrically meaningful.
 * For k=1, a circle has no 2D faces.
 *
 * @param k - Torus dimension (only k=2 supported for faces)
 * @param stepsPerCircle - Resolution per circular parameter
 * @returns Array of quad faces (empty if k !== 2)
 */
export function buildGeneralizedCliffordTorusFaces(
  k: number,
  stepsPerCircle: number
): number[][] {
  // Only 2-torus (k=2) has well-defined 2D faces
  if (k !== 2) {
    return [];
  }

  const faces: number[][] = [];

  // For k=2, use the multi-index system: (i, j) -> i * stepsPerCircle + j
  const index = (i: number, j: number): number => i * stepsPerCircle + j;

  for (let i = 0; i < stepsPerCircle; i++) {
    for (let j = 0; j < stepsPerCircle; j++) {
      const iNext = (i + 1) % stepsPerCircle;
      const jNext = (j + 1) % stepsPerCircle;

      // Quad vertices in counter-clockwise winding order
      faces.push([
        index(i, j),
        index(iNext, j),
        index(iNext, jNext),
        index(i, jNext),
      ]);
    }
  }

  return faces;
}

/**
 * Generates a generalized Clifford torus geometry
 *
 * @param dimension - Ambient dimension n
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the generalized Clifford torus
 * @throws {Error} If dimension < 2 (minimum for k=1)
 */
export function generateGeneralizedCliffordTorus(
  dimension: number,
  config: CliffordTorusConfig
): NdGeometry {
  const { radius, stepsPerCircle, edgeMode } = config;

  // Auto-clamp k to valid range for this dimension
  const maxK = Math.floor(dimension / 2);
  const k = Math.max(1, Math.min(config.k, maxK));

  if (dimension < 2) {
    throw new Error('Generalized Clifford torus requires dimension >= 2');
  }

  // Generate points
  const vertices = generateGeneralizedCliffordTorusPoints({
    n: dimension,
    k,
    stepsPerCircle,
    radiusScale: radius,
  });

  // Generate edges based on mode
  // Note: For k >= 3, edges can become very numerous - consider defaulting to 'none'
  const edges: [number, number][] = edgeMode === 'grid'
    ? buildGeneralizedCliffordTorusEdges(k, stepsPerCircle)
    : [];

  const pointCount = Math.pow(stepsPerCircle, k);

  return {
    dimension,
    type: 'clifford-torus',
    vertices,
    edges,
    isPointCloud: edgeMode === 'none',
    metadata: {
      name: `Generalized Clifford T${superscript(k)} (${k}-torus on S${superscript(2 * k - 1)})`,
      formula: `∑|zₘ|² = ${(radius * radius).toFixed(2)}, |zₘ| = ${(radius / Math.sqrt(k)).toFixed(3)}`,
      properties: {
        mode: 'generalized',
        radius,
        k,
        stepsPerCircle,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        // The torus lies on S^(2k-1) with radius R
        sphereDimension: 2 * k - 1,
        intrinsicDimension: 2 * k,
      },
    },
  };
}

/**
 * Helper function to create Unicode superscript for dimension labels
 * @param n
 */
function superscript(n: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return String(n).split('').map(c => superscriptMap[c] ?? c).join('');
}
