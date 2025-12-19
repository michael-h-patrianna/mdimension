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

import type { VectorND } from '@/lib/math/types'
import type { NdGeometry } from '../../types'
import type { NestedTorusConfig } from '../types'

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
  config: NestedTorusConfig,
  etaOverride?: number
): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2 } = config
  const eta = etaOverride ?? config.eta

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Coupled angles for Hopf parametrization
      const sum = (xi1 + xi2) / 2
      const diff = (xi2 - xi1) / 2

      // 4D point on the Hopf torus
      const p: VectorND = [
        radius * Math.cos(sum) * sinEta, // x₀
        radius * Math.sin(sum) * sinEta, // x₁
        radius * Math.cos(diff) * cosEta, // x₂
        radius * Math.sin(diff) * cosEta, // x₃
      ]

      points.push(p)
    }
  }

  return points
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
  const edges: [number, number][] = []

  const index = (i: number, j: number): number => offset + i * resolutionXi2 + j

  for (let i = 0; i < resolutionXi1; i++) {
    for (let j = 0; j < resolutionXi2; j++) {
      const iNext = (i + 1) % resolutionXi1
      const jNext = (j + 1) % resolutionXi2

      const idx = index(i, j)

      // Edge along ξ₁ direction
      edges.push([idx, index(iNext, j)])

      // Edge along ξ₂ direction
      edges.push([idx, index(i, jNext)])
    }
  }

  // Normalize and dedupe
  return normalizeEdges(edges)
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
  const faces: number[][] = []

  const index = (i: number, j: number): number => offset + i * resolutionXi2 + j

  for (let i = 0; i < resolutionXi1; i++) {
    for (let j = 0; j < resolutionXi2; j++) {
      const iNext = (i + 1) % resolutionXi1
      const jNext = (j + 1) % resolutionXi2

      // Quad in counter-clockwise winding order
      faces.push([index(i, j), index(iNext, j), index(iNext, jNext), index(i, jNext)])
    }
  }

  return faces
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
export function buildHopfTorus8DFaces(resolutionXi1: number, resolutionXi2: number): number[][] {
  // Identical to 4D face structure
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0)
}

/**
 * Generates a complete 4D Hopf fibration torus geometry
 *
 * Optionally displays multiple nested tori at different η values.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 4D Hopf torus
 */
export function generateNestedHopfTorus4D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, showNestedTori, numberOfTori, edgeMode, eta } =
    config

  let vertices: VectorND[] = []
  let edges: [number, number][] = []

  if (showNestedTori && numberOfTori > 1) {
    // Generate multiple nested tori at different η values
    const etaValues = generateEtaValues(numberOfTori)

    for (let t = 0; t < numberOfTori; t++) {
      const offset = t * resolutionXi1 * resolutionXi2
      const torusPoints = generateHopfTorus4DPoints(config, etaValues[t])
      vertices = vertices.concat(torusPoints)

      if (edgeMode === 'grid') {
        const torusEdges = buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, offset)
        edges = edges.concat(torusEdges)
      }
    }
  } else {
    // Single torus at the configured η
    vertices = generateHopfTorus4DPoints(config)

    if (edgeMode === 'grid') {
      edges = buildHopfTorus4DEdges(resolutionXi1, resolutionXi2)
    }
  }

  const pointCount = vertices.length
  const torusCount = showNestedTori ? numberOfTori : 1

  return {
    dimension: 4,
    type: 'clifford-torus',
    vertices,
    edges,
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
  }
}

// ============================================================================
// 5D Twisted 2-Torus (T² + helix)
// ============================================================================

/**
 * Generates points on a 5D twisted 2-torus
 *
 * A 2-torus (T²) naturally lives in 4D (like the Hopf torus). For 5D, we add
 * a helical twist in the 5th dimension, creating a spiraling structure.
 *
 * Uses the same coupled angles as 4D Hopf:
 *   - Circle 1: (x₀, x₁) with sum = (ξ₁ + ξ₂)/2
 *   - Circle 2: (x₂, x₃) with diff = (ξ₂ - ξ₁)/2
 *   - Helix: x₄ with twist based on ξ₁
 *
 * @param config - Clifford torus configuration
 * @returns Array of 5D points on the twisted 2-torus
 */
