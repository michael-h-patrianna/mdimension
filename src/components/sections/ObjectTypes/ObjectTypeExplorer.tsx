import React, { useMemo, useEffect } from 'react';
import { useGeometryStore } from '@/stores/geometryStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useRotationStore } from '@/stores/rotationStore';
import { getAvailableTypes } from '@/lib/geometry';
import type { ObjectType } from '@/lib/geometry/types';
import { isPolytopeType } from '@/lib/geometry/types';

export const ObjectTypeExplorer: React.FC = () => {
  const objectType = useGeometryStore((state) => state.objectType);
  const setObjectType = useGeometryStore((state) => state.setObjectType);
  const dimension = useGeometryStore((state) => state.dimension);
  const resetAllRotations = useRotationStore((state) => state.resetAllRotations);
  
  const initializeMandelbulbForDimension = useExtendedObjectStore(
    (state) => state.initializeMandelbulbForDimension
  );
  const initializeQuaternionJuliaForDimension = useExtendedObjectStore(
    (state) => state.initializeQuaternionJuliaForDimension
  );
  const initializePolytopeForType = useExtendedObjectStore(
    (state) => state.initializePolytopeForType
  );

  // Ensure faces are visible for raymarched fractals so render mode isn't 'none'
  useEffect(() => {
    if (objectType === 'quaternion-julia' || objectType === 'mandelbulb') {
      const store = useAppearanceStore.getState();
      if (!store.facesVisible) {
        store.setFacesVisible(true);
      }
    }
  }, [objectType]);

  // Initialize Mandelbulb settings when objectType is 'mandelbulb' and dimension changes
  useEffect(() => {
    if (objectType === 'mandelbulb') {
      initializeMandelbulbForDimension(dimension);
    }
  }, [objectType, dimension, initializeMandelbulbForDimension]);

  // Initialize Quaternion Julia settings when objectType is 'quaternion-julia' and dimension changes
  useEffect(() => {
    if (objectType === 'quaternion-julia') {
      initializeQuaternionJuliaForDimension(dimension);
    }
  }, [objectType, dimension, initializeQuaternionJuliaForDimension]);

  // Ensure facesVisible is true for raymarched fractals (they require it to render)
  useEffect(() => {
    const isRaymarchedFractal =
      objectType === 'quaternion-julia' ||
      objectType === 'mandelbulb';

    if (isRaymarchedFractal) {
      const currentFacesVisible = useAppearanceStore.getState().facesVisible;
      if (!currentFacesVisible) {
        useAppearanceStore.getState().setFacesVisible(true);
      }
    }
  }, [objectType]);

  // Initialize polytope scale when switching to a polytope type
  useEffect(() => {
    if (isPolytopeType(objectType)) {
      initializePolytopeForType(objectType);
    }
  }, [objectType, initializePolytopeForType]);

  // Get available types based on current dimension
  const availableTypes = useMemo(() => getAvailableTypes(dimension), [dimension]);

  const handleSelect = (value: ObjectType) => {
     // Reset rotation angles to prevent accumulated rotations from previous
     // object type causing visual artifacts (e.g., spikes/distortion)
     resetAllRotations();
     setObjectType(value);
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      {availableTypes.map((type) => {
        const isSelected = objectType === type.type;
        const isDisabled = !type.available;

        return (
          <button
            key={type.type}
            onClick={() => !isDisabled && handleSelect(type.type)}
            disabled={isDisabled}
            className={`
              relative group flex flex-col p-3 rounded-lg border text-left transition-all duration-200
              ${isSelected 
                ? 'bg-accent/10 border-accent text-accent' 
                : 'bg-panel-bg border-panel-border hover:border-text-secondary/50 text-text-secondary hover:text-text-primary'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed hover:border-panel-border' : ''}
            `}
            data-testid={`object-type-${type.type}`}
          >
            <div className="flex items-center justify-between w-full mb-1">
                <span className="font-medium text-sm">{type.name}</span>
                {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
            </div>
            <span className="text-xs text-text-secondary/80 line-clamp-2 leading-relaxed">
                {type.description}
            </span>
            
            {isDisabled && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                     <span className="text-xs font-bold bg-background px-2 py-1 rounded shadow-sm border border-panel-border">
                        {type.disabledReason}
                     </span>
                </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
