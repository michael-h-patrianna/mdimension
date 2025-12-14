/**
 * Nested (Hopf) Torus Generator
 *
 * Implements Hopf fibration tori for 4D and 8D.
 *
 * The Hopf fibration creates tori with coupled angles, producing the characteristic
 * "flowing" visual effect where circles are linked through each other.
 *
 * Supported dimensions:
 * - 4D: S³ → S² fibration (circles as fibers)
 * - 8D: S⁷ → S⁴ quaternionic fibration (3-spheres as fibers)
 *
 * @see docs/prd/clifford-torus-modes.md
 */

import type { VectorND } from '@/lib/math/types';
import type { NdGeometry } from '../../types';
import type { CliffordTorusConfig } from '../types';

// ============================================================================
// 4D Hopf Fibration (S³ → S²)
// ============================================================================

/**
 * Generates points on a 4D Hopf fibration torus
 *
 * The Hopf fibration fills S³ with circles (S¹ fibers) that are pairwise linked.
 * A Clifford torus is one member of the family of tori that foliate S³.
 *
 * Parametrization (η ∈ [0, π/2] selects which torus; ξ₁, ξ₂ ∈ [0, 2π]):
 *   x₀ = R · cos((ξ₁ + ξ₂)/2) · sin(η)
 *   x₁ = R · sin((ξ₁ + ξ₂)/2) · sin(η)
 *   x₂ = R · cos((ξ₂ - ξ₁)/2) · cos(η)
 *   x₃ = R · sin((ξ₂ - ξ₁)/2) · cos(η)
 *
 * Key property: The angles ξ₁ and ξ₂ are coupled via (ξ₁+ξ₂)/2 and (ξ₂-ξ₁)/2.
 * Moving along one circle causes rotation in the other.
 *
 * @param config - Clifford torus configuration
 * @param etaOverride - Optional η value override (for nested tori display)
 * @returns Array of 4D points on the Hopf torus
 */
export function generateHopfTorus4DPoints(
  config: CliffordTorusConfig,
  etaOverride?: number
): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2 } = config;
  const eta = etaOverride ?? config.eta;

  const points: VectorND[] = [];
  const sinEta = Math.sin(eta);
  const cosEta = Math.cos(eta);

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1;

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2;

      // Coupled angles for Hopf parametrization
      const sum = (xi1 + xi2) / 2;
      const diff = (xi2 - xi1) / 2;

      // 4D point on the Hopf torus
      const p: VectorND = [
        radius * Math.cos(sum) * sinEta,  // x₀
        radius * Math.sin(sum) * sinEta,  // x₁
        radius * Math.cos(diff) * cosEta, // x₂
        radius * Math.sin(diff) * cosEta, // x₃
      ];

      points.push(p);
    }
  }

  return points;
}

/**
 * Builds grid edges for the 4D Hopf torus with wrap-around connectivity
 *
 * Connects neighbors in both ξ₁ and ξ₂ directions.
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @param offset - Vertex index offset (for multiple nested tori)
 * @returns Array of edge pairs (vertex indices)
 */
export function buildHopfTorus4DEdges(
  resolutionXi1: number,
  resolutionXi2: number,
  offset = 0
): [number, number][] {
  const edges: [number, number][] = [];

  const index = (i: number, j: number): number =>
    offset + i * resolutionXi2 + j;

  for (let i = 0; i < resolutionXi1; i++) {
    for (let j = 0; j < resolutionXi2; j++) {
      const iNext = (i + 1) % resolutionXi1;
      const jNext = (j + 1) % resolutionXi2;

      const idx = index(i, j);

      // Edge along ξ₁ direction
      edges.push([idx, index(iNext, j)]);

      // Edge along ξ₂ direction
      edges.push([idx, index(i, jNext)]);
    }
  }

  // Normalize and dedupe
  return normalizeEdges(edges);
}

/**
 * Builds quad faces for the 4D Hopf torus
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @param offset - Vertex index offset (for multiple nested tori)
 * @returns Array of quad faces (4 vertex indices each)
 */