export function generateTorus5DPoints(config: NestedTorusConfig): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2, eta } = config

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)
  const rHelix = radius * 0.25 // Helix amplitude

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Coupled angles - same as 4D Hopf
      const sum = (xi1 + xi2) / 2
      const diff = (xi2 - xi1) / 2

      // 5D point: 4D Hopf structure + helical 5th dimension
      const p: VectorND = [
        radius * Math.cos(sum) * sinEta, // x₀
        radius * Math.sin(sum) * sinEta, // x₁
        radius * Math.cos(diff) * cosEta, // x₂
        radius * Math.sin(diff) * cosEta, // x₃
        rHelix * Math.sin(xi1 * 2), // x₄ - helical twist
      ]

      points.push(p)
    }
  }

  return points
}

/**
 * Builds grid edges for the 5D twisted 2-torus
 * @param resolutionXi1 - Resolution in xi1 direction
 * @param resolutionXi2 - Resolution in xi2 direction
 * @returns Array of edge index pairs
 */
export function buildTorus5DEdges(
  resolutionXi1: number,
  resolutionXi2: number
): [number, number][] {
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0)
}

/**
 * Builds quad faces for the 5D twisted 2-torus
 * @param resolutionXi1 - Resolution in xi1 direction
 * @param resolutionXi2 - Resolution in xi2 direction
 * @returns Array of face vertex indices
 */
export function buildTorus5DFaces(resolutionXi1: number, resolutionXi2: number): number[][] {
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0)
}

/**
 * Generates a complete 5D twisted 2-torus geometry
 *
 * Creates a 2D surface with the Hopf structure in 4D plus a helical
 * twist in the 5th dimension.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 5D twisted 2-torus
 */
export function generateNestedTorus5D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, edgeMode, eta } = config

  const vertices = generateTorus5DPoints(config)
  const edges = edgeMode === 'grid' ? buildTorus5DEdges(resolutionXi1, resolutionXi2) : []

  const pointCount = vertices.length

  return {
    dimension: 5,
    type: 'clifford-torus',
    vertices,
    edges,

    metadata: {
      name: '5D Twisted 2-Torus',
      formula: `T² with helical twist, η = ${(eta / Math.PI).toFixed(3)}π`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 5,
        fibration: 'T² + helix',
        fiberType: 'Hopf circles + twist',
      },
    },
  }
}

// ============================================================================
// 6D 3-Torus (T³ = S¹ × S¹ × S¹ with coupled angles)
// ============================================================================

/**
 * Generates points on a 6D 3-torus with coupled angles
 *
 * A 3-torus (T³) is the product of three circles: S¹ × S¹ × S¹.
 * In 6D, each circle lives in its own 2D plane:
 *   - Circle 1: (x₀, x₁) plane
 *   - Circle 2: (x₂, x₃) plane
 *   - Circle 3: (x₄, x₅) plane
 *
 * To create a beautiful 2D surface (like the Hopf torus), we use
 * coupled angles similar to the Hopf fibration:
 *
 * Parametrization (ξ₁, ξ₂ ∈ [0, 2π]):
 *   θ₁ = ξ₁                    (first circle)
 *   θ₂ = ξ₂                    (second circle)
 *   θ₃ = (ξ₁ + ξ₂) / 2         (third circle - coupled)
 *
 * The η parameter controls the relative sizes of the three circles:
 *   r₁ = R · sin(η)
 *   r₂ = R · cos(η) · sin(π/4) = R · cos(η) / √2
 *   r₃ = R · cos(η) · cos(π/4) = R · cos(η) / √2
 *
 * This creates a 2D surface that winds through all three torus directions,
 * producing a beautiful interlinked structure.
 *
 * @param config - Clifford torus configuration
 * @returns Array of 6D points on the 3-torus
 */
