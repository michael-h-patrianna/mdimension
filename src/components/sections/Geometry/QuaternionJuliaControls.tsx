/**
 * QuaternionJuliaControls Component
 *
 * Controls for configuring n-dimensional Quaternion Julia fractal visualization.
 *
 * Features:
 * - Julia constant controls with presets (4D quaternion components)
 * - Power slider (quadratic to octave)
 * - Max iterations slider
 * - Bailout radius slider
 * - Scale parameter for auto-positioning
 * - Slice parameters for 4D+ dimensions
 * - Animation controls (Julia constant animation, power morphing, origin drift)
 *
 * The Quaternion Julia fractal uses the iteration z = z^n + c where c is a
 * fixed constant (unlike Mandelbrot where c varies with sample position).
 *
 * @see docs/prd/quaternion-julia-fractal.md
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { Switch } from '@/components/ui/Switch';
import {
  DEFAULT_QUATERNION_JULIA_CONFIG,
  JULIA_CONSTANT_PRESETS,
} from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

/**
 * Props for the QuaternionJuliaControls component.
 */
export interface QuaternionJuliaControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
  className?: string;
}

/**
 * Power presets for common Julia configurations
 */
const powerPresets = [
  { value: 2, label: 'Quadratic' },
  { value: 3, label: 'Cubic' },
  { value: 4, label: 'Quartic' },
  { value: 8, label: 'Octave' },
];

/**
 * Quality preset options
 */
