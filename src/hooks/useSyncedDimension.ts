import { useLayoutEffect, useRef } from 'react';
import { useGeometryStore } from '@/stores/geometryStore';
import { useRotationStore } from '@/stores/rotationStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAnimationStore } from '@/stores/animationStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useAppearanceStore } from '@/stores/appearanceStore';

/**
 * Synchronizes the dimension across all relevant stores and resets rotations
 * when dimension or object type changes.
 */
export function useSyncedDimension() {
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const setRotationDimension = useRotationStore((state) => state.setDimension);
  const resetAllRotations = useRotationStore((state) => state.resetAllRotations);
  const setTransformDimension = useTransformStore((state) => state.setDimension);
  const setAnimationDimension = useAnimationStore((state) => state.setDimension);
  
  // Extended object re-initialization
  const initializeBlackHoleForDimension = useExtendedObjectStore((state) => state.initializeBlackHoleForDimension);

  // Track previous object type to detect changes
  const prevObjectTypeRef = useRef(objectType);

  useLayoutEffect(() => {
    setRotationDimension(dimension);
    setTransformDimension(dimension);
    setAnimationDimension(dimension);
    
    // Object-specific re-initialization
    if (objectType === 'blackhole') {
      initializeBlackHoleForDimension(dimension);
      useAppearanceStore.getState().setColorAlgorithm('blackbody');
    }
  }, [dimension, objectType, setRotationDimension, setTransformDimension, setAnimationDimension, initializeBlackHoleForDimension]);

  // Reset rotations when object type changes
  useLayoutEffect(() => {
    if (prevObjectTypeRef.current !== objectType) {
      resetAllRotations();
      prevObjectTypeRef.current = objectType;
    }
  }, [objectType, resetAllRotations]);
}
