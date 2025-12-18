/**
 * WebGL Context Store
 *
 * Manages WebGL context lifecycle including:
 * - Context loss/restoration detection
 * - Page visibility tracking
 * - Recovery state management
 * - State persistence before reload
 */

import { create } from 'zustand'
import { createWebGLContextSlice, WebGLContextSlice } from './slices/webglContextSlice'

export const useWebGLContextStore = create<WebGLContextSlice>((...a) => ({
  ...createWebGLContextSlice(...a),
}))

// Re-export types for convenience
export type {
  WebGLContextSlice,
  WebGLContextSliceState,
  WebGLContextSliceActions,
  WebGLContextStatus,
  RecoveryConfig,
} from './slices/webglContextSlice'

export {
  RECOVERY_STATE_KEY,
  RECOVERY_STATE_MAX_AGE,
  DEFAULT_RECOVERY_CONFIG,
} from './slices/webglContextSlice'
