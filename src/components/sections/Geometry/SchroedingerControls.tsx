/**
 * SchroedingerControls Component
 *
 * Controls for configuring n-dimensional quantum wavefunction visualization.
 * Schroedinger uses volumetric rendering of harmonic oscillator superpositions.
 *
 * Features:
 * - Preset selection (Organic Blob, Quantum Foam, etc.)
 * - Quantum parameter controls (seed, term count, max quantum number)
 * - Volume rendering settings (time scale, density gain, samples)
 * - Isosurface mode toggle
 * - Slice parameters for 4D+
 */

import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { DEFAULT_SCHROEDINGER_CONFIG, SchroedingerPresetName } from '@/lib/geometry/extended/types';
import { SCHROEDINGER_NAMED_PRESETS } from '@/lib/geometry/extended/schroedinger/presets';
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
 * Preset options for toggle group
 */
const presetOptions = Object.entries(SCHROEDINGER_NAMED_PRESETS).map(([key, preset]) => ({
  value: key,
  label: preset.name,
  description: preset.description,
}));

/**
 * SchroedingerControls component
 *
 * Provides controls for quantum wavefunction visualization:
 * - Preset selection for different quantum states
 * - Quantum parameter controls
 * - Volume rendering settings
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
    setPresetName,
    setSeed,
    randomizeSeed,
    setTermCount,
    setMaxQuantumNumber,
    setFrequencySpread,
    setTimeScale,
    setFieldScale,
    setDensityGain,
    setSampleCount,
    setIsoEnabled,
    setIsoThreshold,
    setSchroedingerParameterValue,
    resetSchroedingerParameters,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.schroedinger,
      setPresetName: state.setSchroedingerPresetName,
      setSeed: state.setSchroedingerSeed,
      randomizeSeed: state.randomizeSchroedingerSeed,
      setTermCount: state.setSchroedingerTermCount,
      setMaxQuantumNumber: state.setSchroedingerMaxQuantumNumber,
      setFrequencySpread: state.setSchroedingerFrequencySpread,
      setTimeScale: state.setSchroedingerTimeScale,
      setFieldScale: state.setSchroedingerFieldScale,
      setDensityGain: state.setSchroedingerDensityGain,
      setSampleCount: state.setSchroedingerSampleCount,
      setIsoEnabled: state.setSchroedingerIsoEnabled,
      setIsoThreshold: state.setSchroedingerIsoThreshold,
      setSchroedingerParameterValue: state.setSchroedingerParameterValue,
      resetSchroedingerParameters: state.resetSchroedingerParameters,
    }))
  );

  // Get current dimension to show/hide dimension-specific controls
  const dimension = useGeometryStore((state) => state.dimension);

  return (
    <div className={`space-y-4 ${className}`} data-testid="schroedinger-controls">

      {/* Quantum Preset Selection */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Quantum Preset
        </label>
        <ToggleGroup
          options={presetOptions.slice(0, 4).map((p) => ({
            value: p.value,
            label: p.label,
          }))}
          value={config.presetName}
          onChange={(v) => setPresetName(v as SchroedingerPresetName)}
          ariaLabel="Quantum preset selection"
          data-testid="schroedinger-preset-group-1"
        />
        <ToggleGroup
          options={presetOptions.slice(4).map((p) => ({
            value: p.value,
            label: p.label,
          }))}
          value={config.presetName}
          onChange={(v) => setPresetName(v as SchroedingerPresetName)}
          ariaLabel="Quantum preset selection (continued)"
          data-testid="schroedinger-preset-group-2"
        />
        <p className="text-xs text-text-tertiary">
          {SCHROEDINGER_NAMED_PRESETS[config.presetName]?.description ?? 'Custom quantum configuration'}
        </p>
      </div>

      {/* Seed Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-text-secondary">
            Seed: {config.seed}
          </label>
          <button
            onClick={() => randomizeSeed()}
            className="text-xs text-accent hover:underline"
            data-testid="schroedinger-randomize-seed"
          >
            Randomize
          </button>
        </div>
        <Slider
          label="Seed"
          min={0}
          max={999999}
          step={1}
          value={config.seed}
          onChange={setSeed}
          onReset={() => setSeed(DEFAULT_SCHROEDINGER_CONFIG.seed)}
          showValue={false}
          data-testid="schroedinger-seed-slider"
        />
      </div>

      {/* Quantum Parameters */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
          Quantum State
        </label>

        <Slider
          label="Superposition Terms"
          min={1}
          max={8}
          step={1}
          value={config.termCount}
          onChange={setTermCount}
          onReset={() => setTermCount(DEFAULT_SCHROEDINGER_CONFIG.termCount)}
          showValue
          data-testid="schroedinger-term-count"
        />

        <Slider
          label="Max Quantum Number (n)"
          min={2}
          max={6}
          step={1}
          value={config.maxQuantumNumber}
          onChange={setMaxQuantumNumber}
          onReset={() => setMaxQuantumNumber(DEFAULT_SCHROEDINGER_CONFIG.maxQuantumNumber)}
          showValue
          data-testid="schroedinger-max-quantum"
        />

        <Slider
          label="Frequency Spread"
          min={0}
          max={0.1}
          step={0.001}
          value={config.frequencySpread}
          onChange={setFrequencySpread}
          onReset={() => setFrequencySpread(DEFAULT_SCHROEDINGER_CONFIG.frequencySpread)}
          showValue
          data-testid="schroedinger-freq-spread"
        />
      </div>

      {/* Volume Rendering Parameters */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
          Volume Rendering
        </label>

        <Slider
          label="Time Scale"
          min={0.1}
          max={2.0}
          step={0.1}
          value={config.timeScale}
          onChange={setTimeScale}
          onReset={() => setTimeScale(DEFAULT_SCHROEDINGER_CONFIG.timeScale)}
          showValue
          data-testid="schroedinger-time-scale"
        />

        <Slider
          label="Field Scale"
          min={0.5}
          max={2.0}
          step={0.1}
          value={config.fieldScale}
          onChange={setFieldScale}
          onReset={() => setFieldScale(DEFAULT_SCHROEDINGER_CONFIG.fieldScale)}
          showValue
          data-testid="schroedinger-field-scale"
        />

        <Slider
          label="Density Gain"
          min={0.1}
          max={5.0}
          step={0.1}
          value={config.densityGain}
          onChange={setDensityGain}
          onReset={() => setDensityGain(DEFAULT_SCHROEDINGER_CONFIG.densityGain)}
          showValue
          data-testid="schroedinger-density-gain"
        />

        <Slider
          label="Sample Count"
          min={32}
          max={128}
          step={8}
          value={config.sampleCount}
          onChange={setSampleCount}
          onReset={() => setSampleCount(DEFAULT_SCHROEDINGER_CONFIG.sampleCount)}
          showValue
          data-testid="schroedinger-sample-count"
        />
      </div>

      {/* Isosurface Mode */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-text-secondary">
            Isosurface Mode
          </label>
          <ToggleButton
            pressed={config.isoEnabled}
            onToggle={() => setIsoEnabled(!config.isoEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle isosurface mode"
            data-testid="schroedinger-iso-toggle"
          >
            {config.isoEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>
        {config.isoEnabled && (
          <Slider
            label="Iso Threshold (log)"
            min={-6}
            max={0}
            step={0.1}
            value={config.isoThreshold}
            onChange={setIsoThreshold}
            onReset={() => setIsoThreshold(DEFAULT_SCHROEDINGER_CONFIG.isoThreshold)}
            showValue
            data-testid="schroedinger-iso-threshold"
          />
        )}
        <p className="text-xs text-text-tertiary">
          {config.isoEnabled
            ? 'Sharp surface at constant probability density'
            : 'Volumetric cloud visualization'
          }
        </p>
      </div>

      {/* Slice Parameters - shown for 4D+ */}
      {dimension >= 4 && (
        <div className="space-y-3 border-t border-white/10 pt-3">
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
        <p>Rendering: Volumetric (Beer-Lambert)</p>
      </div>
    </div>
  );
});
