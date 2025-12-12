/**
 * 2D Annulus Generator
 *
 * Generates a 2D annulus (ring) as the 2D equivalent of the Clifford torus.
 * Uses the same resolution controls as the Clifford torus.
 */

import type { VectorND } from '@/lib/math/types';
import type { NdGeometry } from '../../types';
import type { CliffordTorusConfig } from '../types';

/**
 * Generates points for a 2D annulus (ring)
 *
 * Uses resolutionU for angular samples and resolutionV for radial samples.
 * The inner radius is derived from the outer radius based on resolution.
 *
 * @param config - Clifford torus configuration (uses radius, resolutionU, resolutionV)
 * @returns Array of 2D points in the annulus
 */
export function generateAnnulusPoints(config: CliffordTorusConfig): VectorND[] {
  const { radius, resolutionU, resolutionV } = config;
  const points: VectorND[] = [];

  // Inner radius is 50% of outer radius for a visually balanced annulus
  // This ratio provides a good visual appearance while being configurable via resolution
  const innerRadius = radius * 0.5;
  const outerRadius = radius;

  // Number of radial samples (thickness of the ring)
  // Use resolutionV for radial sampling, minimum 2 for inner and outer circles
  const radialSteps = Math.max(2, resolutionV);

  // Number of angular samples around the ring
  const angularSteps = resolutionU;

  for (let r = 0; r < radialSteps; r++) {
    // Interpolate radius from inner to outer
    const t = radialSteps === 1 ? 1 : r / (radialSteps - 1);
    const currentRadius = innerRadius + t * (outerRadius - innerRadius);

    for (let a = 0; a < angularSteps; a++) {
      const theta = (2 * Math.PI * a) / angularSteps;

      // 2D point on the annulus
      const p: VectorND = [
        currentRadius * Math.cos(theta),
        currentRadius * Math.sin(theta),
      ];

      points.push(p);
    }
  }

  return points;
}

/**
 * Builds grid edges for the 2D annulus
 *
 * Creates edges connecting points along angular and radial directions,
 * with wrap-around in the angular direction.
 *
 * @param resolutionU - Number of angular steps
 * @param resolutionV - Number of radial steps
 * @returns Array of edge pairs (vertex indices)
 */
export function buildAnnulusGridEdges(
  resolutionU: number,
  resolutionV: number
): [number, number][] {
  const edges: [number, number][] = [];
  const radialSteps = Math.max(2, resolutionV);
  const angularSteps = resolutionU;

  // Index function: (radial, angular) -> linear index
  const index = (r: number, a: number): number => r * angularSteps + a;

  for (let r = 0; r < radialSteps; r++) {
    for (let a = 0; a < angularSteps; a++) {
      const aNext = (a + 1) % angularSteps;
      const idx = index(r, a);

      // Edge along angular direction (around the ring) - always wrap
      edges.push([idx, index(r, aNext)]);

      // Edge along radial direction (from inner to outer) - no wrap
      if (r < radialSteps - 1) {
        edges.push([idx, index(r + 1, a)]);
      }
    }
  }

  // Normalize edges (smaller index first) and dedupe
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
 * Builds quad faces for the 2D annulus
 *
 * The annulus wraps around in the angular direction but NOT in the
 * radial direction (it has inner and outer boundaries).
 * Each grid cell (r, a) forms a quad connecting adjacent radial and angular neighbors.
 *
 * @param resolutionU - Number of angular steps
 * @param resolutionV - Number of radial steps
 * @returns Array of quad faces (4 vertex indices each, counter-clockwise winding)
 */
export function buildAnnulusGridFaces(
  resolutionU: number,
  resolutionV: number
): number[][] {
  const faces: number[][] = [];
  const radialSteps = Math.max(2, resolutionV);
  const angularSteps = resolutionU;

  // Index function: (radial, angular) -> linear index
  const index = (r: number, a: number): number => r * angularSteps + a;

  for (let r = 0; r < radialSteps - 1; r++) {
    // NO wrap in radial direction
    for (let a = 0; a < angularSteps; a++) {
      const aNext = (a + 1) % angularSteps; // Wrap in angular direction

      // Quad vertices in counter-clockwise winding order
      faces.push([
        index(r, a),
        index(r + 1, a),
        index(r + 1, aNext),
        index(r, aNext),
      ]);
    }
  }

  return faces;
}

/**
 * Generates a 2D annulus geometry
 *
 * The annulus is the 2D equivalent of the Clifford torus.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 2D annulus
 */
export function generateAnnulus(config: CliffordTorusConfig): NdGeometry {
  const { radius, resolutionU, resolutionV, edgeMode } = config;

  // Generate points
  const vertices = generateAnnulusPoints(config);

  // Generate edges based on mode
  const edges: [number, number][] =
    edgeMode === 'grid' ? buildAnnulusGridEdges(resolutionU, resolutionV) : [];

  const radialSteps = Math.max(2, resolutionV);
  const pointCount = radialSteps * resolutionU;

  return {
    dimension: 2,
    type: 'clifford-torus',
    vertices,
    edges,
    isPointCloud: edgeMode === 'none',
    metadata: {
      name: 'Annulus (2D ring)',
      formula: `${(radius * 0.5).toFixed(2)} ≤ ||(x,y)|| ≤ ${radius.toFixed(2)}`,
      properties: {
        mode: '2d-annulus',
        radius,
        innerRadius: radius * 0.5,
        outerRadius: radius,
        resolutionU,
        resolutionV,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 2,
      },
    },
  };
}
