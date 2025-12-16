/**
 * KaliControls Component
 *
 * Controls for configuring n-dimensional Kali reciprocal fractal visualization.
 * Animation controls are located in the TimelineControls drawer (FractalAnimationDrawer).
 *
 * Features:
 * - Kali constant controls with presets
 * - Reciprocal gain slider
 * - Axis weights for asymmetric fractal shapes
 * - Max iterations slider
 * - Bailout radius slider
 * - Epsilon for numerical precision
 * - Scale parameter for auto-positioning
 * - Slice parameters for 4D+ dimensions
 *
 * The Kali fractal uses the iteration z = abs(z) / dot(z,z) + c where c is a
 * fixed constant. The reciprocal operation creates intricate, infinitely
 * detailed structures.
 *
 * @see docs/prd/kali-reciprocal-fractal.md
 * @see FractalAnimationDrawer for animation controls
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import {
  DEFAULT_KALI_CONFIG,
  KALI_CONSTANT_PRESETS,
} from '@/lib/geometry/extended/types';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';

/**
 * Props for the KaliControls component.
 */
export interface KaliControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
  className?: string;
}

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
 * KaliControls component
 *
 * Provides controls for Kali fractal generation:
 * - Kali constant (with presets)
 * - Reciprocal gain (affects scaling in reciprocal operation)
 * - Axis weights (create asymmetric structures)
 * - Iteration count and bailout radius
 * - Epsilon for numerical precision
 * - Scale for auto-positioning
 * - Slice parameters for higher dimensions
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 * @returns React component
 */