export function generateTorus6DPoints(config: NestedTorusConfig): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2, eta } = config

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)
  const sqrt2Inv = 1 / Math.sqrt(2)

  // Radii for each circle
  const r1 = radius * sinEta
  const r2 = radius * cosEta * sqrt2Inv
  const r3 = radius * cosEta * sqrt2Inv

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Three angles with coupling (like Hopf)
      const theta1 = xi1
      const theta2 = xi2
      const theta3 = (xi1 + xi2) / 2 // Coupled angle creates linking

      // 6D point: three circles in perpendicular planes
      const p: VectorND = [
        r1 * Math.cos(theta1), // x₀
        r1 * Math.sin(theta1), // x₁
        r2 * Math.cos(theta2), // x₂
        r2 * Math.sin(theta2), // x₃
        r3 * Math.cos(theta3), // x₄
        r3 * Math.sin(theta3), // x₅
      ]

      points.push(p)
    }
  }

  return points
}

/**
 * Builds grid edges for the 6D 3-torus
 *
 * Uses the same 2D grid structure as 4D and 8D Hopf tori.
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @returns Array of edge pairs
 */
export function buildTorus6DEdges(
  resolutionXi1: number,
  resolutionXi2: number
): [number, number][] {
  // Same structure as 4D Hopf
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0)
}

/**
 * Builds quad faces for the 6D 3-torus
 *
 * Uses the same 2D grid structure as 4D and 8D Hopf tori.
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @returns Array of quad faces
 */
export function buildTorus6DFaces(resolutionXi1: number, resolutionXi2: number): number[][] {
  // Same structure as 4D Hopf
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0)
}

/**
 * Generates a complete 6D 3-torus geometry
 *
 * Creates a beautiful 2D surface embedded in the 3-torus (T³) in 6D.
 * The coupled angles create an interlinked structure similar to
 * the Hopf fibration.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 6D 3-torus
 */
export function generateNestedTorus6D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, edgeMode, eta } = config

  const vertices = generateTorus6DPoints(config)
  const edges = edgeMode === 'grid' ? buildTorus6DEdges(resolutionXi1, resolutionXi2) : []

  const pointCount = vertices.length

  return {
    dimension: 6,
    type: 'clifford-torus',
    vertices,
    edges,

    metadata: {
      name: '6D 3-Torus (Coupled)',
      formula: `T³ with coupled angles, η = ${(eta / Math.PI).toFixed(3)}π`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 6,
        fibration: 'T³ (3-torus)',
        fiberType: 'Coupled circles',
      },
    },
  }
}

// ============================================================================
// 7D Twisted 3-Torus (T³ + helix)
// ============================================================================

/**
 * Generates points on a 7D twisted 3-torus
 *
 * A 3-torus (T³) naturally lives in 6D. For 7D, we add a helical twist
 * in the 7th dimension, creating a spiraling structure through the 3-torus.
 *
 * Uses the same coupled angles as 6D:
 *   - Circle 1: (x₀, x₁) with θ₁ = ξ₁
 *   - Circle 2: (x₂, x₃) with θ₂ = ξ₂
 *   - Circle 3: (x₄, x₅) with θ₃ = (ξ₁ + ξ₂)/2
 *   - Helix: x₆ with twist based on θ₃
 *
 * @param config - Clifford torus configuration
 * @returns Array of 7D points on the twisted 3-torus
 */
export function generateTorus7DPoints(config: NestedTorusConfig): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2, eta } = config

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)
  const sqrt2Inv = 1 / Math.sqrt(2)

  // Radii for each circle (same as 6D)
  const r1 = radius * sinEta
  const r2 = radius * cosEta * sqrt2Inv
  const r3 = radius * cosEta * sqrt2Inv
  const rHelix = radius * 0.25 // Helix amplitude

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Three angles with coupling (same as 6D)
      const theta1 = xi1
      const theta2 = xi2
      const theta3 = (xi1 + xi2) / 2

      // 7D point: 6D 3-torus structure + helical 7th dimension
      const p: VectorND = [
        r1 * Math.cos(theta1), // x₀
        r1 * Math.sin(theta1), // x₁
        r2 * Math.cos(theta2), // x₂
        r2 * Math.sin(theta2), // x₃
        r3 * Math.cos(theta3), // x₄
        r3 * Math.sin(theta3), // x₅
        rHelix * Math.sin(theta3 * 2), // x₆ - helical twist
      ]

      points.push(p)
    }
  }

  return points
}

