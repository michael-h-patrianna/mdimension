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
  const rootSystemConfig = useExtendedObjectStore((state) => state.rootSystem)
  const cliffordTorusConfig = useExtendedObjectStore((state) => state.cliffordTorus)
  const nestedTorusConfig = useExtendedObjectStore((state) => state.nestedTorus)
  const mandelbrotConfig = useExtendedObjectStore((state) => state.mandelbrot)
  const quaternionJuliaConfig = useExtendedObjectStore((state) => state.quaternionJulia)
  const kaliConfig = useExtendedObjectStore((state) => state.kali)

  const extendedParams: ExtendedObjectParams = useMemo(
    () => ({
      polytope: polytopeConfig,
      rootSystem: rootSystemConfig,
      cliffordTorus: cliffordTorusConfig,
      nestedTorus: nestedTorusConfig,
      mandelbrot: mandelbrotConfig,
      quaternionJulia: quaternionJuliaConfig,
      kali: kaliConfig,
    }),
    [
      polytopeConfig,
      rootSystemConfig,
      cliffordTorusConfig,
      nestedTorusConfig,
      mandelbrotConfig,
      quaternionJuliaConfig,
      kaliConfig,
    ]
  )

  const geometry = useMemo(() => {
    return generateGeometry(objectType, dimension, extendedParams)
  }, [objectType, dimension, extendedParams])

  return { geometry, dimension, objectType }
}
