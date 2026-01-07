/**
 * TSL Utility Modules
 *
 * Performance optimization utilities for TSL materials.
 *
 * @module rendering/tsl/utils
 */

// Version tracking for dirty-flag optimization
export {
  checkVersionChanges,
  createVersionTracking,
  createVersionTracker,
} from './version-tracking'

export type { VersionTracking } from './version-tracking'

// Color caching
export {
  ColorCache,
  getColorCache,
  hexToLinearColor,
  hexToLinearRGB,
} from './color-cache'

// Store subscription refs
export {
  createStoreRef,
  createStoreRefs,
  useStoreRefSetup,
} from './store-refs'

export type { StoreSubscription } from './store-refs'

// Shader debug info
export {
  createShaderDebugInfo,
  getShaderDebugRegistry,
  logShaderDebugInfo,
} from './shader-debug'

export type { ShaderDebugInfo } from './shader-debug'

// Safe math utilities (GPU-safe operations that handle edge cases)
export {
  safeNormalize3,
  safeNormalizeUp,
  safeNormalizeNoFallback,
  safeDiv,
  safeDivSigned,
  safeSqrt,
  safeInverseSqrt,
  safeLength,
} from './safe-math'
