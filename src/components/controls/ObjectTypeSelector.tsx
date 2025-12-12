/**
 * Object Type Selector Component
 * Allows users to select the type of n-dimensional object
 *
 * Supports both traditional polytopes and extended objects:
 * - Polytopes: Hypercube, Simplex, Cross-Polytope
 * - Extended: Hypersphere, Root System, Product Manifold, Clifford Torus
 */

import React, { useMemo } from 'react';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGeometryStore } from '@/stores/geometryStore';
import { getAvailableTypes } from '@/lib/geometry';
import type { ObjectType } from '@/lib/geometry/types';

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
      setObjectType(value as ObjectType);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Tooltip
        content="Select the type of geometric object to visualize"
        position="top"
      >
        <Select
          label="Object Type"
          options={options}
          value={objectType}
          onChange={handleChange}
          disabled={disabled}
          data-testid="object-type-selector"
        />
      </Tooltip>
      <p className="text-xs text-text-secondary">
        {description}
      </p>
    </div>
  );
};
