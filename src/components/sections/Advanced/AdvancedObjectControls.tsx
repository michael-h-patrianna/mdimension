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
import type { RaymarchQuality } from '@/lib/geometry/extended/types';

// Object types that show the Advanced Rendering section
const ADVANCED_RENDERING_OBJECT_TYPES = [
    'mandelbulb',
    'quaternion-julia',
    'schroedinger',
    'hypercube',
    'simplex',
    'cross-polytope',
    'wythoff-polytope',
];

// Object types that have raymarching quality controls
const RAYMARCHING_OBJECT_TYPES = ['mandelbulb', 'quaternion-julia', 'schroedinger'];

export const AdvancedObjectControls: React.FC = () => {
    const objectType = useGeometryStore(state => state.objectType);

    // Show for all supported object types (fractals + polytopes)
    if (!ADVANCED_RENDERING_OBJECT_TYPES.includes(objectType)) {
        return null;
    }

    const showRaymarchingQuality = RAYMARCHING_OBJECT_TYPES.includes(objectType);

    return (
        <Section title="Advanced Rendering" defaultOpen={true} data-testid="advanced-object-controls">
            {/* Raymarching Quality - only for raymarching objects */}
            {showRaymarchingQuality && <RaymarchingQualityControl objectType={objectType} />}

            {/* Global Settings (Shared) - for all objects */}
            <SharedAdvancedControls />

            {/* Object-Specific Settings */}
            {objectType === 'schroedinger' && <SchroedingerAdvanced />}
        </Section>
    );
};

/** Quality descriptions with concrete numbers for each object type */
const QUALITY_DESCRIPTIONS: Record<RaymarchQuality, { volumetric: string; sdf: string }> = {
    fast: {
        volumetric: '16 samples/ray - fastest, some banding',
        sdf: '4x larger steps - fastest, lower detail',
    },
    balanced: {
        volumetric: '32 samples/ray - good balance',
        sdf: '2x larger steps - balanced quality',
    },
    quality: {
        volumetric: '48 samples/ray - smooth gradients',
        sdf: '1.33x larger steps - high detail',
    },
    ultra: {
        volumetric: '64 samples/ray - maximum quality',
        sdf: 'Full resolution - maximum detail',
    },
};

/** Get quality description with concrete numbers based on object type */
const getQualityDescription = (quality: RaymarchQuality, objectType: string): string => {
    const isVolumetric = objectType === 'schroedinger';
    return isVolumetric ? QUALITY_DESCRIPTIONS[quality].volumetric : QUALITY_DESCRIPTIONS[quality].sdf;
};

