/**
 * Renderer Store
 *
 * Manages state related to the active renderer backend (WebGPU/WebGL).
 * Provides information about capabilities, backend type, and GPU info.
 *
 * @module stores/rendererStore
 */

import { create } from 'zustand'

/**
 * Renderer backend type.
 */
export type RendererBackendType = 'webgpu' | 'webgl' | 'unknown'

/**
 * Renderer store state.
 */
export interface RendererState {
  /** The active renderer backend */
  backend: RendererBackendType

  /** Whether WebGPU is available in this browser */
  isWebGPUAvailable: boolean

  /** Whether the renderer has been initialized */
  isInitialized: boolean

  /** GPU adapter name (if available) */
  gpuName: string | null

  /** Maximum texture size supported */
  maxTextureSize: number

  /** Whether WebGL fallback was forced via URL parameter */
  isWebGLForced: boolean

  /** Set the active backend */
  setBackend: (backend: RendererBackendType) => void

  /** Set whether WebGPU is available */
  setWebGPUAvailable: (available: boolean) => void

  /** Set renderer as initialized with all info */
  initialize: (info: {
    backend: RendererBackendType
    gpuName?: string | null
    maxTextureSize?: number
    isWebGLForced?: boolean
  }) => void

  /** Reset to initial state */
  reset: () => void
}

/**
 * Check if WebGL fallback is forced via URL parameter.
 */
function checkWebGLForced(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('forceWebGL') === 'true' || params.get('backend') === 'webgl'
}

/**
 * Check if WebGPU is available in the browser.
 */
function checkWebGPUAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return 'gpu' in navigator && navigator.gpu !== undefined
}

const initialState = {
  backend: 'unknown' as RendererBackendType,
  isWebGPUAvailable: checkWebGPUAvailable(),
  isInitialized: false,
  gpuName: null,
  maxTextureSize: 4096,
  isWebGLForced: checkWebGLForced(),
}

/**
 * Store for managing renderer backend state.
 *
 * @example
 * ```tsx
 * // In a component
 * const backend = useRendererStore((s) => s.backend);
 * const isWebGPU = backend === 'webgpu';
 *
 * // After renderer initialization
 * useRendererStore.getState().initialize({
 *   backend: 'webgpu',
 *   gpuName: 'Apple M1',
 *   maxTextureSize: 16384,
 * });
 * ```
 */
export const useRendererStore = create<RendererState>((set) => ({
  ...initialState,

  setBackend: (backend) => set({ backend }),

  setWebGPUAvailable: (available) => set({ isWebGPUAvailable: available }),

  initialize: (info) =>
    set({
      backend: info.backend,
      gpuName: info.gpuName ?? null,
      maxTextureSize: info.maxTextureSize ?? 4096,
      isWebGLForced: info.isWebGLForced ?? false,
      isInitialized: true,
    }),

  reset: () => set(initialState),
}))







