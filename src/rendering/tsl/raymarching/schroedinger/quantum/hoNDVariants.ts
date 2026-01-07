/**
 * TSL Dimension-specific Harmonic Oscillator ND Eigenfunction Variants
 *
 * These are dimension-specialized versions of hoND() for each dimension 3-11.
 * Each function:
 * 1. Computes the dimension-scaled early exit check
 * 2. Computes the product of ho1D eigenfunctions
 *
 * Ported exactly from WebGL: shaders/schroedinger/quantum/hoNDVariants.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/hoNDVariants
 */

import { Fn, float, sqrt, max, abs, select } from 'three/tsl'
import type { Node, UniformArrayNode } from 'three/tsl'
import { ho1D } from './ho1d'

/**
 * Maximum supported dimension
 */
export const MAX_DIM = 11

/**
 * Maximum superposition terms
 *
 * Restored to 8 after implementing texture-based eigenfunction evaluation.
 * Instead of computing HO eigenfunctions inline (which caused 88,000+ shader nodes),
 * we now precompute to 3D textures and sample in the shader (O(1) lookups).
 *
 * See: hoTexture.ts for texture generation
 */
export const MAX_TERMS = 8

/**
 * Uniforms required for HO ND evaluation
 * CRITICAL: Uses UniformArrayNode to match uniformArray() return type
 */
export interface HONDUniforms {
  /** Per-dimension angular frequencies (MAX_DIM values) */
  uOmega: UniformArrayNode<number>
  /** Flattened quantum numbers: n[k][j] where k=termIdx, j=dimension */
  uQuantum: UniformArrayNode<number>
}

/**
 * Compute dimension-scaled early-exit threshold.
 *
 * The threshold is based on the χ² distribution - in higher dimensions,
 * the sum of squared Gaussians has a higher expected value.
 *
 * Formula: 2 * dimension + ln(dimension) * 3
 *
 * @param dimension - The dimension (3-11)
 * @returns The early-exit threshold for distSq comparison
 */
export function computeEarlyExitThreshold(dimension: number): number {
  return 2 * dimension + Math.log(dimension) * 3
}

/**
 * Type for omega getter function
 */
type OmegaGetter = (idx: number) => Node

/**
 * Type for quantum number getter function
 */
type QuantumGetter = (termIdx: Node, dimIdx: number) => Node

/**
 * Create a dimension-specific HO ND evaluator.
 *
 * This is the core factory function that creates optimized evaluators
 * for a specific dimension count.
 *
 * @param dim - The dimension (3-11)
 * @param getOmega - Function to get omega for dimension j
 * @param getQuantum - Function to get quantum number for term k, dimension j
 * @returns TSL Fn that evaluates hoND at given coordinates
 */
export function createHONDEvaluator(
  dim: number,
  getOmega: OmegaGetter,
  getQuantum: QuantumGetter
) {
  const threshold = computeEarlyExitThreshold(dim)

  /**
   * Evaluate HO ND eigenfunction for a specific dimension
   *
   * @param coords - Array of D coordinate nodes
   * @param termIdx - Superposition term index
   * @returns Eigenfunction value (real)
   */
  return Fn(
    ([
      termIdxArg,
      x0Arg,
      x1Arg,
      x2Arg,
      x3Arg,
      x4Arg,
      x5Arg,
      x6Arg,
      x7Arg,
      x8Arg,
      x9Arg,
      x10Arg,
    ]: Node[]) => {
      // Provide fallback values to avoid undefined
      const termIdx = termIdxArg ?? float(0)
      const coords = [
        x0Arg ?? float(0),
        x1Arg ?? float(0),
        x2Arg ?? float(0),
        x3Arg ?? float(0),
        x4Arg ?? float(0),
        x5Arg ?? float(0),
        x6Arg ?? float(0),
        x7Arg ?? float(0),
        x8Arg ?? float(0),
        x9Arg ?? float(0),
        x10Arg ?? float(0),
      ]

      // Compute squared distance with dimension-specific alpha scaling
      // CRITICAL: Use anonymous toVar() inside Fn() to avoid WGSL declaration name conflicts
      const distSq = float(0).toVar()

      for (let j = 0; j < dim; j++) {
        const omega = getOmega(j)
        const alpha = sqrt(max(omega, float(0.01)))
        const u = alpha.mul(coords[j] as Node)
        distSq.addAssign(u.mul(u))
      }

      // Compute product of 1D eigenfunctions
      const product = float(1).toVar()

      for (let j = 0; j < dim; j++) {
        const n = getQuantum(termIdx, j)
        const omega = getOmega(j)
        const val = ho1D(n, coords[j] as Node, omega)
        // Multiply, short-circuit if negligible
        product.assign(select(abs(product).lessThan(1e-10), float(0), product.mul(val)))
      }

      // Return 0 if outside Gaussian envelope, product otherwise
      return select(distSq.greaterThan(threshold), float(0), product)
    }
  )
}

