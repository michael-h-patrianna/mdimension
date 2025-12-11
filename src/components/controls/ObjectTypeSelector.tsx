/**
 * Object Type Selector Component
 * Allows users to select the type of n-dimensional object
 */

import React from 'react';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGeometryStore } from '@/stores/geometryStore';
import { getAvailableTypes } from '@/lib/geometry';
import type { PolytopeType } from '@/lib/geometry/types';

export interface ObjectTypeSelectorProps {
  className?: string;
  disabled?: boolean;
}

/** Get select options from available polytope types */
function getObjectTypeOptions() {
  const types = getAvailableTypes();
  return types.map((t) => ({
    value: t.type,
    label: t.name,
  }));
}

/** Get description for a polytope type */
function getTypeDescription(type: PolytopeType): string {
  const types = getAvailableTypes();
  const found = types.find((t) => t.type === type);
  return found?.description ?? '';
}

export const ObjectTypeSelector: React.FC<ObjectTypeSelectorProps> = ({
  className = '',
  disabled = false,
}) => {
  const { objectType, setObjectType } = useGeometryStore();

  const handleChange = (value: string) => {
    setObjectType(value as PolytopeType);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Tooltip
        content="Select the type of geometric object to visualize"
        position="top"
      >
        <Select
          label="Object Type"
          options={getObjectTypeOptions()}
          value={objectType}
          onChange={handleChange}
          disabled={disabled}
          data-testid="object-type-selector"
        />
      </Tooltip>
      <p className="text-xs text-text-secondary">
        {getTypeDescription(objectType)}
      </p>
    </div>
  );
};
