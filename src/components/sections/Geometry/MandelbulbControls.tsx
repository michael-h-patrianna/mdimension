/**
 * MandelbulbControls Component
 *
 * Controls for configuring n-dimensional Mandelbulb fractal visualization.
 * Mandelbulb uses GPU raymarching exclusively.
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
import { Section } from '@/components/sections/Section';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React from 'react';

/**
 * Props for the MandelbulbControls component.
 */
export interface MandelbulbControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
  className?: string;
}

/**
 * Mandelbulb power presets
 */
const powerPresets = [
  { value: 3, label: 'Flower' },
  { value: 4, label: 'Quad' },
  { value: 8, label: 'Classic' },
  { value: 12, label: 'Spiky' },
];

/**
 * MandelbulbControls component
 *
 * Provides controls for Mandelbulb GPU raymarching:
 * - Iteration count adjustment
 * - Escape radius adjustment
 * - Power presets and slider
 * - Slice parameters for 4D+
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 * @returns React component
 */
export const MandelbulbControls: React.FC<MandelbulbControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const extendedObjectSelector = useShallow((state: any) => ({
    config: state.mandelbulb,
    setMaxIterations: state.setMandelbulbMaxIterations,
    setEscapeRadius: state.setMandelbulbEscapeRadius,
    setMandelbulbPower: state.setMandelbulbMandelbulbPower,
    setMandelbulbParameterValue: state.setMandelbulbParameterValue,
    resetMandelbulbParameters: state.resetMandelbulbParameters,
  }));
  const {
    config,
    setMaxIterations,
    setEscapeRadius,
    setMandelbulbPower,
    setMandelbulbParameterValue,
    resetMandelbulbParameters,
  } = useExtendedObjectStore(extendedObjectSelector);

  // Get current dimension to show/hide dimension-specific controls
  const dimension = useGeometryStore((state) => state.dimension);

  return (
    <div className={className} data-testid="mandelbulb-controls">
        <Section title="Parameters" defaultOpen={true}>
            {/* Max Iterations */}
            <Slider
            label="Max Iterations"
            min={10}
            max={500}
            step={10}
            value={config.maxIterations}
            onChange={setMaxIterations}
            showValue
            data-testid="mandelbulb-iterations"
            />

            {/* Escape Radius */}
            <Slider
            label={dimension >= 4 ? 'Escape Radius (8+ recommended for 4D+)' : 'Escape Radius'}
            min={2.0}
            max={16.0}
            step={0.5}
            value={config.escapeRadius}
            onChange={setEscapeRadius}
            showValue
            data-testid="mandelbulb-escape-radius"
            />

            {/* Power Control (shown for 3D+ Mandelbulb) */}
            {dimension >= 3 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-xs text-text-secondary">
                Mandelbulb Power (n={config.mandelbulbPower})
                </label>
                <ToggleGroup
                options={powerPresets.map((p) => ({
                    value: String(p.value),
                    label: p.label,
                }))}
                value={String(config.mandelbulbPower)}
                onChange={(v) => setMandelbulbPower(parseInt(v, 10))}
                ariaLabel="Mandelbulb power preset"
                data-testid="mandelbulb-power-preset"
                />
                <Slider
                label="Custom Power"
                min={2}
                max={16}
                step={1}
                value={config.mandelbulbPower}
                onChange={setMandelbulbPower}
                showValue
                data-testid="mandelbulb-power-slider"
                />
                <p className="text-xs text-text-tertiary">
                {dimension === 3
                    ? 'Controls the shape of the 3D Mandelbulb fractal'
                    : `Controls the shape of the ${dimension}D Mandelbulb fractal`}
                </p>
            </div>
            )}
        </Section>

        {/* Slice Parameters - shown for 4D+ */}
        {dimension >= 4 && (
            <Section 
            title={`Cross Section (${dimension - 3} dim${dimension > 4 ? 's' : ''})`}
            defaultOpen={true}
            onReset={() => resetMandelbulbParameters()}
            >
            {Array.from({ length: dimension - 3 }, (_, i) => (
                <Slider
                key={`slice-dim-${i + 3}`}
                label={`Dim ${i + 3}`}
                min={-2.0}
                max={2.0}
                step={0.1}
                value={config.parameterValues[i] ?? 0}
                onChange={(v) => setMandelbulbParameterValue(i, v)}
                showValue
                data-testid={`mandelbulb-slice-dim-${i + 3}`}
                />
            ))}
            <p className="text-xs text-text-tertiary">
                Explore different {dimension}D cross-sections
            </p>
            </Section>
        )}

      {/* Render Mode Info */}
      <div className="px-4 py-2 text-xs text-text-secondary border-t border-white/5">
        <p>Rendering: GPU Ray Marching</p>
      </div>
    </div>
  );
});
