/**
 * Layout state management using Zustand
 *
 * Manages sidebar layout and sizing for responsive behavior:
 * - Sidebar width with min/max constraints
 * - Collapsed state
 * - Layout mode (overlay vs side-by-side)
 *
 * Constraints:
 * - Canvas must never shrink below MIN_CANVAS_WIDTH (300px)
 * - Sidebar width is dynamically clamped based on viewport
 * - User preferences persisted to localStorage
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// Constants
// ============================================================================

/** Minimum canvas width in pixels - canvas cannot shrink below this */
export const MIN_CANVAS_WIDTH = 300

/** Minimum sidebar width in pixels */
export const MIN_SIDEBAR_WIDTH = 280

/** Default sidebar width in pixels */
export const DEFAULT_SIDEBAR_WIDTH = 320

/** Maximum sidebar width in pixels (absolute max, further constrained by viewport) */
export const MAX_SIDEBAR_WIDTH = 480

/** Breakpoint for side-by-side layout (matches Tailwind 'lg') */
export const SIDE_BY_SIDE_BREAKPOINT = 1024

// ============================================================================
// Types
// ============================================================================

export type LayoutMode = 'overlay' | 'side-by-side'

export interface LayoutState {
  /** Current sidebar width in pixels */
  sidebarWidth: number
  /** Whether sidebar is collapsed */
  isCollapsed: boolean
}

export interface LayoutActions {
  /**
   * Set sidebar width with clamping.
   * Max width is dynamically calculated to ensure canvas stays >= MIN_CANVAS_WIDTH.
   * @param width - Desired width in pixels
   * @param viewportWidth - Current viewport width for max calculation
   */
  setSidebarWidth: (width: number, viewportWidth: number) => void

  /** Toggle sidebar collapsed state */
  toggleCollapsed: () => void

  /** Set collapsed state explicitly */
  setCollapsed: (collapsed: boolean) => void

  /** Reset to default values */
  reset: () => void
}

export type LayoutStore = LayoutState & LayoutActions

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the maximum allowed sidebar width for a given viewport.
 * Ensures canvas never shrinks below MIN_CANVAS_WIDTH.
 * @param viewportWidth - Current viewport width
 * @returns Maximum sidebar width in pixels
 */
export function getMaxSidebarWidth(viewportWidth: number): number {
  // Account for some padding (the sidebar has right-4 = 16px margin in side-by-side mode)
  const maxForCanvas = viewportWidth - MIN_CANVAS_WIDTH - 16
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, maxForCanvas))
}

/**
 * Clamp sidebar width between min and dynamic max.
 * @param width - Desired width
 * @param viewportWidth - Current viewport width
 * @returns Clamped width
 */
export function clampSidebarWidth(width: number, viewportWidth: number): number {
  const max = getMaxSidebarWidth(viewportWidth)
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(max, width))
}

/**
 * Determine layout mode based on viewport width.
 * @param viewportWidth - Current viewport width
 * @returns Layout mode
 */
export function getLayoutMode(viewportWidth: number): LayoutMode {
  return viewportWidth >= SIDE_BY_SIDE_BREAKPOINT ? 'side-by-side' : 'overlay'
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: LayoutState = {
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  isCollapsed: false,
}

// ============================================================================
// Store
// ============================================================================

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setSidebarWidth: (width: number, viewportWidth: number) => {
        const clampedWidth = clampSidebarWidth(width, viewportWidth)
        set({ sidebarWidth: clampedWidth })
      },

      toggleCollapsed: () => {
        set((state) => ({ isCollapsed: !state.isCollapsed }))
      },

      setCollapsed: (collapsed: boolean) => {
        set({ isCollapsed: collapsed })
      },

      reset: () => {
        set(INITIAL_STATE)
      },
    }),
    {
      name: 'mdimension-layout',
      // Only persist these fields
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        isCollapsed: state.isCollapsed,
      }),
    }
  )
)
