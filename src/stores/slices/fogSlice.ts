/**
 * Fog Slice
 *
 * State management for scene fog effect.
 * Supports both linear fog (near/far) and volumetric/exponential fog (density).
 */

import type { StateCreator } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type FogType = 'linear' | 'volumetric';

export interface FogSliceState {
  /** Whether fog is enabled */
  fogEnabled: boolean;
  /** Fog type: linear (near/far) or volumetric (exponential density) */
  fogType: FogType;
  /** Fog density for volumetric mode (0-0.1) */
  fogDensity: number;
  /** Fog start distance (linear mode) */
  fogNear: number;
  /** Fog end distance (linear mode) */
  fogFar: number;
  /** Fog color (hex string) */
  fogColor: string;
}

export interface FogSliceActions {
  setFogEnabled: (enabled: boolean) => void;
  setFogType: (type: FogType) => void;
  setFogDensity: (density: number) => void;
  setFogNear: (near: number) => void;
  setFogFar: (far: number) => void;
  setFogColor: (color: string) => void;
  resetFog: () => void;
}

export type FogSlice = FogSliceState & FogSliceActions;

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_FOG_STATE: FogSliceState = {
  fogEnabled: false,
  fogType: 'linear',
  fogDensity: 0.02,
  fogNear: 10,
  fogFar: 50,
  fogColor: '#000000',
};

// ============================================================================
// Slice Creator
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validates hex color string format (accepts #RGB, #RRGGBB, #RRGGBBAA)
 * @param color
 */
const isValidHexColor = (color: string): boolean =>
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);

export const createFogSlice: StateCreator<FogSlice, [], [], FogSlice> = (set, get) => ({
  ...DEFAULT_FOG_STATE,

  setFogEnabled: (enabled: boolean) => set({ fogEnabled: enabled }),

  setFogType: (type: FogType) => set({ fogType: type }),

  setFogDensity: (density: number) =>
    set({ fogDensity: clamp(density, 0, 0.15) }),

  setFogNear: (near: number) => {
    const clamped = clamp(near, 0, 100);
    const { fogFar } = get();
    // Ensure fogNear is always less than fogFar
    set({ fogNear: Math.min(clamped, fogFar - 1) });
  },

  setFogFar: (far: number) => {
    const clamped = clamp(far, 1, 200);
    const { fogNear } = get();
    // Ensure fogFar is always greater than fogNear
    set({ fogFar: Math.max(clamped, fogNear + 1) });
  },

  setFogColor: (color: string) => {
    if (isValidHexColor(color)) {
      set({ fogColor: color });
    }
  },

  resetFog: () => set({ ...DEFAULT_FOG_STATE }),
});
