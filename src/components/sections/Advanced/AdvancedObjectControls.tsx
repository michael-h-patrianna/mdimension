import { Section } from '@/components/sections/Section';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Slider } from '@/components/ui/Slider';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import type { BlackHoleRayBendingMode, RaymarchQuality } from '@/lib/geometry/extended/types';
import { useAppearanceStore, type AppearanceSlice } from '@/stores/appearanceStore';
import { useExtendedObjectStore, type ExtendedObjectState } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

// Object types that show the Advanced Rendering section
const ADVANCED_RENDERING_OBJECT_TYPES = [
    'mandelbulb',
    'quaternion-julia',
    'schroedinger',
    'blackhole',
    'hypercube',
    'simplex',
    'cross-polytope',
    'wythoff-polytope',
];

// Object types that have raymarching quality controls
const RAYMARCHING_OBJECT_TYPES = ['mandelbulb', 'quaternion-julia', 'schroedinger', 'blackhole'];

export const AdvancedObjectControls: React.FC = () => {
    const objectType = useGeometryStore(state => state.objectType);

    // Show for all supported object types (fractals + polytopes)
    if (!ADVANCED_RENDERING_OBJECT_TYPES.includes(objectType)) {
        return null;
    }

    const showRaymarchingQuality = RAYMARCHING_OBJECT_TYPES.includes(objectType);
    const isPolytope = ['hypercube', 'simplex', 'cross-polytope', 'wythoff-polytope'].includes(objectType);

    return (
        <Section title="Advanced Rendering" defaultOpen={true} data-testid="advanced-object-controls">
            {/* Raymarching Quality - only for raymarching objects */}
            {showRaymarchingQuality && <RaymarchingQualityControl objectType={objectType} />}

            {/* Global Settings (Shared) - for all objects */}
            <SharedAdvancedControls />

            {/* Object-Specific Settings */}
            {objectType === 'schroedinger' && <SchroedingerAdvanced />}
            {objectType === 'blackhole' && <BlackHoleAdvanced />}
            {objectType === 'mandelbulb' && <MandelbulbAdvanced />}
            {isPolytope && <PolytopeAdvanced />}
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

/**
 * Get quality description with concrete numbers based on object type
 * @param quality - The quality level
 * @param objectType - The object type (volumetric or SDF)
 * @returns Human-readable quality description
 */
const getQualityDescription = (quality: RaymarchQuality, objectType: string): string => {
    const isVolumetric = objectType === 'schroedinger';
    return isVolumetric ? QUALITY_DESCRIPTIONS[quality].volumetric : QUALITY_DESCRIPTIONS[quality].sdf;
};

/**
 * Unified Raymarching Quality Control for all 3 raymarching object types
 * @param root0 - Component props
 * @param root0.objectType - The type of raymarched object
 * @returns The quality control UI component
 */
const RaymarchingQualityControl: React.FC<{ objectType: string }> = ({ objectType }) => {
    const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
        mandelbulbQuality: state.mandelbulb.raymarchQuality,
        setMandelbulbQuality: state.setMandelbulbRaymarchQuality,
        juliaQuality: state.quaternionJulia.raymarchQuality,
        setJuliaQuality: state.setQuaternionJuliaRaymarchQuality,
        schroedingerQuality: state.schroedinger.raymarchQuality,
        setSchroedingerQuality: state.setSchroedingerRaymarchQuality,
        blackholeQuality: state.blackhole.raymarchQuality,
        setBlackholeQuality: state.setBlackHoleRaymarchQuality,
    }));
    const {
        mandelbulbQuality, setMandelbulbQuality,
        juliaQuality, setJuliaQuality,
        schroedingerQuality, setSchroedingerQuality,
        blackholeQuality, setBlackholeQuality,
    } = useExtendedObjectStore(extendedObjectSelector);

    // Select the appropriate quality and setter based on object type
    let quality: RaymarchQuality;
    let setQuality: (q: RaymarchQuality) => void;

    if (objectType === 'mandelbulb') {
        quality = mandelbulbQuality;
        setQuality = setMandelbulbQuality;
    } else if (objectType === 'quaternion-julia') {
        quality = juliaQuality;
        setQuality = setJuliaQuality;
    } else if (objectType === 'blackhole') {
        quality = blackholeQuality;
        setQuality = setBlackholeQuality;
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
    const appearanceSelector = useShallow((state: AppearanceSlice) => ({
        sssEnabled: state.sssEnabled, setSssEnabled: state.setSssEnabled,
        sssIntensity: state.sssIntensity, setSssIntensity: state.setSssIntensity,
        sssColor: state.sssColor, setSssColor: state.setSssColor,
        sssThickness: state.sssThickness, setSssThickness: state.setSssThickness,
        sssJitter: state.sssJitter, setSssJitter: state.setSssJitter,
        fresnelEnabled: state.shaderSettings.surface.fresnelEnabled,
        setSurfaceSettings: state.setSurfaceSettings,
        fresnelIntensity: state.fresnelIntensity, setFresnelIntensity: state.setFresnelIntensity,
    }));
    const {
        sssEnabled, setSssEnabled,
        sssIntensity, setSssIntensity,
        sssColor, setSssColor,
        sssThickness, setSssThickness,
        sssJitter, setSssJitter,
        fresnelEnabled, setSurfaceSettings,
        fresnelIntensity, setFresnelIntensity,
    } = useAppearanceStore(appearanceSelector);

    return (
        <div className="space-y-4 mb-4 pb-4 border-b border-white/10">
            <div className="space-y-2">
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
    const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
        config: state.schroedinger,
        setDensityGain: state.setSchroedingerDensityGain,
        setPowderScale: state.setSchroedingerPowderScale,
        setScatteringAnisotropy: state.setSchroedingerScatteringAnisotropy,
        setDispersionEnabled: state.setSchroedingerDispersionEnabled,
        setDispersionStrength: state.setSchroedingerDispersionStrength,
        setDispersionDirection: state.setSchroedingerDispersionDirection,
        setDispersionQuality: state.setSchroedingerDispersionQuality,
        // Shadows/AO
        setShadowsEnabled: state.setSchroedingerShadowsEnabled,
        setShadowStrength: state.setSchroedingerShadowStrength,
        setAoEnabled: state.setSchroedingerAoEnabled,
        setAoStrength: state.setSchroedingerAoStrength,
        // Quantum Effects
        setNodalEnabled: state.setSchroedingerNodalEnabled,
        setNodalColor: state.setSchroedingerNodalColor,
        setNodalStrength: state.setSchroedingerNodalStrength,
        setEnergyColorEnabled: state.setSchroedingerEnergyColorEnabled,
        setShimmerEnabled: state.setSchroedingerShimmerEnabled,
        setShimmerStrength: state.setSchroedingerShimmerStrength,
        setIsoEnabled: state.setSchroedingerIsoEnabled,
        setIsoThreshold: state.setSchroedingerIsoThreshold,
        // New features
        setErosionStrength: state.setSchroedingerErosionStrength,
    }));
    const {
        config,
        setDensityGain,
        setPowderScale,
        setScatteringAnisotropy,
        setDispersionEnabled,
        setDispersionStrength,
        setDispersionDirection,
        setDispersionQuality,
        setShadowsEnabled,
        setShadowStrength,
        setAoEnabled,
        setAoStrength,
        setNodalEnabled,
        setNodalColor,
        setNodalStrength,
        setEnergyColorEnabled,
        setShimmerEnabled,
        setShimmerStrength,
        setIsoEnabled,
        setIsoThreshold,
        setErosionStrength,
    } = useExtendedObjectStore(extendedObjectSelector);

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

            {/* Volume Effects */}
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">Volume Effects</label>
                </div>

                {/* Erosion */}
                <div className="mt-2">
                    <Slider
                        label="Surface Erosion"
                        min={0}
                        max={1}
                        step={0.1}
                        value={config.erosionStrength ?? 0.0}
                        onChange={setErosionStrength}
                        showValue
                    />
                </div>

                {/* Shadows & AO */}
                <div className="flex items-center justify-between mt-2">
                    <label className="text-xs text-text-secondary">Volumetric Shadows</label>
                    <ToggleButton
                        pressed={config.shadowsEnabled ?? false}
                        onToggle={() => setShadowsEnabled(!(config.shadowsEnabled ?? false))}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle shadows"
                    >
                        {config.shadowsEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.shadowsEnabled && (
                    <Slider
                        label="Shadow Strength"
                        min={0}
                        max={2}
                        step={0.1}
                        value={config.shadowStrength ?? 1.0}
                        onChange={setShadowStrength}
                        showValue
                    />
                )}

                <div className="flex items-center justify-between mt-2">
                    <label className="text-xs text-text-secondary">Volumetric AO</label>
                    <ToggleButton
                        pressed={config.aoEnabled ?? false}
                        onToggle={() => setAoEnabled(!(config.aoEnabled ?? false))}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle AO"
                    >
                        {config.aoEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.aoEnabled && (
                    <Slider
                        label="AO Strength"
                        min={0}
                        max={2}
                        step={0.1}
                        value={config.aoStrength ?? 1.0}
                        onChange={setAoStrength}
                        showValue
                    />
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

const MandelbulbAdvanced: React.FC = () => {
    const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
        config: state.mandelbulb,
        // Animations
        setAlternatePowerEnabled: state.setMandelbulbAlternatePowerEnabled,
        setAlternatePowerValue: state.setMandelbulbAlternatePowerValue,
        setAlternatePowerBlend: state.setMandelbulbAlternatePowerBlend,
        // Atmosphere
        setFogEnabled: state.setMandelbulbFogEnabled,
        setFogContribution: state.setMandelbulbFogContribution,
        setInternalFogDensity: state.setMandelbulbInternalFogDensity,
    }));
    const {
        config,
        setAlternatePowerEnabled,
        setAlternatePowerValue,
        setAlternatePowerBlend,
        setFogEnabled,
        setFogContribution,
        setInternalFogDensity,
    } = useExtendedObjectStore(extendedObjectSelector);

    return (
        <div className="space-y-6">
            {/* Alternate Power (Technique B) */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Alternate Power</label>
                    <ToggleButton
                        pressed={config.alternatePowerEnabled}
                        onToggle={() => setAlternatePowerEnabled(!config.alternatePowerEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle alternate power"
                    >
                        {config.alternatePowerEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.alternatePowerEnabled && (
                    <div className="space-y-3 pl-2 border-l border-white/10">
                        <Slider label="Power 2" min={2} max={16} step={0.1} value={config.alternatePowerValue} onChange={setAlternatePowerValue} showValue />
                        <Slider label="Blend" min={0} max={1} step={0.05} value={config.alternatePowerBlend} onChange={setAlternatePowerBlend} showValue />
                    </div>
                )}
            </div>

            {/* Atmosphere */}
            <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Atmosphere</label>
                    <ToggleButton
                        pressed={config.fogEnabled}
                        onToggle={() => setFogEnabled(!config.fogEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle atmosphere"
                    >
                        {config.fogEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.fogEnabled && (
                    <div className="space-y-3 pl-2 border-l border-white/10">
                        <Slider label="Contribution" min={0} max={2} step={0.1} value={config.fogContribution} onChange={setFogContribution} showValue />
                        <Slider label="Internal Fog" min={0} max={1} step={0.05} value={config.internalFogDensity} onChange={setInternalFogDensity} showValue />
                    </div>
                )}
            </div>
        </div>
    );
};

const PolytopeAdvanced: React.FC = () => {
    // All Polytope animations have been moved to the Timeline Animation Drawer.
    // This component is currently empty but retained for future advanced settings.
    return null;
};

const BlackHoleAdvanced: React.FC = () => {
    const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
        config: state.blackhole,
        // Visuals
        setGravityStrength: state.setBlackHoleGravityStrength,
        setManifoldIntensity: state.setBlackHoleManifoldIntensity,
        setBloomBoost: state.setBlackHoleBloomBoost,
        setDiskTemperature: state.setBlackHoleDiskTemperature,
        // Lensing
        setDimensionEmphasis: state.setBlackHoleDimensionEmphasis,
        setDistanceFalloff: state.setBlackHoleDistanceFalloff,
        setBendScale: state.setBlackHoleBendScale,
        setBendMaxPerStep: state.setBlackHoleBendMaxPerStep,
        setRayBendingMode: state.setBlackHoleRayBendingMode,
        setLensingClamp: state.setBlackHoleLensingClamp,
        setEpsilonMul: state.setBlackHoleEpsilonMul,
        // Manifold Visuals
        setDensityFalloff: state.setBlackHoleDensityFalloff,
        setNoiseScale: state.setBlackHoleNoiseScale,
        setNoiseAmount: state.setBlackHoleNoiseAmount,
        // Shell
        setPhotonShellWidth: state.setBlackHolePhotonShellWidth,
        setShellGlowStrength: state.setBlackHoleShellGlowStrength,
        setShellGlowColor: state.setBlackHoleShellGlowColor,
        setShellContrastBoost: state.setBlackHoleShellContrastBoost,
        // Doppler
        setDopplerEnabled: state.setBlackHoleDopplerEnabled,
        setDopplerStrength: state.setBlackHoleDopplerStrength,
        setDopplerHueShift: state.setBlackHoleDopplerHueShift,
        // Jets
        setJetsEnabled: state.setBlackHoleJetsEnabled,
        setJetsHeight: state.setBlackHoleJetsHeight,
        setJetsWidth: state.setBlackHoleJetsWidth,
        setJetsIntensity: state.setBlackHoleJetsIntensity,
        setJetsColor: state.setBlackHoleJetsColor,
        setJetsFalloff: state.setBlackHoleJetsFalloff,
        setJetsNoiseAmount: state.setBlackHoleJetsNoiseAmount,
        // Rendering
        setMaxSteps: state.setBlackHoleMaxSteps,
        setStepBase: state.setBlackHoleStepBase,
        setEnableAbsorption: state.setBlackHoleEnableAbsorption,
        setAbsorption: state.setBlackHoleAbsorption,
        // Motion blur
        setMotionBlurEnabled: state.setBlackHoleMotionBlurEnabled,
        setMotionBlurStrength: state.setBlackHoleMotionBlurStrength,
        // Deferred lensing
        setDeferredLensingEnabled: state.setBlackHoleDeferredLensingEnabled,
        setDeferredLensingStrength: state.setBlackHoleDeferredLensingStrength,
        setDeferredLensingChromaticAberration: state.setBlackHoleDeferredLensingChromaticAberration,
    }));
    const {
        config,
        setGravityStrength,
        setManifoldIntensity,
        setBloomBoost,
        setDiskTemperature,
        setDimensionEmphasis,
        setDistanceFalloff,
        setBendScale,
        setRayBendingMode,
        setEpsilonMul,
        setDensityFalloff,
        setNoiseScale,
        setNoiseAmount,
        setPhotonShellWidth,
        setShellGlowStrength,
        setShellGlowColor,
        setDopplerEnabled,
        setDopplerStrength,
        setDopplerHueShift,
        setJetsEnabled,
        setJetsHeight,
        setJetsWidth,
        setJetsIntensity,
        setJetsColor,
        setJetsNoiseAmount,
        setMaxSteps,
        setStepBase,
        setEnableAbsorption,
        setAbsorption,
        setMotionBlurEnabled,
        setMotionBlurStrength,
        setDeferredLensingEnabled,
        setDeferredLensingStrength,
        setDeferredLensingChromaticAberration,
    } = useExtendedObjectStore(extendedObjectSelector);

    return (
        <div className="space-y-6">
            {/* Gravity & Lensing */}
            <div className="space-y-3 pt-2">
                <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Gravity & Lensing</label>

                <Slider
                    label="Gravity Strength"
                    min={0}
                    max={10.0}
                    step={0.1}
                    value={config.gravityStrength}
                    onChange={setGravityStrength}
                    showValue
                    data-testid="blackhole-gravity-strength"
                />

                <Slider
                    label="Bloom Boost"
                    min={0}
                    max={5.0}
                    step={0.1}
                    value={config.bloomBoost}
                    onChange={setBloomBoost}
                    showValue
                    data-testid="blackhole-bloom-boost"
                />

                <div className="p-3 bg-black/20 rounded border border-white/5 space-y-3">
                    <label className="text-xs text-text-tertiary font-medium">Advanced Lensing</label>
                    <Slider
                        label="Bend Scale"
                        min={0}
                        max={3}
                        step={0.1}
                        value={config.bendScale}
                        onChange={setBendScale}
                        showValue
                    />
                    <Slider
                        label="Dist. Falloff"
                        min={0.5}
                        max={4}
                        step={0.1}
                        value={config.distanceFalloff}
                        onChange={setDistanceFalloff}
                        showValue
                    />
                    <Slider
                        label="Dim. Emphasis"
                        min={0}
                        max={2}
                        step={0.1}
                        value={config.dimensionEmphasis}
                        onChange={setDimensionEmphasis}
                        showValue
                    />
                    <div className="flex gap-2">
                         <div className="flex-1">
                            <label className="text-xs text-text-tertiary">Mode</label>
                            <select
                                className="w-full bg-surface-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                                value={config.rayBendingMode}
                                onChange={(e) => setRayBendingMode(e.target.value as BlackHoleRayBendingMode)}
                            >
                                <option value="spiral">Spiral</option>
                                <option value="orbital">Orbital</option>
                            </select>
                         </div>
                         <div className="flex-1">
                             <label className="text-xs text-text-tertiary">Stability</label>
                             <input
                                type="number"
                                step="0.001"
                                min="0.0001"
                                max="0.5"
                                value={config.epsilonMul}
                                onChange={(e) => setEpsilonMul(parseFloat(e.target.value))}
                                className="w-full bg-surface-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary mt-1 focus:outline-none focus:border-accent"
                             />
                         </div>
                    </div>
                </div>
            </div>

            {/* Accretion Visuals */}
            <div className="space-y-3 pt-2 border-t border-white/5">
                <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Accretion Disk</label>

                <Slider
                    label="Intensity"
                    min={0}
                    max={10.0}
                    step={0.1}
                    value={config.manifoldIntensity}
                    onChange={setManifoldIntensity}
                    showValue
                />

                <Slider
                    label="Temperature (K)"
                    min={1000}
                    max={40000}
                    step={100}
                    value={config.diskTemperature}
                    onChange={setDiskTemperature}
                    showValue
                />

                <Slider
                    label="Density Falloff"
                    min={1}
                    max={40}
                    step={1}
                    value={config.densityFalloff}
                    onChange={setDensityFalloff}
                    showValue
                />

                <div className="p-3 bg-black/20 rounded border border-white/5 space-y-3">
                    <label className="text-xs text-text-tertiary font-medium">Turbulence</label>
                    <Slider
                        label="Noise Amount"
                        min={0}
                        max={1}
                        step={0.05}
                        value={config.noiseAmount}
                        onChange={setNoiseAmount}
                        showValue
                    />
                    <Slider
                        label="Noise Scale"
                        min={0.1}
                        max={5}
                        step={0.1}
                        value={config.noiseScale}
                        onChange={setNoiseScale}
                        showValue
                    />
                </div>
            </div>

            {/* Photon Shell */}
            <div className="space-y-3 pt-2 border-t border-white/5">
                <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Photon Shell</label>

                <Slider
                    label="Width"
                    min={0}
                    max={0.3}
                    step={0.01}
                    value={config.photonShellWidth}
                    onChange={setPhotonShellWidth}
                    showValue
                />

                <Slider
                    label="Glow Strength"
                    min={0}
                    max={10.0}
                    step={0.5}
                    value={config.shellGlowStrength}
                    onChange={setShellGlowStrength}
                    showValue
                />

                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary">Color</label>
                    <ColorPicker
                        value={config.shellGlowColor}
                        onChange={setShellGlowColor}
                        disableAlpha={true}
                        className="w-24"
                    />
                </div>
            </div>

            {/* Relativistic Effects */}
            <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Relativistic Effects</label>
                    <ToggleButton
                        pressed={config.dopplerEnabled}
                        onToggle={() => setDopplerEnabled(!config.dopplerEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle doppler effect"
                    >
                        {config.dopplerEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>

                {config.dopplerEnabled && (
                    <div className="space-y-3 pl-2 border-l border-white/10">
                        <Slider
                            label="Doppler Strength"
                            min={0}
                            max={2.0}
                            step={0.1}
                            value={config.dopplerStrength}
                            onChange={setDopplerStrength}
                            showValue
                        />
                        <Slider
                            label="Hue Shift"
                            min={0}
                            max={0.5}
                            step={0.01}
                            value={config.dopplerHueShift}
                            onChange={setDopplerHueShift}
                            showValue
                        />
                    </div>
                )}
            </div>

            {/* Polar Jets */}
            <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Polar Jets</label>
                    <ToggleButton
                        pressed={config.jetsEnabled}
                        onToggle={() => setJetsEnabled(!config.jetsEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle polar jets"
                    >
                        {config.jetsEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>

                {config.jetsEnabled && (
                    <div className="space-y-3 pl-2 border-l border-white/10">
                        <Slider
                            label="Height"
                            min={1}
                            max={30}
                            step={1}
                            value={config.jetsHeight}
                            onChange={setJetsHeight}
                            showValue
                        />
                        <Slider
                            label="Width"
                            min={0.1}
                            max={2.0}
                            step={0.1}
                            value={config.jetsWidth}
                            onChange={setJetsWidth}
                            showValue
                        />
                        <Slider
                            label="Intensity"
                            min={0}
                            max={5.0}
                            step={0.1}
                            value={config.jetsIntensity}
                            onChange={setJetsIntensity}
                            showValue
                        />
                        <Slider
                            label="Noise"
                            min={0}
                            max={1}
                            step={0.1}
                            value={config.jetsNoiseAmount}
                            onChange={setJetsNoiseAmount}
                            showValue
                        />
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-text-secondary">Color</label>
                            <ColorPicker
                                value={config.jetsColor}
                                onChange={setJetsColor}
                                disableAlpha={true}
                                className="w-24"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Rendering Quality */}
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <label className="text-xs text-text-secondary font-semibold">Rendering</label>
                <Slider
                    label="Max Steps"
                    min={32}
                    max={256}
                    step={16}
                    value={config.maxSteps}
                    onChange={setMaxSteps}
                    showValue
                    data-testid="blackhole-max-steps"
                />
                <Slider
                    label="Step Size"
                    min={0.01}
                    max={0.2}
                    step={0.01}
                    value={config.stepBase}
                    onChange={setStepBase}
                    showValue
                    data-testid="blackhole-step-size"
                />
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary">Absorption</label>
                    <ToggleButton
                        pressed={config.enableAbsorption}
                        onToggle={() => setEnableAbsorption(!config.enableAbsorption)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle absorption"
                        data-testid="blackhole-absorption-toggle"
                    >
                        {config.enableAbsorption ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.enableAbsorption && (
                    <Slider
                        label="Absorption"
                        min={0}
                        max={5}
                        step={0.1}
                        value={config.absorption}
                        onChange={setAbsorption}
                        showValue
                        data-testid="blackhole-absorption"
                    />
                )}
            </div>

            {/* Motion Blur */}
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">Motion Blur</label>
                    <ToggleButton
                        pressed={config.motionBlurEnabled}
                        onToggle={() => setMotionBlurEnabled(!config.motionBlurEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle motion blur"
                        data-testid="blackhole-motion-blur-toggle"
                    >
                        {config.motionBlurEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.motionBlurEnabled && (
                    <Slider
                        label="Strength"
                        min={0}
                        max={2}
                        step={0.1}
                        value={config.motionBlurStrength}
                        onChange={setMotionBlurStrength}
                        showValue
                        data-testid="blackhole-motion-blur-strength"
                    />
                )}
            </div>

            {/* Deferred Lensing */}
            <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary font-semibold">Deferred Lensing</label>
                    <ToggleButton
                        pressed={config.deferredLensingEnabled}
                        onToggle={() => setDeferredLensingEnabled(!config.deferredLensingEnabled)}
                        className="text-xs px-2 py-1 h-auto"
                        ariaLabel="Toggle deferred lensing"
                        data-testid="blackhole-deferred-lensing-toggle"
                    >
                        {config.deferredLensingEnabled ? 'ON' : 'OFF'}
                    </ToggleButton>
                </div>
                {config.deferredLensingEnabled && (
                    <Slider
                        label="Strength"
                        min={0}
                        max={2}
                        step={0.1}
                        value={config.deferredLensingStrength}
                        onChange={setDeferredLensingStrength}
                        showValue
                        data-testid="blackhole-deferred-lensing-strength"
                    />
                )}
                {config.deferredLensingEnabled && (
                    <Slider
                        label="Chromatic Aberration"
                        min={0}
                        max={1}
                        step={0.05}
                        value={config.deferredLensingChromaticAberration}
                        onChange={setDeferredLensingChromaticAberration}
                        showValue
                        data-testid="blackhole-deferred-lensing-chromatic-aberration"
                    />
                )}
                <p className="text-xs text-text-tertiary">
                    Apply gravitational lensing to scene objects
                </p>
            </div>
        </div>
    );
};
