/**
 * Hook to generate geometry based on current store state.
 *
 * Uses Web Worker for Wythoff polytopes to prevent UI blocking.
 * Falls back to synchronous generation for other object types.
 */

import type { ExtendedObjectParams, NdGeometry } from '@/lib/geometry'
import { generateGeometry } from '@/lib/geometry'
import { generateWythoffPolytopeWithWarnings } from '@/lib/geometry/wythoff'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useToast } from '@/hooks/useToast'
import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { useGeometryWorker, generateRequestId } from './useGeometryWorker'
import { inflateGeometry } from '@/lib/geometry/transfer'
import type { GenerationStage } from '@/workers/types'
import type { WythoffPolytopeConfig } from '@/lib/geometry/wythoff/types'

/**
 * Return type for useGeometryGenerator hook
 */
export interface GeometryGeneratorResult {
  /** Generated geometry (null while loading for async types) */
  geometry: NdGeometry | null
  /** Dimension of the geometry */
  dimension: number
  /** Object type being generated */
  objectType: string
  /** Whether generation is in progress */
  isLoading: boolean
  /** Current progress (0-100) */
  progress: number
  /** Current generation stage */
  stage: GenerationStage
  /** Warnings from generation */
  warnings: string[]
}

/**
 * Hook to generate geometry based on current store state.
 * Combines geometry store state with extended object configuration.
 *
 * Uses Web Worker for Wythoff polytopes to prevent UI blocking.
 * Falls back to synchronous generation for other object types.
 *
 * @returns The generated geometry object with loading state.
 */
