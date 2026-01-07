/**
 * Hook for detecting and managing the active renderer backend.
 *
 * Provides information about whether WebGPU or WebGL is being used,
 * and allows forcing a specific backend via URL parameters.
 *
 * @module hooks/useRendererBackend
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * Renderer backend type.
 */
export type RendererBackend = 'webgpu' | 'webgl' | 'unknown'

/**
 * Renderer backend information.
 */
export interface RendererBackendInfo {
  /** The active renderer backend */
  backend: RendererBackend
  /** Whether WebGPU is available in this browser */
  isWebGPUAvailable: boolean
  /** Whether WebGPU is forced off via URL parameter */
  isWebGPUForced: boolean
  /** GPU adapter name (if available) */
  gpuName?: string
  /** Maximum texture size supported */
  maxTextureSize?: number
}

/**
 * Check if WebGPU is available in the current browser.
 * This is a synchronous check for the API presence, not adapter availability.
 */
export function checkWebGPUAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return 'gpu' in navigator && navigator.gpu !== undefined
}

/**
 * Check if WebGL fallback is forced via URL parameter.
 * Supports both `?forceWebGL=true` and `?backend=webgl`.
 */
export function isWebGLForced(): boolean {
  if (typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)

  // Check for explicit forceWebGL parameter
  if (params.get('forceWebGL') === 'true') return true

  // Check for backend=webgl parameter
  if (params.get('backend') === 'webgl') return true

  return false
}

/**
 * Check if WebGPU is forced via URL parameter.
 * Supports `?backend=webgpu`.
 */
export function isWebGPUForced(): boolean {
  if (typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)
  return params.get('backend') === 'webgpu'
}

/**
 * Determine which backend should be used based on availability and URL parameters.
 */
export function determineBackend(): 'webgpu' | 'webgl' {
  // If WebGL is forced, use WebGL
  if (isWebGLForced()) return 'webgl'

  // If WebGPU is available, use it
  if (checkWebGPUAvailable()) return 'webgpu'

  // Default to WebGL
  return 'webgl'
}

/**
 * Hook to get renderer backend information.
 *
 * @returns Renderer backend information and state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { backend, isWebGPUAvailable } = useRendererBackend();
 *
 *   return (
 *     <div>
 *       Active backend: {backend}
 *       {isWebGPUAvailable && <span>WebGPU available!</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRendererBackend(): RendererBackendInfo {
  const [info, setInfo] = useState<RendererBackendInfo>(() => ({
    backend: 'unknown',
    isWebGPUAvailable: false,
    isWebGPUForced: false,
  }))

  useEffect(() => {
    const checkBackend = async () => {
      const isAvailable = checkWebGPUAvailable()
      const forced = isWebGPUForced()
      let backend: RendererBackend = 'unknown'
      let gpuName: string | undefined

      if (isWebGLForced()) {
        backend = 'webgl'
      } else if (isAvailable) {
        // Try to verify WebGPU adapter is available
        try {
          const adapter = await navigator.gpu?.requestAdapter()
          if (adapter) {
            backend = 'webgpu'
            // Note: adapter.info is the modern API for getting adapter info
            // but it may not be available in all browsers
            gpuName = (adapter as { info?: { device?: string } }).info?.device
          } else {
            backend = 'webgl'
          }
        } catch {
          backend = 'webgl'
        }
      } else {
        backend = 'webgl'
      }

      setInfo({
        backend,
        isWebGPUAvailable: isAvailable,
        isWebGPUForced: forced,
        gpuName,
      })
    }

    checkBackend()
  }, [])

  return info
}

/**
 * Get renderer backend information from an active renderer.
 * Use this inside R3F's useThree() context.
 *
 * @param renderer - The active Three.js renderer
 * @returns Backend information
 */
export function getRendererBackendInfo(
  renderer: {
    backend?: { isWebGPU?: boolean; parameters?: { adapterInfo?: GPUAdapterInfo } }
    capabilities?: { maxTextureSize?: number }
  } | null
): RendererBackendInfo {
  if (!renderer) {
    return {
      backend: 'unknown',
      isWebGPUAvailable: checkWebGPUAvailable(),
      isWebGPUForced: isWebGPUForced(),
    }
  }

  // Three.js WebGPU backend shape varies by build/version:
  // - `backend.isWebGPUBackend` (some r181+ builds)
  // - `backend.isWebGPU` (used elsewhere in this codebase + tests)
  const backend = renderer.backend as { isWebGPUBackend?: boolean; isWebGPU?: boolean } | undefined
  const isWebGPU = backend?.isWebGPUBackend ?? backend?.isWebGPU ?? false

  return {
    backend: isWebGPU ? 'webgpu' : 'webgl',
    isWebGPUAvailable: checkWebGPUAvailable(),
    isWebGPUForced: isWebGPUForced(),
    gpuName: renderer.backend?.parameters?.adapterInfo?.description,
    maxTextureSize: renderer.capabilities?.maxTextureSize,
  }
}

/**
 * Hook to get renderer backend info from the active R3F renderer.
 * Must be used inside a Canvas component.
 */
export function useActiveRendererBackend(): RendererBackendInfo {
  const [info, setInfo] = useState<RendererBackendInfo>({
    backend: 'unknown',
    isWebGPUAvailable: checkWebGPUAvailable(),
    isWebGPUForced: isWebGPUForced(),
  })

  // This will be updated when the renderer is available
  const updateFromRenderer = useCallback(
    (
      renderer: {
        backend?: { isWebGPU?: boolean; parameters?: { adapterInfo?: GPUAdapterInfo } }
        capabilities?: { maxTextureSize?: number }
      } | null
    ) => {
      setInfo(getRendererBackendInfo(renderer))
    },
    []
  )

  return { ...info, updateFromRenderer } as RendererBackendInfo & {
    updateFromRenderer: typeof updateFromRenderer
  }
}






