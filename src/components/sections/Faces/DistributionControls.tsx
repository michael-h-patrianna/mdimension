/**
 * Distribution Controls Component
 *
 * Sliders for controlling the distribution curve that remaps input values
 * before palette lookup. Controls power curve, cycles, and offset.
 */

import { Slider } from '@/components/ui/Slider';
import { DEFAULT_DISTRIBUTION } from '@/rendering/shaders/palette';
import { useAppearanceStore } from '@/stores/appearanceStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface DistributionControlsProps {
  className?: string;
}

export const DistributionControls: React.FC<DistributionControlsProps> = ({
  className = '',
}) => {
  const { distribution, setDistribution } = useAppearanceStore(
    useShallow((state) => ({
      distribution: state.distribution,
      setDistribution: state.setDistribution,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-sm font-medium text-text-secondary mb-2">
        Distribution
      </div>

      <Slider
        label="Power"
        min={0.25}
        max={4}
        step={0.05}
        value={distribution.power}
        onChange={(value) => setDistribution({ power: value })}
        showValue
        tooltip="Power curve: < 1 expands dark tones, > 1 expands light tones"
      />

      <Slider
        label="Cycles"
        min={0.5}
        max={5}
        step={0.1}
        value={distribution.cycles}
        onChange={(value) => setDistribution({ cycles: value })}
        showValue
        tooltip="Number of times the palette repeats across the surface"
      />

      <Slider
        label="Offset"
        min={0}
        max={1}
        step={0.01}
        value={distribution.offset}
        onChange={(value) => setDistribution({ offset: value })}
        showValue
        tooltip="Shifts the starting point of the color gradient"
      />
    </div>
  );
};
