import { useMemo } from 'react';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useVisualStore } from '@/stores/visualStore';
import { generateGeometry } from '@/lib/geometry';
import type { ExtendedObjectParams } from '@/lib/geometry';

/**
 * Hook to generate geometry based on current store state.
 * Combines geometry store state with extended object configuration.
 *
 * Now includes polytope configuration for unified scale control across
 * all object types (polytopes and extended objects).
 *
 * For hypersphere, the Edges toggle (edgesVisible) controls wireframe generation.
 *
 * @returns The generated geometry object.
 */
export function useGeometryGenerator() {
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);

  // Get edgesVisible from visual store - controls hypersphere wireframe
  const edgesVisible = useVisualStore((state) => state.edgesVisible);

  const polytopeConfig = useExtendedObjectStore((state) => state.polytope);
  const hypersphereConfig = useExtendedObjectStore((state) => state.hypersphere);
  const rootSystemConfig = useExtendedObjectStore((state) => state.rootSystem);
  const cliffordTorusConfig = useExtendedObjectStore((state) => state.cliffordTorus);
  const mandelbrotConfig = useExtendedObjectStore((state) => state.mandelbrot);

  const extendedParams: ExtendedObjectParams = useMemo(() => ({
    polytope: polytopeConfig,
    // Override wireframeEnabled with edgesVisible from visual store
    hypersphere: {
      ...hypersphereConfig,
      wireframeEnabled: edgesVisible,
    },
    rootSystem: rootSystemConfig,
    cliffordTorus: cliffordTorusConfig,
    mandelbrot: mandelbrotConfig,
  }), [polytopeConfig, hypersphereConfig, edgesVisible, rootSystemConfig, cliffordTorusConfig, mandelbrotConfig]);

  const geometry = useMemo(() => {
    return generateGeometry(objectType, dimension, extendedParams);
  }, [objectType, dimension, extendedParams]);

  return { geometry, dimension, objectType };
}