/**
 * Builds grid edges for the 7D twisted 3-torus
 * @param resolutionXi1 - Resolution in first direction
 * @param resolutionXi2 - Resolution in second direction
 * @returns Array of edge pairs
 */
export function buildTorus7DEdges(
  resolutionXi1: number,
  resolutionXi2: number
): [number, number][] {
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0)
}

/**
 * Builds quad faces for the 7D twisted 3-torus
 * @param resolutionXi1 - Resolution in first direction
 * @param resolutionXi2 - Resolution in second direction
 * @returns Array of quad faces
 */
export function buildTorus7DFaces(resolutionXi1: number, resolutionXi2: number): number[][] {
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0)
}

/**
 * Generates a complete 7D twisted 3-torus geometry
 *
 * Creates a 2D surface embedded in a 3-torus structure with a helical
 * twist in the 7th dimension.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 7D twisted 3-torus
 */
export function generateNestedTorus7D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, edgeMode, eta } = config

  const vertices = generateTorus7DPoints(config)
  const edges = edgeMode === 'grid' ? buildTorus7DEdges(resolutionXi1, resolutionXi2) : []

  const pointCount = vertices.length

  return {
    dimension: 7,
    type: 'clifford-torus',
    vertices,
    edges,

    metadata: {
      name: '7D Twisted 3-Torus',
      formula: `T³ with helical twist, η = ${(eta / Math.PI).toFixed(3)}π`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 7,
        fibration: 'T³ + helix',
        fiberType: 'Three coupled circles + twist',
      },
    },
  }
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
export function generateHopfTorus8DPoints(config: NestedTorusConfig): VectorND[] {
  // Use the same resolution parameters as 4D
  const { radius, resolutionXi1, resolutionXi2, eta } = config

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Coupled angles - SAME as 4D Hopf
      const sum = (xi1 + xi2) / 2
      const diff = (xi2 - xi1) / 2

      // Rotation factor for 8D embedding
      const cosXi1 = Math.cos(xi1)
      const sinXi1 = Math.sin(xi1)

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
      ]

      points.push(p)
    }
  }

  return points
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
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0)
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
export function generateNestedHopfTorus8D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, edgeMode, eta } = config

  const vertices = generateHopfTorus8DPoints(config)

  // Build edges using the same 2D grid structure as 4D
  const edges = edgeMode === 'grid' ? buildHopfTorus8DEdges(resolutionXi1, resolutionXi2) : []

  const pointCount = vertices.length

  return {
    dimension: 8,
    type: 'clifford-torus',
    vertices,
    edges,

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
  }
}

// ============================================================================
// 9D Twisted 4-Torus (T⁴ with helical 9th dimension)
// ============================================================================

/**
 * Generates points on a 9D twisted 4-torus
 *
 * A 4-torus (T⁴) naturally lives in 8D. For 9D, we add a helical twist
 * in the 9th dimension, creating a beautiful spiraling structure.
 *
 * Four circles with coupled angles (like combining 6D and Hopf patterns):
 *   - Circle 1: (x₀, x₁) with θ₁ = ξ₁
 *   - Circle 2: (x₂, x₃) with θ₂ = ξ₂
 *   - Circle 3: (x₄, x₅) with θ₃ = (ξ₁ + ξ₂)/2 (sum coupling)
 *   - Circle 4: (x₆, x₇) with θ₄ = (ξ₂ - ξ₁)/2 (diff coupling)
 *   - Helix: x₈ with twist based on sum angle
 *
 * The coupling creates an intricate linked structure where moving along
 * one circle causes rotation in all others.
 *
 * @param config - Clifford torus configuration
 * @returns Array of 9D points on the twisted 4-torus
 */