const qualityOptions = [
  { value: 'draft', label: 'Draft (Fast)' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High Quality' },
  { value: 'ultra', label: 'Ultra (Slow)' },
];

/**
 * QuaternionJuliaControls component
 *
 * Provides controls for Quaternion Julia fractal generation:
 * - Julia constant (4D quaternion with presets)
 * - Power parameter (affects fractal shape)
 * - Iteration count and bailout radius
 * - Scale for auto-positioning
 * - Slice parameters for higher dimensions
 * - Animation controls
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 * @returns React component
 */
export const QuaternionJuliaControls: React.FC<QuaternionJuliaControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const {
    config,
    setJuliaConstant,
    setPower,
    setMaxIterations,
    setBailoutRadius,
    setScale,
    setQualityPreset,
    setParameterValue,
    resetParameters,
    setConstantAnimationEnabled,
    setConstantAnimationAmplitude,
    setConstantAnimationFrequency,
    setPowerAnimationEnabled,
    setPowerAnimationMinPower,
    setPowerAnimationMaxPower,
    setPowerAnimationSpeed,
    setOriginDriftEnabled,
    setOriginDriftAmplitude,
    setOriginDriftBaseFrequency,
    setDimensionMixEnabled,
    setMixIntensity,
    setMixFrequency,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.quaternionJulia,
      setJuliaConstant: state.setQuaternionJuliaConstant,
      setPower: state.setQuaternionJuliaPower,
      setMaxIterations: state.setQuaternionJuliaMaxIterations,
      setBailoutRadius: state.setQuaternionJuliaBailoutRadius,
      setScale: state.setQuaternionJuliaScale,
      setQualityPreset: state.setQuaternionJuliaQualityPreset,
      setParameterValue: state.setQuaternionJuliaParameterValue,
      resetParameters: state.resetQuaternionJuliaParameters,
      setConstantAnimationEnabled: state.setQuaternionJuliaConstantAnimationEnabled,
      setConstantAnimationAmplitude: state.setQuaternionJuliaConstantAnimationAmplitude,
      setConstantAnimationFrequency: state.setQuaternionJuliaConstantAnimationFrequency,
      setPowerAnimationEnabled: state.setQuaternionJuliaPowerAnimationEnabled,
      setPowerAnimationMinPower: state.setQuaternionJuliaPowerAnimationMinPower,
      setPowerAnimationMaxPower: state.setQuaternionJuliaPowerAnimationMaxPower,
      setPowerAnimationSpeed: state.setQuaternionJuliaPowerAnimationSpeed,
      setOriginDriftEnabled: state.setQuaternionJuliaOriginDriftEnabled,
      setOriginDriftAmplitude: state.setQuaternionJuliaOriginDriftAmplitude,
      setOriginDriftBaseFrequency: state.setQuaternionJuliaOriginDriftBaseFrequency,
      setDimensionMixEnabled: state.setQuaternionJuliaDimensionMixEnabled,
      setMixIntensity: state.setQuaternionJuliaMixIntensity,
      setMixFrequency: state.setQuaternionJuliaMixFrequency,
    }))
  );

  // Get current dimension for slice parameters
  const dimension = useGeometryStore((state) => state.dimension);

  // Helper to check if current constant matches a preset
  const getCurrentPresetIndex = (): number => {
    const [x, y, z, w] = config.juliaConstant;
    return JULIA_CONSTANT_PRESETS.findIndex(
      (p) =>
        Math.abs(p.value[0] - x) < 0.001 &&
        Math.abs(p.value[1] - y) < 0.001 &&
        Math.abs(p.value[2] - z) < 0.001 &&
        Math.abs(p.value[3] - w) < 0.001
    );
  };

  const currentPresetIndex = getCurrentPresetIndex();

  return (
    <div className={`space-y-4 ${className}`} data-testid="quaternion-julia-controls">
      {/* Julia Constant Presets */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Julia Constant (c)
        </label>
        <Select
          label=""
          options={JULIA_CONSTANT_PRESETS.map((p, i) => ({
            value: String(i),
            label: p.name,
          }))}
          value={currentPresetIndex >= 0 ? String(currentPresetIndex) : '-1'}
          onChange={(v) => {
            const idx = parseInt(v, 10);
            if (idx >= 0 && idx < JULIA_CONSTANT_PRESETS.length) {
              setJuliaConstant(JULIA_CONSTANT_PRESETS[idx].value);
            }
          }}
          data-testid="julia-constant-preset"
        />
        <div className="grid grid-cols-2 gap-2">
          <Slider
            label="X"
            min={-2.0}
            max={2.0}
            step={0.01}
            value={config.juliaConstant[0]}
            onChange={(v) => setJuliaConstant([v, config.juliaConstant[1], config.juliaConstant[2], config.juliaConstant[3]])}
            onReset={() => setJuliaConstant([DEFAULT_QUATERNION_JULIA_CONFIG.juliaConstant[0], config.juliaConstant[1], config.juliaConstant[2], config.juliaConstant[3]])}
            showValue
            data-testid="julia-constant-x"
          />
          <Slider
            label="Y"
            min={-2.0}
            max={2.0}
            step={0.01}
            value={config.juliaConstant[1]}
            onChange={(v) => setJuliaConstant([config.juliaConstant[0], v, config.juliaConstant[2], config.juliaConstant[3]])}
            onReset={() => setJuliaConstant([config.juliaConstant[0], DEFAULT_QUATERNION_JULIA_CONFIG.juliaConstant[1], config.juliaConstant[2], config.juliaConstant[3]])}
            showValue
            data-testid="julia-constant-y"
          />
          <Slider
            label="Z"
            min={-2.0}
            max={2.0}
            step={0.01}
            value={config.juliaConstant[2]}
            onChange={(v) => setJuliaConstant([config.juliaConstant[0], config.juliaConstant[1], v, config.juliaConstant[3]])}
            onReset={() => setJuliaConstant([config.juliaConstant[0], config.juliaConstant[1], DEFAULT_QUATERNION_JULIA_CONFIG.juliaConstant[2], config.juliaConstant[3]])}
            showValue
            data-testid="julia-constant-z"
          />
          <Slider
            label="W"
            min={-2.0}
            max={2.0}
            step={0.01}
            value={config.juliaConstant[3]}
            onChange={(v) => setJuliaConstant([config.juliaConstant[0], config.juliaConstant[1], config.juliaConstant[2], v])}
            onReset={() => setJuliaConstant([config.juliaConstant[0], config.juliaConstant[1], config.juliaConstant[2], DEFAULT_QUATERNION_JULIA_CONFIG.juliaConstant[3]])}
            showValue
            data-testid="julia-constant-w"
          />
        </div>
        <p className="text-xs text-text-tertiary">
          The fixed constant c in z = z^n + c
        </p>
      </div>

      {/* Power Control */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Power (n={config.power})
        </label>
        <ToggleGroup
          options={powerPresets.map((p) => ({
            value: String(p.value),
            label: p.label,
          }))}
          value={String(config.power)}
          onChange={(v) => setPower(parseInt(v, 10))}
          ariaLabel="Power preset"
          data-testid="julia-power-preset"
        />
        <Slider
          label="Custom Power"
          min={2}
          max={8}
          step={1}
          value={config.power}
          onChange={setPower}
          onReset={() => setPower(DEFAULT_QUATERNION_JULIA_CONFIG.power)}
          showValue
          data-testid="julia-power-slider"
        />
      </div>

      {/* Quality Preset */}
      <Select
        label="Quality Preset"
        options={qualityOptions}
        value={
          config.maxIterations <= 32 ? 'draft' :
          config.maxIterations <= 64 ? 'standard' :
          config.maxIterations <= 128 ? 'high' : 'ultra'
        }
        onChange={(v) => setQualityPreset(v as 'draft' | 'standard' | 'high' | 'ultra')}
        data-testid="julia-quality"
      />

      {/* Max Iterations */}
      <Slider
        label="Max Iterations"
        min={32}
        max={256}
        step={16}
        value={config.maxIterations}
        onChange={setMaxIterations}
        onReset={() => setMaxIterations(DEFAULT_QUATERNION_JULIA_CONFIG.maxIterations)}
        showValue
        data-testid="julia-iterations"
      />

      {/* Bailout Radius */}
      <Slider
        label="Bailout Radius"
        min={2.0}
        max={16.0}
        step={0.5}
        value={config.bailoutRadius}
        onChange={setBailoutRadius}
        onReset={() => setBailoutRadius(DEFAULT_QUATERNION_JULIA_CONFIG.bailoutRadius)}
        showValue
        data-testid="julia-bailout"
      />

      {/* Scale */}
      <Slider
        label="Scale"
        min={0.5}
        max={5.0}
        step={0.1}
        value={config.scale}
        onChange={setScale}
        onReset={() => setScale(DEFAULT_QUATERNION_JULIA_CONFIG.scale)}
        showValue
        data-testid="julia-scale"
      />

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
              data-testid="julia-reset-params"
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
              data-testid={`julia-slice-dim-${i + 3}`}
            />
          ))}
          <p className="text-xs text-text-tertiary">
            Explore different {dimension}D cross-sections
          </p>
        </div>
      )}

      {/* Animation Section */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <label className="text-xs text-text-secondary font-medium">Animation</label>

        {/* Julia Constant Animation */}
        <div className="space-y-2">
          <Switch
            checked={config.juliaConstantAnimation.enabled}
            onCheckedChange={setConstantAnimationEnabled}
            label="Julia Constant Animation"
            data-testid="julia-constant-animation-toggle"
          />
          {config.juliaConstantAnimation.enabled && (
            <div className="pl-4 space-y-2">
              <Slider
                label="Amplitude"
                min={0.01}
                max={0.5}
                step={0.01}
                value={config.juliaConstantAnimation.amplitude[0]}
                onChange={(v) => setConstantAnimationAmplitude([v, v, v, v])}
                showValue
                data-testid="julia-constant-amplitude"
              />
              <Slider
                label="Frequency"
                min={0.01}
                max={0.2}
                step={0.01}
                value={config.juliaConstantAnimation.frequency[0]}
                onChange={(v) => setConstantAnimationFrequency([v, v * 0.8, v * 1.2, v * 0.6])}
                showValue
                data-testid="julia-constant-frequency"
              />
            </div>
          )}
        </div>

        {/* Power Animation */}
        <div className="space-y-2">
          <Switch
            checked={config.powerAnimation.enabled}
            onCheckedChange={setPowerAnimationEnabled}
            label="Power Morphing"
            data-testid="julia-power-animation-toggle"
          />
          {config.powerAnimation.enabled && (
            <div className="pl-4 space-y-2">
              <Slider
                label="Min Power"
                min={2}
                max={6}
                step={0.5}
                value={config.powerAnimation.minPower}
                onChange={setPowerAnimationMinPower}
                showValue
                data-testid="julia-power-min"
              />
              <Slider
                label="Max Power"
                min={4}
                max={8}
                step={0.5}
                value={config.powerAnimation.maxPower}
                onChange={setPowerAnimationMaxPower}
                showValue
                data-testid="julia-power-max"
              />
              <Slider
                label="Speed"
                min={0.01}
                max={0.1}
                step={0.005}
                value={config.powerAnimation.speed}
                onChange={setPowerAnimationSpeed}
                showValue
                data-testid="julia-power-speed"
              />
            </div>
          )}
        </div>

        {/* Origin Drift (4D+) */}
        {dimension >= 4 && (
          <div className="space-y-2">
            <Switch
              checked={config.originDriftEnabled}
              onCheckedChange={setOriginDriftEnabled}
              label="Origin Drift"
              data-testid="julia-origin-drift-toggle"
            />
            {config.originDriftEnabled && (
              <div className="pl-4 space-y-2">
                <Slider
                  label="Amplitude"
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  value={config.originDriftAmplitude}
                  onChange={setOriginDriftAmplitude}
                  showValue
                  data-testid="julia-drift-amplitude"
                />
                <Slider
                  label="Base Frequency"
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  value={config.originDriftBaseFrequency}
                  onChange={setOriginDriftBaseFrequency}
                  showValue
                  data-testid="julia-drift-frequency"
                />
              </div>
            )}
          </div>
        )}

        {/* Dimension Mixing (4D+) */}
        {dimension >= 4 && (
          <div className="space-y-2">
            <Switch
              checked={config.dimensionMixEnabled}
              onCheckedChange={setDimensionMixEnabled}
              label="Dimension Mixing"
              data-testid="julia-dimension-mix-toggle"
            />
            {config.dimensionMixEnabled && (
              <div className="pl-4 space-y-2">
                <Slider
                  label="Intensity"
                  min={0.0}
                  max={0.3}
                  step={0.01}
                  value={config.mixIntensity}
                  onChange={setMixIntensity}
                  showValue
                  data-testid="julia-mix-intensity"
                />
                <Slider
                  label="Frequency"
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  value={config.mixFrequency}
                  onChange={setMixFrequency}
                  showValue
                  data-testid="julia-mix-frequency"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-text-secondary space-y-1 border-t border-white/10 pt-2">
        <p>Rendering: GPU Ray Marching</p>
        <p className="text-text-tertiary">
          {dimension}D Quaternion Julia fractal (z = z^{config.power} + c)
        </p>
      </div>
    </div>
  );
});
