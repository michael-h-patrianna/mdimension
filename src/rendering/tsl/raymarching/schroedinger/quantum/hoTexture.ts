/**
 * Harmonic Oscillator Eigenfunction 3D Texture Generator
 *
 * Precomputes N-dimensional harmonic oscillator eigenfunctions to 3D textures
 * for efficient GPU sampling. This replaces inline shader computation which
 * causes WebGPU shader graph explosion with 8+ terms.
 *
 * Each texture stores Φ_k(x,y,z) values for one superposition term k.
 * Time phase e^{-iE_k t} is applied in the shader at runtime.
 *
 * @module rendering/tsl/raymarching/schroedinger/quantum/hoTexture
 */

import * as THREE from 'three'
import type { QuantumPreset } from '@/lib/geometry/extended/schroedinger/presets'

/**
 * Maximum supported quantum number (matches TSL hermite.ts)
 */
const MAX_QUANTUM_N = 6

/**
 * Configuration for eigenfunction texture generation
 */
export interface HOTextureConfig {
  /** Number of dimensions (3-11) */
  dimension: number
  /** Texture resolution (16 or 32) */
  resolution: 16 | 32
  /** Coordinate range: [-fieldScale, +fieldScale] */
  fieldScale: number
}

/**
 * Result of texture generation
 */
export interface HOTextureResult {
  /** Array of 3D textures, one per term */
  textures: THREE.Data3DTexture[]
  /** Resolution used */
  resolution: number
  /** Field scale used */
  fieldScale: number
  /** Number of terms */
  termCount: number
}

/**
 * Select optimal texture resolution based on preset complexity.
 *
 * Higher quantum numbers have more oscillations and need higher resolution
 * to avoid aliasing artifacts.
 *
 * @param preset - Quantum preset to analyze
 * @returns Optimal resolution (16 or 32)
 */
export function selectResolution(preset: QuantumPreset): 16 | 32 {
  const maxN = Math.max(...preset.quantumNumbers.flat())
  // Use 32³ if any quantum number exceeds 4 (more oscillations)
  return maxN > 4 ? 32 : 16
}

// ============================================
// CPU-side Hermite Polynomial Implementation
// ============================================

/**
 * Hermite polynomial coefficients for H_0 through H_6
 * These match the TSL implementation exactly.
 */
const HERMITE_COEFFICIENTS: number[][] = [
  [1], // H_0 = 1
  [0, 2], // H_1 = 2u
  [-2, 0, 4], // H_2 = 4u² - 2
  [0, -12, 0, 8], // H_3 = 8u³ - 12u
  [12, 0, -48, 0, 16], // H_4 = 16u⁴ - 48u² + 12
  [0, 120, 0, -160, 0, 32], // H_5 = 32u⁵ - 160u³ + 120u
  [-120, 0, 720, 0, -480, 0, 64], // H_6 = 64u⁶ - 480u⁴ + 720u² - 120
]

/**
 * Evaluate Hermite polynomial H_n(u) using Horner's method.
 *
 * @param n - Quantum number (0 to MAX_QUANTUM_N)
 * @param u - Evaluation point
 * @returns H_n(u)
 */
function hermite(n: number, u: number): number {
  const clampedN = Math.min(Math.max(n, 0), MAX_QUANTUM_N)
  const coeffs = HERMITE_COEFFICIENTS[clampedN]
  if (!coeffs) return 1

  // Horner's method: evaluate polynomial from highest to lowest degree
  let result = 0
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = result * u + (coeffs[i] ?? 0)
  }
  return result
}

// ============================================
// CPU-side 1D Harmonic Oscillator
// ============================================

/**
 * Evaluate 1D harmonic oscillator eigenfunction φ_n(x, ω)
 *
 * φ_n(x) = damp(n) · H_n(αx) · e^{-½(αx)²}
 *
 * where α = √ω and damp = 1/(1 + 0.15·n²)
 *
 * @param n - Quantum number (0-6)
 * @param x - Position coordinate
 * @param omega - Angular frequency
 * @returns Eigenfunction value
 */
function ho1D(n: number, x: number, omega: number): number {
  // α = √ω (with minimum to prevent division issues)
  const alpha = Math.sqrt(Math.max(omega, 0.01))
  const u = alpha * x

  // Gaussian envelope: e^{-½u²} (clamped to prevent underflow)
  const u2 = Math.min(u * u, 40.0)
  const gauss = Math.exp(-0.5 * u2)

  // Hermite polynomial
  const H = hermite(n, u)

  // Damping factor to prevent blowup at higher n
  const damp = 1.0 / (1.0 + 0.15 * n * n)

  return damp * H * gauss
}

// ============================================
// CPU-side N-dimensional Harmonic Oscillator
// ============================================

/**
 * Early exit threshold based on dimension.
 *
 * Based on χ² distribution - in higher dimensions, the sum of squared
 * Gaussians has a higher expected value before becoming negligible.
 *
 * @param dimension - Number of dimensions
 * @returns Threshold for sum of (αx)² before returning 0
 */
function computeEarlyExitThreshold(dimension: number): number {
  return 2 * dimension + Math.log(dimension) * 3
}

/**
 * Evaluate N-dimensional harmonic oscillator eigenfunction.
 *
 * Φ_k(x) = ∏_{j=0}^{D-1} φ_{n_j}(x_j, ω_j)
 *
 * @param quantumNumbers - Array of quantum numbers [n_0, n_1, ..., n_{D-1}]
 * @param coords - Position coordinates [x_0, x_1, ..., x_{D-1}]
 * @param omegas - Angular frequencies [ω_0, ω_1, ..., ω_{D-1}]
 * @returns Eigenfunction value
 */
