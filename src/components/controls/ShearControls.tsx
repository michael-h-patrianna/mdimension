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
import { getRotationPlanes } from '@/lib/math';

export interface ShearControlsProps {
  className?: string;
}

/**
 * Get shear plane groups for display
 */
function getShearPlaneGroups(dimension: number) {
  const planes = getRotationPlanes(dimension);
  const groups: { title: string; planes: string[] }[] = [];

  // 3D shears
  const planes3D = planes
    .filter(
      (p) =>
        !p.name.includes('W') &&
        !p.name.includes('V') &&
        !p.name.includes('U')
    )
    .map((p) => p.name);

  if (planes3D.length > 0) {
    groups.push({ title: '3D Shears', planes: planes3D });
  }

  // 4D shears (W-axis)
  if (dimension >= 4) {
    const planesW = planes
      .filter(
        (p) =>
          p.name.includes('W') &&
          !p.name.includes('V') &&
          !p.name.includes('U')
      )
      .map((p) => p.name);

    if (planesW.length > 0) {
      groups.push({ title: '4th Dimension (W)', planes: planesW });
    }
  }

  // 5D shears (V-axis)
  if (dimension >= 5) {
    const planesV = planes
      .filter((p) => p.name.includes('V') && !p.name.includes('U'))
      .map((p) => p.name);

    if (planesV.length > 0) {
      groups.push({ title: '5th Dimension (V)', planes: planesV });
    }
  }

  // 6D shears (U-axis)
  if (dimension >= 6) {
    const planesU = planes.filter((p) => p.name.includes('U')).map((p) => p.name);

    if (planesU.length > 0) {
      groups.push({ title: '6th Dimension (U)', planes: planesU });
    }
  }

  return groups;
}

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
    <div className={`space-y-4 ${className}`}>
      {/* Info tooltip */}
      <Tooltip
        content="Shear skews the object. Formula: x' = x + s*y where s is the shear amount."
        position="top"
      >
        <p className="text-xs text-text-secondary">
          Shear transforms skew the object along axis pairs
        </p>
      </Tooltip>

      {/* Shear plane groups */}
      {planeGroups.map((group) => (
        <div key={group.title} className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">
            {group.title}
          </label>
          <div className="space-y-1">
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
        className="w-full"
      >
        Reset Shears
      </Button>
    </div>
  );
};
