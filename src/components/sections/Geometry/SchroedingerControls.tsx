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
import { Section } from '@/components/sections/Section';
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
    <div className={className} data-testid="schroedinger-controls">
      <Section title="Quantum State" defaultOpen={true}>
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
            showValue={false}
            data-testid="schroedinger-seed-slider"
            />
        </div>

        {/* Quantum Parameters */}
        <Slider
            label="Superposition Terms"
            min={1}
            max={8}
            step={1}
            value={config.termCount}
            onChange={setTermCount}
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
            showValue
            data-testid="schroedinger-freq-spread"
        />
      </Section>

      <Section title="Volume Rendering" defaultOpen={true}>
        <Slider
            label="Time Scale"
            min={0.1}
            max={2.0}
            step={0.1}
            value={config.timeScale}
            onChange={setTimeScale}
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
            showValue
            data-testid="schroedinger-sample-count"
        />

        {/* Isosurface Mode */}
        <div className="space-y-2 pt-2">
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
      </Section>

      {/* Slice Parameters - shown for 4D+ */}
      {dimension >= 4 && (
        <Section title={`Cross Section (${dimension - 3} dim${dimension > 4 ? 's' : ''})`} defaultOpen={true} onReset={() => resetSchroedingerParameters()}>
          {Array.from({ length: dimension - 3 }, (_, i) => (
            <Slider
              key={`slice-dim-${i + 3}`}
              label={`Dim ${i + 3}`}
              min={-2.0}
              max={2.0}
              step={0.1}
              value={config.parameterValues[i] ?? 0}
              onChange={(v) => setSchroedingerParameterValue(i, v)}
              showValue
              data-testid={`schroedinger-slice-dim-${i + 3}`}
            />
          ))}
          <p className="text-xs text-text-tertiary">
            Explore different {dimension}D cross-sections
          </p>
        </Section>
      )}

      {/* Render Mode Info */}
      <div className="px-4 py-2 text-xs text-text-secondary border-t border-white/5">
        <p>Rendering: Volumetric (Beer-Lambert)</p>
      </div>
    </div>
  );
});
