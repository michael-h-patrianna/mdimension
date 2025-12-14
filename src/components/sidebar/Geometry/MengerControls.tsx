/**
 * MengerControls Component
 *
 * Controls for configuring n-dimensional Menger Sponge fractal visualization.
 *
 * Features:
 * - Iterations slider (detail level / recursion depth)
 * - Scale slider (overall size)
 * - Detail presets (Low, Standard, High)
 * - Slice parameters for 4D+ dimensions
 *
 * The Menger Sponge is a geometric IFS fractal that uses KIFS fold operations
 * (absolute value, sort, scale) with a true geometric SDF.
 * It is parameter-light compared to escape-time fractals like Mandelbox.
 *
 * @see docs/prd/menger-sponge.md
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { DEFAULT_MENGER_CONFIG } from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

/**
 * Props for the MengerControls component.
 */
export interface MengerControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
  className?: string;
}

/**
 * Detail presets for Menger Sponge iterations
 */
const detailPresets = [
  { value: 3, label: 'Low' },
  { value: 5, label: 'Standard' },
  { value: 7, label: 'High' },
];

/**
 * MengerControls component
 *
 * Provides controls for Menger Sponge fractal generation:
 * - Iterations (detail level / recursion depth)
 * - Scale (overall size)
 * - Slice parameters for higher dimensions
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 * @returns React component
 */
