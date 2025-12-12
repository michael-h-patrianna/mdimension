/**
 * Scale Controls Component
 * Allows users to scale objects uniformly or per-axis
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  useTransformStore,
  MIN_SCALE,
  MAX_SCALE,
  DEFAULT_SCALE,
} from '@/stores/transformStore';
import { useGeometryStore } from '@/stores/geometryStore';

/** Axis labels for each dimension index */
const AXIS_LABELS = ['X', 'Y', 'Z', 'W', 'V', 'U'];

export interface ScaleControlsProps {
  className?: string;
}

export const ScaleControls: React.FC<ScaleControlsProps> = ({
  className = '',
}) => {
  const dimension = useGeometryStore((state) => state.dimension);

  const uniformScale = useTransformStore((state) => state.uniformScale);
  const perAxisScale = useTransformStore((state) => state.perAxisScale);
  const scaleLocked = useTransformStore((state) => state.scaleLocked);
  const setUniformScale = useTransformStore((state) => state.setUniformScale);
  const setAxisScale = useTransformStore((state) => state.setAxisScale);
  const setScaleLocked = useTransformStore((state) => state.setScaleLocked);
  const resetScale = useTransformStore((state) => state.resetScale);
  const isScaleExtreme = useTransformStore((state) => state.isScaleExtreme);

  const showWarning = isScaleExtreme();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Warning for extreme values */}
      {showWarning && (
        <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg text-yellow-400 text-xs">
          Extreme scaling may cause visual distortion
        </div>
      )}

      {/* Uniform Scale */}
      <div className="space-y-2">
        <Tooltip
          content="Scale all dimensions uniformly. Double-click value to reset."
          position="top"
        >
          <Slider
            label="Uniform Scale"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.1}
            value={uniformScale}
            onChange={setUniformScale}
            onReset={() => setUniformScale(DEFAULT_SCALE)}
            showValue
          />
        </Tooltip>
      </div>

      {/* Lock Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setScaleLocked(!scaleLocked)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
            ${scaleLocked
              ? 'bg-accent/20 text-accent border border-accent/50'
              : 'bg-panel-border text-text-secondary border border-panel-border'
            }
          `}
          aria-pressed={scaleLocked}
        >
          <span>{scaleLocked ? '🔒' : '🔓'}</span>
          <span>{scaleLocked ? 'Locked' : 'Unlocked'}</span>
        </button>
        <span className="text-xs text-text-secondary">
          {scaleLocked ? 'All axes scale together' : 'Axes scale independently'}
        </span>
      </div>

      {/* Per-Axis Scales */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Per-Axis Scale
        </label>
        <div className="space-y-1">
          {Array.from({ length: dimension }).map((_, i) => (
            <Slider
              key={i}
              label={AXIS_LABELS[i] || `Axis ${i}`}
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.1}
              value={perAxisScale[i] ?? DEFAULT_SCALE}
              onChange={(value) => setAxisScale(i, value)}
              onReset={() => setAxisScale(i, DEFAULT_SCALE)}
              disabled={scaleLocked}
              showValue
              className={scaleLocked ? 'opacity-50' : ''}
            />
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={resetScale}
        className="w-full"
      >
        Reset Scale
      </Button>
    </div>
  );
};