export function useGeometryGenerator(): GeometryGeneratorResult {
  const dimension = useGeometryStore((state) => state.dimension)
  const objectType = useGeometryStore((state) => state.objectType)
  const { addToast } = useToast()
  const { sendRequest, cancelRequest } = useGeometryWorker()

  // Track shown warnings to avoid duplicate toasts
  const shownWarningsRef = useRef<Set<string>>(new Set())

  // Async state for worker-based generation
  const [asyncGeometry, setAsyncGeometry] = useState<NdGeometry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<GenerationStage>('initializing')
  const [warnings, setWarnings] = useState<string[]>([])
  const currentRequestId = useRef<string | null>(null)

  const polytopeConfig = useExtendedObjectStore((state) => state.polytope)
  const wythoffPolytopeConfig = useExtendedObjectStore((state) => state.wythoffPolytope)
  const rootSystemConfig = useExtendedObjectStore((state) => state.rootSystem)
  const cliffordTorusConfig = useExtendedObjectStore((state) => state.cliffordTorus)
  const nestedTorusConfig = useExtendedObjectStore((state) => state.nestedTorus)
  const mandelbulbConfig = useExtendedObjectStore((state) => state.mandelbulb)
  const quaternionJuliaConfig = useExtendedObjectStore((state) => state.quaternionJulia)
  const schroedingerConfig = useExtendedObjectStore((state) => state.schroedinger)

  // Optimization: Only subscribe to the config relevant to the current object type
  const relevantConfig = useMemo(() => {
    switch (objectType) {
      case 'hypercube':
      case 'simplex':
      case 'cross-polytope':
        return polytopeConfig
      case 'wythoff-polytope':
        return wythoffPolytopeConfig
      case 'root-system':
        return rootSystemConfig
      case 'clifford-torus':
        return cliffordTorusConfig
      case 'nested-torus':
        return nestedTorusConfig
      case 'mandelbulb':
        return mandelbulbConfig
      case 'quaternion-julia':
        return quaternionJuliaConfig
      case 'schroedinger':
        return schroedingerConfig
      default:
        return polytopeConfig
    }
  }, [
    objectType,
    polytopeConfig,
    wythoffPolytopeConfig,
    rootSystemConfig,
    cliffordTorusConfig,
    nestedTorusConfig,
    mandelbulbConfig,
    quaternionJuliaConfig,
    schroedingerConfig,
  ])

  // Stable config reference for dependency tracking
  const configJson = useMemo(() => JSON.stringify(relevantConfig), [relevantConfig])

  // Generate synchronous geometry for non-Wythoff types
  const syncGeometry = useMemo(() => {
    if (objectType === 'wythoff-polytope') {
      return null // Handled by async path
    }

    const params: Partial<ExtendedObjectParams> = {}

    switch (objectType) {
      case 'hypercube':
      case 'simplex':
      case 'cross-polytope':
        params.polytope = relevantConfig as typeof polytopeConfig
        break
      case 'root-system':
        params.rootSystem = relevantConfig as typeof rootSystemConfig
        break
      case 'clifford-torus':
        params.cliffordTorus = relevantConfig as typeof cliffordTorusConfig
        break
      case 'nested-torus':
        params.nestedTorus = relevantConfig as typeof nestedTorusConfig
        break
      case 'mandelbulb':
        params.mandelbulb = relevantConfig as typeof mandelbulbConfig
        break
      case 'quaternion-julia':
        params.quaternionJulia = relevantConfig as typeof quaternionJuliaConfig
        break
      case 'schroedinger':
        params.schroedinger = relevantConfig as typeof schroedingerConfig
        break
      default:
        params.polytope = relevantConfig as typeof polytopeConfig
    }

    return generateGeometry(objectType, dimension, params as ExtendedObjectParams)
  }, [objectType, dimension, relevantConfig])

  // Generate Wythoff polytopes via worker
  const generateWythoffAsync = useCallback(async () => {
    // Cancel any previous request
    if (currentRequestId.current) {
      cancelRequest(currentRequestId.current)
    }

    const requestId = generateRequestId('wythoff')
    currentRequestId.current = requestId

    setIsLoading(true)
    setProgress(0)
    setStage('initializing')
    setWarnings([])

    try {
      const response = await sendRequest(
        {
          type: 'generate-wythoff',
          id: requestId,
          dimension,
          config: wythoffPolytopeConfig as Partial<WythoffPolytopeConfig>,
        },
        (prog, stg) => {
          if (currentRequestId.current === requestId) {
            setProgress(prog)
            setStage(stg)
          }
        }
      )

      // Check if this response is for the current request
      if (currentRequestId.current !== requestId) {
        // Request was cancelled - ensure loading state is cleared
        setIsLoading(false)
        return
      }

      // Handle cancelled response explicitly
      if (response.type === 'cancelled') {
        setIsLoading(false)
        return
      }

      if (response.type === 'result' && response.geometry) {
        const inflated = inflateGeometry(response.geometry)
        const scale = (wythoffPolytopeConfig as WythoffPolytopeConfig).scale ?? 1

        setAsyncGeometry({
          ...inflated,
          type: 'wythoff-polytope',
          metadata: {
            ...inflated.metadata,
            properties: {
              ...inflated.metadata?.properties,
              scale,
            },
          },
        } as NdGeometry)

        setWarnings(response.warnings ?? [])
        setIsLoading(false)
      } else {
        // Unexpected response type - log and clear loading
        if (import.meta.env.DEV) {
          console.warn('[useGeometryGenerator] Unexpected response:', response)
        }
        setIsLoading(false)
      }
    } catch (err) {
      // Always clear loading state on error
      setIsLoading(false)

      if (currentRequestId.current === requestId) {
        const errorMessage = err instanceof Error ? err.message : String(err)

        // Fallback to sync generation if worker is unavailable
        if (errorMessage.includes('Worker not available')) {
          if (import.meta.env.DEV) {
            console.warn('[useGeometryGenerator] Worker unavailable, using sync fallback')
          }
          try {
            const result = generateWythoffPolytopeWithWarnings(
              dimension,
              wythoffPolytopeConfig as WythoffPolytopeConfig
            )
            const scale = (wythoffPolytopeConfig as WythoffPolytopeConfig).scale ?? 1

            setAsyncGeometry({
              ...result.geometry,
              type: 'wythoff-polytope',
              metadata: {
                ...result.geometry.metadata,
                properties: {
                  ...result.geometry.metadata?.properties,
                  scale,
                },
              },
            } as NdGeometry)
            setWarnings(result.warnings)
          } catch (syncErr) {
            console.error('[useGeometryGenerator] Sync fallback error:', syncErr)
            setAsyncGeometry(null)
          }
          return
        }

        console.error('[useGeometryGenerator] Worker error:', err)
        setAsyncGeometry(null)
      }
    } finally {
      // Clear request ID if this was our request
      if (currentRequestId.current === requestId) {
        currentRequestId.current = null
      }
    }
  }, [dimension, wythoffPolytopeConfig, sendRequest, cancelRequest])

  // Reset async state when switching away from Wythoff
  useEffect(() => {
    if (objectType !== 'wythoff-polytope') {
      // Clear async state when not on Wythoff to prevent stale data
      setAsyncGeometry(null)
      setIsLoading(false)
      setProgress(0)
      setStage('initializing')
    }
  }, [objectType])

  // Trigger async generation for Wythoff polytopes
  useEffect(() => {
    if (objectType === 'wythoff-polytope') {
      generateWythoffAsync()
    }

    return () => {
      if (currentRequestId.current) {
        cancelRequest(currentRequestId.current)
        currentRequestId.current = null
        // Ensure loading is cleared on cleanup
        setIsLoading(false)
      }
    }
  }, [objectType, dimension, configJson, generateWythoffAsync, cancelRequest])

  // Show warnings via toast (only new warnings, not duplicates)
  useEffect(() => {
    for (const warning of warnings) {
      if (!shownWarningsRef.current.has(warning)) {
        shownWarningsRef.current.add(warning)
        addToast(warning, 'info')
      }
    }
  }, [warnings, addToast])

  // Clear shown warnings when object type or dimension changes
  useEffect(() => {
    shownWarningsRef.current.clear()
  }, [objectType, dimension])

  // Determine which geometry to return
  const geometry = objectType === 'wythoff-polytope' ? asyncGeometry : syncGeometry

  return {
    geometry,
    dimension,
    objectType,
    isLoading: objectType === 'wythoff-polytope' ? isLoading : false,
    progress: objectType === 'wythoff-polytope' ? progress : 100,
    stage: objectType === 'wythoff-polytope' ? stage : 'complete',
    warnings,
  }
}
