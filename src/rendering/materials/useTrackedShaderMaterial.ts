/**
 * Hook for creating tracked shader materials imperatively
 *
 * Provides the same deferred rendering and overlay tracking as TrackedShaderMaterial
 * but returns a ShaderMaterial instance for direct manipulation.
 *
 * The deferred rendering pattern:
 * 1. Show compilation overlay immediately
 * 2. Defer material creation by one frame (lets overlay paint)
 * 3. Create material (GPU blocks during first render)
 * 4. Hide overlay after GPU compilation completes (double RAF)
 *
 * Usage:
 * ```tsx
 * const { material, isCompiling } = useTrackedShaderMaterial(
 *   'Polytope PBR',
 *   () => new ShaderMaterial({ vertexShader, fragmentShader, uniforms }),
 *   [vertexShader, fragmentShader]
 * );
 *
 * // Render invisible placeholder while compiling
 * if (isCompiling) {
 *   return <mesh><meshBasicMaterial visible={false} /></mesh>;
 * }
 *
 * return <mesh material={material} />;
 * ```
 *
 * @module rendering/materials/useTrackedShaderMaterial
 */

import type React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ShaderMaterial } from 'three'
import {
  deferredExecute,
  trackShaderCompilation,
  waitForGPUCompile,
} from './shaderCompilationTracking'

/**
 * Result object from useTrackedShaderMaterial hook.
 */
export interface TrackedShaderMaterialResult<T extends ShaderMaterial> {
  /** The shader material instance, or null during initial creation */
  material: T | null
  /** True while shader is being compiled (overlay visible) */
  isCompiling: boolean
}

/**
 * Create a tracked shader material with deferred compilation.
 *
 * @param shaderName - Display name for shader compilation overlay
 * @param createMaterial - Factory function that creates the ShaderMaterial
 * @param deps - Dependency array (triggers recompilation when changed)
 * @returns Object with material instance and compilation state
 */
export function useTrackedShaderMaterial<T extends ShaderMaterial = ShaderMaterial>(
  shaderName: string,
  createMaterial: () => T,
  deps: React.DependencyList
): TrackedShaderMaterialResult<T> {
  const [material, setMaterial] = useState<T | null>(null)
  const [isCompiling, setIsCompiling] = useState(true)
  const stopTrackingRef = useRef<(() => void) | null>(null)
  const cancelRafRef = useRef<(() => void) | null>(null)
  const prevMaterialRef = useRef<T | null>(null)

  // Validate shader name
  const validShaderName = shaderName?.trim() || 'Unknown Shader'

  // Create a stable deps key for comparison
  const depsKey = JSON.stringify(deps)
  const prevDepsKeyRef = useRef<string | null>(null)

  // Detect if deps changed
  const depsChanged = prevDepsKeyRef.current !== depsKey

  // Step 1: Show overlay when deps change (useLayoutEffect runs before paint)
  useLayoutEffect(() => {
    if (depsChanged) {
      // Clean up previous tracking
      stopTrackingRef.current?.()
      cancelRafRef.current?.()

      // Mark as compiling (shows overlay)
      const stopTracking = trackShaderCompilation(validShaderName)
      stopTrackingRef.current = stopTracking
      setIsCompiling(true)

      // Update deps key
      prevDepsKeyRef.current = depsKey
    }
  }, [depsKey, depsChanged, validShaderName])

  // Step 2: Defer material creation to let overlay paint
  useEffect(() => {
    if (!depsChanged && material !== null) {
      // No change, keep current material
      return
    }

    // Defer material creation by one frame
    const cancelDefer = deferredExecute(() => {
      try {
        // Dispose previous material
        if (prevMaterialRef.current) {
          prevMaterialRef.current.dispose()
        }

        // Create the material (GPU will block during first render)
        const newMaterial = createMaterial()
        prevMaterialRef.current = newMaterial
        setMaterial(newMaterial)

        // Step 3: Wait for GPU compilation, then hide overlay
        // IMPORTANT: Call stopTrackingRef directly, don't rely on closure
        const cancelWait = waitForGPUCompile(() => {
          stopTrackingRef.current?.()
          stopTrackingRef.current = null
          setIsCompiling(false)
        })
        cancelRafRef.current = cancelWait
      } catch (error) {
        console.error(
          `[useTrackedShaderMaterial] Failed to create material for "${validShaderName}":`,
          error
        )
        stopTrackingRef.current?.()
        stopTrackingRef.current = null
        setIsCompiling(false)
      }
    })

    cancelRafRef.current = cancelDefer

    return () => {
      cancelRafRef.current?.()
    }
    // We intentionally use depsKey instead of spreading deps to avoid exhaustive-deps warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, validShaderName])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTrackingRef.current?.()
      cancelRafRef.current?.()

      // Dispose material
      if (prevMaterialRef.current) {
        prevMaterialRef.current.dispose()
        prevMaterialRef.current = null
      }
    }
  }, [])

  return { material, isCompiling }
}
