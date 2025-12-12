import { useLayoutEffect } from 'react';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';

/**
 * Synchronizes the dimension across all relevant stores.
 * This ensures that when the geometry dimension changes, the rotation,
 * transform, and animation stores are updated to match.
 */
export function useSyncedDimension() {
  const dimension = useGeometryStore((state) => state.dimension);
  const setRotationDimension = useRotationStore((state) => state.setDimension);
  const setTransformDimension = useTransformStore((state) => state.setDimension);
  const setAnimationDimension = useAnimationStore((state) => state.setDimension);

  useLayoutEffect(() => {
    setRotationDimension(dimension);
    setTransformDimension(dimension);
    setAnimationDimension(dimension);
  }, [dimension, setRotationDimension, setTransformDimension, setAnimationDimension]);
}
