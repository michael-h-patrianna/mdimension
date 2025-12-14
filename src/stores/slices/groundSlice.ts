/**
 * Ground slice for visual store
 *
 * Manages ground plane and environment surfaces:
 * - Active walls (floor, back, left, right, top)
 * - Ground plane appearance (offset, opacity, reflectivity, color)
 * - Ground grid settings
 * - Ground material PBR properties
 */

import type { StateCreator } from 'zustand'
import {
  type GroundPlaneType,
  type WallPosition,
  DEFAULT_ACTIVE_WALLS,
  DEFAULT_GROUND_GRID_COLOR,
  DEFAULT_GROUND_GRID_SPACING,
  DEFAULT_GROUND_MATERIAL_ENVMAP_INTENSITY,
  DEFAULT_GROUND_MATERIAL_METALNESS,
  DEFAULT_GROUND_MATERIAL_ROUGHNESS,
  DEFAULT_GROUND_PLANE_COLOR,
  DEFAULT_GROUND_PLANE_OFFSET,
  DEFAULT_GROUND_PLANE_OPACITY,
  DEFAULT_GROUND_PLANE_REFLECTIVITY,
  DEFAULT_GROUND_PLANE_SIZE_SCALE,
  DEFAULT_GROUND_PLANE_TYPE,
  DEFAULT_SHOW_GROUND_GRID,
} from '../defaults/visualDefaults'

// ============================================================================
// State Interface
// ============================================================================

export interface GroundSliceState {
  // --- Ground Plane ---
  activeWalls: WallPosition[]
  groundPlaneOffset: number
  groundPlaneOpacity: number
  groundPlaneReflectivity: number
  groundPlaneColor: string
  groundPlaneType: GroundPlaneType
  groundPlaneSizeScale: number

  // --- Ground Grid ---
  showGroundGrid: boolean
  groundGridColor: string
  groundGridSpacing: number

  // --- Ground Material ---
  groundMaterialRoughness: number
  groundMaterialMetalness: number
  groundMaterialEnvMapIntensity: number
}

export interface GroundSliceActions {
  // --- Ground Plane Actions ---
  setActiveWalls: (walls: WallPosition[]) => void
  toggleWall: (wall: WallPosition) => void
  setGroundPlaneOffset: (offset: number) => void
  setGroundPlaneOpacity: (opacity: number) => void
  setGroundPlaneReflectivity: (reflectivity: number) => void
  setGroundPlaneColor: (color: string) => void
  setGroundPlaneType: (type: GroundPlaneType) => void
  setGroundPlaneSizeScale: (scale: number) => void

  // --- Ground Grid Actions ---
  setShowGroundGrid: (show: boolean) => void
  setGroundGridColor: (color: string) => void
  setGroundGridSpacing: (spacing: number) => void

  // --- Ground Material Actions ---
  setGroundMaterialRoughness: (roughness: number) => void
  setGroundMaterialMetalness: (metalness: number) => void
  setGroundMaterialEnvMapIntensity: (intensity: number) => void
}

export type GroundSlice = GroundSliceState & GroundSliceActions

// ============================================================================
// Initial State
// ============================================================================

export const GROUND_INITIAL_STATE: GroundSliceState = {
  // Ground plane
  activeWalls: [...DEFAULT_ACTIVE_WALLS],
  groundPlaneOffset: DEFAULT_GROUND_PLANE_OFFSET,
  groundPlaneOpacity: DEFAULT_GROUND_PLANE_OPACITY,
  groundPlaneReflectivity: DEFAULT_GROUND_PLANE_REFLECTIVITY,
  groundPlaneColor: DEFAULT_GROUND_PLANE_COLOR,
  groundPlaneType: DEFAULT_GROUND_PLANE_TYPE,
  groundPlaneSizeScale: DEFAULT_GROUND_PLANE_SIZE_SCALE,

  // Ground grid
  showGroundGrid: DEFAULT_SHOW_GROUND_GRID,
  groundGridColor: DEFAULT_GROUND_GRID_COLOR,
  groundGridSpacing: DEFAULT_GROUND_GRID_SPACING,

  // Ground material
  groundMaterialRoughness: DEFAULT_GROUND_MATERIAL_ROUGHNESS,
  groundMaterialMetalness: DEFAULT_GROUND_MATERIAL_METALNESS,
  groundMaterialEnvMapIntensity: DEFAULT_GROUND_MATERIAL_ENVMAP_INTENSITY,
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createGroundSlice: StateCreator<GroundSlice, [], [], GroundSlice> = (set) => ({
  ...GROUND_INITIAL_STATE,

  // --- Ground Plane Actions ---
  setActiveWalls: (walls: WallPosition[]) => {
    set({ activeWalls: [...walls] })
  },

  toggleWall: (wall: WallPosition) => {
    set((state) => {
      const isActive = state.activeWalls.includes(wall)
      if (isActive) {
        return { activeWalls: state.activeWalls.filter((w) => w !== wall) }
      } else {
        return { activeWalls: [...state.activeWalls, wall] }
      }
    })
  },

  setGroundPlaneOffset: (offset: number) => {
    set({ groundPlaneOffset: Math.max(0, Math.min(10, offset)) })
  },

  setGroundPlaneOpacity: (opacity: number) => {
    set({ groundPlaneOpacity: Math.max(0, Math.min(1, opacity)) })
  },

  setGroundPlaneReflectivity: (reflectivity: number) => {
    set({ groundPlaneReflectivity: Math.max(0, Math.min(1, reflectivity)) })
  },

  setGroundPlaneColor: (color: string) => {
    set({ groundPlaneColor: color })
  },

  setGroundPlaneType: (type: GroundPlaneType) => {
    set({ groundPlaneType: type })
  },

  setGroundPlaneSizeScale: (scale: number) => {
    set({ groundPlaneSizeScale: Math.max(1, Math.min(10, scale)) })
  },

  // --- Ground Grid Actions ---
  setShowGroundGrid: (show: boolean) => {
    set({ showGroundGrid: show })
  },

  setGroundGridColor: (color: string) => {
    set({ groundGridColor: color })
  },

  setGroundGridSpacing: (spacing: number) => {
    set({ groundGridSpacing: Math.max(0.5, Math.min(5, spacing)) })
  },

  // --- Ground Material Actions ---
  setGroundMaterialRoughness: (roughness: number) => {
    set({ groundMaterialRoughness: Math.max(0, Math.min(1, roughness)) })
  },

  setGroundMaterialMetalness: (metalness: number) => {
    set({ groundMaterialMetalness: Math.max(0, Math.min(1, metalness)) })
  },

  setGroundMaterialEnvMapIntensity: (intensity: number) => {
    set({ groundMaterialEnvMapIntensity: Math.max(0, Math.min(1, intensity)) })
  },
})
