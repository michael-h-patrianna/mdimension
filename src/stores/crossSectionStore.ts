/**
 * Cross-Section state management using Zustand
 * Manages the cross-section slicing visualization
 */

import { create } from 'zustand';

/** Minimum slice position */
export const MIN_SLICE_W = -2.0;

/** Maximum slice position */
export const MAX_SLICE_W = 2.0;

/** Default slice position */
export const DEFAULT_SLICE_W = 0;

interface CrossSectionState {
  /** Whether cross-section mode is enabled */
  enabled: boolean;

  /** W coordinate of the slicing hyperplane */
  sliceW: number;

  /** Whether to show the original polytope alongside the cross-section */
  showOriginal: boolean;

  /** Opacity of the original polytope when shown (0-1) */
  originalOpacity: number;

  /** Whether to animate the slice position */
  animateSlice: boolean;

  /** Animation speed for slice animation */
  sliceAnimationSpeed: number;

  // Actions
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
  setSliceW: (w: number) => void;
  setShowOriginal: (show: boolean) => void;
  setOriginalOpacity: (opacity: number) => void;
  setAnimateSlice: (animate: boolean) => void;
  setSliceAnimationSpeed: (speed: number) => void;
  reset: () => void;
}

/**
 * Clamps slice W to valid range
 * @param w
 */
function clampSliceW(w: number): number {
  return Math.max(MIN_SLICE_W, Math.min(MAX_SLICE_W, w));
}

export const useCrossSectionStore = create<CrossSectionState>((set) => ({
  enabled: false,
  sliceW: DEFAULT_SLICE_W,
  showOriginal: true,
  originalOpacity: 0.3,
  animateSlice: false,
  sliceAnimationSpeed: 1.0,

  setEnabled: (enabled: boolean) => {
    set({ enabled });
  },

  toggle: () => {
    set((state) => ({ enabled: !state.enabled }));
  },

  setSliceW: (w: number) => {
    set({ sliceW: clampSliceW(w) });
  },

  setShowOriginal: (show: boolean) => {
    set({ showOriginal: show });
  },

  setOriginalOpacity: (opacity: number) => {
    set({ originalOpacity: Math.max(0, Math.min(1, opacity)) });
  },

  setAnimateSlice: (animate: boolean) => {
    set({ animateSlice: animate });
  },

  setSliceAnimationSpeed: (speed: number) => {
    set({ sliceAnimationSpeed: Math.max(0.1, Math.min(5.0, speed)) });
  },

  reset: () => {
    set({
      enabled: false,
      sliceW: DEFAULT_SLICE_W,
      showOriginal: true,
      originalOpacity: 0.3,
      animateSlice: false,
      sliceAnimationSpeed: 1.0,
    });
  },
}));
