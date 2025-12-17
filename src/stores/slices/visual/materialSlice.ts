import { StateCreator } from 'zustand'
import { AppearanceSlice, MaterialSlice, MaterialSliceState } from './types'
import {
  DEFAULT_EDGE_METALLIC,
  DEFAULT_EDGE_ROUGHNESS,
  DEFAULT_EDGE_THICKNESS,
  DEFAULT_FACE_OPACITY,
} from '@/stores/defaults/visualDefaults'

export const MATERIAL_INITIAL_STATE: MaterialSliceState = {
  edgeThickness: DEFAULT_EDGE_THICKNESS,
  edgeMetallic: DEFAULT_EDGE_METALLIC,
  edgeRoughness: DEFAULT_EDGE_ROUGHNESS,
  faceOpacity: DEFAULT_FACE_OPACITY,
}

export const createMaterialSlice: StateCreator<AppearanceSlice, [], [], MaterialSlice> = (set) => ({
  ...MATERIAL_INITIAL_STATE,

  setEdgeThickness: (thickness) => {
    const clamped = Math.max(0, Math.min(5, thickness))
    set({ 
      edgeThickness: clamped,
      edgesVisible: clamped > 0 
    })
  },
  setEdgeMetallic: (metallic) => set({ edgeMetallic: Math.max(0, Math.min(1, metallic)) }),
  setEdgeRoughness: (roughness) => set({ edgeRoughness: Math.max(0, Math.min(1, roughness)) }),
  setFaceOpacity: (opacity) => set({ faceOpacity: Math.max(0, Math.min(1, opacity)) }),
})