/** Unified Raymarching Quality Control for all 3 raymarching object types */
const RaymarchingQualityControl: React.FC<{ objectType: string }> = ({ objectType }) => {
    const {
        mandelbulbQuality, setMandelbulbQuality,
        juliaQuality, setJuliaQuality,
        schroedingerQuality, setSchroedingerQuality,
    } = useExtendedObjectStore(
        useShallow((state) => ({
            mandelbulbQuality: state.mandelbulb.raymarchQuality,
            setMandelbulbQuality: state.setMandelbulbRaymarchQuality,
            juliaQuality: state.quaternionJulia.raymarchQuality,
            setJuliaQuality: state.setQuaternionJuliaRaymarchQuality,
            schroedingerQuality: state.schroedinger.raymarchQuality,
            setSchroedingerQuality: state.setSchroedingerRaymarchQuality,
        }))
    );

    // Select the appropriate quality and setter based on object type
    let quality: RaymarchQuality;
    let setQuality: (q: RaymarchQuality) => void;

    if (objectType === 'mandelbulb') {
        quality = mandelbulbQuality;
        setQuality = setMandelbulbQuality;
    } else if (objectType === 'quaternion-julia') {
        quality = juliaQuality;
        setQuality = setJuliaQuality;
    } else {
        quality = schroedingerQuality;
        setQuality = setSchroedingerQuality;
    }

    return (
        <div className="space-y-2 mb-4 pb-4 border-b border-white/10">
            <label className="text-xs text-text-secondary font-semibold">Raymarching Quality</label>
            <ToggleGroup
                options={[
                    { value: 'fast', label: 'Fast' },
                    { value: 'balanced', label: 'Balanced' },
                    { value: 'quality', label: 'Quality' },
                    { value: 'ultra', label: 'Ultra' },
                ]}
                value={quality}
                onChange={(v) => setQuality(v as RaymarchQuality)}
                ariaLabel="Raymarching quality selection"
                data-testid="raymarching-quality"
            />
            <p className="text-xs text-text-tertiary">
                {getQualityDescription(quality, objectType)}
            </p>
        </div>
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
        fresnelEnabled, setSurfaceSettings,
        fresnelIntensity, setFresnelIntensity,
    } = useAppearanceStore(
        useShallow((state) => ({
            roughness: state.roughness, setRoughness: state.setRoughness,
            sssEnabled: state.sssEnabled, setSssEnabled: state.setSssEnabled,
            sssIntensity: state.sssIntensity, setSssIntensity: state.setSssIntensity,
            sssColor: state.sssColor, setSssColor: state.setSssColor,
            sssThickness: state.sssThickness, setSssThickness: state.setSssThickness,
            sssJitter: state.sssJitter, setSssJitter: state.setSssJitter,
            fresnelEnabled: state.shaderSettings.surface.fresnelEnabled,
            setSurfaceSettings: state.setSurfaceSettings,
            fresnelIntensity: state.fresnelIntensity, setFresnelIntensity: state.setFresnelIntensity,
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

            {/* Fresnel Rim */}
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">Fresnel Rim</label>
                    <ToggleButton
                        pressed={fresnelEnabled}
                        onToggle={() => setSurfaceSettings({ fresnelEnabled: !fresnelEnabled })}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle Fresnel Rim"
                        data-testid="global-fresnel-toggle"
                    >
                        {fresnelEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {fresnelEnabled && (
                    <Slider
                        label="Intensity"
                        min={0.0}
                        max={1.0}
                        step={0.1}
                        value={fresnelIntensity}
                        onChange={setFresnelIntensity}
                        showValue
                        data-testid="global-fresnel-intensity"
                    />
                )}
            </div>
            {/* Note: Fog/Atmosphere controls moved to Scene → Environment → Fog tab */}
        </div>
    );
};

const SchroedingerAdvanced: React.FC = () => {
    const {
        config,
        setDensityGain,
        setPowderScale,
        setScatteringAnisotropy,
        setDispersionEnabled,
        setDispersionStrength,
        setDispersionDirection,
        setDispersionQuality,
        // Note: Shadow setters removed - now in ShadowsSection
        // Note: AO setters removed - now in MiscControls (Post Processing)
        setNodalEnabled,
        setNodalColor,
        setNodalStrength,
        setEnergyColorEnabled,
        setShimmerEnabled,
        setShimmerStrength,
        setIsoEnabled,
        setIsoThreshold
    } = useExtendedObjectStore(
        useShallow((state) => ({
            config: state.schroedinger,
            setDensityGain: state.setSchroedingerDensityGain,
            setPowderScale: state.setSchroedingerPowderScale,
            setScatteringAnisotropy: state.setSchroedingerScatteringAnisotropy,
            setDispersionEnabled: state.setSchroedingerDispersionEnabled,
            setDispersionStrength: state.setSchroedingerDispersionStrength,
            setDispersionDirection: state.setSchroedingerDispersionDirection,
            setDispersionQuality: state.setSchroedingerDispersionQuality,
            // Note: Shadow setters removed - now in ShadowsSection
            // Note: AO setters removed - now in MiscControls (Post Processing)
            setNodalEnabled: state.setSchroedingerNodalEnabled,
            setNodalColor: state.setSchroedingerNodalColor,
            setNodalStrength: state.setSchroedingerNodalStrength,
            setEnergyColorEnabled: state.setSchroedingerEnergyColorEnabled,
            setShimmerEnabled: state.setSchroedingerShimmerEnabled,
            setShimmerStrength: state.setSchroedingerShimmerStrength,
            setIsoEnabled: state.setSchroedingerIsoEnabled,
            setIsoThreshold: state.setSchroedingerIsoThreshold
        }))
    );

    return (
        <div className="space-y-4">
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

            {/* Anisotropy (Phase) */}
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
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

            {/* Note: Shadow controls moved to ShadowsSection */}
            {/* Note: AO controls moved to MiscControls (Post Processing → FX tab) */}

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