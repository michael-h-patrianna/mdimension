/**
 * TSL Unified Wavefunction Evaluation
 *
 * Supports three quantum physics modes:
 *
 * 1. HARMONIC OSCILLATOR (uQuantumMode == 0):
 *    Evaluates the time-dependent wavefunction as a superposition of
 *    harmonic oscillator eigenstates:
 *      ψ(x,t) = Σ_k c_k · Φ_k(x) · e^{-iE_k t}
 *
 * 2. HYDROGEN ORBITAL (uQuantumMode == 1):
 *    Evaluates the hydrogen atom wavefunction:
 *      ψ_nlm(r,θ,φ,t) = R_nl(r) · Y_lm(θ,φ) · e^{-iE_n t}
 *
 * 3. HYDROGEN ND (uQuantumMode == 2):
 *    Evaluates an N-dimensional hydrogen-like wavefunction:
 *      ψ_ND = R_nl(r_D) × Y_lm(θ,φ) × ∏_{j=4}^{D} φ_{nj}(xj)
 *
 * Ported exactly from WebGL: shaders/schroedinger/quantum/psi.glsl.ts
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/psi
 */

import { Fn, float, vec2, vec3, vec4, If, atan, select } from 'three/tsl'
import type { Node, UniformNode, UniformArrayNode } from 'three/tsl'
import type * as THREE from 'three'
import { cmul, cscale, cexp_i } from './complex'
import { evalHydrogenPsi, evalHydrogenPsiTime, evalHydrogenPsiWithPhase } from './hydrogenPsi'

// Quantum mode constants
export const QUANTUM_MODE_HARMONIC = 0
export const QUANTUM_MODE_HYDROGEN = 1
export const QUANTUM_MODE_HYDROGEN_ND = 2

// Maximum terms for superposition
export const MAX_TERMS = 8
export const MAX_DIM = 11

/**
 * Uniforms for unified PSI evaluation
 */
export interface PsiUniforms {
  /** Quantum mode selector (0=HO, 1=Hydrogen, 2=HydrogenND) */
  uQuantumMode: UniformNode<number>

  // Harmonic oscillator uniforms
  /** Number of superposition terms */
  uTermCount: UniformNode<number>
  /** Complex coefficients (vec2 arrays) - uses uniformArray() for WebGPU compatibility */
  uCoeff: UniformArrayNode<THREE.Vector2>
  /** Precomputed energies - uses uniformArray() for WebGPU compatibility */
  uEnergy: UniformArrayNode<number>

  // Hydrogen uniforms
  /** Principal quantum number */
  uPrincipalN: UniformNode<number>
  /** Azimuthal quantum number */
  uAzimuthalL: UniformNode<number>
  /** Magnetic quantum number */
  uMagneticM: UniformNode<number>
  /** Bohr radius scale */
  uBohrRadius: UniformNode<number>
  /** Use real orbitals */
  uUseRealOrbitals: UniformNode<boolean>
  /** Dimension for ND modes */
  uDimension: UniformNode<number>

  // Phase animation
  /** Enable phase animation */
  uPhaseAnimationEnabled?: UniformNode<boolean>

  // Extra dimension uniforms (for HydrogenND)
  /** Extra dimension quantum numbers (packed as vec4 arrays) */
  uExtraDimN?: UniformNode<THREE.Vector4>[]
  /** Extra dimension angular frequencies */
  uExtraDimOmega?: UniformNode<THREE.Vector4>[]
}

/**
 * Type alias for HO ND evaluator function
 */
export type HONDEvaluator = (termIdx: Node, ...coords: Node[]) => Node

/**
 * Type alias for Hydrogen ND evaluator function
 */
export type HydrogenNDEvaluator = (...args: Node[]) => Node

/**
 * Create unified PSI evaluation function for Harmonic Oscillator mode.
 *
 * @param uniforms - PSI uniforms
 * @param hoNDOptimized - Dimension-optimized HO ND evaluator
 * @returns TSL Fn that evaluates HO psi
 */
