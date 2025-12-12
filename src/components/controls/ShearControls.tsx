/**
 * Shear Controls Component
 * Allows users to apply shear transformations along dimension pairs
 */

import React, { useMemo } from 'react';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  useTransformStore,
  MIN_SHEAR,
  MAX_SHEAR,
  DEFAULT_SHEAR,
} from '@/stores/transformStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { getShearPlaneGroups } from '@/utils/shearUtils';

export interface ShearControlsProps {
  className?: string;
}

const STYLES = {
  container: "space-y-4",
  group: "space-y-2",
  groupTitle: "block text-sm font-medium text-text-secondary",
  slidersContainer: "space-y-1",
  tooltipText: "text-xs text-text-secondary",
  resetButton: "w-full"
} as const;

export const ShearControls: React.FC<ShearControlsProps> = ({
  className = '',
}) => {
  const dimension = useGeometryStore((state) => state.dimension);
  const shears = useTransformStore((state) => state.shears);
  const setShear = useTransformStore((state) => state.setShear);
  const resetAllShears = useTransformStore((state) => state.resetAllShears);

  const planeGroups = useMemo(() => getShearPlaneGroups(dimension), [dimension]);

  const hasActiveShears = shears.size > 0;

  return (
    <div className={`${STYLES.container} ${className}`}>
      {/* Info tooltip */}
      <Tooltip
        content="Shear skews the object. Formula: x' = x + s*y where s is the shear amount."
        position="top"
      >
        <p className={STYLES.tooltipText}>
          Shear transforms skew the object along axis pairs
        </p>
      </Tooltip>

      {/* Shear plane groups */}
      {planeGroups.map((group) => (
        <div key={group.title} className={STYLES.group}>
          <label className={STYLES.groupTitle}>
            {group.title}
          </label>
          <div className={STYLES.slidersContainer}>
            {group.planes.map((plane) => (
              <Slider
                key={plane}
                label={plane}
                min={MIN_SHEAR}
                max={MAX_SHEAR}
                step={0.1}
                value={shears.get(plane) ?? DEFAULT_SHEAR}
                onChange={(value) => setShear(plane, value)}
                onReset={() => setShear(plane, DEFAULT_SHEAR)}
                showValue
              />
            ))}
          </div>
        </div>
      ))}

      {/* Reset Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={resetAllShears}
        disabled={!hasActiveShears}
        className={STYLES.resetButton}
      >
        Reset Shears
      </Button>
    </div>
  );
};
