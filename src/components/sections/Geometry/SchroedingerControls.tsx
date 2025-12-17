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
import { SCHROEDINGER_NAMED_PRESETS } from '@/lib/geometry/extended/schroedinger/presets';
import { SCHROEDINGER_PALETTE_DEFINITIONS } from '@/lib/geometry/extended/schroedinger/palettes';
import { SchroedingerColorMode, SchroedingerPalette, SchroedingerPresetName } from '@/lib/geometry/extended/types';
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
 * Color mode options
 */
const colorModeOptions: { value: SchroedingerColorMode; label: string }[] = [
    { value: 'density', label: 'Density' },
    { value: 'phase', label: 'Phase' },
    { value: 'mixed', label: 'Mixed' },
    { value: 'palette', label: 'Palette' },
    { value: 'blackbody', label: 'Heat' },
];

/**
 * Palette options
 */
const paletteOptions = Object.keys(SCHROEDINGER_PALETTE_DEFINITIONS).map(key => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1)
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
    setPowderScale,
    setSampleCount,
    setEmissionIntensity,
    setEmissionPulsing,
    setRimExponent,
    setScatteringAnisotropy,
    setRoughness,
    setFogIntegrationEnabled,
    setFogContribution,
    setInternalFogDensity,
    setLodEnabled,
    setLodNearDistance,
    setLodFarDistance,
    setLodMinSamples,
    setLodMaxSamples,
    setSssEnabled,
    setSssIntensity,
    setSssColor,
    setSssThickness,
    setSssJitter,
    setErosionStrength,
    setErosionScale,
    setErosionTurbulence,
    setErosionNoiseType,
    setCurlEnabled,
    setCurlStrength,
    setCurlScale,
    setCurlSpeed,
    setCurlBias,
    setDispersionEnabled,
    setDispersionStrength,
    setDispersionDirection,
    setDispersionQuality,
    setShadowsEnabled,
    setShadowStrength,
    setShadowSteps,
    setAoEnabled,
    setAoStrength,
    setAoQuality,
    setAoRadius,
    setAoColor,
    setNodalEnabled,
    setNodalColor,
    setNodalStrength,
    setEnergyColorEnabled,
    setShimmerEnabled,
    setShimmerStrength,
    setIsoThreshold,
    setSchroedingerParameterValue,
    resetSchroedingerParameters,
    setColorMode,
    setPalette
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
      setPowderScale: state.setSchroedingerPowderScale,
      setSampleCount: state.setSchroedingerSampleCount,
      setEmissionIntensity: state.setSchroedingerEmissionIntensity,
      setEmissionThreshold: state.setSchroedingerEmissionThreshold,
      setEmissionColorShift: state.setSchroedingerEmissionColorShift,
      setEmissionPulsing: state.setSchroedingerEmissionPulsing,
      setRimExponent: state.setSchroedingerRimExponent,
      setScatteringAnisotropy: state.setSchroedingerScatteringAnisotropy,
      setRoughness: state.setSchroedingerRoughness,
      setFogIntegrationEnabled: state.setSchroedingerFogIntegrationEnabled,
      setFogContribution: state.setSchroedingerFogContribution,
      setInternalFogDensity: state.setSchroedingerInternalFogDensity,
      setLodEnabled: state.setSchroedingerLodEnabled,
      setLodNearDistance: state.setSchroedingerLodNearDistance,
      setLodFarDistance: state.setSchroedingerLodFarDistance,
      setLodMinSamples: state.setSchroedingerLodMinSamples,
      setLodMaxSamples: state.setSchroedingerLodMaxSamples,
      setSssEnabled: state.setSchroedingerSssEnabled,
      setSssIntensity: state.setSchroedingerSssIntensity,
      setSssColor: state.setSchroedingerSssColor,
      setSssThickness: state.setSchroedingerSssThickness,
      setSssJitter: state.setSchroedingerSssJitter,
      setErosionStrength: state.setSchroedingerErosionStrength,
      setErosionScale: state.setSchroedingerErosionScale,
      setErosionTurbulence: state.setSchroedingerErosionTurbulence,
      setErosionNoiseType: state.setSchroedingerErosionNoiseType,
      setCurlEnabled: state.setSchroedingerCurlEnabled,
      setCurlStrength: state.setSchroedingerCurlStrength,
      setCurlScale: state.setSchroedingerCurlScale,
      setCurlSpeed: state.setSchroedingerCurlSpeed,
      setCurlBias: state.setSchroedingerCurlBias,
      setDispersionEnabled: state.setSchroedingerDispersionEnabled,
      setDispersionStrength: state.setSchroedingerDispersionStrength,
      setDispersionDirection: state.setSchroedingerDispersionDirection,
      setDispersionQuality: state.setSchroedingerDispersionQuality,
      setShadowsEnabled: state.setSchroedingerShadowsEnabled,
      setShadowStrength: state.setSchroedingerShadowStrength,
      setShadowSteps: state.setSchroedingerShadowSteps,
      setAoEnabled: state.setSchroedingerAoEnabled,
      setAoStrength: state.setSchroedingerAoStrength,
      setAoQuality: state.setSchroedingerAoQuality,
      setAoRadius: state.setSchroedingerAoRadius,
      setAoColor: state.setSchroedingerAoColor,
      setNodalEnabled: state.setSchroedingerNodalEnabled,
      setNodalColor: state.setSchroedingerNodalColor,
      setNodalStrength: state.setSchroedingerNodalStrength,
      setEnergyColorEnabled: state.setSchroedingerEnergyColorEnabled,
      setShimmerEnabled: state.setSchroedingerShimmerEnabled,
      setShimmerStrength: state.setSchroedingerShimmerStrength,
      setIsoEnabled: state.setSchroedingerIsoEnabled,
      setIsoThreshold: state.setSchroedingerIsoThreshold,
      setSchroedingerParameterValue: state.setSchroedingerParameterValue,
      resetSchroedingerParameters: state.resetSchroedingerParameters,
      setColorMode: state.setSchroedingerColorMode,
      setPalette: state.setSchroedingerPalette
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
        {/* Color Mode Selection */}
        <div className="space-y-2 mb-4">
             <label className="text-xs text-text-secondary">Color Mode</label>
             <ToggleGroup
                options={colorModeOptions}
                value={config.colorMode}
                onChange={(v) => setColorMode(v as SchroedingerColorMode)}
                ariaLabel="Color mode selection"
                data-testid="schroedinger-color-mode"
             />
             
             {config.colorMode === 'palette' && (
                 <div className="pt-2">
                     <label className="text-xs text-text-secondary">Palette Preset</label>
                     <select 
                         className="w-full bg-surface-dark border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                         value={config.palette}
                         onChange={(e) => setPalette(e.target.value as SchroedingerPalette)}
                         data-testid="schroedinger-palette-select"
                     >
                         {paletteOptions.map(opt => (
                             <option key={opt.value} value={opt.value}>{opt.label}</option>
                         ))}
                     </select>
                 </div>
             )}
        </div>

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
            label="Powder Effect"
            min={0.0}
            max={2.0}
            step={0.1}
            value={config.powderScale}
            onChange={setPowderScale}
            showValue
            data-testid="schroedinger-powder-scale"
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

        {/* Emission Controls */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">HDR Emission</label>
            </div>
            <Slider
                label="Intensity"
                min={0.0}
                max={5.0}
                step={0.1}
                value={config.emissionIntensity}
                onChange={setEmissionIntensity}
                showValue
                data-testid="schroedinger-emission-intensity"
            />
            {config.emissionIntensity > 0 && (
                <>
                    <Slider
                        label="Threshold"
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        value={config.emissionThreshold}
                        onChange={setEmissionThreshold}
                        showValue
                        data-testid="schroedinger-emission-threshold"
                    />
                    <Slider
                        label="Color Shift (Cool/Warm)"
                        min={-1.0}
                        max={1.0}
                        step={0.1}
                        value={config.emissionColorShift}
                        onChange={setEmissionColorShift}
                        showValue
                        data-testid="schroedinger-emission-shift"
                    />
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-text-secondary">Pulsing</label>
                        <ToggleButton
                            pressed={config.emissionPulsing}
                            onToggle={() => setEmissionPulsing(!config.emissionPulsing)}
                            className="text-xs px-2 py-1 h-auto"
                            ariaLabel="Toggle emission pulsing"
                            data-testid="schroedinger-emission-pulse"
                        >
                            {config.emissionPulsing ? 'ON' : 'OFF'}
                        </ToggleButton>
                    </div>
                </>
            )}
            
             <Slider
                label="Rim Falloff"
                min={1.0}
                max={10.0}
                step={0.5}
                value={config.rimExponent ?? 3.0}
                onChange={setRimExponent}
                showValue
                data-testid="schroedinger-rim-exponent"
            />
            
            <Slider
                label="Anisotropy (Phase)"
                min={-0.9}
                max={0.9}
                step={0.05}
                value={config.scatteringAnisotropy ?? 0.0}
                onChange={setScatteringAnisotropy}
                showValue
                data-testid="schroedinger-anisotropy"
            />
            
            <Slider
                label="Roughness"
                min={0.0}
                max={1.0}
                step={0.05}
                value={config.roughness ?? 0.3}
                onChange={setRoughness}
                showValue
                data-testid="schroedinger-roughness"
            />
        </div>

        {/* Fog & Atmosphere */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Atmosphere</label>
                <ToggleButton
                    pressed={config.fogIntegrationEnabled ?? true}
                    onToggle={() => setFogIntegrationEnabled(!(config.fogIntegrationEnabled ?? true))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle fog integration"
                    data-testid="schroedinger-fog-toggle"
                >
                    {config.fogIntegrationEnabled !== false ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.fogIntegrationEnabled !== false && (
                <Slider
                    label="Fog Contribution"
                    min={0.0}
                    max={2.0}
                    step={0.1}
                    value={config.fogContribution ?? 1.0}
                    onChange={setFogContribution}
                    showValue
                    data-testid="schroedinger-fog-contribution"
                />
            )}
            <Slider
                label="Internal Fog"
                min={0.0}
                max={1.0}
                step={0.05}
                value={config.internalFogDensity ?? 0.0}
                onChange={setInternalFogDensity}
                showValue
                data-testid="schroedinger-internal-fog"
            />
        </div>

        {/* Level of Detail (LOD) */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Adaptive Quality (LOD)</label>
                <ToggleButton
                    pressed={config.lodEnabled ?? true}
                    onToggle={() => setLodEnabled(!(config.lodEnabled ?? true))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle LOD"
                    data-testid="schroedinger-lod-toggle"
                >
                    {config.lodEnabled !== false ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.lodEnabled !== false && (
                <>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Slider
                                label="Min Samples (Far)"
                                min={16}
                                max={64}
                                step={8}
                                value={config.lodMinSamples ?? 32}
                                onChange={setLodMinSamples}
                                showValue
                                data-testid="schroedinger-lod-min"
                            />
                        </div>
                        <div className="flex-1">
                            <Slider
                                label="Max Samples (Near)"
                                min={64}
                                max={256}
                                step={16}
                                value={config.lodMaxSamples ?? 128}
                                onChange={setLodMaxSamples}
                                showValue
                                data-testid="schroedinger-lod-max"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Slider
                                label="Near Dist"
                                min={1}
                                max={10}
                                step={1}
                                value={config.lodNearDistance ?? 2}
                                onChange={setLodNearDistance}
                                showValue
                                data-testid="schroedinger-lod-near"
                            />
                        </div>
                        <div className="flex-1">
                            <Slider
                                label="Far Dist"
                                min={5}
                                max={30}
                                step={1}
                                value={config.lodFarDistance ?? 10}
                                onChange={setLodFarDistance}
                                showValue
                                data-testid="schroedinger-lod-far"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* Subsurface Scattering (SSS) */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Subsurface Scattering</label>
                <ToggleButton
                    pressed={config.sssEnabled ?? false}
                    onToggle={() => setSssEnabled(!(config.sssEnabled ?? false))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle SSS"
                    data-testid="schroedinger-sss-toggle"
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
                        data-testid="schroedinger-sss-intensity"
                    />
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-text-secondary">SSS Tint</label>
                        <input
                            type="color"
                            value={config.sssColor ?? '#ff8844'}
                            onChange={(e) => setSssColor(e.target.value)}
                            className="bg-transparent border-none w-6 h-6 cursor-pointer"
                            data-testid="schroedinger-sss-color"
                        />
                    </div>
                    <Slider
                        label="Thickness Falloff"
                        min={0.1}
                        max={5.0}
                        step={0.1}
                        value={config.sssThickness ?? 1.0}
                        onChange={setSssThickness}
                        showValue
                        data-testid="schroedinger-sss-thickness"
                    />
                </>
            )}
        </div>

        {/* Edge Detail Erosion */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Edge Detail</label>
            </div>
            <Slider
                label="Strength"
                min={0.0}
                max={1.0}
                step={0.05}
                value={config.erosionStrength ?? 0.0}
                onChange={setErosionStrength}
                showValue
                data-testid="schroedinger-erosion-strength"
            />
            {config.erosionStrength > 0 && (
                <>
                    <Slider
                        label="Scale"
                        min={0.25}
                        max={4.0}
                        step={0.25}
                        value={config.erosionScale ?? 1.0}
                        onChange={setErosionScale}
                        showValue
                        data-testid="schroedinger-erosion-scale"
                    />
                    <Slider
                        label="Turbulence"
                        min={0.0}
                        max={1.0}
                        step={0.1}
                        value={config.erosionTurbulence ?? 0.5}
                        onChange={setErosionTurbulence}
                        showValue
                        data-testid="schroedinger-erosion-turbulence"
                    />
                    <div className="pt-2">
                        <label className="text-xs text-text-secondary">Noise Type</label>
                        <select 
                            className="w-full bg-surface-dark border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                            value={config.erosionNoiseType ?? 0}
                            onChange={(e) => setErosionNoiseType(parseInt(e.target.value))}
                            data-testid="schroedinger-erosion-type"
                        >
                            <option value={0}>Worley (Cloudy)</option>
                            <option value={1}>Perlin (Smooth)</option>
                            <option value={2}>Hybrid (Billowy)</option>
                        </select>
                    </div>
                </>
            )}
        </div>

        {/* Curl Noise Turbulence */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Animated Flow</label>
                <ToggleButton
                    pressed={config.curlEnabled ?? false}
                    onToggle={() => setCurlEnabled(!(config.curlEnabled ?? false))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle flow animation"
                    data-testid="schroedinger-curl-toggle"
                >
                    {config.curlEnabled ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.curlEnabled && (
                <>
                    <Slider
                        label="Strength"
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        value={config.curlStrength ?? 0.3}
                        onChange={setCurlStrength}
                        showValue
                        data-testid="schroedinger-curl-strength"
                    />
                    <Slider
                        label="Scale"
                        min={0.25}
                        max={4.0}
                        step={0.25}
                        value={config.curlScale ?? 1.0}
                        onChange={setCurlScale}
                        showValue
                        data-testid="schroedinger-curl-scale"
                    />
                    <Slider
                        label="Speed"
                        min={0.1}
                        max={5.0}
                        step={0.1}
                        value={config.curlSpeed ?? 1.0}
                        onChange={setCurlSpeed}
                        showValue
                        data-testid="schroedinger-curl-speed"
                    />
                    <div className="pt-2">
                        <label className="text-xs text-text-secondary">Flow Bias</label>
                        <select 
                            className="w-full bg-surface-dark border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                            value={config.curlBias ?? 0}
                            onChange={(e) => setCurlBias(parseInt(e.target.value))}
                            data-testid="schroedinger-curl-bias"
                        >
                            <option value={0}>None (Isotropic)</option>
                            <option value={1}>Upward (Rising)</option>
                            <option value={2}>Outward (Expansion)</option>
                            <option value={3}>Inward (Implosion)</option>
                        </select>
                    </div>
                </>
            )}
        </div>

        {/* Chromatic Dispersion */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Chromatic Dispersion</label>
                <ToggleButton
                    pressed={config.dispersionEnabled ?? false}
                    onToggle={() => setDispersionEnabled(!(config.dispersionEnabled ?? false))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle dispersion"
                    data-testid="schroedinger-dispersion-toggle"
                >
                    {config.dispersionEnabled ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.dispersionEnabled && (
                <>
                    <Slider
                        label="Strength"
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        value={config.dispersionStrength ?? 0.2}
                        onChange={setDispersionStrength}
                        showValue
                        data-testid="schroedinger-dispersion-strength"
                    />
                    <div className="flex gap-2 pt-2">
                        <div className="flex-1">
                            <label className="text-xs text-text-secondary">Direction</label>
                            <select 
                                className="w-full bg-surface-dark border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                                value={config.dispersionDirection ?? 0}
                                onChange={(e) => setDispersionDirection(parseInt(e.target.value))}
                                data-testid="schroedinger-dispersion-direction"
                            >
                                <option value={0}>Radial</option>
                                <option value={1}>View</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-text-secondary">Quality</label>
                            <select 
                                className="w-full bg-surface-dark border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                                value={config.dispersionQuality ?? 0}
                                onChange={(e) => setDispersionQuality(parseInt(e.target.value))}
                                data-testid="schroedinger-dispersion-quality"
                            >
                                <option value={0}>Fast (Grad)</option>
                                <option value={1}>High (Sample)</option>
                            </select>
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* Volumetric Shadows */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Self-Shadowing (Expensive)</label>
                <ToggleButton
                    pressed={config.shadowsEnabled ?? false}
                    onToggle={() => setShadowsEnabled(!(config.shadowsEnabled ?? false))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle shadows"
                    data-testid="schroedinger-shadow-toggle"
                >
                    {config.shadowsEnabled ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.shadowsEnabled && (
                <>
                    <Slider
                        label="Strength"
                        min={0.0}
                        max={2.0}
                        step={0.1}
                        value={config.shadowStrength ?? 1.0}
                        onChange={setShadowStrength}
                        showValue
                        data-testid="schroedinger-shadow-strength"
                    />
                    <Slider
                        label="Quality (Steps)"
                        min={1}
                        max={8}
                        step={1}
                        value={config.shadowSteps ?? 4}
                        onChange={setShadowSteps}
                        showValue
                        data-testid="schroedinger-shadow-steps"
                    />
                </>
            )}
        </div>

        {/* Volumetric Ambient Occlusion */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Ambient Occlusion (Very Expensive)</label>
                <ToggleButton
                    pressed={config.aoEnabled ?? false}
                    onToggle={() => setAoEnabled(!(config.aoEnabled ?? false))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle AO"
                    data-testid="schroedinger-ao-toggle"
                >
                    {config.aoEnabled ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>
            {config.aoEnabled && (
                <>
                    <Slider
                        label="Strength"
                        min={0.0}
                        max={2.0}
                        step={0.1}
                        value={config.aoStrength ?? 1.0}
                        onChange={setAoStrength}
                        showValue
                        data-testid="schroedinger-ao-strength"
                    />
                    <Slider
                        label="Quality (Cones)"
                        min={3}
                        max={8}
                        step={1}
                        value={config.aoQuality ?? 4}
                        onChange={setAoQuality}
                        showValue
                        data-testid="schroedinger-ao-quality"
                    />
                    <Slider
                        label="Radius"
                        min={0.1}
                        max={2.0}
                        step={0.1}
                        value={config.aoRadius ?? 0.5}
                        onChange={setAoRadius}
                        showValue
                        data-testid="schroedinger-ao-radius"
                    />
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-text-secondary">Shadow Tint</label>
                        <input
                            type="color"
                            value={config.aoColor ?? '#000000'}
                            onChange={(e) => setAoColor(e.target.value)}
                            className="bg-transparent border-none w-6 h-6 cursor-pointer"
                            data-testid="schroedinger-ao-color"
                        />
                    </div>
                </>
            )}
        </div>

        {/* Quantum Effects */}
        <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-semibold">Quantum Effects</label>
            </div>
            
            {/* Nodal Surfaces */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary">Nodal Surfaces</label>
                    <ToggleButton
                        pressed={config.nodalEnabled ?? false}
                        onToggle={() => setNodalEnabled(!(config.nodalEnabled ?? false))}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle nodal surfaces"
                        data-testid="schroedinger-nodal-toggle"
                    >
                        {config.nodalEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.nodalEnabled && (
                    <div className="pl-2 border-l border-white/10">
                        <Slider
                            label="Strength"
                            min={0.0}
                            max={2.0}
                            step={0.1}
                            value={config.nodalStrength ?? 1.0}
                            onChange={setNodalStrength}
                            showValue
                            data-testid="schroedinger-nodal-strength"
                        />
                        <div className="flex items-center justify-between mt-1">
                            <label className="text-xs text-text-secondary">Color</label>
                            <input
                                type="color"
                                value={config.nodalColor ?? '#00ffff'}
                                onChange={(e) => setNodalColor(e.target.value)}
                                className="bg-transparent border-none w-6 h-6 cursor-pointer"
                                data-testid="schroedinger-nodal-color"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Energy Coloring */}
            <div className="flex items-center justify-between mt-2">
                <label className="text-xs text-text-secondary">Energy Coloring</label>
                <ToggleButton
                    pressed={config.energyColorEnabled ?? false}
                    onToggle={() => setEnergyColorEnabled(!(config.energyColorEnabled ?? false))}
                    className="text-xs px-2 py-1 h-auto"
                    ariaLabel="Toggle energy coloring"
                    data-testid="schroedinger-energy-toggle"
                >
                    {config.energyColorEnabled ? 'ON' : 'OFF'}
                </ToggleButton>
            </div>

            {/* Uncertainty Shimmer */}
            <div className="space-y-1 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary">Uncertainty Shimmer</label>
                    <ToggleButton
                        pressed={config.shimmerEnabled ?? false}
                        onToggle={() => setShimmerEnabled(!(config.shimmerEnabled ?? false))}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle shimmer"
                        data-testid="schroedinger-shimmer-toggle"
                    >
                        {config.shimmerEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.shimmerEnabled && (
                    <Slider
                        label="Strength"
                        min={0.0}
                        max={1.0}
                        step={0.1}
                        value={config.shimmerStrength ?? 0.5}
                        onChange={setShimmerStrength}
                        showValue
                        data-testid="schroedinger-shimmer-strength"
                    />
                )}
            </div>
        </div>

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