export function createHarmonicOscillatorPsi(
  uniforms: PsiUniforms,
  hoNDOptimized: HONDEvaluator
) {
  return Fn(
    ([
      tArg,
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
      const t = tArg ?? float(0)
      const x0 = x0Arg ?? float(0)
      const x1 = x1Arg ?? float(0)
      const x2 = x2Arg ?? float(0)
      const x3 = x3Arg ?? float(0)
      const x4 = x4Arg ?? float(0)
      const x5 = x5Arg ?? float(0)
      const x6 = x6Arg ?? float(0)
      const x7 = x7Arg ?? float(0)
      const x8 = x8Arg ?? float(0)
      const x9 = x9Arg ?? float(0)
      const x10 = x10Arg ?? float(0)
      const coords = [x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10]

      const psi = vec2(0, 0).toVar()

      // Unroll loop over MAX_TERMS using JavaScript for loop
      // CRITICAL: Using JS for loop instead of TSL Loop() because uniformArray.element()
      // with a TSL IntNode index causes "Invalid PipelineLayout" WebGPU errors.
      for (let i = 0; i < MAX_TERMS; i++) {
        const termIdx = float(i)
        // Wrap in If to skip terms beyond uTermCount (equivalent to early Break)
        If(termIdx.lessThan(uniforms.uTermCount), () => {
          // Time phase factor: e^{-iE_k t}
          // Using constant JS index i for .element() to avoid WebGPU errors
          const energy = uniforms.uEnergy.element(i)
          const phase = energy.negate().mul(t)
          const timeFactor = cexp_i(phase)

          // Complex coefficient c_k
          const coeffVec = uniforms.uCoeff.element(i)
          const coeff = vec2(coeffVec.x, coeffVec.y)

          // Combined: c_k · e^{-iE_k t}
          const term = cmul(coeff, timeFactor)

          // Spatial eigenfunction Φ_k(x)
          const spatial = hoNDOptimized(termIdx, ...coords)

          // Accumulate: ψ += c_k · Φ_k(x) · e^{-iE_k t}
          psi.assign(psi.add(cscale(spatial, term)))
        })
      }

      return psi
    }
  )
}

/**
 * Create unified PSI evaluation with mode switching.
 *
 * This version uses select for branch-free mode switching.
 *
 * @param uniforms - PSI uniforms
 * @param hoNDOptimized - Dimension-optimized HO ND evaluator
 * @param hydrogenNDEval - Dimension-specific Hydrogen ND evaluator
 * @param dim - Current dimension
 * @returns TSL Fn that evaluates psi based on mode
 */
export function createUnifiedPsi(
  uniforms: PsiUniforms,
  hoNDOptimized: HONDEvaluator,
  hydrogenNDEval: HydrogenNDEvaluator | null,
  dim: number
) {
  const hoEval = createHarmonicOscillatorPsi(uniforms, hoNDOptimized)

  return Fn(
    ([
      tArg,
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
      const t = tArg ?? float(0)
      const x0 = x0Arg ?? float(0)
      const x1 = x1Arg ?? float(0)
      const x2 = x2Arg ?? float(0)
      const x3 = x3Arg ?? float(0)
      const x4 = x4Arg ?? float(0)
      const x5 = x5Arg ?? float(0)
      const x6 = x6Arg ?? float(0)
      const x7 = x7Arg ?? float(0)
      const x8 = x8Arg ?? float(0)
      const x9 = x9Arg ?? float(0)
      const x10 = x10Arg ?? float(0)

      // Harmonic oscillator result
      const hoResult = hoEval(t, x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10)

      // Hydrogen orbital result (3D only)
      const pos = vec3(x0, x1, x2)
      const hydrogenResult = evalHydrogenPsiTime(
        pos,
        uniforms.uPrincipalN,
        uniforms.uAzimuthalL,
        uniforms.uMagneticM,
        uniforms.uBohrRadius,
        uniforms.uUseRealOrbitals,
        t
      )

      // Hydrogen ND result
      const hydrogenNDResult = vec2(0, 0).toVar()
      if (hydrogenNDEval && dim >= 3) {
        // Build coordinate array based on dimension
        const coordArgs = [x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10].slice(0, dim)
        const psi = hydrogenNDEval(...coordArgs, t)
        hydrogenNDResult.assign(vec2(psi.x, psi.y))
      }

      // Select based on mode using nested select
      const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
      const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)

      return select(isHydrogen, hydrogenResult, select(isHydrogenND, hydrogenNDResult, hoResult))
    }
  )
}

/**
 * Create unified PSI with phase evaluation.
 *
 * Returns: vec4(psi.re, psi.im, spatialPhase, unused)
 *
 * Matches WebGL evalPsiWithSpatialPhase exactly:
 * - For HydrogenND: evaluates spatial wavefunction ONCE (at t=0)
 * - If uPhaseAnimationEnabled: computes phase(t) = phase_spatial - E * t
 *   where E = E_hydrogen + Σ ω_j × (n_j + 0.5)
 *
 * @param uniforms - PSI uniforms
 * @param hoNDOptimized - Dimension-optimized HO ND evaluator
 * @param hydrogenNDEval - Optional Hydrogen ND evaluator for current dimension
 * @param dim - Current dimension (needed for HydrogenND extra dim count)
 * @returns TSL Fn that evaluates psi with phase
 */
export function createPsiWithSpatialPhase(
  uniforms: PsiUniforms,
  hoNDOptimized: HONDEvaluator,
  hydrogenNDEval?: HydrogenNDEvaluator | null,
  dim?: number
) {
  const hoEval = createHarmonicOscillatorPsi(uniforms, hoNDOptimized)
  const currentDim = dim ?? 3
  const extraDimCount = Math.max(0, currentDim - 3)

  return Fn(
    ([
      tArg,
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
      const t = tArg ?? float(0)
      const x0 = x0Arg ?? float(0)
      const x1 = x1Arg ?? float(0)
      const x2 = x2Arg ?? float(0)
      const x3 = x3Arg ?? float(0)
      const x4 = x4Arg ?? float(0)
      const x5 = x5Arg ?? float(0)
      const x6 = x6Arg ?? float(0)
      const x7 = x7Arg ?? float(0)
      const x8 = x8Arg ?? float(0)
      const x9 = x9Arg ?? float(0)
      const x10 = x10Arg ?? float(0)

      // Hydrogen orbital mode (3D only)
      const pos = vec3(x0, x1, x2)
      const hydrogenWithPhase = evalHydrogenPsiWithPhase(
        pos,
        uniforms.uPrincipalN,
        uniforms.uAzimuthalL,
        uniforms.uMagneticM,
        uniforms.uBohrRadius,
        uniforms.uUseRealOrbitals,
        t
      )

      // Harmonic oscillator mode
      const psiTime = hoEval(t, x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10)
      const psiSpatial = hoEval(float(0), x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10)
      const hoSpatialPhase = atan(psiSpatial.y, psiSpatial.x)
      const hoResult = vec4(psiTime.x, psiTime.y, hoSpatialPhase, float(0))

      // Hydrogen ND mode
      // OPTIMIZED: Evaluate spatial wavefunction ONCE (at t=0)
      // For a single eigenstate, |ψ(t)|² = |ψ_spatial|² since time evolution
      // is just a global phase rotation: e^{-iEt} has unit magnitude.
      const hydrogenNDResult = vec4(0, 0, 0, 0).toVar()

      if (hydrogenNDEval && currentDim >= 3) {
        // Build coordinate array based on dimension
        const coordArgs = [x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10].slice(0, currentDim)

        // Evaluate spatial wavefunction at t=0
        const psiSpatialND = hydrogenNDEval(...coordArgs, float(0))
        const spatialPhaseND = atan(psiSpatialND.y, psiSpatialND.x)

        // Phase animation: compute time-dependent phase rotation when enabled
        const outputPhase = spatialPhaseND.toVar()

        if (uniforms.uPhaseAnimationEnabled && uniforms.uExtraDimN && uniforms.uExtraDimOmega) {
          // Compute total energy: E = E_hydrogen + Σ ω_j × (n_j + 0.5)
          const fn = uniforms.uPrincipalN
          const E = float(-0.5).div(fn.mul(fn)).toVar() // Hydrogen ground state energy

          // Add extra dimension HO contributions
          // uExtraDimN and uExtraDimOmega are vec4 arrays
          for (let i = 0; i < extraDimCount && i < 8; i++) {
            const vecIdx = Math.floor(i / 4)
            const compIdx = i % 4
            const omega =
              uniforms.uExtraDimOmega[vecIdx]?.[['x', 'y', 'z', 'w'][compIdx] as 'x' | 'y' | 'z' | 'w'] ?? float(1)
            const nj =
              uniforms.uExtraDimN[vecIdx]?.[['x', 'y', 'z', 'w'][compIdx] as 'x' | 'y' | 'z' | 'w'] ?? float(0)
            E.addAssign(omega.mul(nj.add(0.5)))
          }

          // phase(t) = phase_spatial - E * t
          const animatedPhase = spatialPhaseND.sub(E.mul(t))
          // Apply only when phase animation is enabled
          outputPhase.assign(
            select(uniforms.uPhaseAnimationEnabled, animatedPhase, spatialPhaseND)
          )
        }

        // Return spatial wavefunction (density unchanged) with animated phase
        hydrogenNDResult.assign(vec4(psiSpatialND.x, psiSpatialND.y, outputPhase, float(0)))
      }

      // Select based on mode
      const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
      const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)

      return select(isHydrogen, hydrogenWithPhase, select(isHydrogenND, hydrogenNDResult, hoResult))
    }
  )
}

/**
 * Evaluate spatial-only phase (t=0) for stable coloring.
 *
 * Matches WebGL evalSpatialPhase exactly:
 * - Hydrogen mode: evaluate hydrogenPsi at t=0 and compute phase
 * - HydrogenND mode: evaluate dimension-specific hydrogenND at t=0 and compute phase
 * - Harmonic oscillator mode: evaluate HO psi at t=0 and compute phase
 *
 * @param uniforms - PSI uniforms
 * @param hoNDOptimized - Dimension-optimized HO ND evaluator
 * @param hydrogenNDEval - Optional dimension-specific Hydrogen ND evaluator
 * @param dim - Current dimension (for HydrogenND coordinate slicing)
 * @returns TSL Fn that evaluates spatial phase
 */
export function createSpatialPhase(
  uniforms: PsiUniforms,
  hoNDOptimized: HONDEvaluator,
  hydrogenNDEval?: HydrogenNDEvaluator | null,
  dim?: number
) {
  const hoEval = createHarmonicOscillatorPsi(uniforms, hoNDOptimized)
  const currentDim = dim ?? 3

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
      // Provide fallback values to avoid undefined
      const x0 = x0Arg ?? float(0)
      const x1 = x1Arg ?? float(0)
      const x2 = x2Arg ?? float(0)
      const x3 = x3Arg ?? float(0)
      const x4 = x4Arg ?? float(0)
      const x5 = x5Arg ?? float(0)
      const x6 = x6Arg ?? float(0)
      const x7 = x7Arg ?? float(0)
      const x8 = x8Arg ?? float(0)
      const x9 = x9Arg ?? float(0)
      const x10 = x10Arg ?? float(0)

      // Hydrogen orbital phase (3D only)
      const pos = vec3(x0, x1, x2)
      const hydrogenPsi = evalHydrogenPsi(
        pos,
        uniforms.uPrincipalN,
        uniforms.uAzimuthalL,
        uniforms.uMagneticM,
        uniforms.uBohrRadius,
        uniforms.uUseRealOrbitals
      )
      const hydrogenPhase = atan(hydrogenPsi.y, hydrogenPsi.x)

      // Harmonic oscillator phase
      const hoPsi = hoEval(float(0), x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10)
      const hoPhase = atan(hoPsi.y, hoPsi.x)

      // Hydrogen ND phase (evaluate at t=0)
      // CRITICAL: Must handle HydrogenND mode to match WebGL evalSpatialPhase
      const hydrogenNDPhase = float(0).toVar()
      if (hydrogenNDEval && currentDim >= 3) {
        // Build coordinate array based on dimension
        const coordArgs = [x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10].slice(0, currentDim)
        // Evaluate at t=0 for spatial-only phase
        const psiSpatialND = hydrogenNDEval(...coordArgs, float(0))
        hydrogenNDPhase.assign(atan(psiSpatialND.y, psiSpatialND.x))
      }

      // Select based on mode using nested select
      const isHydrogen = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN)
      const isHydrogenND = uniforms.uQuantumMode.equal(QUANTUM_MODE_HYDROGEN_ND)

      return select(isHydrogen, hydrogenPhase, select(isHydrogenND, hydrogenNDPhase, hoPhase))
    }
  )
}
