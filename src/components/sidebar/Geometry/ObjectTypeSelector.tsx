/**
 * Object Type Selector Component
 * Allows users to select the type of n-dimensional object
 *
 * Supports both traditional polytopes and extended objects:
 * - Polytopes: Hypercube, Simplex, Cross-Polytope
 * - Extended: Root System, Clifford Torus, Mandelbrot, Mandelbox
 */

import React, { useMemo, useEffect } from 'react';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useRotationStore } from '@/stores/rotationStore';
import { getAvailableTypes } from '@/lib/geometry';
import type { ObjectType } from '@/lib/geometry/types';
import { isPolytopeType } from '@/lib/geometry/types';

export interface ObjectTypeSelectorProps {
  className?: string;
  disabled?: boolean;
}

export const ObjectTypeSelector: React.FC<ObjectTypeSelectorProps> = ({
  className = '',
  disabled = false,
}) => {
  const objectType = useGeometryStore((state) => state.objectType);
  const setObjectType = useGeometryStore((state) => state.setObjectType);
  const dimension = useGeometryStore((state) => state.dimension);
  const resetAllRotations = useRotationStore((state) => state.resetAllRotations);
  const initializeMandelbrotForDimension = useExtendedObjectStore(
    (state) => state.initializeMandelbrotForDimension
  );
  const initializeMandelboxForDimension = useExtendedObjectStore(
    (state) => state.initializeMandelboxForDimension
  );
  const initializePolytopeForType = useExtendedObjectStore(
    (state) => state.initializePolytopeForType
  );

  // Initialize Mandelbrot settings when objectType is 'mandelbrot' and dimension changes
  useEffect(() => {
    if (objectType === 'mandelbrot') {
      initializeMandelbrotForDimension(dimension);
    }
  }, [objectType, dimension, initializeMandelbrotForDimension]);

  // Initialize Mandelbox settings when objectType is 'mandelbox' and dimension changes
  useEffect(() => {
    if (objectType === 'mandelbox') {
      initializeMandelboxForDimension(dimension);
    }
  }, [objectType, dimension, initializeMandelboxForDimension]);

  // Initialize polytope scale when switching to a polytope type
  useEffect(() => {
    if (isPolytopeType(objectType)) {
      initializePolytopeForType(objectType);
    }
  }, [objectType, initializePolytopeForType]);

  // Get available types based on current dimension
  const availableTypes = useMemo(() => getAvailableTypes(dimension), [dimension]);

  // Build options with disabled state for dimension-constrained types
  const options = useMemo(() => {
    return availableTypes.map((t) => ({
      value: t.type,
      label: t.available ? t.name : `${t.name} (${t.disabledReason})`,
      disabled: !t.available,
    }));
  }, [availableTypes]);

  // Get description for current type
  const description = useMemo(() => {
    const found = availableTypes.find((t) => t.type === objectType);
    return found?.description ?? '';
  }, [availableTypes, objectType]);

  const handleChange = (value: string) => {
    // Only set if the type is available for current dimension
    const typeInfo = availableTypes.find((t) => t.type === value);
    if (typeInfo?.available) {
      // Reset rotation angles to prevent accumulated rotations from previous
      // object type causing visual artifacts (e.g., spikes/distortion)
      resetAllRotations();
      setObjectType(value as ObjectType);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Tooltip
        content="Select the type of geometric object to visualize"
        position="top"
        className="w-full"
      >
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-text-secondary">
            Type
          </label>
          <Select
            options={options}
            value={objectType}
            onChange={handleChange}
            disabled={disabled}
            data-testid="object-type-selector"
            className="flex-1"
          />
        </div>
      </Tooltip>
      <p className="text-xs text-text-secondary">
        {description}
      </p>
    </div>
  );
};