export const MengerControls: React.FC<MengerControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const {
    config,
    setIterations,
    setScale,
    setParameterValue,
    resetParameters,
    // Fold Twist Animation
    setFoldTwistEnabled,
    setFoldTwistAngle,
    setFoldTwistSpeed,
    // Scale Pulse Animation
    setScalePulseEnabled,
    setScalePulseAmplitude,
    setScalePulseSpeed,
    // Slice Sweep Animation
    setSliceSweepEnabled,
    setSliceSweepAmplitude,
    setSliceSweepSpeed,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.menger,
      setIterations: state.setMengerIterations,
      setScale: state.setMengerScale,
      setParameterValue: state.setMengerParameterValue,
      resetParameters: state.resetMengerParameters,
      // Fold Twist Animation
      setFoldTwistEnabled: state.setMengerFoldTwistEnabled,
      setFoldTwistAngle: state.setMengerFoldTwistAngle,
      setFoldTwistSpeed: state.setMengerFoldTwistSpeed,
      // Scale Pulse Animation
      setScalePulseEnabled: state.setMengerScalePulseEnabled,
      setScalePulseAmplitude: state.setMengerScalePulseAmplitude,
      setScalePulseSpeed: state.setMengerScalePulseSpeed,
      // Slice Sweep Animation
      setSliceSweepEnabled: state.setMengerSliceSweepEnabled,
      setSliceSweepAmplitude: state.setMengerSliceSweepAmplitude,
      setSliceSweepSpeed: state.setMengerSliceSweepSpeed,
    }))
  );

  // Get current dimension for slice parameters
  const dimension = useGeometryStore((state) => state.dimension);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Iterations (Detail Level) */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Detail Level ({config.iterations})
        </label>
        <ToggleGroup
          options={detailPresets.map((p) => ({
            value: String(p.value),
            label: p.label,
          }))}
          value={String(config.iterations)}
          onChange={(v) => setIterations(parseInt(v, 10))}
          ariaLabel="Detail preset"
        />
        <Slider
          label="Custom Detail"
          min={3}
          max={8}
          step={1}
          value={config.iterations}
          onChange={setIterations}
          onReset={() => setIterations(DEFAULT_MENGER_CONFIG.iterations)}
          showValue
        />
        <p className="text-xs text-text-tertiary">
          Higher = finer holes, more computation
        </p>
      </div>

      {/* Scale */}
      <Slider
        label="Scale"
        min={0.5}
        max={2.0}
        step={0.1}
        value={config.scale}
        onChange={setScale}
        onReset={() => setScale(DEFAULT_MENGER_CONFIG.scale)}
        showValue
      />

      {/* Slice Parameters - shown for 4D+ */}
      {dimension >= 4 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs text-text-secondary">
              Slice Position ({dimension - 3} dim{dimension > 4 ? 's' : ''})
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
            Explore different {dimension}D cross-sections of the Menger hypersponge
          </p>
        </div>
      )}

      {/* Fractal Animation Section */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <label className="text-xs text-text-secondary font-medium">
          Fractal Animation
        </label>

        {/* Fold Twist */}
        <div className="space-y-2">
          <Switch
            checked={config.foldTwistEnabled}
            onCheckedChange={setFoldTwistEnabled}
            label="Fold Twist"
            data-testid="fold-twist-toggle"
          />
          {config.foldTwistEnabled && (
            <>
              <Slider
                label="Angle"
                min={-180}
                max={180}
                step={5}
                value={Math.round((config.foldTwistAngle * 180) / Math.PI)}
                onChange={(v) => setFoldTwistAngle((v * Math.PI) / 180)}
                onReset={() => setFoldTwistAngle(DEFAULT_MENGER_CONFIG.foldTwistAngle)}
                showValue
                formatValue={(v) => `${v}°`}
              />
              <Slider
                label="Speed"
                min={0}
                max={2}
                step={0.1}
                value={config.foldTwistSpeed}
                onChange={setFoldTwistSpeed}
                onReset={() => setFoldTwistSpeed(DEFAULT_MENGER_CONFIG.foldTwistSpeed)}
                showValue
              />
            </>
          )}
        </div>

        {/* Scale Pulse */}
        <div className="space-y-2">
          <Switch
            checked={config.scalePulseEnabled}
            onCheckedChange={setScalePulseEnabled}
            label="Scale Pulse"
            data-testid="scale-pulse-toggle"
          />
          {config.scalePulseEnabled && (
            <>
              <Slider
                label="Amplitude"
                min={0}
                max={0.5}
                step={0.05}
                value={config.scalePulseAmplitude}
                onChange={setScalePulseAmplitude}
                onReset={() => setScalePulseAmplitude(DEFAULT_MENGER_CONFIG.scalePulseAmplitude)}
                showValue
              />
              <Slider
                label="Speed"
                min={0}
                max={2}
                step={0.1}
                value={config.scalePulseSpeed}
                onChange={setScalePulseSpeed}
                onReset={() => setScalePulseSpeed(DEFAULT_MENGER_CONFIG.scalePulseSpeed)}
                showValue
              />
            </>
          )}
        </div>

        {/* Slice Sweep - 4D+ only */}
        {dimension >= 4 && (
          <div className="space-y-2">
            <Switch
              checked={config.sliceSweepEnabled}
              onCheckedChange={setSliceSweepEnabled}
              label="Slice Sweep"
              data-testid="slice-sweep-toggle"
            />
            {config.sliceSweepEnabled && (
              <>
                <Slider
                  label="Amplitude"
                  min={0}
                  max={2}
                  step={0.1}
                  value={config.sliceSweepAmplitude}
                  onChange={setSliceSweepAmplitude}
                  onReset={() => setSliceSweepAmplitude(DEFAULT_MENGER_CONFIG.sliceSweepAmplitude)}
                  showValue
                />
                <Slider
                  label="Speed"
                  min={0}
                  max={2}
                  step={0.1}
                  value={config.sliceSweepSpeed}
                  onChange={setSliceSweepSpeed}
                  onReset={() => setSliceSweepSpeed(DEFAULT_MENGER_CONFIG.sliceSweepSpeed)}
                  showValue
                />
              </>
            )}
            <p className="text-xs text-text-tertiary">
              Auto-animate through {dimension}D slices
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-text-secondary space-y-1 border-t border-white/10 pt-2">
        <p>Rendering: GPU Ray Marching (KIFS)</p>
        <p className="text-text-tertiary">
          {dimension}D Menger Sponge
        </p>
        <p className="text-text-tertiary text-[10px]">
          True geometric SDF via Kaleidoscopic IFS folds
        </p>
      </div>
    </div>
  );
});