export function generateTorus9DPoints(config: NestedTorusConfig): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2, eta } = config

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)

  // Distribute radius across 4 circles + helix
  // At η = π/4: circles 1&2 get sinEta, circles 3&4 get cosEta
  const sqrt2Inv = 1 / Math.sqrt(2)
  const r1 = radius * sinEta * sqrt2Inv
  const r2 = radius * sinEta * sqrt2Inv
  const r3 = radius * cosEta * sqrt2Inv
  const r4 = radius * cosEta * sqrt2Inv
  const rHelix = radius * 0.2 // Small helix amplitude

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Four coupled angles
      const theta1 = xi1
      const theta2 = xi2
      const theta3 = (xi1 + xi2) / 2 // Sum coupling (like Hopf)
      const theta4 = (xi2 - xi1) / 2 // Diff coupling (like Hopf)

      // 9D point: four circles + helical 9th dimension
      const p: VectorND = [
        r1 * Math.cos(theta1), // x₀
        r1 * Math.sin(theta1), // x₁
        r2 * Math.cos(theta2), // x₂
        r2 * Math.sin(theta2), // x₃
        r3 * Math.cos(theta3), // x₄
        r3 * Math.sin(theta3), // x₅
        r4 * Math.cos(theta4), // x₆
        r4 * Math.sin(theta4), // x₇
        rHelix * Math.sin(theta3 * 2), // x₈ - helical twist
      ]

      points.push(p)
    }
  }

  return points
}

/**
 * Builds grid edges for the 9D twisted 4-torus
 *
 * Uses the same 2D grid structure as other nested tori.
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @returns Array of edge pairs
 */
export function buildTorus9DEdges(
  resolutionXi1: number,
  resolutionXi2: number
): [number, number][] {
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0)
}

/**
 * Builds quad faces for the 9D twisted 4-torus
 *
 * @param resolutionXi1 - Resolution in ξ₁ direction
 * @param resolutionXi2 - Resolution in ξ₂ direction
 * @returns Array of quad faces
 */
export function buildTorus9DFaces(resolutionXi1: number, resolutionXi2: number): number[][] {
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0)
}

/**
 * Generates a complete 9D twisted 4-torus geometry
 *
 * Creates a 2D surface embedded in a 4-torus structure with a helical
 * twist in the 9th dimension. Combines the coupling patterns of both
 * the 6D 3-torus and the Hopf fibration.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 9D twisted 4-torus
 */
export function generateNestedTorus9D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, edgeMode, eta } = config

  const vertices = generateTorus9DPoints(config)
  const edges = edgeMode === 'grid' ? buildTorus9DEdges(resolutionXi1, resolutionXi2) : []

  const pointCount = vertices.length

  return {
    dimension: 9,
    type: 'clifford-torus',
    vertices,
    edges,

    metadata: {
      name: '9D Twisted 4-Torus',
      formula: `T⁴ with helical twist, η = ${(eta / Math.PI).toFixed(3)}π`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 9,
        fibration: 'T⁴ + helix',
        fiberType: 'Four coupled circles',
      },
    },
  }
}

// ============================================================================
// 10D 5-Torus (T⁵ = S¹ × S¹ × S¹ × S¹ × S¹)
// ============================================================================

/**
 * Generates points on a 10D 5-torus with coupled angles
 *
 * A 5-torus (T⁵) is the product of five circles: S¹ × S¹ × S¹ × S¹ × S¹.
 * In 10D, each circle lives in its own 2D plane.
 *
 * Angles with sophisticated coupling pattern:
 *   - Circle 1: (x₀, x₁) with θ₁ = ξ₁
 *   - Circle 2: (x₂, x₃) with θ₂ = ξ₂
 *   - Circle 3: (x₄, x₅) with θ₃ = (ξ₁ + ξ₂)/2 (sum)
 *   - Circle 4: (x₆, x₇) with θ₄ = (ξ₂ - ξ₁)/2 (diff)
 *   - Circle 5: (x₈, x₉) with θ₅ = (ξ₁ + 2*ξ₂)/3 (weighted mix)
 *
 * @param config - Clifford torus configuration
 * @returns Array of 10D points on the 5-torus
 */
