import { StateCreator } from 'zustand'
import { AppearanceSlice, ColorSlice, ColorSliceState } from './types'
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_COLOR_ALGORITHM,
  DEFAULT_COSINE_COEFFICIENTS,
  DEFAULT_DISTRIBUTION,
  DEFAULT_EDGE_COLOR,
  DEFAULT_FACE_COLOR,
  DEFAULT_LCH_CHROMA,
  DEFAULT_LCH_LIGHTNESS,
  DEFAULT_MULTI_SOURCE_WEIGHTS,
  DEFAULT_PER_DIMENSION_COLOR_ENABLED,
  VISUAL_PRESETS,
} from '@/stores/defaults/visualDefaults'

export const COLOR_INITIAL_STATE: ColorSliceState = {
  edgeColor: DEFAULT_EDGE_COLOR,
  faceColor: DEFAULT_FACE_COLOR,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  perDimensionColorEnabled: DEFAULT_PER_DIMENSION_COLOR_ENABLED,
  colorAlgorithm: DEFAULT_COLOR_ALGORITHM,
  cosineCoefficients: { ...DEFAULT_COSINE_COEFFICIENTS },
  distribution: { ...DEFAULT_DISTRIBUTION },
  multiSourceWeights: { ...DEFAULT_MULTI_SOURCE_WEIGHTS },
  lchLightness: DEFAULT_LCH_LIGHTNESS,
  lchChroma: DEFAULT_LCH_CHROMA,
}

export const createColorSlice: StateCreator<AppearanceSlice, [], [], ColorSlice> = (set) => ({
  // State
  ...COLOR_INITIAL_STATE,

  // Actions
  setEdgeColor: (color) => set({ edgeColor: color }),
  setFaceColor: (color) => set({ faceColor: color }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  setPerDimensionColorEnabled: (enabled) => set({ perDimensionColorEnabled: enabled }),

  setColorAlgorithm: (algorithm) => set({ colorAlgorithm: algorithm }),
  
  setCosineCoefficients: (coefficients) => set({ cosineCoefficients: { ...coefficients } }),
  
  setCosineCoefficient: (key, index, value) => set((state) => {
    const newCoefficients = { ...state.cosineCoefficients }
    const arr = [...newCoefficients[key]] as [number, number, number]
    arr[index] = Math.max(0, Math.min(2, value))
    newCoefficients[key] = arr
    return { cosineCoefficients: newCoefficients }
  }),

  setDistribution: (settings) => set((state) => ({
    distribution: {
      ...state.distribution,
      power: settings.power !== undefined ? Math.max(0.25, Math.min(4, settings.power)) : state.distribution.power,
      cycles: settings.cycles !== undefined ? Math.max(0.5, Math.min(5, settings.cycles)) : state.distribution.cycles,
      offset: settings.offset !== undefined ? Math.max(0, Math.min(1, settings.offset)) : state.distribution.offset,
    },
  })),

  setMultiSourceWeights: (weights) => set((state) => ({
    multiSourceWeights: {
      ...state.multiSourceWeights,
      depth: weights.depth !== undefined ? Math.max(0, Math.min(1, weights.depth)) : state.multiSourceWeights.depth,
      orbitTrap: weights.orbitTrap !== undefined ? Math.max(0, Math.min(1, weights.orbitTrap)) : state.multiSourceWeights.orbitTrap,
      normal: weights.normal !== undefined ? Math.max(0, Math.min(1, weights.normal)) : state.multiSourceWeights.normal,
    },
  })),

  setLchLightness: (lightness) => set({ lchLightness: Math.max(0.1, Math.min(1, lightness)) }),
  setLchChroma: (chroma) => set({ lchChroma: Math.max(0, Math.min(0.4, chroma)) }),

  applyPreset: (preset) => {
    const settings = VISUAL_PRESETS[preset]
    if (!settings) return

    set((state) => ({
      edgeColor: settings.edgeColor,
      edgeThickness: settings.edgeThickness,
      backgroundColor: settings.backgroundColor,
      faceColor: ('faceColor' in settings && settings.faceColor) ? settings.faceColor : state.faceColor
    }))
  },
} as unknown as AppearanceSlice) 
// Casting because we are only implementing part of the interface here, 
// but in the final merge it will be complete.
// Actually, safer pattern is:
// export const createColorSlice: StateCreator<AppearanceSlice, [], [], ColorSlice> = ...
// But ColorSlice doesn't include the other properties needed for initialization if we do spreading.
// The standard Zustand pattern for slice splitting with TypeScript usually involves 
// defining the Slice as a part of the whole Store state.
