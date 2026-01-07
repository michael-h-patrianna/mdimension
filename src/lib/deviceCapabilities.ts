/**
 * Unified Device Capability Detection
 *
 * Single source of truth for all device capability detection:
 * - WebGL2 support (required for app to run)
 * - GPU tier classification (for performance scaling)
 * - Mobile device detection (for default settings)
 *
 * Uses detect-gpu library for GPU benchmarking:
 * @see https://github.com/pmndrs/detect-gpu
 */

import { getGPUTier, type TierResult } from 'detect-gpu'

// ============================================================================
// Types
// ============================================================================

/** GPU performance tier (0-3) */
export type GPUTier = 0 | 1 | 2 | 3

/** Complete device capability information */
export interface DeviceCapabilities {
  /** Whether WebGL2 is supported (required for app) */
  webgl2Supported: boolean

  /** GPU performance tier (0=fallback, 1=low, 2=medium, 3=high) */
  gpuTier: GPUTier

  /** Whether device has a mobile GPU */
  isMobileGPU: boolean

  /** GPU name/identifier (for debugging) */
  gpuName: string

  /** Detection method used by detect-gpu */
  detectionType: string

  /** Estimated FPS capability */
  estimatedFps: number | undefined
}

/** Default capabilities (conservative until detection completes) */
export const DEFAULT_CAPABILITIES: DeviceCapabilities = {
  webgl2Supported: false,
  gpuTier: 3, // Assume best until proven otherwise
  isMobileGPU: false,
  gpuName: 'unknown',
  detectionType: 'pending',
  estimatedFps: undefined,
}

// ============================================================================
// WebGL2 Detection
// ============================================================================

/**
 * Check if the browser supports WebGL2.
 *
 * WebGL2 is required for:
 * - GLSL ES 3.00 shaders
 * - Multiple Render Targets (MRT)
 * - GPU timer queries
 * - Advanced texture formats
 *
 * @returns True if WebGL2 is supported
 */
export function isWebGL2Supported(): boolean {
  try {
    // FAST PATH: If WebGPU API is available, WebGL2 is definitely supported
    // All browsers with WebGPU support also support WebGL2
    // This avoids creating a test context which can fail due to context exhaustion
    // IMPORTANT: In tests we often stub `navigator.gpu = {}` (without requestAdapter),
    // so require a real-looking WebGPU shape to avoid bypassing the WebGL2 probe.
    if (
      typeof navigator !== 'undefined' &&
      'gpu' in navigator &&
      typeof (navigator as unknown as { gpu?: { requestAdapter?: unknown } }).gpu?.requestAdapter ===
        'function'
    ) {
      console.log('[isWebGL2Supported] WebGPU API available, assuming WebGL2 supported')
      return true
    }

    // FALLBACK: Create test context for browsers without WebGPU
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    const supported = gl !== null

    console.log('[isWebGL2Supported] canvas created:', !!canvas, 'gl context:', !!gl, 'supported:', supported)

    // CRITICAL: Clean up the context to prevent context exhaustion
    if (gl && typeof (gl as unknown as { getExtension?: unknown }).getExtension === 'function') {
      const ext = (gl as WebGL2RenderingContext).getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()
    }
    // Remove canvas from memory
    canvas.width = 0
    canvas.height = 0

    return supported
  } catch (e) {
    console.error('[isWebGL2Supported] Exception:', e)
    return false
  }
}

// ============================================================================
// GPU Tier Detection
// ============================================================================

/**
 * Detect GPU capabilities using detect-gpu library.
 *
 * This is an async operation that queries a benchmark database
 * to classify the GPU into performance tiers.
 *
 * Tier meanings:
 * - 0: No WebGL, blocklisted, or <15 FPS (show fallback)
 * - 1: >= 15 FPS (basic graphics)
 * - 2: >= 30 FPS (intermediate)
 * - 3: >= 60 FPS (full quality)
 *
 * @returns Promise resolving to TierResult from detect-gpu
 */
export async function detectGPUTier(): Promise<TierResult> {
  return getGPUTier({
    // Use default benchmarks from CDN
    // Can be overridden to self-host benchmark data
    failIfMajorPerformanceCaveat: false,
  })
}

// ============================================================================
// Unified Detection
// ============================================================================

/**
 * Detect all device capabilities.
 *
 * Combines WebGL2 check with GPU tier detection into a single
 * unified result. Should be called once at app startup.
 *
 * @returns Promise resolving to complete DeviceCapabilities
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  // 1. Check WebGL2 support first (synchronous, fast)
  const webgl2Supported = isWebGL2Supported()

  // 2. If no WebGL2, return early with tier 0
  if (!webgl2Supported) {
    return {
      webgl2Supported: false,
      gpuTier: 0,
      isMobileGPU: false,
      gpuName: 'unsupported',
      detectionType: 'webgl2-missing',
      estimatedFps: undefined,
    }
  }

  // 3. Run GPU tier detection (async, queries benchmark DB)
  try {
    const tierResult = await detectGPUTier()

    return {
      webgl2Supported: true,
      gpuTier: tierResult.tier as GPUTier,
      isMobileGPU: tierResult.isMobile ?? false,
      gpuName: tierResult.gpu ?? 'unknown',
      detectionType: tierResult.type,
      estimatedFps: tierResult.fps,
    }
  } catch (error) {
    // Detection failed - assume desktop tier 3 for best experience
    if (import.meta.env.DEV) {
      console.warn('[DeviceCapabilities] GPU detection failed:', error)
    }

    return {
      webgl2Supported: true,
      gpuTier: 3,
      isMobileGPU: false,
      gpuName: 'detection-failed',
      detectionType: 'error',
      estimatedFps: undefined,
    }
  }
}

// ============================================================================
// Mobile Defaults
// ============================================================================

/** Default render resolution scale for mobile devices */
export const MOBILE_DEFAULT_RESOLUTION_SCALE = 0.5

/** Default render resolution scale for desktop devices */
export const DESKTOP_DEFAULT_RESOLUTION_SCALE = 0.75

/** Default max FPS for mobile devices */
export const MOBILE_DEFAULT_MAX_FPS = 30