function hoND(
  quantumNumbers: number[],
  coords: number[],
  omegas: number[]
): number {
  const dim = quantumNumbers.length
  const threshold = computeEarlyExitThreshold(dim)

  // Early exit: compute squared distance in Gaussian envelope space
  let distSq = 0
  for (let j = 0; j < dim; j++) {
    const omega = omegas[j] ?? 1.0
    const alpha = Math.sqrt(Math.max(omega, 0.01))
    const u = alpha * (coords[j] ?? 0)
    distSq += u * u
  }

  // If outside Gaussian envelope, return 0
  if (distSq > threshold) {
    return 0
  }

  // Compute product of 1D eigenfunctions
  let product = 1.0
  for (let j = 0; j < dim; j++) {
    const n = quantumNumbers[j] ?? 0
    const x = coords[j] ?? 0
    const omega = omegas[j] ?? 1.0
    const val = ho1D(n, x, omega)

    // Short-circuit if value becomes negligible
    if (Math.abs(product) < 1e-10) {
      return 0
    }
    product *= val
  }

  return product
}

// ============================================
// 3D Texture Generation
// ============================================

/**
 * Generate eigenfunction textures for all terms in a quantum preset.
 *
 * Creates one 3D texture per term containing Φ_k(x,y,z) values.
 * The texture coordinates map [-fieldScale, +fieldScale]³ → [0,1]³.
 *
 * For dimensions > 3, the extra dimensions are set to 0 (the slice plane).
 * The full N-D coordinates are computed in the shader via basis vectors.
 *
 * @param preset - Quantum preset with terms, omega, quantum numbers
 * @param config - Texture generation configuration
 * @returns Array of 3D textures and metadata
 */
export function generateHOEigenfunctionTextures(
  preset: QuantumPreset,
  config: HOTextureConfig
): HOTextureResult {
  const { dimension, resolution, fieldScale } = config
  const { termCount, omega, quantumNumbers } = preset

  const textures: THREE.Data3DTexture[] = []

  // Generate one texture per term
  for (let k = 0; k < termCount; k++) {
    const termQuantumNumbers = quantumNumbers[k]
    if (!termQuantumNumbers) {
      // Create empty texture for missing term
      textures.push(createEmptyTexture(resolution))
      continue
    }

    // Allocate texture data (R32F format - single float per texel)
    const data = new Float32Array(resolution * resolution * resolution)

    // Fill texture with eigenfunction values
    let index = 0
    for (let iz = 0; iz < resolution; iz++) {
      for (let iy = 0; iy < resolution; iy++) {
        for (let ix = 0; ix < resolution; ix++) {
          // Map texture coordinates [0, res-1] → [-fieldScale, +fieldScale]
          const x = ((ix + 0.5) / resolution) * 2 - 1
          const y = ((iy + 0.5) / resolution) * 2 - 1
          const z = ((iz + 0.5) / resolution) * 2 - 1

          // Build coordinate array for N dimensions
          // First 3 dimensions use texture coordinates
          // Remaining dimensions default to 0 (will be transformed by basis vectors)
          const coords: number[] = new Array(dimension).fill(0)
          coords[0] = x * fieldScale
          coords[1] = y * fieldScale
          coords[2] = z * fieldScale

          // Evaluate eigenfunction
          const value = hoND(termQuantumNumbers.slice(0, dimension), coords, omega.slice(0, dimension))

          data[index++] = value
        }
      }
    }

    // Create Three.js 3D texture
    const texture = new THREE.Data3DTexture(data, resolution, resolution, resolution)
    texture.format = THREE.RedFormat
    texture.type = THREE.FloatType
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.wrapR = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true

    // Optional: Add metadata for debugging
    texture.name = `HO_Term_${k}_${dimension}D`

    textures.push(texture)
  }

  return {
    textures,
    resolution,
    fieldScale,
    termCount,
  }
}

/**
 * Create an empty 3D texture (all zeros) for missing terms.
 */
function createEmptyTexture(resolution: number): THREE.Data3DTexture {
  const data = new Float32Array(resolution * resolution * resolution)
  // data is already initialized to zeros

  const texture = new THREE.Data3DTexture(data, resolution, resolution, resolution)
  texture.format = THREE.RedFormat
  texture.type = THREE.FloatType
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.wrapR = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  texture.name = 'HO_Empty'

  return texture
}

/**
 * Dispose of all textures in a result to free GPU memory.
 *
 * @param result - Texture result to dispose
 */
export function disposeHOTextures(result: HOTextureResult): void {
  for (const texture of result.textures) {
    texture.dispose()
  }
  result.textures.length = 0
}

/**
 * Check if a preset requires texture regeneration.
 *
 * Compare key properties that affect eigenfunction values.
 *
 * @param current - Current preset
 * @param previous - Previous preset (if any)
 * @returns True if textures need regeneration
 */
export function needsTextureRegeneration(
  current: QuantumPreset,
  previous: QuantumPreset | null
): boolean {
  if (!previous) return true

  // Check if term count changed
  if (current.termCount !== previous.termCount) return true

  // Check omega values
  if (current.omega.length !== previous.omega.length) return true
  for (let i = 0; i < current.omega.length; i++) {
    if (Math.abs((current.omega[i] ?? 0) - (previous.omega[i] ?? 0)) > 0.001) return true
  }

  // Check quantum numbers
  if (current.quantumNumbers.length !== previous.quantumNumbers.length) return true
  for (let k = 0; k < current.quantumNumbers.length; k++) {
    const currentRow = current.quantumNumbers[k]
    const prevRow = previous.quantumNumbers[k]
    if (!currentRow || !prevRow) continue
    if (currentRow.length !== prevRow.length) return true
    for (let j = 0; j < currentRow.length; j++) {
      if (currentRow[j] !== prevRow[j]) return true
    }
  }

  return false
}
