/**
 * Hydrogen orbital presets for Schrödinger visualization
 *
 * Defines the famous s, p, d, f electron orbitals that arise from
 * solving the Schrödinger equation for the hydrogen atom with
 * Coulomb potential.
 *
 * Quantum numbers:
 * - n (principal): 1, 2, 3, ... (determines shell and energy)
 * - l (azimuthal): 0 to n-1 (determines shape: s=0, p=1, d=2, f=3)
 * - m (magnetic): -l to +l (determines orientation)
 *
 * Real orbital names (e.g., px, py, pz) are linear combinations
 * of complex spherical harmonics that produce real-valued functions.
 */

import { HydrogenOrbitalPresetName } from '../types'

/**
 * Hydrogen orbital preset configuration
 */
export interface HydrogenOrbitalPreset {
  /** Display name (e.g., "2pz") */
  name: string
  /** Human-readable description */
  description: string
  /** Principal quantum number n (shell) */
  n: number
  /** Azimuthal quantum number l (shape) */
  l: number
  /** Magnetic quantum number m (orientation) */
  m: number
  /**
   * Whether to use real spherical harmonics.
   * true: px, py, pz notation (real combinations)
   * false: complex Y_lm
   */
  useReal: boolean
  /** Suggested Bohr radius scale for visualization */
  bohrRadiusScale: number
}

/**
 * Orbital shape letter from azimuthal quantum number
 * @param l - The azimuthal quantum number
 * @returns The orbital shape letter (s, p, d, f, etc.)
 */
export function orbitalShapeLetter(l: number): string {
  const letters = ['s', 'p', 'd', 'f', 'g', 'h', 'i']
  return letters[l] ?? `l=${l}`
}

/**
 * Get maximum l for a given n
 * @param n - The principal quantum number
 * @returns Maximum azimuthal quantum number (n-1)
 */
export function maxAzimuthalForPrincipal(n: number): number {
  return Math.max(0, n - 1)
}

/**
 * Validate quantum number constraints
 * @param n - Principal quantum number
 * @param l - Azimuthal quantum number
 * @param m - Magnetic quantum number
 * @returns True if quantum numbers are valid
 */
export function validateQuantumNumbers(n: number, l: number, m: number): boolean {
  if (n < 1) return false
  if (l < 0 || l >= n) return false
  if (Math.abs(m) > l) return false
  return true
}

/**
 * Named hydrogen orbital presets
 *
 * Real orbital naming conventions:
 * - s orbitals: Just "ns" (spherical)
 * - p orbitals: px, py, pz (lobes along axes)
 * - d orbitals: dxy, dxz, dyz (lobes between axes), dz2 (donut), dx2-y2 (lobes along axes)
 * - f orbitals: Complex multi-lobed shapes
 */