/**
 * Create a dimension-specific HO ND evaluator with uniform access.
 *
 * This version accepts uniforms and handles array indexing internally.
 *
 * @param dim - The dimension (3-11)
 * @param uniforms - HO ND uniforms
 * @returns TSL Fn that evaluates hoND
 */
export function createHONDWithUniforms(dim: number, uniforms: HONDUniforms) {
  const threshold = computeEarlyExitThreshold(dim)

  return Fn(
    ([
      termIdxArg,
      x0Arg,
      x1Arg,
      x2Arg,
      x3Arg,
      x4Arg,
      x5Arg,
      x6Arg,
      x7Arg,
      x8Arg,
      x9Arg,
      x10Arg,
    ]: Node[]) => {
      // Provide fallback values to avoid undefined
      const termIdx = termIdxArg ?? float(0)
      const coords = [
        x0Arg ?? float(0),
        x1Arg ?? float(0),
        x2Arg ?? float(0),
        x3Arg ?? float(0),
        x4Arg ?? float(0),
        x5Arg ?? float(0),
        x6Arg ?? float(0),
        x7Arg ?? float(0),
        x8Arg ?? float(0),
        x9Arg ?? float(0),
        x10Arg ?? float(0),
      ].slice(0, dim)

      // Compute squared distance
      const distSq = float(0).toVar()

      // For each dimension, compute alpha * x and accumulate
      for (let j = 0; j < dim; j++) {
        // Access omega[j] - need to handle uniform array access
        const omega = uniforms.uOmega.element(j)
        const alpha = sqrt(max(omega, float(0.01)))
        const u = alpha.mul(coords[j] as Node)
        distSq.addAssign(u.mul(u))
      }

      // Compute product of 1D eigenfunctions
      const product = float(1).toVar()

      // Helper to get quantum number with select chain
      // CRITICAL: Using select chain instead of .element(termIdx * MAX_DIM + j) because
      // uniformArray.element() with TSL node index causes "Invalid PipelineLayout" WebGPU errors.
      // termIdx is a TSL node (0-7), j is a JS constant (0 to dim-1)
      const getQuantumNumber = (j: number) =>
        select(termIdx.equal(0), uniforms.uQuantum.element(0 * MAX_DIM + j),
          select(termIdx.equal(1), uniforms.uQuantum.element(1 * MAX_DIM + j),
            select(termIdx.equal(2), uniforms.uQuantum.element(2 * MAX_DIM + j),
              select(termIdx.equal(3), uniforms.uQuantum.element(3 * MAX_DIM + j),
                select(termIdx.equal(4), uniforms.uQuantum.element(4 * MAX_DIM + j),
                  select(termIdx.equal(5), uniforms.uQuantum.element(5 * MAX_DIM + j),
                    select(termIdx.equal(6), uniforms.uQuantum.element(6 * MAX_DIM + j),
                      uniforms.uQuantum.element(7 * MAX_DIM + j) // default: term 7
                    )
                  )
                )
              )
            )
          )
        )

      for (let j = 0; j < dim; j++) {
        const n = getQuantumNumber(j)
        const omega = uniforms.uOmega.element(j)
        const val = ho1D(n, coords[j] as Node, omega)
        // Multiply with early-exit optimization
        product.assign(select(abs(product).lessThan(1e-10), float(0), product.mul(val)))
      }

      // Return 0 if outside Gaussian envelope, product otherwise
      return select(distSq.greaterThan(threshold), float(0), product)
    }
  )
}

