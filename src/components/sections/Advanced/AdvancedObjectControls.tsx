import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Section } from '@/components/sections/Section';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { SCHROEDINGER_PALETTE_DEFINITIONS } from '@/lib/geometry/extended/schroedinger/palettes';
import { SchroedingerColorMode, SchroedingerPalette } from '@/lib/geometry/extended/types';

const colorModeOptions: { value: SchroedingerColorMode; label: string }[] = [
    { value: 'density', label: 'Density' },
    { value: 'phase', label: 'Phase' },
    { value: 'mixed', label: 'Mixed' },
    { value: 'palette', label: 'Palette' },
    { value: 'blackbody', label: 'Heat' },
];

const paletteOptions = Object.keys(SCHROEDINGER_PALETTE_DEFINITIONS).map(key => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1)
}));

export const AdvancedObjectControls: React.FC = () => {
    const objectType = useGeometryStore(state => state.objectType);
    
    // We only show this section for fractals with advanced settings
    if (objectType !== 'mandelbulb' && objectType !== 'quaternion-julia' && objectType !== 'schroedinger') {
        return null;
    }

    return (
        <Section title="Advanced Rendering" defaultOpen={true} data-testid="advanced-object-controls">
            {/* Global Settings (Shared) */}
            <SharedAdvancedControls />
            
            {/* Object-Specific Settings */}
            {objectType === 'schroedinger' && <SchroedingerAdvanced />}
        </Section>
    );
};

const SharedAdvancedControls: React.FC = () => {
    const {
        roughness, setRoughness,
        sssEnabled, setSssEnabled,
        sssIntensity, setSssIntensity,
        sssColor, setSssColor,
        sssThickness, setSssThickness,
        sssJitter, setSssJitter,
        fogIntegrationEnabled, setFogIntegrationEnabled,
        fogContribution, setFogContribution,
        internalFogDensity, setInternalFogDensity,
        lodEnabled, setLodEnabled,
        lodDetail, setLodDetail
    } = useAppearanceStore(
        useShallow((state) => ({
            roughness: state.roughness, setRoughness: state.setRoughness,
            sssEnabled: state.sssEnabled, setSssEnabled: state.setSssEnabled,
            sssIntensity: state.sssIntensity, setSssIntensity: state.setSssIntensity,
            sssColor: state.sssColor, setSssColor: state.setSssColor,
            sssThickness: state.sssThickness, setSssThickness: state.setSssThickness,
            sssJitter: state.sssJitter, setSssJitter: state.setSssJitter,
            fogIntegrationEnabled: state.fogIntegrationEnabled, setFogIntegrationEnabled: state.setFogIntegrationEnabled,
            fogContribution: state.fogContribution, setFogContribution: state.setFogContribution,
            internalFogDensity: state.internalFogDensity, setInternalFogDensity: state.setInternalFogDensity,
            lodEnabled: state.lodEnabled, setLodEnabled: state.setLodEnabled,
            lodDetail: state.lodDetail, setLodDetail: state.setLodDetail,
        }))
    );

    return (
        <div className="space-y-4 mb-4 pb-4 border-b border-white/10">
            <Slider
                label="Roughness"
                min={0.0}
                max={1.0}
                step={0.05}
                value={roughness}
                onChange={setRoughness}
                showValue
                data-testid="global-roughness"
            />
            
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">Subsurface Scattering</label>
                    <ToggleButton
                        pressed={sssEnabled}
                        onToggle={() => setSssEnabled(!sssEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle SSS"
                        data-testid="global-sss-toggle"
                    >
                        {sssEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {sssEnabled && (
                    <>
                        <Slider
                            label="Intensity"
                            min={0.0}
                            max={2.0}
                            step={0.1}
                            value={sssIntensity}
                            onChange={setSssIntensity}
                            showValue
                            data-testid="global-sss-intensity"
                        />
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-text-secondary">SSS Tint</label>
                            <ColorPicker
                                value={sssColor}
                                onChange={(c) => setSssColor(c)}
                                disableAlpha={true}
                                className="w-24"
                            />
                        </div>
                        <Slider
                            label="Thickness"
                            min={0.1}
                            max={5.0}
                            step={0.1}
                            value={sssThickness}
                            onChange={setSssThickness}
                            showValue
                            data-testid="global-sss-thickness"
                        />
                        <Slider
                            label="Sample Jitter"
                            min={0.0}
                            max={1.0}
                            step={0.05}
                            value={sssJitter}
                            onChange={setSssJitter}
                            showValue
                            data-testid="global-sss-jitter"
                        />
                    </>
                )}
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">Atmosphere</label>
                    <ToggleButton
                        pressed={fogIntegrationEnabled}
                        onToggle={() => setFogIntegrationEnabled(!fogIntegrationEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle Fog"
                        data-testid="global-fog-toggle"
                    >
                        {fogIntegrationEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {fogIntegrationEnabled && (
                    <Slider
                        label="Contribution"
                        min={0.0}
                        max={2.0}
                        step={0.1}
                        value={fogContribution}
                        onChange={setFogContribution}
                        showValue
                        data-testid="global-fog-contribution"
                    />
                )}
                <Slider
                    label="Internal Density"
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={internalFogDensity}
                    onChange={setInternalFogDensity}
                    showValue
                    data-testid="global-internal-fog"
                />
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">Distance-Adaptive LOD</label>
                    <ToggleButton
                        pressed={lodEnabled}
                        onToggle={() => setLodEnabled(!lodEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle LOD"
                        data-testid="global-lod-toggle"
                    >
                        {lodEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {lodEnabled && (
                    <Slider
                        label="Detail Factor"
                        min={0.1}
                        max={2.0}
                        step={0.1}
                        value={lodDetail}
                        onChange={setLodDetail}
                        showValue
                        data-testid="global-lod-detail"
                    />
                )}
            </div>
        </div>
    );
};

const SchroedingerAdvanced: React.FC = () => {
    const {
        config,
        setTimeScale,
        setFieldScale,
        setDensityGain,
        setPowderScale,
        setSampleCount,
        setEmissionIntensity,
        setEmissionThreshold,
        setEmissionColorShift,
        setEmissionPulsing,
        setRimExponent,
        setScatteringAnisotropy,
        setLodNearDistance,
        setLodFarDistance,
        setLodMinSamples,
        setLodMaxSamples,
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
        setIsoEnabled,
        setIsoThreshold,
        setColorMode,
        setPalette
    } = useExtendedObjectStore(
        useShallow((state) => ({
            config: state.schroedinger,
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
            setLodNearDistance: state.setSchroedingerLodNearDistance,
            setLodFarDistance: state.setSchroedingerLodFarDistance,
            setLodMinSamples: state.setSchroedingerLodMinSamples,
            setLodMaxSamples: state.setSchroedingerLodMaxSamples,
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
            setColorMode: state.setSchroedingerColorMode,
            setPalette: state.setSchroedingerPalette
        }))
    );

    return (
        <div className="space-y-4">
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
            </div>

            {/* Level of Detail (LOD) Configuration */}
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">LOD Configuration</label>
                </div>
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
                            <ColorPicker
                                value={config.aoColor ?? '#000000'}
                                onChange={(c) => setAoColor(c)}
                                disableAlpha={true}
                                className="w-24"
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
                                <ColorPicker
                                    value={config.nodalColor ?? '#00ffff'}
                                    onChange={(c) => setNodalColor(c)}
                                    disableAlpha={true}
                                    className="w-24"
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
        </div>
    );
};