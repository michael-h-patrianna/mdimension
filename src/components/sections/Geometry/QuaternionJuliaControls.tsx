/**
 * QuaternionJuliaControls Component
 *
 * Controls for configuring n-dimensional Quaternion Julia fractal visualization.
 * Animation controls are located in the TimelineControls drawer (JuliaAnimationDrawer).
 *
 * Features:
 * - Julia constant controls with presets (4D quaternion components)
 * - Power slider (quadratic to octave)
 * - Max iterations slider
 * - Bailout radius slider
 * - Scale parameter for auto-positioning
 * - Slice parameters for 4D+ dimensions
 *
 * The Quaternion Julia fractal uses the iteration z = z^n + c where c is a
 * fixed constant (unlike Mandelbulb where c varies with sample position).
 *
 * @see docs/prd/quaternion-julia-fractal.md
 * @see JuliaAnimationDrawer for animation controls
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { Section } from '@/components/sections/Section';
import {
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
    resetParameters: state.resetQuaternionJuliaParameters,
    // Advanced Rendering
    setRoughness: state.setQuaternionJuliaRoughness,
    setSssEnabled: state.setQuaternionJuliaSssEnabled,
    setSssIntensity: state.setQuaternionJuliaSssIntensity,
    setSssColor: state.setQuaternionJuliaSssColor,
    setSssThickness: state.setQuaternionJuliaSssThickness,
    // Atmosphere
    setFogEnabled: state.setQuaternionJuliaFogEnabled,
    setFogContribution: state.setQuaternionJuliaFogContribution,
    setInternalFogDensity: state.setQuaternionJuliaInternalFogDensity,
    // LOD
    setLodEnabled: state.setQuaternionJuliaLodEnabled,
    setLodDetail: state.setQuaternionJuliaLodDetail,
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
      // Advanced Rendering
      setRoughness: state.setQuaternionJuliaRoughness,
      setSssEnabled: state.setQuaternionJuliaSssEnabled,
      setSssIntensity: state.setQuaternionJuliaSssIntensity,
      setSssColor: state.setQuaternionJuliaSssColor,
      setSssThickness: state.setQuaternionJuliaSssThickness,
      // Atmosphere
      setFogEnabled: state.setQuaternionJuliaFogEnabled,
      setFogContribution: state.setQuaternionJuliaFogContribution,
      setInternalFogDensity: state.setQuaternionJuliaInternalFogDensity,
      // LOD
      setLodEnabled: state.setQuaternionJuliaLodEnabled,
      setLodDetail: state.setQuaternionJuliaLodDetail,
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
    <div className={className} data-testid="quaternion-julia-controls">
      <Section title="Julia Constant" defaultOpen={true}>
        <div className="space-y-2">
            <Select
            label="Preset"
            options={JULIA_CONSTANT_PRESETS.map((p, i) => ({
                value: String(i),
                label: p.name,
            }))}
            value={currentPresetIndex >= 0 ? String(currentPresetIndex) : '-1'}
            onChange={(v) => {
                const idx = parseInt(v, 10);
                const preset = JULIA_CONSTANT_PRESETS[idx];
                if (idx >= 0 && preset) {
                setJuliaConstant(preset.value);
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
                showValue
                data-testid="julia-constant-w"
            />
            </div>
            <p className="text-xs text-text-tertiary">
            The fixed constant c in z = z^n + c
            </p>
        </div>
      </Section>

      <Section title="Parameters" defaultOpen={true}>
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
            showValue
            data-testid="julia-scale"
        />
      </Section>

      {/* Slice Parameters - shown for 4D+ */}
      {dimension >= 4 && (
        <Section title={`Cross Section (${dimension - 3} dim${dimension > 4 ? 's' : ''})`} defaultOpen={true} onReset={() => resetParameters()}>
          {Array.from({ length: dimension - 3 }, (_, i) => (
            <Slider
              key={`slice-dim-${i + 3}`}
              label={`Dim ${i + 4}`}
              min={-2.0}
              max={2.0}
              step={0.1}
              value={config.parameterValues[i] ?? 0}
              onChange={(v) => setParameterValue(i, v)}
              showValue
              data-testid={`julia-slice-dim-${i + 3}`}
            />
          ))}
          <p className="text-xs text-text-tertiary">
            Explore different {dimension}D cross-sections
          </p>
        </Section>
      )}

      <Section title="Advanced Rendering" defaultOpen={false}>
        <Slider
          label="Roughness"
          min={0.0}
          max={1.0}
          step={0.05}
          value={config.roughness ?? 0.3}
          onChange={setRoughness}
          showValue
          data-testid="julia-roughness"
        />
        
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Subsurface Scattering</label>
                <ToggleButton
                    pressed={config.sssEnabled ?? false}
                    onToggle={() => setSssEnabled(!(config.sssEnabled ?? false))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle SSS"
                    data-testid="julia-sss-toggle"
                >
                    {config.sssEnabled ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.sssEnabled && (
                <>
                    <Slider
                        label="Intensity"
                        min={0.0}
                        max={2.0}
                        step={0.1}
                        value={config.sssIntensity ?? 1.0}
                        onChange={setSssIntensity}
                        showValue
                        data-testid="julia-sss-intensity"
                    />
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-text-secondary">SSS Tint</label>
                        <input
                            type="color"
                            value={config.sssColor ?? '#ff8844'}
                            onChange={(e) => setSssColor(e.target.value)}
                            className="bg-transparent border-none w-6 h-6 cursor-pointer"
                            data-testid="julia-sss-color"
                        />
                    </div>
                    <Slider
                        label="Thickness"
                        min={0.1}
                        max={5.0}
                        step={0.1}
                        value={config.sssThickness ?? 1.0}
                        onChange={setSssThickness}
                        showValue
                        data-testid="julia-sss-thickness"
                    />
                </>
            )}
        </div>
      </Section>

      <Section title="Atmosphere" defaultOpen={false}>
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Fog Integration</label>
                <ToggleButton
                    pressed={config.fogEnabled ?? true}
                    onToggle={() => setFogEnabled(!(config.fogEnabled ?? true))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle Fog"
                    data-testid="julia-fog-toggle"
                >
                    {config.fogEnabled !== false ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.fogEnabled !== false && (
                <Slider
                    label="Contribution"
                    min={0.0}
                    max={2.0}
                    step={0.1}
                    value={config.fogContribution ?? 1.0}
                    onChange={setFogContribution}
                    showValue
                    data-testid="julia-fog-contribution"
                />
            )}
            <Slider
                label="Internal Density"
                min={0.0}
                max={1.0}
                step={0.05}
                value={config.internalFogDensity ?? 0.0}
                onChange={setInternalFogDensity}
                showValue
                data-testid="julia-internal-fog"
            />
        </div>
      </Section>

      <Section title="Performance" defaultOpen={false}>
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Distance-Adaptive LOD</label>
                <ToggleButton
                    pressed={config.lodEnabled ?? true}
                    onToggle={() => setLodEnabled(!(config.lodEnabled ?? true))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle LOD"
                    data-testid="julia-lod-toggle"
                >
                    {config.lodEnabled !== false ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.lodEnabled !== false && (
                <Slider
                    label="Detail Factor"
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    value={config.lodDetail ?? 1.0}
                    onChange={setLodDetail}
                    showValue
                    data-testid="julia-lod-detail"
                />
            )}
        </div>
      </Section>

      {/* Info */}
      <div className="px-4 py-2 text-xs text-text-secondary border-t border-white/5">
        <p>Rendering: GPU Ray Marching</p>
        <p className="text-text-tertiary">
          {`${dimension}D Quaternion Julia fractal (z = z^${config.power} + c)`}
        </p>
      </div>
    </div>
  );
});
