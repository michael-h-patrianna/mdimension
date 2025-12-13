import { useLayoutEffect, useRef } from 'react';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';

/**
 * Synchronizes the dimension across all relevant stores and resets rotations
 * when dimension or object type changes.
 *
 * This ensures that when the geometry changes, the rotation, transform, and
 * animation stores are updated to match, preventing accumulated rotation angles
 * from causing erratic behavior in different dimension spaces.
 */
export function useSyncedDimension() {
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const setRotationDimension = useRotationStore((state) => state.setDimension);
  const resetAllRotations = useRotationStore((state) => state.resetAllRotations);
  const setTransformDimension = useTransformStore((state) => state.setDimension);
  const setAnimationDimension = useAnimationStore((state) => state.setDimension);

  // Track previous object type to detect changes
  const prevObjectTypeRef = useRef(objectType);

  useLayoutEffect(() => {
    setRotationDimension(dimension);
    setTransformDimension(dimension);
    setAnimationDimension(dimension);
  }, [dimension, setRotationDimension, setTransformDimension, setAnimationDimension]);

  // Reset rotations when object type changes
  useLayoutEffect(() => {
    if (prevObjectTypeRef.current !== objectType) {
      resetAllRotations();
      prevObjectTypeRef.current = objectType;
    }
  }, [objectType, resetAllRotations]);
}