export function generateTorus10DPoints(config: NestedTorusConfig): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2, eta } = config

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)

  // Distribute radius across 5 circles
  const sqrt3Inv = 1 / Math.sqrt(3)
  const sqrt2Inv = 1 / Math.sqrt(2)
  const r1 = radius * sinEta * sqrt2Inv
  const r2 = radius * sinEta * sqrt2Inv
  const r3 = radius * cosEta * sqrt3Inv
  const r4 = radius * cosEta * sqrt3Inv
  const r5 = radius * cosEta * sqrt3Inv

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Five coupled angles
      const theta1 = xi1
      const theta2 = xi2
      const theta3 = (xi1 + xi2) / 2
      const theta4 = (xi2 - xi1) / 2
      const theta5 = (xi1 + 2 * xi2) / 3

      // 10D point: five circles in perpendicular planes
      const p: VectorND = [
        r1 * Math.cos(theta1), // x₀
        r1 * Math.sin(theta1), // x₁
        r2 * Math.cos(theta2), // x₂
        r2 * Math.sin(theta2), // x₃
        r3 * Math.cos(theta3), // x₄
        r3 * Math.sin(theta3), // x₅
        r4 * Math.cos(theta4), // x₆
        r4 * Math.sin(theta4), // x₇
        r5 * Math.cos(theta5), // x₈
        r5 * Math.sin(theta5), // x₉
      ]

      points.push(p)
    }
  }

  return points
}

/**
 * Builds grid edges for the 10D 5-torus
 * @param resolutionXi1 - Resolution in first direction
 * @param resolutionXi2 - Resolution in second direction
 * @returns Array of edge pairs
 */
export function buildTorus10DEdges(
  resolutionXi1: number,
  resolutionXi2: number
): [number, number][] {
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0)
}

/**
 * Builds quad faces for the 10D 5-torus
 * @param resolutionXi1 - Resolution in first direction
 * @param resolutionXi2 - Resolution in second direction
 * @returns Array of quad faces
 */
export function buildTorus10DFaces(resolutionXi1: number, resolutionXi2: number): number[][] {
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0)
}

/**
 * Generates a complete 10D 5-torus geometry
 *
 * Creates a 2D surface embedded in a 5-torus (T⁵) in 10D.
 * The coupled angles create an intricate interlinked structure.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 10D 5-torus
 */
export function generateNestedTorus10D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, edgeMode, eta } = config

  const vertices = generateTorus10DPoints(config)
  const edges = edgeMode === 'grid' ? buildTorus10DEdges(resolutionXi1, resolutionXi2) : []

  const pointCount = vertices.length

  return {
    dimension: 10,
    type: 'clifford-torus',
    vertices,
    edges,

    metadata: {
      name: '10D 5-Torus (Coupled)',
      formula: `T⁵ with coupled angles, η = ${(eta / Math.PI).toFixed(3)}π`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 10,
        fibration: 'T⁵ (5-torus)',
        fiberType: 'Five coupled circles',
      },
    },
  }
}

// ============================================================================
// 11D Twisted 5-Torus (T⁵ + helix)
// ============================================================================

/**
 * Generates points on an 11D twisted 5-torus
 *
 * A 5-torus (T⁵) naturally lives in 10D. For 11D, we add a helical twist
 * in the 11th dimension, creating a spiraling structure through the 5-torus.
 *
 * Same coupled angles as 10D plus a helix:
 *   - Circle 1-5: same as 10D
 *   - Helix: x₁₀ with twist based on combined angles
 *
 * @param config - Clifford torus configuration
 * @returns Array of 11D points on the twisted 5-torus
 */
