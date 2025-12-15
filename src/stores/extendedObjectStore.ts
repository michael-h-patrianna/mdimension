/**
 * Extended Object State Management using Zustand
 *
 * Manages parameters for all object types including:
 * - Polytopes (hypercube, simplex, cross-polytope) - scale configuration
 * - Root Systems (A, D, E8 polytopes)
 * - Clifford Torus (flat torus on S^3)
 * - Mandelbrot Set (n-dimensional fractal)
 * - Mandelbox (n-dimensional box fractal)
 *
 * The unified configuration ensures visual consistency across all object types.
 *
 * @see docs/prd/extended-objects.md
 * @see docs/research/nd-extended-objects-guide.md
 */

import {
  DEFAULT_CLIFFORD_TORUS_CONFIG,
  DEFAULT_MANDELBOX_CONFIG,
  DEFAULT_MANDELBROT_CONFIG,
  DEFAULT_MENGER_CONFIG,
  DEFAULT_NESTED_TORUS_CONFIG,
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_ROOT_SYSTEM_CONFIG,
} from '@/lib/geometry/extended/types'
import { create } from 'zustand'
import { createCliffordTorusSlice } from './slices/geometry/cliffordTorusSlice'
import { createMandelboxSlice } from './slices/geometry/mandelboxSlice'
import { createMandelbrotSlice } from './slices/geometry/mandelbrotSlice'
import { createMengerSlice } from './slices/geometry/mengerSlice'
import { createNestedTorusSlice } from './slices/geometry/nestedTorusSlice'
import { createPolytopeSlice } from './slices/geometry/polytopeSlice'
import { createRootSystemSlice } from './slices/geometry/rootSystemSlice'
import { ExtendedObjectSlice } from './slices/geometry/types'

// Re-export type for consumers
export type { ExtendedObjectSlice as ExtendedObjectState } from './slices/geometry/types'

// ============================================================================
// Store Implementation
// ============================================================================

export const useExtendedObjectStore = create<ExtendedObjectSlice>()((...a) => {
  const [set] = a

  return {
    ...createPolytopeSlice(...a),
    ...createRootSystemSlice(...a),
    ...createCliffordTorusSlice(...a),
    ...createNestedTorusSlice(...a),
    ...createMandelbrotSlice(...a),
    ...createMandelboxSlice(...a),
    ...createMengerSlice(...a),

    // --- Reset Action ---
    reset: () => {
      set({
        polytope: { ...DEFAULT_POLYTOPE_CONFIG },
        rootSystem: { ...DEFAULT_ROOT_SYSTEM_CONFIG },
        cliffordTorus: { ...DEFAULT_CLIFFORD_TORUS_CONFIG },
        nestedTorus: { ...DEFAULT_NESTED_TORUS_CONFIG },
        mandelbrot: { ...DEFAULT_MANDELBROT_CONFIG },
        mandelbox: { ...DEFAULT_MANDELBOX_CONFIG },
        menger: { ...DEFAULT_MENGER_CONFIG },
      })
    },
  }
})