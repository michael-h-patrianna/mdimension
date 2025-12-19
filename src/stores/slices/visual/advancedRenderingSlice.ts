import type { StateCreator } from 'zustand'
import type { AdvancedRenderingSlice } from './types'

export const ADVANCED_RENDERING_INITIAL_STATE = {
  roughness: 0.3,

  sssEnabled: false,
  sssIntensity: 1.0,
  sssColor: '#ff8844',
  sssThickness: 1.0,
  sssJitter: 0.2,
}

export const createAdvancedRenderingSlice: StateCreator<
  AdvancedRenderingSlice,
  [],
  [],
  AdvancedRenderingSlice
> = (set) => ({
  ...ADVANCED_RENDERING_INITIAL_STATE,

  setRoughness: (roughness) => set({ roughness }),
  
  setSssEnabled: (sssEnabled) => set({ sssEnabled }),
  setSssIntensity: (sssIntensity) => set({ sssIntensity }),
  setSssColor: (sssColor) => set({ sssColor }),
  setSssThickness: (sssThickness) => set({ sssThickness }),
  setSssJitter: (sssJitter) => set({ sssJitter }),
})
