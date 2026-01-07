/**
 * Renderer Utilities
 *
 * Provides abstractions for working with both WebGLRenderer and WebGPURenderer.
 * These utilities allow code to safely access renderer-specific features without
 * crashing when the "wrong" renderer type is used.
 *
 * @module rendering/core/rendererUtils
 */

import * as THREE from 'three'
import type { WebGPURenderer } from 'three/webgpu'

/**
 * Union type for supported renderers.
 * WebGPURenderer has a different API than WebGLRenderer.
 */
export type SupportedRenderer = THREE.WebGLRenderer | WebGPURenderer

/**
 * Check if the renderer is a WebGLRenderer.
 *
 * Uses multiple checks to distinguish between WebGLRenderer and WebGPURenderer:
 * 1. Positive check: WebGLRenderer has getContext() that returns WebGL context
 * 2. Negative check: WebGPURenderer has backend property (even in fallback mode)
 *
 * @param renderer - The renderer to check
 * @returns True if the renderer is a WebGLRenderer (not a WebGPURenderer in fallback mode)
 */
export function isWebGLRenderer(renderer: SupportedRenderer): renderer is THREE.WebGLRenderer {
  if (renderer === null || typeof renderer !== 'object') {
    return false
  }

  // WebGPURenderer has a 'backend' property - if present, it's NOT a pure WebGLRenderer
  // This catches WebGPURenderer even when it falls back to WebGL internally
  if ('backend' in renderer && (renderer as WebGPURenderer).backend !== undefined) {
    return false
  }

  // Check for WebGLRenderer-specific method
  return 'getContext' in renderer && typeof (renderer as THREE.WebGLRenderer).getContext === 'function'
}

/**
 * Check if the renderer is using WebGPU backend.
 *
 * Uses multiple detection methods:
 * 1. Check backend.isWebGPU property (if exists)
 * 2. Check backend constructor name (WebGPUBackend vs WebGLBackend)
 * 3. Check for WebGPU-specific parameters on the backend
 *
 * @param renderer - The renderer to check
 * @returns True if the renderer is using WebGPU backend
 */
export function isWebGPUBackend(renderer: SupportedRenderer): boolean {
  const gpuRenderer = renderer as WebGPURenderer

  // Debug logging disabled - was causing performance issues when called frequently
  // if (import.meta.env.DEV) {
  //   const backend = gpuRenderer.backend as unknown as Record<string, unknown> | undefined
  //   console.log('[isWebGPUBackend] Checking renderer:', {...})
  // }

  // Method 1: Direct isWebGPUBackend property (Three.js r181+)
  if ((gpuRenderer.backend as { isWebGPUBackend?: boolean })?.isWebGPUBackend === true) {
    return true
  }

  // Method 1b: Legacy isWebGPU property (older versions)
  if (gpuRenderer.backend?.isWebGPU === true) {
    return true
  }

  // Method 2: Check constructor name
  const backendConstructor = gpuRenderer.backend?.constructor?.name
  if (backendConstructor === 'WebGPUBackend') {
    return true
  }
  if (backendConstructor === 'WebGLBackend') {
    return false
  }

  // Method 3: Check for WebGPU-specific properties on backend
  // WebGPUBackend has 'device' property (GPUDevice), WebGLBackend has 'gl' property
  const backend = gpuRenderer.backend as { device?: unknown; gl?: unknown } | undefined
  if (backend?.device !== undefined) {
    return true
  }

  // Default to false if we can't determine
  return false
}

/**
 * Safely get the WebGL2 context from a renderer.
 *
 * Returns null if the renderer is not a WebGLRenderer or if the context
 * is not a valid WebGL2 context (e.g., if it's a WebGPURenderer in fallback mode).
 *
 * @param renderer - The renderer to get context from
 * @returns The WebGL2 context or null if not available
 */
export function getWebGLContext(renderer: SupportedRenderer): WebGL2RenderingContext | null {
  if (isWebGLRenderer(renderer)) {
    try {
      const context = renderer.getContext()
      // Verify it's actually a WebGL2 context by checking for a WebGL2-specific method
      // Cast to WebGL2RenderingContext first since getContext() may return WebGLRenderingContext
      const gl2Context = context as WebGL2RenderingContext | null
      if (gl2Context && typeof gl2Context.drawBuffers === 'function') {
        return gl2Context
      }
      return null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Check if the WebGL context is lost.
 *
 * Returns false for WebGPU (context loss is handled differently).
 *
 * @param renderer - The renderer to check
 * @returns True if WebGL context is lost, false otherwise
 */
export function isContextLost(renderer: SupportedRenderer): boolean {
  const context = getWebGLContext(renderer)
  if (context) {
    try {
      return context.isContextLost()
    } catch {
      return false
    }
  }
  // WebGPU handles context loss differently
  return false
}

/**
 * Get a WebGL extension safely.
 *
 * Returns null if the renderer is not a WebGLRenderer or extension is unavailable.
 *
 * @param renderer - The renderer to get extension from
 * @param name - Name of the extension
 * @returns The extension or null if not available
 */
export function getWebGLExtension<T>(
  renderer: SupportedRenderer,
  name: string
): T | null {
  const context = getWebGLContext(renderer)
  if (context) {
    try {
      return context.getExtension(name) as T | null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Get GPU name from renderer.
 *
 * Works with both WebGL (via debug extension) and WebGPU (via adapter info).
 *
 * @param renderer - The renderer to get GPU name from
 * @returns The GPU name or null if not available
 */
export function getGPUName(renderer: SupportedRenderer): string | null {
  // Try WebGPU first
  const gpuRenderer = renderer as WebGPURenderer
  if (gpuRenderer.backend?.parameters?.adapterInfo?.description) {
    return gpuRenderer.backend.parameters.adapterInfo.description
  }

  // Fall back to WebGL debug info
  const context = getWebGLContext(renderer)
  if (context) {
    try {
      const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const rendererName = context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
        // Clean up strings like "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)"
        const cleanName = rendererName.replace(/angle\s*\((.+)\)/i, '$1').split(',')[1]?.trim() || rendererName
        return cleanName
      }
    } catch {
      // Extension not available
    }
  }

  return null
}

/**
 * Get the current backend type.
 *
 * @param renderer - The renderer to check
 * @returns 'webgpu' or 'webgl'
 */
export function getBackendType(renderer: SupportedRenderer): 'webgpu' | 'webgl' {
  return isWebGPUBackend(renderer) ? 'webgpu' : 'webgl'
}

/**
 * Check if the renderer is a WebGPURenderer (supports TSL node materials).
 *
 * This is different from isWebGPUBackend which checks if the actual GPU backend is WebGPU.
 * A WebGPURenderer supports TSL materials even when it falls back to WebGL internally.
 *
 * Use this to decide whether to use TSL-based components vs GLSL ShaderMaterial components.
 *
 * @param renderer - The renderer to check
 * @returns True if the renderer is a WebGPURenderer (supports TSL)
 */
export function isWebGPURenderer(renderer: SupportedRenderer): boolean {
  // WebGPURenderer has a 'backend' property - this is the distinguishing feature
  // that separates it from THREE.WebGLRenderer
  if ('backend' in renderer && (renderer as WebGPURenderer).backend !== undefined) {
    return true
  }
  return false
}