export function generateTorus11DPoints(config: NestedTorusConfig): VectorND[] {
  const { radius, resolutionXi1, resolutionXi2, eta } = config

  const points: VectorND[] = []
  const sinEta = Math.sin(eta)
  const cosEta = Math.cos(eta)

  // Distribute radius across 5 circles + helix
  const sqrt3Inv = 1 / Math.sqrt(3)
  const sqrt2Inv = 1 / Math.sqrt(2)
  const r1 = radius * sinEta * sqrt2Inv
  const r2 = radius * sinEta * sqrt2Inv
  const r3 = radius * cosEta * sqrt3Inv
  const r4 = radius * cosEta * sqrt3Inv
  const r5 = radius * cosEta * sqrt3Inv
  const rHelix = radius * 0.2 // Helix amplitude

  for (let i = 0; i < resolutionXi1; i++) {
    const xi1 = (2 * Math.PI * i) / resolutionXi1

    for (let j = 0; j < resolutionXi2; j++) {
      const xi2 = (2 * Math.PI * j) / resolutionXi2

      // Five coupled angles (same as 10D)
      const theta1 = xi1
      const theta2 = xi2
      const theta3 = (xi1 + xi2) / 2
      const theta4 = (xi2 - xi1) / 2
      const theta5 = (xi1 + 2 * xi2) / 3

      // 11D point: five circles + helical 11th dimension
      const p: VectorND = [
        r1 * Math.cos(theta1), // x₀
        r1 * Math.sin(theta1), // x₁
        r2 * Math.cos(theta2), // x₂
        r2 * Math.sin(theta2), // x₃
        r3 * Math.cos(theta3), // x₄
        r3 * Math.sin(theta3), // x₅
        r4 * Math.cos(theta4), // x₆
        r4 * Math.sin(theta4), // x₇
        r5 * Math.cos(theta5), // x₈
        r5 * Math.sin(theta5), // x₉
        rHelix * Math.sin(theta3 * 2 + theta5), // x₁₀ - helical twist
      ]

      points.push(p)
    }
  }

  return points
}

/**
 * Builds grid edges for the 11D twisted 5-torus
 * @param resolutionXi1 - Resolution in first direction
 * @param resolutionXi2 - Resolution in second direction
 * @returns Array of edge pairs
 */
export function buildTorus11DEdges(
  resolutionXi1: number,
  resolutionXi2: number
): [number, number][] {
  return buildHopfTorus4DEdges(resolutionXi1, resolutionXi2, 0)
}

/**
 * Builds quad faces for the 11D twisted 5-torus
 * @param resolutionXi1 - Resolution in first direction
 * @param resolutionXi2 - Resolution in second direction
 * @returns Array of quad faces
 */
export function buildTorus11DFaces(resolutionXi1: number, resolutionXi2: number): number[][] {
  return buildHopfTorus4DFaces(resolutionXi1, resolutionXi2, 0)
}

/**
 * Generates a complete 11D twisted 5-torus geometry
 *
 * Creates a 2D surface embedded in a 5-torus structure with a helical
 * twist in the 11th dimension.
 *
 * @param config - Clifford torus configuration
 * @returns NdGeometry representing the 11D twisted 5-torus
 */
export function generateNestedTorus11D(config: NestedTorusConfig): NdGeometry {
  const { radius, resolutionXi1, resolutionXi2, edgeMode, eta } = config

  const vertices = generateTorus11DPoints(config)
  const edges = edgeMode === 'grid' ? buildTorus11DEdges(resolutionXi1, resolutionXi2) : []

  const pointCount = vertices.length

  return {
    dimension: 11,
    type: 'clifford-torus',
    vertices,
    edges,
    metadata: {
      name: '11D Twisted 5-Torus',
      formula: `T⁵ with helical twist, η = ${(eta / Math.PI).toFixed(3)}π`,
      properties: {
        visualizationMode: 'nested',
        radius,
        eta,
        resolutionXi1,
        resolutionXi2,
        pointCount,
        edgeCount: edges.length,
        edgeMode,
        intrinsicDimension: 11,
        fibration: 'T⁵ + helix',
        fiberType: 'Five coupled circles + twist',
      },
    },
  }
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
    return [Math.PI / 4] // Default to main Clifford torus
  }

  const minEta = Math.PI / 8
  const maxEta = (3 * Math.PI) / 8
  const values: number[] = []

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    values.push(minEta + t * (maxEta - minEta))
  }

  return values
}

/**
 * Normalizes edge list by ensuring smaller index comes first and removing duplicates
 *
 * @param edges - Raw edge list
 * @returns Normalized and deduplicated edge list
 */
function normalizeEdges(edges: [number, number][]): [number, number][] {
  const edgeSet = new Set<string>()
  const normalized: [number, number][] = []

  for (const [a, b] of edges) {
    const minIdx = Math.min(a, b)
    const maxIdx = Math.max(a, b)
    const key = `${minIdx},${maxIdx}`

    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      normalized.push([minIdx, maxIdx])
    }
  }

  return normalized
}
