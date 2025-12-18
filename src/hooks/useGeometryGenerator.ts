import type { ExtendedObjectParams } from '@/lib/geometry'
import { generateGeometry } from '@/lib/geometry'
import { useExtendedObjectStore } from '@/stores/extendedObjectStore'
import { useGeometryStore } from '@/stores/geometryStore'
import { useMemo } from 'react'

/**
 * Hook to generate geometry based on current store state.
 * Combines geometry store state with extended object configuration.
 *
 * Now includes polytope configuration for unified scale control across
 * all object types (polytopes and extended objects).
 *
 * @returns The generated geometry object.
 */
export function useGeometryGenerator() {
  const dimension = useGeometryStore((state) => state.dimension)
  const objectType = useGeometryStore((state) => state.objectType)

  const polytopeConfig = useExtendedObjectStore((state) => state.polytope)
  const wythoffPolytopeConfig = useExtendedObjectStore((state) => state.wythoffPolytope)
  const rootSystemConfig = useExtendedObjectStore((state) => state.rootSystem)
  const cliffordTorusConfig = useExtendedObjectStore((state) => state.cliffordTorus)
  const nestedTorusConfig = useExtendedObjectStore((state) => state.nestedTorus)
  const mandelbulbConfig = useExtendedObjectStore((state) => state.mandelbulb)
  const quaternionJuliaConfig = useExtendedObjectStore((state) => state.quaternionJulia)
  const schroedingerConfig = useExtendedObjectStore((state) => state.schroedinger)

  // Optimization: Only subscribe to the config relevant to the current object type
  // This prevents geometry regeneration when changing settings for inactive objects
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

  const geometry = useMemo(() => {
    // Reconstruct just the necessary part of ExtendedObjectParams
    // generateGeometry uses specific keys based on objectType
    const params: Partial<ExtendedObjectParams> = {}

    // Map the relevant config to the correct key expected by generateGeometry
    switch (objectType) {
      case 'hypercube':
      case 'simplex':
      case 'cross-polytope':
        params.polytope = relevantConfig as typeof polytopeConfig
        break
      case 'wythoff-polytope':
        params.wythoffPolytope = relevantConfig as typeof wythoffPolytopeConfig
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

  return { geometry, dimension, objectType }
}
