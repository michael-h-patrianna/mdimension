/**
 * Dimension Selector Component
 * Allows users to select the number of dimensions (3D, 4D, 5D, 6D)
 */

import React from 'react';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGeometryStore, MIN_DIMENSION, MAX_DIMENSION } from '@/stores/geometryStore';

export interface DimensionSelectorProps {
  className?: string;
  disabled?: boolean;
}

/** Generate dimension options from MIN to MAX */
function getDimensionOptions() {
  const options = [];
  for (let d = MIN_DIMENSION; d <= MAX_DIMENSION; d++) {
    options.push({
      value: String(d),
      label: `${d}D`,
    });
  }
  return options;
}

export const DimensionSelector: React.FC<DimensionSelectorProps> = ({
  className = '',
  disabled = false,
}) => {
  const { dimension, setDimension } = useGeometryStore();

  const handleChange = (value: string) => {
    const newDimension = parseInt(value, 10);
    if (!isNaN(newDimension)) {
      setDimension(newDimension);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Tooltip
        content="Select the number of dimensions for the object. Higher dimensions have more rotation planes."
        position="top"
      >
        <label className="block text-sm font-medium text-text-secondary">
          Dimension
        </label>
      </Tooltip>
      <ToggleGroup
        options={getDimensionOptions()}
        value={String(dimension)}
        onChange={handleChange}
        disabled={disabled}
        ariaLabel="Select dimension"
        className="w-full justify-center"
        data-testid="dimension-selector"
      />
      <p className="text-xs text-text-secondary">
        {dimension}D space has {(dimension * (dimension - 1)) / 2} rotation planes
      </p>
    </div>
  );
};