/**
 * Pre-computed thresholds for each dimension
 */
export const DIM_THRESHOLDS = {
  3: computeEarlyExitThreshold(3), // ~9.3
  4: computeEarlyExitThreshold(4), // ~12.2
  5: computeEarlyExitThreshold(5), // ~14.8
  6: computeEarlyExitThreshold(6), // ~17.4
  7: computeEarlyExitThreshold(7), // ~19.8
  8: computeEarlyExitThreshold(8), // ~22.2
  9: computeEarlyExitThreshold(9), // ~24.6
  10: computeEarlyExitThreshold(10), // ~26.9
  11: computeEarlyExitThreshold(11), // ~29.2
} as const

/**
 * Select the appropriate HO ND evaluator for a given dimension.
 *
 * @param dimension - The dimension (3-11)
 * @param uniforms - HO ND uniforms
 * @returns Dimension-specific evaluator function
 */
export function selectHONDEvaluator(dimension: number, uniforms: HONDUniforms) {
  const dim = Math.min(Math.max(dimension, 3), 11)
  return createHONDWithUniforms(dim, uniforms)
}

/**
 * Create a term-specific HO ND evaluator with JS constant term index.
 *
 * PERFORMANCE OPTIMIZATION: This version accepts termK as a JavaScript constant
 * (0-7) instead of a TSL node, eliminating the expensive 7-level nested select
 * chain that was causing shader graph explosion.
 *
 * Use this when you know the term index at composition time (e.g., when
 * pre-computing all term results).
 *
 * @param dim - The dimension (3-11)
 * @param uniforms - HO ND uniforms
 * @param termK - Term index as JS constant (0 to MAX_TERMS-1)
 * @returns TSL Fn that evaluates hoND for this specific term
 */
export function createHONDForTerm(dim: number, uniforms: HONDUniforms, termK: number) {
  const threshold = computeEarlyExitThreshold(dim)

  return Fn(
    ([
      x0Arg,
      x1Arg,
      x2Arg,
      x3Arg,
      x4Arg,
      x5Arg,
      x6Arg,
      x7Arg,
      x8Arg,
      x9Arg,
      x10Arg,
    ]: Node[]) => {
      const coords = [
        x0Arg ?? float(0),
        x1Arg ?? float(0),
        x2Arg ?? float(0),
        x3Arg ?? float(0),
        x4Arg ?? float(0),
        x5Arg ?? float(0),
        x6Arg ?? float(0),
        x7Arg ?? float(0),
        x8Arg ?? float(0),
        x9Arg ?? float(0),
        x10Arg ?? float(0),
      ].slice(0, dim)

      // Compute squared distance
      const distSq = float(0).toVar()

      for (let j = 0; j < dim; j++) {
        const omega = uniforms.uOmega.element(j)
        const alpha = sqrt(max(omega, float(0.01)))
        const u = alpha.mul(coords[j] as Node)
        distSq.addAssign(u.mul(u))
      }

      // Compute product of 1D eigenfunctions
      const product = float(1).toVar()

      // OPTIMIZATION: Use JS constant termK directly - no select chain needed!
      // This is the key fix that eliminates the 7-level nested select chain.
      for (let j = 0; j < dim; j++) {
        const n = uniforms.uQuantum.element(termK * MAX_DIM + j)
        const omega = uniforms.uOmega.element(j)
        const val = ho1D(n, coords[j] as Node, omega)
        product.assign(select(abs(product).lessThan(1e-10), float(0), product.mul(val)))
      }

      return select(distSq.greaterThan(threshold), float(0), product)
    }
  )
}

/**
 * Create all term-specific evaluators for a dimension.
 *
 * Pre-creates evaluators for all MAX_TERMS terms, each with direct
 * array indexing (no select chains).
 *
 * @param dim - The dimension (3-11)
 * @param uniforms - HO ND uniforms
 * @returns Array of term-specific evaluator functions
 */
export function createAllTermEvaluators(dim: number, uniforms: HONDUniforms) {
  const evaluators: ReturnType<typeof createHONDForTerm>[] = []
  for (let k = 0; k < MAX_TERMS; k++) {
    evaluators.push(createHONDForTerm(dim, uniforms, k))
  }
  return evaluators
}
