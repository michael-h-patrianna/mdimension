import {
  DEFAULT_POLYTOPE_CONFIG,
  DEFAULT_POLYTOPE_SCALES,
  DualNormalizeMode,
  TruncationMode,
} from '@/lib/geometry/extended/types'
import { StateCreator } from 'zustand'
import { ExtendedObjectSlice, PolytopeSlice } from './types'

export const createPolytopeSlice: StateCreator<ExtendedObjectSlice, [], [], PolytopeSlice> = (set) => ({
  polytope: { ...DEFAULT_POLYTOPE_CONFIG },

  setPolytopeScale: (scale: number) => {
    // Range 0.5-8.0 to accommodate different polytope types (simplex needs up to 8)
    const clampedScale = Math.max(0.5, Math.min(8.0, scale))
    set((state) => ({
      polytope: { ...state.polytope, scale: clampedScale },
    }))
  },

  initializePolytopeForType: (polytopeType: string) => {
    const defaultScale = DEFAULT_POLYTOPE_SCALES[polytopeType] ?? DEFAULT_POLYTOPE_CONFIG.scale
    set((state) => ({
      polytope: { ...state.polytope, scale: defaultScale },
    }))
  },

  // === Truncation Animation Actions ===

  setPolytopeTruncationEnabled: (enabled: boolean) => {
    set((state) => ({
      polytope: { ...state.polytope, truncationEnabled: enabled },
    }))
  },

  setPolytopeTruncationMode: (mode: TruncationMode) => {
    set((state) => ({
      polytope: { ...state.polytope, truncationMode: mode },
    }))
  },

  setPolytopeTruncationT: (t: number) => {
    const clampedT = Math.max(0.0, Math.min(1.0, t))
    set((state) => ({
      polytope: { ...state.polytope, truncationT: clampedT },
    }))
  },

  setPolytopeTruncationMin: (min: number) => {
    const clampedMin = Math.max(0.0, Math.min(0.5, min))
    set((state) => ({
      polytope: { ...state.polytope, truncationMin: clampedMin },
    }))
  },

  setPolytopeTruncationMax: (max: number) => {
    const clampedMax = Math.max(0.5, Math.min(1.0, max))
    set((state) => ({
      polytope: { ...state.polytope, truncationMax: clampedMax },
    }))
  },

  setPolytopeTruncationSpeed: (speed: number) => {
    const clampedSpeed = Math.max(0.01, Math.min(0.5, speed))
    set((state) => ({
      polytope: { ...state.polytope, truncationSpeed: clampedSpeed },
    }))
  },

  // === Pulse Animation Actions (organic breathing) ===

  setPolytopeFacetOffsetEnabled: (enabled: boolean) => {
    set((state) => ({
      polytope: { ...state.polytope, facetOffsetEnabled: enabled },
    }))
  },

  setPolytopeFacetOffsetAmplitude: (amplitude: number) => {
    // 0-1 range for organic pulse intensity
    const clampedAmplitude = Math.max(0.0, Math.min(1.0, amplitude))
    set((state) => ({
      polytope: { ...state.polytope, facetOffsetAmplitude: clampedAmplitude },
    }))
  },

  setPolytopeFacetOffsetFrequency: (frequency: number) => {
    const clampedFrequency = Math.max(0.1, Math.min(2.0, frequency))
    set((state) => ({
      polytope: { ...state.polytope, facetOffsetFrequency: clampedFrequency },
    }))
  },

  setPolytopeFacetOffsetPhaseSpread: (spread: number) => {
    const clampedSpread = Math.max(0.0, Math.min(1.0, spread))
    set((state) => ({
      polytope: { ...state.polytope, facetOffsetPhaseSpread: clampedSpread },
    }))
  },

  // === Flow Animation Actions (organic vertex drift) ===

  setPolytopeDualMorphEnabled: (enabled: boolean) => {
    set((state) => ({
      polytope: { ...state.polytope, dualMorphEnabled: enabled },
    }))
  },

  setPolytopeDualMorphT: (t: number) => {
    // 0-1 range for organic flow intensity
    const clampedT = Math.max(0.0, Math.min(1.0, t))
    set((state) => ({
      polytope: { ...state.polytope, dualMorphT: clampedT },
    }))
  },

  setPolytopeDualNormalize: (mode: DualNormalizeMode) => {
    set((state) => ({
      polytope: { ...state.polytope, dualNormalize: mode },
    }))
  },

  setPolytopeDualMorphSpeed: (speed: number) => {
    const clampedSpeed = Math.max(0.01, Math.min(0.3, speed))
    set((state) => ({
      polytope: { ...state.polytope, dualMorphSpeed: clampedSpeed },
    }))
  },

  // === Ripple Animation Actions (smooth radial waves) ===

  setPolytopeExplodeEnabled: (enabled: boolean) => {
    set((state) => ({
      polytope: { ...state.polytope, explodeEnabled: enabled },
    }))
  },

  setPolytopeExplodeFactor: (factor: number) => {
    const clampedFactor = Math.max(0.0, Math.min(1.0, factor))
    set((state) => ({
      polytope: { ...state.polytope, explodeFactor: clampedFactor },
    }))
  },

  setPolytopeExplodeSpeed: (speed: number) => {
    const clampedSpeed = Math.max(0.01, Math.min(0.3, speed))
    set((state) => ({
      polytope: { ...state.polytope, explodeSpeed: clampedSpeed },
    }))
  },

  setPolytopeExplodeMax: (max: number) => {
    // 0-1 range for organic ripple intensity
    const clampedMax = Math.max(0.0, Math.min(1.0, max))
    set((state) => ({
      polytope: { ...state.polytope, explodeMax: clampedMax },
    }))
  },
})