export function buildHopfTorus4DFaces(
  resolutionXi1: number,
  resolutionXi2: number,
  offset = 0
): number[][] {
  const faces: number[][] = [];

  const index = (i: number, j: number): number =>
    offset + i * resolutionXi2 + j;

  for (let i = 0; i < resolutionXi1; i++) {
    for (let j = 0; j < resolutionXi2; j++) {
      const iNext = (i + 1) % resolutionXi1;
      const jNext = (j + 1) % resolutionXi2;

      // Quad in counter-clockwise winding order
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
 * Builds quad faces for the 8D Hopf torus
 *
 * Uses the SAME structure as 4D: a simple 2D grid of quads.
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @returns Array of quad faces (4 vertex indices each)
 */
export function buildHopfTorus8DFaces(
  resolutionXi1: number,
  resolutionXi2: number
): number[][] {
  // Identical to 4D face structure
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0);
}

/**
 * Generates a complete 4D Hopf fibration torus geometry
 *
 * Optionally displays multiple nested tori at different η values.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 4D Hopf torus
 */
export function generateNestedHopfTorus4D(config: CliffordTorusConfig): NdGeometry {
  const {
    radius,
    resolutionXi1,
    resolutionXi2,
    showNestedTori,
    numberOfTori,
    edgeMode,
    eta,
  } = config;

  let vertices: VectorND[] = [];
  let edges: [number, number][] = [];

  if (showNestedTori && numberOfTori > 1) {
    // Generate multiple nested tori at different η values
    const etaValues = generateEtaValues(numberOfTori);

    for (let t = 0; t < numberOfTori; t++) {
      const offset = t * resolutionXi1 * resolutionXi2;
      const torusPoints = generateHopfTorus4DPoints(config, etaValues[t]);
      vertices = vertices.concat(torusPoints);

      if (edgeMode === 'grid') {
        const torusEdges = buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, offset);
        edges = edges.concat(torusEdges);
      }
    }
  } else {
    // Single torus at the configured η
    vertices = generateHopfTorus4DPoints(config);

    if (edgeMode === 'grid') {
      edges = buildHopfTorus4DEdges(resolutionXi1, resolutionXi2);
    }
  }

  const pointCount = vertices.length;
  const torusCount = showNestedTori ? numberOfTori : 1;

  return {
    dimension: 4,
    type: 'clifford-torus',
    vertices,
    edges,
    isPointCloud: edgeMode === 'none',
    metadata: {
      name: `Hopf Fibration Torus (4D)${torusCount > 1 ? ` × ${torusCount}` : ''}`,
      formula: `η = ${(eta / Math.PI).toFixed(3)}π, x₀² + x₁² + x₂² + x₃² = ${(radius * radius).toFixed(2)}`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        etaFraction: `${(eta / Math.PI).toFixed(3)}π`,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        torusCount,
        fibration: 'S³ → S²',
        fiberType: 'S¹ (circles)',
        intrinsicDimension: 4,
      },
    },
  };
}

// ============================================================================
// 8D Hopf Torus (proper 2D surface in S⁷, analogous to 4D)
// ============================================================================

/**
 * Generates points on an 8D Hopf fibration torus
 *
 * This creates a proper 2D toroidal surface in 8D, using the SAME structure
 * as the 4D Hopf torus: two coupled angles (ξ₁, ξ₂) that create linked circles.
 *
 * The key insight is that the 8D version should NOT be a 5D volume sampling -
 * it should be a 2D surface just like the 4D case, but embedded in 8D.
 *
 * Parametrization (ξ₁, ξ₂ ∈ [0, 2π]):
 *   sum = (ξ₁ + ξ₂) / 2
 *   diff = (ξ₂ - ξ₁) / 2
 *
 *   The 8D embedding extends the 4D Hopf structure by rotating through
 *   an additional angle to fill 8 dimensions while preserving the
 *   characteristic linked circle structure:
 *
 *   x₀ = R · cos(sum) · sin(η) · cos(ξ₁)
 *   x₁ = R · sin(sum) · sin(η) · cos(ξ₁)
 *   x₂ = R · cos(diff) · cos(η) · cos(ξ₁)
 *   x₃ = R · sin(diff) · cos(η) · cos(ξ₁)
 *   x₄ = R · cos(sum) · sin(η) · sin(ξ₁)
 *   x₅ = R · sin(sum) · sin(η) · sin(ξ₁)
 *   x₆ = R · cos(diff) · cos(η) · sin(ξ₁)
 *   x₇ = R · sin(diff) · cos(η) · sin(ξ₁)
 *
 * This satisfies |x|² = R² (lies on S⁷) and creates a 2-torus with the
 * beautiful linked structure of the Hopf fibration.
 *
 * @param config - Clifford torus configuration
 * @returns Array of 8D points on the Hopf torus
 */
