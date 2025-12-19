/**
 * Fog Slice
 *
 * State management for physical volumetric fog effect.
 * Physical fog uses height-based density with 3D noise for realistic atmospheric effects.
 */

import type { StateCreator } from 'zustand'

// ============================================================================
// Types
// ============================================================================

export interface FogSliceState {
  /** Whether fog is enabled */
  fogEnabled: boolean
  /** Fog density (0-0.15) */
  fogDensity: number
  /** Fog color (hex string) */
  fogColor: string
  /** Maximum height of the base fog layer (World Space Y) */
  fogHeight: number
  /** Vertical decay rate (how quickly it fades up) */
  fogFalloff: number
  /** Scale of the 3D turbulence */
  fogNoiseScale: number
  /** Velocity of the wind drift vector */
  fogNoiseSpeed: [number, number, number]
  /** Anisotropy factor (g) for phase function (-1 to 1) */
  fogScattering: number
  /** Whether to enable volumetric shadows */
  volumetricShadows: boolean
}

export interface FogSliceActions {
  setFogEnabled: (enabled: boolean) => void
  setFogDensity: (density: number) => void
  setFogColor: (color: string) => void
  setFogHeight: (height: number) => void
  setFogFalloff: (falloff: number) => void
  setFogNoiseScale: (scale: number) => void
  setFogNoiseSpeed: (speed: [number, number, number]) => void
  setFogScattering: (g: number) => void
  setVolumetricShadows: (enabled: boolean) => void
  resetFog: () => void
}

export type FogSlice = FogSliceState & FogSliceActions

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_FOG_STATE: FogSliceState = {
  fogEnabled: false,
  fogDensity: 0.05,
  fogColor: '#e5e2e2',
  fogHeight: 15.0,
  fogFalloff: 0.08,
  fogNoiseScale: 0.15,
  fogNoiseSpeed: [0.02, 0.0, 0.02],
  fogScattering: 0.3,
  volumetricShadows: true,
}

// ============================================================================
// Slice Creator
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Validates hex color string format (accepts #RGB, #RRGGBB, #RRGGBBAA)
 * @param color - The color string to validate
 * @returns True if valid hex color format
 */
const isValidHexColor = (color: string): boolean =>
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color)

export const createFogSlice: StateCreator<FogSlice, [], [], FogSlice> = (set) => ({
  ...DEFAULT_FOG_STATE,

  setFogEnabled: (enabled: boolean) => set({ fogEnabled: enabled }),

  setFogDensity: (density: number) => set({ fogDensity: clamp(density, 0, 0.15) }),

  setFogColor: (color: string) => {
    if (isValidHexColor(color)) {
      set({ fogColor: color })
    }
  },

  setFogHeight: (height: number) => set({ fogHeight: Math.max(0, height) }),

  setFogFalloff: (falloff: number) => set({ fogFalloff: Math.max(0.001, falloff) }),

  setFogNoiseScale: (scale: number) => set({ fogNoiseScale: Math.max(0.001, scale) }),

  setFogNoiseSpeed: (speed: [number, number, number]) => set({ fogNoiseSpeed: speed }),

  setFogScattering: (g: number) => set({ fogScattering: clamp(g, -0.99, 0.99) }),

  setVolumetricShadows: (enabled: boolean) => set({ volumetricShadows: enabled }),

  resetFog: () => set({ ...DEFAULT_FOG_STATE }),
})
