import { StateCreator } from 'zustand'
import { AppearanceSlice, RenderSlice, RenderSliceState } from './types'
import {
  DEFAULT_DEPTH_ATTENUATION_ENABLED,
  DEFAULT_DEPTH_ATTENUATION_STRENGTH,
  DEFAULT_EDGES_VISIBLE,
  DEFAULT_FACES_VISIBLE,
  DEFAULT_FRESNEL_ENABLED,
  DEFAULT_FRESNEL_INTENSITY,
  DEFAULT_SHADER_SETTINGS,
  DEFAULT_SHADER_TYPE,
} from '@/stores/defaults/visualDefaults'

export const RENDER_INITIAL_STATE: RenderSliceState = {
  edgesVisible: DEFAULT_EDGES_VISIBLE,
  facesVisible: DEFAULT_FACES_VISIBLE,
  shaderType: DEFAULT_SHADER_TYPE,
  shaderSettings: { ...DEFAULT_SHADER_SETTINGS },
  depthAttenuationEnabled: DEFAULT_DEPTH_ATTENUATION_ENABLED,
  depthAttenuationStrength: DEFAULT_DEPTH_ATTENUATION_STRENGTH,
  fresnelEnabled: DEFAULT_FRESNEL_ENABLED,
  fresnelIntensity: DEFAULT_FRESNEL_INTENSITY,
}

export const createRenderSlice: StateCreator<AppearanceSlice, [], [], RenderSlice> = (set) => ({
  ...RENDER_INITIAL_STATE,

  setEdgesVisible: (visible) => set({ edgesVisible: visible }),

  setFacesVisible: (visible) => set({
    facesVisible: visible,
    shaderType: visible ? 'surface' : 'wireframe',
  }),

  setShaderType: (shaderType) => set({ shaderType }),

  setWireframeSettings: (settings) => set((state) => ({
    shaderSettings: {
      ...state.shaderSettings,
      wireframe: {
        ...state.shaderSettings.wireframe,
        ...settings,
        lineThickness: settings.lineThickness !== undefined
          ? Math.max(1, Math.min(5, settings.lineThickness))
          : state.shaderSettings.wireframe.lineThickness,
      },
    },
  })),

  setSurfaceSettings: (settings) => set((state) => ({
    shaderSettings: {
      ...state.shaderSettings,
      surface: {
        ...state.shaderSettings.surface,
        ...settings,
        faceOpacity: settings.faceOpacity !== undefined
          ? Math.max(0, Math.min(1, settings.faceOpacity))
          : state.shaderSettings.surface.faceOpacity,
        specularIntensity: settings.specularIntensity !== undefined
          ? Math.max(0, Math.min(2, settings.specularIntensity))
          : state.shaderSettings.surface.specularIntensity,
        shininess: settings.shininess !== undefined
          ? Math.max(1, Math.min(128, settings.shininess))
          : state.shaderSettings.surface.shininess,
      },
    },
  })),

  setDepthAttenuationEnabled: (enabled) => set({ depthAttenuationEnabled: enabled }),
  setDepthAttenuationStrength: (strength) => set({ depthAttenuationStrength: Math.max(0, Math.min(0.5, strength)) }),
  setFresnelEnabled: (enabled) => set({ fresnelEnabled: enabled }),
  setFresnelIntensity: (intensity) => set({ fresnelIntensity: Math.max(0, Math.min(1, intensity)) }),
})
