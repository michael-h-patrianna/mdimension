/**
 * MandelboxControls Component
 *
 * Controls for configuring n-dimensional Mandelbox fractal visualization.
 *
 * Features:
 * - Scale slider (controls overall fractal shape)
 * - Folding limit slider (box fold parameter)
 * - Min/Fixed radius sliders (sphere fold parameters)
 * - Max iterations slider
 * - Escape radius slider
 * - Slice parameters for 4D+ dimensions
 *
 * The Mandelbox uses box-fold + sphere-fold operations that generalize
 * to any dimension, producing intricate fractal structures.
 *
 * @see docs/prd/mandelbox.md
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { DEFAULT_MANDELBOX_CONFIG } from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

/**
 * Props for the MandelboxControls component.
 */
export interface MandelboxControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
  className?: string;
}

/**
 * Scale presets for common Mandelbox configurations
 */
const scalePresets = [
  { value: -2.0, label: 'Sharp' },
  { value: -1.5, label: 'Classic' },
  { value: -1.0, label: 'Soft' },
  { value: 2.0, label: 'Inverted' },
];

/**
 * MandelboxControls component
 *
 * Provides controls for Mandelbox fractal generation:
 * - Scale parameter (affects overall fractal shape)
 * - Folding limit (box fold threshold)
 * - Min/Fixed radius (sphere fold parameters)
 * - Iteration count and escape radius
 * - Slice parameters for higher dimensions
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 * @returns React component
 */
export const MandelboxControls: React.FC<MandelboxControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const {
    config,
    setScale,
    setFoldingLimit,
    setMinRadius,
    setFixedRadius,
    setMaxIterations,
    setEscapeRadius,
    setIterationRotation,
    setParameterValue,
    resetParameters,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.mandelbox,
      setScale: state.setMandelboxScale,
      setFoldingLimit: state.setMandelboxFoldingLimit,
      setMinRadius: state.setMandelboxMinRadius,
      setFixedRadius: state.setMandelboxFixedRadius,
      setMaxIterations: state.setMandelboxMaxIterations,
      setEscapeRadius: state.setMandelboxEscapeRadius,
      setIterationRotation: state.setMandelboxIterationRotation,
      setParameterValue: state.setMandelboxParameterValue,
      resetParameters: state.resetMandelboxParameters,
    }))
  );

  // Get current dimension for slice parameters
  const dimension = useGeometryStore((state) => state.dimension);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Scale Control */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Scale ({config.scale.toFixed(2)})
        </label>
        <ToggleGroup
          options={scalePresets.map((p) => ({
            value: String(p.value),
            label: p.label,
          }))}
          value={String(config.scale)}
          onChange={(v) => setScale(parseFloat(v))}
          ariaLabel="Scale preset"
        />
        <Slider
          label="Custom Scale"
          min={-3.0}
          max={3.0}
          step={0.1}
          value={config.scale}
          onChange={setScale}
          onReset={() => setScale(DEFAULT_MANDELBOX_CONFIG.scale)}
          showValue
        />
        <p className="text-xs text-text-tertiary">
          Negative values create intricate box-like fractals
        </p>
      </div>

      {/* Folding Limit */}
      <Slider
        label="Folding Limit"
        min={0.5}
        max={2.0}
        step={0.05}
        value={config.foldingLimit}
        onChange={setFoldingLimit}
        onReset={() => setFoldingLimit(DEFAULT_MANDELBOX_CONFIG.foldingLimit)}
        showValue
      />

      {/* Sphere Fold Parameters */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">Sphere Fold Radii</label>
        <Slider
          label="Min Radius"
          min={0.1}
          max={1.0}
          step={0.05}
          value={config.minRadius}
          onChange={setMinRadius}
          onReset={() => setMinRadius(DEFAULT_MANDELBOX_CONFIG.minRadius)}
          showValue
        />
        <Slider
          label="Fixed Radius"
          min={0.5}
          max={2.0}
          step={0.05}
          value={config.fixedRadius}
          onChange={setFixedRadius}
          onReset={() => setFixedRadius(DEFAULT_MANDELBOX_CONFIG.fixedRadius)}
          showValue
        />
        <p className="text-xs text-text-tertiary">
          Controls sphere inversion behavior
        </p>
      </div>

      {/* Iteration Control */}
      <Slider
        label="Max Iterations"
        min={10}
        max={100}
        step={5}
        value={config.maxIterations}
        onChange={setMaxIterations}
        onReset={() => setMaxIterations(DEFAULT_MANDELBOX_CONFIG.maxIterations)}
        showValue
      />

      {/* Escape Radius */}
      <Slider
        label="Escape Radius"
        min={4.0}
        max={100.0}
        step={2.0}
        value={config.escapeRadius}
        onChange={setEscapeRadius}
        onReset={() => setEscapeRadius(DEFAULT_MANDELBOX_CONFIG.escapeRadius)}
        showValue
      />

      {/* Iteration Rotation - key for N-D structure in 4D+ */}
      {dimension >= 4 && (
        <div className="space-y-2">
          <Slider
            label="Iteration Rotation"
            min={0.0}
            max={0.5}
            step={0.01}
            value={config.iterationRotation}
            onChange={setIterationRotation}
            onReset={() => setIterationRotation(DEFAULT_MANDELBOX_CONFIG.iterationRotation)}
            showValue
          />
          <p className="text-xs text-text-tertiary">
            Creates genuine {dimension}D structure by mixing dimensions during iteration.
            Higher values produce more interdimensional mixing.
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
              onClick={() => resetParameters()}
              className="text-xs text-accent hover:underline"
            >
              Reset
            </button>
          </div>
          {Array.from({ length: dimension - 3 }, (_, i) => (
            <Slider
              key={`slice-dim-${i + 3}`}
              label={`Dim ${i + 4}`}
              min={-2.0}
              max={2.0}
              step={0.1}
              value={config.parameterValues[i] ?? 0}
              onChange={(v) => setParameterValue(i, v)}
              onReset={() => setParameterValue(i, 0)}
              showValue
            />
          ))}
          <p className="text-xs text-text-tertiary">
            Explore different {dimension}D cross-sections
          </p>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-text-secondary space-y-1 border-t border-white/10 pt-2">
        <p>Rendering: GPU Ray Marching</p>
        <p className="text-text-tertiary">
          {dimension}D Mandelbox fractal
        </p>
      </div>
    </div>
  );
});