export const HYDROGEN_ORBITAL_PRESETS: Record<HydrogenOrbitalPresetName, HydrogenOrbitalPreset> = {
  // ============================================
  // s Orbitals (l = 0) - Spherical
  // ============================================
  '1s': {
    name: '1s',
    description: 'Ground state - spherical, no nodes',
    n: 1,
    l: 0,
    m: 0,
    useReal: true,
    bohrRadiusScale: 1.0,
  },
  '2s': {
    name: '2s',
    description: 'First excited s - spherical with 1 radial node',
    n: 2,
    l: 0,
    m: 0,
    useReal: true,
    bohrRadiusScale: 1.5,
  },
  '3s': {
    name: '3s',
    description: 'Second excited s - spherical with 2 radial nodes',
    n: 3,
    l: 0,
    m: 0,
    useReal: true,
    bohrRadiusScale: 2.0,
  },
  '4s': {
    name: '4s',
    description: 'Third excited s - spherical with 3 radial nodes',
    n: 4,
    l: 0,
    m: 0,
    useReal: true,
    bohrRadiusScale: 2.5,
  },

  // ============================================
  // p Orbitals (l = 1) - Dumbbell
  // ============================================
  '2px': {
    name: '2px',
    description: 'Dumbbell along x-axis',
    n: 2,
    l: 1,
    m: 1, // Real: (Y_1^1 + Y_1^{-1})/√2 ∝ sin(θ)cos(φ) ∝ x/r
    useReal: true,
    bohrRadiusScale: 1.5,
  },
  '2py': {
    name: '2py',
    description: 'Dumbbell along y-axis',
    n: 2,
    l: 1,
    m: -1, // Real: (Y_1^1 - Y_1^{-1})/(i√2) ∝ sin(θ)sin(φ) ∝ y/r
    useReal: true,
    bohrRadiusScale: 1.5,
  },
  '2pz': {
    name: '2pz',
    description: 'Dumbbell along z-axis',
    n: 2,
    l: 1,
    m: 0, // Y_1^0 ∝ cos(θ) ∝ z/r
    useReal: true,
    bohrRadiusScale: 1.5,
  },
  '3px': {
    name: '3px',
    description: 'Dumbbell with 1 radial node',
    n: 3,
    l: 1,
    m: 1,
    useReal: true,
    bohrRadiusScale: 2.0,
  },
  '3py': {
    name: '3py',
    description: 'Dumbbell with 1 radial node',
    n: 3,
    l: 1,
    m: -1,
    useReal: true,
    bohrRadiusScale: 2.0,
  },
  '3pz': {
    name: '3pz',
    description: 'Dumbbell with 1 radial node',
    n: 3,
    l: 1,
    m: 0,
    useReal: true,
    bohrRadiusScale: 2.0,
  },

  // ============================================
  // d Orbitals (l = 2) - Cloverleaf/Donut
  // ============================================
  '3dxy': {
    name: '3dxy',
    description: 'Four-lobed cloverleaf in xy plane (lobes between axes)',
    n: 3,
    l: 2,
    m: 2, // Real: (Y_2^2 + Y_2^{-2})/√2 ∝ sin²(θ)sin(2φ) ∝ xy/r²
    useReal: true,
    bohrRadiusScale: 2.0,
  },
  '3dxz': {
    name: '3dxz',
    description: 'Four-lobed cloverleaf in xz plane',
    n: 3,
    l: 2,
    m: 1, // Real: (Y_2^1 + Y_2^{-1})/√2 ∝ sin(θ)cos(θ)cos(φ) ∝ xz/r²
    useReal: true,
    bohrRadiusScale: 2.0,
  },
  '3dyz': {
    name: '3dyz',
    description: 'Four-lobed cloverleaf in yz plane',
    n: 3,
    l: 2,
    m: -1, // Real: (Y_2^1 - Y_2^{-1})/(i√2) ∝ sin(θ)cos(θ)sin(φ) ∝ yz/r²
    useReal: true,
    bohrRadiusScale: 2.0,
  },
  '3dz2': {
    name: '3dz²',
    description: 'Donut with lobes along z-axis',
    n: 3,
    l: 2,
    m: 0, // Y_2^0 ∝ 3cos²(θ) - 1 ∝ (3z² - r²)/r²
    useReal: true,
    bohrRadiusScale: 2.0,
  },
  '3dx2y2': {
    name: '3dx²-y²',
    description: 'Four-lobed cloverleaf along x and y axes',
    n: 3,
    l: 2,
    m: -2, // Real: (Y_2^2 - Y_2^{-2})/(i√2) ∝ sin²(θ)cos(2φ) ∝ (x²-y²)/r²
    useReal: true,
    bohrRadiusScale: 2.0,
  },

  // ============================================
  // f Orbitals (l = 3) - Complex multilobed
  // ============================================
  '4fz3': {
    name: '4fz³',
    description: 'Triple dumbbell along z-axis',
    n: 4,
    l: 3,
    m: 0, // Y_3^0 ∝ z(5z² - 3r²)/r³
    useReal: true,
    bohrRadiusScale: 2.5,
  },
  '4fxyz': {
    name: '4fxyz',
    description: 'Eight-lobed cubic arrangement',
    n: 4,
    l: 3,
    m: 2, // ∝ xyz/r³
    useReal: true,
    bohrRadiusScale: 2.5,
  },
  '4fy3x2y2': {
    name: '4fy(3x²-y²)',
    description: 'Complex six-lobed pattern',
    n: 4,
    l: 3,
    m: -3,
    useReal: true,
    bohrRadiusScale: 2.5,
  },
  '4fzx2y2': {
    name: '4fz(x²-y²)',
    description: 'Complex lobed pattern with z modulation',
    n: 4,
    l: 3,
    m: -2,
    useReal: true,
    bohrRadiusScale: 2.5,
  },

  // ============================================
  // Custom - User-defined quantum numbers
  // ============================================
  custom: {
    name: 'Custom',
    description: 'User-defined quantum numbers',
    n: 2,
    l: 1,
    m: 0,
    useReal: true,
    bohrRadiusScale: 1.0,
  },
}

/**
 * Get a hydrogen orbital preset by name
 * @param name - Name of the preset
 * @returns The preset configuration
 */
export function getHydrogenPreset(name: HydrogenOrbitalPresetName): HydrogenOrbitalPreset {
  return HYDROGEN_ORBITAL_PRESETS[name] ?? HYDROGEN_ORBITAL_PRESETS['2pz']
}

/**
 * Get all presets grouped by orbital type (s, p, d, f)
 * @returns Record of orbital type to array of presets
 */
export function getPresetsGroupedByType(): Record<string, HydrogenOrbitalPreset[]> {
  const groups: Record<string, HydrogenOrbitalPreset[]> = {
    s: [],
    p: [],
    d: [],
    f: [],
  }

  for (const preset of Object.values(HYDROGEN_ORBITAL_PRESETS)) {
    if (preset.name === 'Custom') continue
    const letter = orbitalShapeLetter(preset.l)
    if (groups[letter]) {
      groups[letter].push(preset)
    }
  }

  return groups
}

/**
 * Generate a label for arbitrary quantum numbers
 * @param n - Principal quantum number
 * @param l - Angular momentum quantum number
 * @param m - Magnetic quantum number
 * @returns Human-readable label string
 */
export function quantumNumbersToLabel(n: number, l: number, m: number): string {
  const letter = orbitalShapeLetter(l)
  if (l === 0) {
    return `${n}${letter}`
  } else if (l === 1) {
    // p orbitals
    if (m === 0) return `${n}pz`
    if (m === 1) return `${n}px`
    if (m === -1) return `${n}py`
  } else if (l === 2) {
    // d orbitals
    if (m === 0) return `${n}dz²`
    if (m === 1) return `${n}dxz`
    if (m === -1) return `${n}dyz`
    if (m === 2) return `${n}dxy`
    if (m === -2) return `${n}dx²-y²`
  }
  // Default: just show quantum numbers
  return `${n}${letter} (m=${m})`
}
