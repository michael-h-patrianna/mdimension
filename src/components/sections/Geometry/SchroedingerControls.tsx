/**
 * SchroedingerControls Component
 *
 * Controls for configuring n-dimensional Schroedinger fractal visualization.
 * Schroedinger uses GPU raymarching exclusively.
 *
 * Features:
 * - Max iterations slider
 * - Escape radius slider
 * - Power presets and custom slider
 * - Slice parameters for 4D+
 */

import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { DEFAULT_SCHROEDINGER_CONFIG } from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React from 'react';

/**
 * Props for the SchroedingerControls component.
 */
export interface SchroedingerControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
  className?: string;
}

/**
 * Schroedinger power presets
 */
const powerPresets = [
  { value: 3, label: 'Flower' },
  { value: 4, label: 'Quad' },
  { value: 8, label: 'Classic' },
  { value: 12, label: 'Spiky' },
];

/**
 * SchroedingerControls component
 *
 * Provides controls for Schroedinger GPU raymarching:
 * - Iteration count adjustment
 * - Escape radius adjustment
 * - Power presets and slider
 * - Slice parameters for 4D+
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 * @returns React component
 */
export const SchroedingerControls: React.FC<SchroedingerControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const {
    config,
    setMaxIterations,
    setEscapeRadius,
    setSchroedingerPower,
    setSchroedingerParameterValue,
    resetSchroedingerParameters,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.schroedinger,
      setMaxIterations: state.setSchroedingerMaxIterations,
      setEscapeRadius: state.setSchroedingerEscapeRadius,
      setSchroedingerPower: state.setSchroedingerSchroedingerPower,
      setSchroedingerParameterValue: state.setSchroedingerParameterValue,
      resetSchroedingerParameters: state.resetSchroedingerParameters,
    }))
  );

  // Get current dimension to show/hide dimension-specific controls
  const dimension = useGeometryStore((state) => state.dimension);

  return (
    <div className={`space-y-4 ${className}`} data-testid="schroedinger-controls">

      {/* Max Iterations */}
      <Slider
        label="Max Iterations"
        min={10}
        max={500}
        step={10}
        value={config.maxIterations}
        onChange={setMaxIterations}
        onReset={() => setMaxIterations(DEFAULT_SCHROEDINGER_CONFIG.maxIterations)}
        showValue
        data-testid="schroedinger-iterations"
      />

      {/* Escape Radius */}
      <Slider
        label={dimension >= 4 ? 'Escape Radius (8+ recommended for 4D+)' : 'Escape Radius'}
        min={2.0}
        max={16.0}
        step={0.5}
        value={config.escapeRadius}
        onChange={setEscapeRadius}
        onReset={() => setEscapeRadius(dimension >= 4 ? 8.0 : DEFAULT_SCHROEDINGER_CONFIG.escapeRadius)}
        showValue
        data-testid="schroedinger-escape-radius"
      />

      {/* Power Control (shown for 3D+ Schroedinger) */}
      {dimension >= 3 && (
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">
            Schroedinger Power (n={config.schroedingerPower})
          </label>
          <ToggleGroup
            options={powerPresets.map((p) => ({
              value: String(p.value),
              label: p.label,
            }))}
            value={String(config.schroedingerPower)}
            onChange={(v) => setSchroedingerPower(parseInt(v, 10))}
            ariaLabel="Schroedinger power preset"
            data-testid="schroedinger-power-preset"
          />
          <Slider
            label="Custom Power"
            min={2}
            max={16}
            step={1}
            value={config.schroedingerPower}
            onChange={setSchroedingerPower}
            onReset={() => setSchroedingerPower(DEFAULT_SCHROEDINGER_CONFIG.schroedingerPower)}
            showValue
            data-testid="schroedinger-power-slider"
          />
          <p className="text-xs text-text-tertiary">
            {dimension === 3
              ? 'Controls the shape of the 3D Schroedinger fractal'
              : `Controls the shape of the ${dimension}D Schroedinger fractal`}
          </p>
        </div>
      )}

      {/* Slice Parameters - shown for 4D+ */}
      {dimension >= 4 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs text-text-secondary">
              Slice Parameters ({dimension - 3} dim{dimension > 4 ? 's' : ''})
            </label>
            <button
              onClick={() => resetSchroedingerParameters()}
              className="text-xs text-accent hover:underline"
              data-testid="schroedinger-reset-params"
            >
              Reset
            </button>
          </div>
          {Array.from({ length: dimension - 3 }, (_, i) => (
            <Slider
              key={`slice-dim-${i + 3}`}
              label={`Dim ${i + 3}`}
              min={-2.0}
              max={2.0}
              step={0.1}
              value={config.parameterValues[i] ?? 0}
              onChange={(v) => setSchroedingerParameterValue(i, v)}
              onReset={() => setSchroedingerParameterValue(i, 0)}
              showValue
              data-testid={`schroedinger-slice-dim-${i + 3}`}
            />
          ))}
          <p className="text-xs text-text-tertiary">
            Explore different {dimension}D cross-sections
          </p>
        </div>
      )}

      {/* Render Mode Info */}
      <div className="text-xs text-text-secondary border-t border-white/10 pt-2">
        <p>Rendering: GPU Ray Marching</p>
      </div>
    </div>
  );
});