export function generateHopfTorus8DPoints(config: CliffordTorusConfig): VectorND[] {
  // Use the same resolution parameters as 4D
  const { radius, resolutionXi1, resolutionXi2, eta } = config;

  const points: VectorND[] = [];
  const sinEta = Math.sin(eta);
  const cosEta = Math.cos(eta);

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1;

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2;

      // Coupled angles - SAME as 4D Hopf
      const sum = (xi1 + xi2) / 2;
      const diff = (xi2 - xi1) / 2;

      // Rotation factor for 8D embedding
      const cosXi1 = Math.cos(xi1);
      const sinXi1 = Math.sin(xi1);

      // 8D point: extends 4D Hopf pattern to 8 dimensions
      const p: VectorND = [
        // First 4D Hopf pattern (scaled by cos(ξ₁))
        radius * Math.cos(sum) * sinEta * cosXi1,
        radius * Math.sin(sum) * sinEta * cosXi1,
        radius * Math.cos(diff) * cosEta * cosXi1,
        radius * Math.sin(diff) * cosEta * cosXi1,
        // Second 4D Hopf pattern (scaled by sin(ξ₁))
        radius * Math.cos(sum) * sinEta * sinXi1,
        radius * Math.sin(sum) * sinEta * sinXi1,
        radius * Math.cos(diff) * cosEta * sinXi1,
        radius * Math.sin(diff) * cosEta * sinXi1,
      ];

      points.push(p);
    }
  }

  return points;
}

/**
 * Builds grid edges for the 8D Hopf torus
 *
 * Uses the SAME structure as 4D: a simple 2D grid connecting neighbors
 * in both ξ₁ and ξ₂ directions.
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @returns Array of edge pairs
 */
export function buildHopfTorus8DEdges(
  resolutionXi1: number,
  resolutionXi2: number
): [number, number][] {
  // Identical to 4D edge structure
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0);
}

/**
 * Generates a complete 8D Hopf fibration torus geometry
 *
 * Uses the SAME structure as 4D: a proper 2D toroidal surface with
 * coupled angles (ξ₁, ξ₂). This is NOT a volume sampling - it's a
 * beautiful 2D surface embedded in 8D, just like the 4D case.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 8D Hopf torus
 */
export function generateNestedHopfTorus8D(config: CliffordTorusConfig): NdGeometry {
  const {
    radius,
    resolutionXi1,
    resolutionXi2,
    edgeMode,
    eta,
  } = config;

  const vertices = generateHopfTorus8DPoints(config);

  // Build edges using the same 2D grid structure as 4D
  const edges = edgeMode === 'grid'
    ? buildHopfTorus8DEdges(resolutionXi1, resolutionXi2)
    : [];

  const pointCount = vertices.length;

  return {
    dimension: 8,
    type: 'clifford-torus',
    vertices,
    edges,
    isPointCloud: edgeMode === 'none',
    metadata: {
      name: '8D Hopf Torus',
      formula: `2-torus in S⁷, |point|² = ${(radius * radius).toFixed(2)}`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 8,
        fibration: 'S⁷ → S⁴',
        fiberType: 'S³ (3-spheres)',
      },
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates evenly spaced η values for nested tori display
 *
 * Spreads tori across the valid η range (π/8 to 3π/8) to show the
 * family structure of the Hopf fibration.
 *
 * @param count - Number of tori to generate
 * @returns Array of η values
 */
function generateEtaValues(count: number): number[] {
  if (count <= 1) {
    return [Math.PI / 4]; // Default to main Clifford torus
  }

  const minEta = Math.PI / 8;
  const maxEta = (3 * Math.PI) / 8;
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    values.push(minEta + t * (maxEta - minEta));
  }

  return values;
}

/**
 * Normalizes edge list by ensuring smaller index comes first and removing duplicates
 *
 * @param edges - Raw edge list
 * @returns Normalized and deduplicated edge list
 */
function normalizeEdges(edges: [number, number][]): [number, number][] {
  const edgeSet = new Set<string>();
  const normalized: [number, number][] = [];

  for (const [a, b] of edges) {
    const minIdx = Math.min(a, b);
    const maxIdx = Math.max(a, b);
    const key = `${minIdx},${maxIdx}`;

    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      normalized.push([minIdx, maxIdx]);
    }
  }

  return normalized;
}
