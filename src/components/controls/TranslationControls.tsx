/**
 * Translation Controls Component
 * Allows users to move objects along each axis
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  useTransformStore,
  MIN_TRANSLATION,
  MAX_TRANSLATION,
  DEFAULT_TRANSLATION,
} from '@/stores/transformStore';
import { useGeometryStore } from '@/stores/geometryStore';

/** Axis labels for each dimension index */
const AXIS_LABELS = ['X', 'Y', 'Z', 'W', 'V', 'U'];

/** Axis descriptions */
const AXIS_DESCRIPTIONS: Record<string, string> = {
  X: 'Move left/right',
  Y: 'Move up/down',
  Z: 'Move forward/backward',
  W: 'Move in 4th dimension (affects perspective size)',
  V: 'Move in 5th dimension',
  U: 'Move in 6th dimension',
};

export interface TranslationControlsProps {
  className?: string;
}

export const TranslationControls: React.FC<TranslationControlsProps> = ({
  className = '',
}) => {
  const dimension = useGeometryStore((state) => state.dimension);
  const translation = useTransformStore((state) => state.translation);
  const setTranslation = useTransformStore((state) => state.setTranslation);
  const center = useTransformStore((state) => state.center);

  const hasNonZeroTranslation = translation.some((t) => Math.abs(t) > 0.01);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Info */}
      <p className="text-xs text-text-secondary">
        Move the object along each axis. W translation affects apparent size in perspective mode.
      </p>

      {/* Per-Axis Translation Sliders */}
      <div className="space-y-2">
        {Array.from({ length: dimension }).map((_, i) => {
          const label = AXIS_LABELS[i] || `Axis ${i}`;
          const description = AXIS_DESCRIPTIONS[label] || '';

          return (
            <Tooltip key={i} content={description} position="left">
              <Slider
                label={label}
                min={MIN_TRANSLATION}
                max={MAX_TRANSLATION}
                step={0.1}
                value={translation[i] ?? DEFAULT_TRANSLATION}
                onChange={(value) => setTranslation(i, value)}
                onReset={() => setTranslation(i, DEFAULT_TRANSLATION)}
                showValue
              />
            </Tooltip>
          );
        })}
      </div>

      {/* Center Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={center}
        disabled={!hasNonZeroTranslation}
        className="w-full"
      >
        Center Object
      </Button>
    </div>
  );
};