export const KaliControls: React.FC<KaliControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const {
    config,
    setKaliConstant,
    setKaliConstantComponent,
    setReciprocalGain,
    setAxisWeight,
    setMaxIterations,
    setBailoutRadius,
    setEpsilon,
    setScale,
    setQualityPreset,
    setParameterValue,
    resetParameters,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.kali,
      setKaliConstant: state.setKaliConstant,
      setKaliConstantComponent: state.setKaliConstantComponent,
      setReciprocalGain: state.setKaliReciprocalGain,
      setAxisWeight: state.setKaliAxisWeight,
      setMaxIterations: state.setKaliMaxIterations,
      setBailoutRadius: state.setKaliBailoutRadius,
      setEpsilon: state.setKaliEpsilon,
      setScale: state.setKaliScale,
      setQualityPreset: state.setKaliQualityPreset,
      setParameterValue: state.setKaliParameterValue,
      resetParameters: state.resetKaliParameters,
    }))
  );

  // Get current dimension for slice parameters and axis weights
  const dimension = useGeometryStore((state) => state.dimension);

  // Helper to check if current constant matches a preset
  const getCurrentPresetIndex = (): number => {
    const c = config.kaliConstant;
    return KALI_CONSTANT_PRESETS.findIndex(
      (p) =>
        p.value.length === c.length &&
        p.value.every((v, i) => Math.abs(v - (c[i] ?? 0)) < 0.001)
    );
  };

  const currentPresetIndex = getCurrentPresetIndex();

  // Ensure kaliConstant array is sized correctly for current dimension
  const constantSize = Math.min(dimension, config.kaliConstant.length);

  return (
    <div className={`space-y-4 ${className}`} data-testid="kali-controls">
      {/* Kali Constant Presets */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Kali Constant (c)
        </label>
        <Select
          label=""
          options={KALI_CONSTANT_PRESETS.map((p, i) => ({
            value: String(i),
            label: p.name,
          }))}
          value={currentPresetIndex >= 0 ? String(currentPresetIndex) : '-1'}
          onChange={(v) => {
            const idx = parseInt(v, 10);
            const preset = KALI_CONSTANT_PRESETS[idx];
            if (idx >= 0 && preset) {
              setKaliConstant(preset.value);
            }
          }}
          data-testid="kali-constant-preset"
        />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: Math.min(constantSize, 4) }, (_, i) => {
            const axisLabels = ['X', 'Y', 'Z', 'W'] as const;
            const testIdLabels = ['x', 'y', 'z', 'w'] as const;
            return (
              <Slider
                key={`const-${i}`}
                label={axisLabels[i] ?? `D${i}`}
                min={-2.0}
                max={2.0}
                step={0.01}
                value={config.kaliConstant[i] ?? 0}
                onChange={(v) => setKaliConstantComponent(i, v)}
                onReset={() => setKaliConstantComponent(i, DEFAULT_KALI_CONFIG.kaliConstant[i] ?? 0)}
                showValue
                data-testid={`kali-constant-${testIdLabels[i] ?? i}`}
              />
            );
          })}
        </div>
        <p className="text-xs text-text-tertiary">
          The fixed constant c in z = abs(z) / dot(z,z) + c
        </p>
      </div>

      {/* Reciprocal Gain */}
      <Slider
        label="Reciprocal Gain"
        min={0.1}
        max={3.0}
        step={0.05}
        value={config.reciprocalGain}
        onChange={setReciprocalGain}
        onReset={() => setReciprocalGain(DEFAULT_KALI_CONFIG.reciprocalGain)}
        showValue
        data-testid="kali-gain"
      />

      {/* Axis Weights */}
      <div className="space-y-2">
        <label className="text-xs text-text-secondary">
          Axis Weights
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: Math.min(dimension, 3) }, (_, i) => {
            const axisLabels = ['X', 'Y', 'Z'] as const;
            const testIdLabels = ['x', 'y', 'z'] as const;
            return (
              <Slider
                key={`weight-${i}`}
                label={axisLabels[i] ?? `D${i}`}
                min={0.0}
                max={2.0}
                step={0.05}
                value={config.axisWeights[i] ?? 1.0}
                onChange={(v) => setAxisWeight(i, v)}
                onReset={() => setAxisWeight(i, DEFAULT_KALI_CONFIG.axisWeights[i] ?? 1.0)}
                showValue
                data-testid={`kali-weight-${testIdLabels[i] ?? i}`}
              />
            );
          })}
        </div>
        <p className="text-xs text-text-tertiary">
          Weight each axis differently for asymmetric structures
        </p>
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
        data-testid="kali-quality"
      />

      {/* Max Iterations */}
      <Slider
        label="Max Iterations"
        min={16}
        max={256}
        step={8}
        value={config.maxIterations}
        onChange={setMaxIterations}
        onReset={() => setMaxIterations(DEFAULT_KALI_CONFIG.maxIterations)}
        showValue
        data-testid="kali-iterations"
      />

      {/* Bailout Radius */}
      <Slider
        label="Bailout Radius"
        min={2.0}
        max={32.0}
        step={1.0}
        value={config.bailoutRadius}
        onChange={setBailoutRadius}
        onReset={() => setBailoutRadius(DEFAULT_KALI_CONFIG.bailoutRadius)}
        showValue
        data-testid="kali-bailout"
      />

      {/* Epsilon */}
      <Slider
        label="Epsilon (Precision)"
        min={0.0001}
        max={0.01}
        step={0.0001}
        value={config.epsilon}
        onChange={setEpsilon}
        onReset={() => setEpsilon(DEFAULT_KALI_CONFIG.epsilon)}
        showValue
        data-testid="kali-epsilon"
      />

      {/* Scale */}
      <Slider
        label="Scale"
        min={0.5}
        max={5.0}
        step={0.1}
        value={config.scale}
        onChange={setScale}
        onReset={() => setScale(DEFAULT_KALI_CONFIG.scale)}
        showValue
        data-testid="kali-scale"
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
              data-testid="kali-reset-params"
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
              data-testid={`kali-slice-dim-${i + 3}`}
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
          {`${dimension}D Kali fractal (z = abs(z) / dot(z,z) + c)`}
        </p>
      </div>
    </div>
  );
});

KaliControls.displayName = 'KaliControls';

export default KaliControls;
