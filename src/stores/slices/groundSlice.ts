/**
 * Ground slice for visual store
 *
 * Manages ground plane and environment surfaces:
 * - Active walls (floor, back, left, right, top)
 * - Ground plane appearance (offset, color, type, size)
 * - Ground grid settings
 * - IBL (environment reflections on objects)
 *
 * Note: Ground PBR material properties are managed by pbrStore (state.ground)
 */

import type { StateCreator } from 'zustand'
import {
  type GroundPlaneType,
  type IBLQuality,
  type WallPosition,
  DEFAULT_ACTIVE_WALLS,
  DEFAULT_GROUND_GRID_COLOR,
  DEFAULT_GROUND_GRID_SPACING,
  DEFAULT_GROUND_PLANE_COLOR,
  DEFAULT_GROUND_PLANE_OFFSET,
  DEFAULT_GROUND_PLANE_SIZE_SCALE,
  DEFAULT_GROUND_PLANE_TYPE,
  DEFAULT_IBL_INTENSITY,
  DEFAULT_IBL_QUALITY,
  DEFAULT_SHOW_GROUND_GRID,
} from '../defaults/visualDefaults'

/**
 * Validates hex color string format (accepts #RGB, #RRGGBB, #RRGGBBAA)
 * @param color - Color string to validate
 * @returns True if the color is a valid hex color
 */
const isValidHexColor = (color: string): boolean =>
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color)

// ============================================================================
// State Interface
// ============================================================================

export interface GroundSliceState {
  // --- Ground Plane ---
  activeWalls: WallPosition[]
  groundPlaneOffset: number
  groundPlaneColor: string
  groundPlaneType: GroundPlaneType
  groundPlaneSizeScale: number

  // --- Ground Grid ---
  showGroundGrid: boolean
  groundGridColor: string
  groundGridSpacing: number

  // --- IBL (Wall Reflections) ---
  iblQuality: IBLQuality
  iblIntensity: number
}

export interface GroundSliceActions {
  // --- Ground Plane Actions ---
  setActiveWalls: (walls: WallPosition[]) => void
  toggleWall: (wall: WallPosition) => void
  setGroundPlaneOffset: (offset: number) => void
  setGroundPlaneColor: (color: string) => void
  setGroundPlaneType: (type: GroundPlaneType) => void
  setGroundPlaneSizeScale: (scale: number) => void

  // --- Ground Grid Actions ---
  setShowGroundGrid: (show: boolean) => void
  setGroundGridColor: (color: string) => void
  setGroundGridSpacing: (spacing: number) => void

  // --- IBL Actions ---
  setIBLQuality: (quality: IBLQuality) => void
  setIBLIntensity: (intensity: number) => void
}

export type GroundSlice = GroundSliceState & GroundSliceActions

// ============================================================================
// Initial State
// ============================================================================

export const GROUND_INITIAL_STATE: GroundSliceState = {
  // Ground plane
  activeWalls: [...DEFAULT_ACTIVE_WALLS],
  groundPlaneOffset: DEFAULT_GROUND_PLANE_OFFSET,
  groundPlaneColor: DEFAULT_GROUND_PLANE_COLOR,
  groundPlaneType: DEFAULT_GROUND_PLANE_TYPE,
  groundPlaneSizeScale: DEFAULT_GROUND_PLANE_SIZE_SCALE,

  // Ground grid
  showGroundGrid: DEFAULT_SHOW_GROUND_GRID,
  groundGridColor: DEFAULT_GROUND_GRID_COLOR,
  groundGridSpacing: DEFAULT_GROUND_GRID_SPACING,

  // IBL
  iblQuality: DEFAULT_IBL_QUALITY,
  iblIntensity: DEFAULT_IBL_INTENSITY,
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

  setGroundPlaneColor: (color: string) => {
    if (isValidHexColor(color)) {
      set({ groundPlaneColor: color })
    }
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
    if (isValidHexColor(color)) {
      set({ groundGridColor: color })
    }
  },

  setGroundGridSpacing: (spacing: number) => {
    set({ groundGridSpacing: Math.max(0.5, Math.min(5, spacing)) })
  },

  // --- IBL Actions ---
  setIBLQuality: (quality: IBLQuality) => {
    set({ iblQuality: quality })
  },

  setIBLIntensity: (intensity: number) => {
    set({ iblIntensity: Math.max(0, Math.min(2, intensity)) })
  },
})
