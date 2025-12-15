import type { StateCreator } from 'zustand'
import {
  type SkyboxAnimationMode,
  type SkyboxTexture,
  DEFAULT_SKYBOX_ANIMATION_MODE,
  DEFAULT_SKYBOX_ANIMATION_SPEED,
  DEFAULT_SKYBOX_BLUR,
  DEFAULT_SKYBOX_ENABLED,
  DEFAULT_SKYBOX_HIGH_QUALITY,
  DEFAULT_SKYBOX_INTENSITY,
  DEFAULT_SKYBOX_ROTATION,
  DEFAULT_SKYBOX_TEXTURE,
} from '../defaults/visualDefaults'

export interface SkyboxSliceState {
  skyboxEnabled: boolean
  skyboxTexture: SkyboxTexture
  skyboxBlur: number
  skyboxIntensity: number
  skyboxRotation: number
  skyboxAnimationMode: SkyboxAnimationMode
  skyboxAnimationSpeed: number
  skyboxHighQuality: boolean
  /** Whether skybox texture is currently loading */
  skyboxLoading: boolean
}

export interface SkyboxSliceActions {
  setSkyboxEnabled: (enabled: boolean) => void
  setSkyboxTexture: (texture: SkyboxTexture) => void
  setSkyboxBlur: (blur: number) => void
  setSkyboxIntensity: (intensity: number) => void
  setSkyboxRotation: (rotation: number) => void
  setSkyboxAnimationMode: (mode: SkyboxAnimationMode) => void
  setSkyboxAnimationSpeed: (speed: number) => void
  setSkyboxHighQuality: (highQuality: boolean) => void
  setSkyboxLoading: (loading: boolean) => void
  resetSkyboxSettings: () => void
}

export type SkyboxSlice = SkyboxSliceState & SkyboxSliceActions

export const SKYBOX_INITIAL_STATE: SkyboxSliceState = {
  skyboxEnabled: DEFAULT_SKYBOX_ENABLED,
  skyboxTexture: DEFAULT_SKYBOX_TEXTURE,
  skyboxBlur: DEFAULT_SKYBOX_BLUR,
  skyboxIntensity: DEFAULT_SKYBOX_INTENSITY,
  skyboxRotation: DEFAULT_SKYBOX_ROTATION,
  skyboxAnimationMode: DEFAULT_SKYBOX_ANIMATION_MODE,
  skyboxAnimationSpeed: DEFAULT_SKYBOX_ANIMATION_SPEED,
  skyboxHighQuality: DEFAULT_SKYBOX_HIGH_QUALITY,
  skyboxLoading: false,
}

export const createSkyboxSlice: StateCreator<SkyboxSlice, [], [], SkyboxSlice> = (set) => ({
  ...SKYBOX_INITIAL_STATE,

  setSkyboxEnabled: (enabled: boolean) => set({ skyboxEnabled: enabled }),
  setSkyboxTexture: (texture: SkyboxTexture) => set({ skyboxTexture: texture }),
  setSkyboxBlur: (blur: number) => set({ skyboxBlur: Math.max(0, Math.min(1, blur)) }),
  setSkyboxIntensity: (intensity: number) =>
    set({ skyboxIntensity: Math.max(0, Math.min(10, intensity)) }),
  setSkyboxRotation: (rotation: number) => set({ skyboxRotation: rotation }),
  setSkyboxAnimationMode: (mode: SkyboxAnimationMode) => set({ skyboxAnimationMode: mode }),
  setSkyboxAnimationSpeed: (speed: number) =>
    set({ skyboxAnimationSpeed: Math.max(0, Math.min(5, speed)) }),
  setSkyboxHighQuality: (highQuality: boolean) => set({ skyboxHighQuality: highQuality }),
  setSkyboxLoading: (loading: boolean) => set({ skyboxLoading: loading }),
  resetSkyboxSettings: () =>
    set({
      skyboxBlur: DEFAULT_SKYBOX_BLUR,
      skyboxIntensity: DEFAULT_SKYBOX_INTENSITY,
      skyboxRotation: DEFAULT_SKYBOX_ROTATION,
      skyboxAnimationMode: DEFAULT_SKYBOX_ANIMATION_MODE,
      skyboxAnimationSpeed: DEFAULT_SKYBOX_ANIMATION_SPEED,
      skyboxHighQuality: DEFAULT_SKYBOX_HIGH_QUALITY,
    }),
})
