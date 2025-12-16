/**
 * Faces Section Component
 *
 * Sidebar section for all face/surface settings organized in tabs:
 * - Colors: Color algorithm selection and configuration
 * - Material: Opacity, diffuse, and specular settings
 * - FX: Fresnel rim effects and shadow controls
 *
 * Only visible when facesVisible is true.
 */

import { Section } from '@/components/sections/Section';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import {
  LAYER_COUNT_OPTIONS,
  LAYER_OPACITY_RANGE,
  OPACITY_MODE_LABELS,
  OPACITY_MODE_OPTIONS,
  OPACITY_MODE_TOOLTIPS,
  SAMPLE_QUALITY_LABELS,
  SAMPLE_QUALITY_OPTIONS,
  SIMPLE_ALPHA_RANGE,
  VOLUMETRIC_DENSITY_RANGE,
} from '@/rendering/opacity/constants';
import type { OpacityMode, SampleQuality, VolumetricAnimationQuality } from '@/rendering/opacity/types';
import {
  DEFAULT_SHADOW_SOFTNESS,
  SHADOW_ANIMATION_MODE_LABELS,
  SHADOW_ANIMATION_MODE_OPTIONS,
  SHADOW_ANIMATION_MODE_TOOLTIPS,
  SHADOW_QUALITY_LABELS,
  SHADOW_QUALITY_OPTIONS,
  SHADOW_QUALITY_TOOLTIPS,
  SHADOW_SOFTNESS_RANGE,
} from '@/rendering/shadows/constants';
import type { ShadowAnimationMode, ShadowQuality } from '@/rendering/shadows/types';
import { isRaymarchingFractal } from '@/lib/geometry/registry';
import { useGeometryStore } from '@/stores/geometryStore';
import {
  DEFAULT_DIFFUSE_INTENSITY,
  DEFAULT_FRESNEL_INTENSITY,
  DEFAULT_LCH_CHROMA,
  DEFAULT_LCH_LIGHTNESS,
  DEFAULT_SHININESS,
  DEFAULT_SPECULAR_COLOR,
  DEFAULT_SPECULAR_INTENSITY,
  DEFAULT_SURFACE_SETTINGS,
} from '@/stores/defaults/visualDefaults';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import { useUIStore } from '@/stores/uiStore';
import React, { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ColorAlgorithmSelector } from './ColorAlgorithmSelector';
import { ColorPreview } from './ColorPreview';
import { CosineGradientEditor } from './CosineGradientEditor';
import { DistributionControls } from './DistributionControls';
import { LchPresetSelector } from './LchPresetSelector';
import { PresetSelector } from './PresetSelector';

export interface FacesSectionProps {
  defaultOpen?: boolean;
}

type FacesTabId = 'colors' | 'material' | 'fx';

export const FacesSection: React.FC<FacesSectionProps> = ({
  defaultOpen = false,
}) => {
  const [activeTab, setActiveTab] = useState<FacesTabId>('colors');

  // Get object type and dimension to check if we're viewing a raymarching fractal
  const objectType = useGeometryStore((state) => state.objectType);
  const dimension = useGeometryStore((state) => state.dimension);
  const isRaymarchingFractalType = isRaymarchingFractal(objectType, dimension);

  // Appearance settings
  const {
    facesVisible,
    colorAlgorithm,
    faceColor,
    setFaceColor,
    shaderSettings,
    setSurfaceSettings,
    fresnelIntensity,
    setFresnelIntensity,
    lchLightness,
    setLchLightness,
    lchChroma,
    setLchChroma,
    shaderType,
  } = useAppearanceStore(
    useShallow((state) => ({
      facesVisible: state.facesVisible,
      colorAlgorithm: state.colorAlgorithm,
      faceColor: state.faceColor,
      setFaceColor: state.setFaceColor,
      shaderSettings: state.shaderSettings,
      setSurfaceSettings: state.setSurfaceSettings,
      fresnelIntensity: state.fresnelIntensity,
      setFresnelIntensity: state.setFresnelIntensity,
      lchLightness: state.lchLightness,
      setLchLightness: state.setLchLightness,
      lchChroma: state.lchChroma,
      setLchChroma: state.setLchChroma,
      shaderType: state.shaderType,
    }))
  );

  // Lighting settings
  const {
    lightEnabled,
    specularIntensity,
    shininess,
    specularColor,
    diffuseIntensity,
    setSpecularIntensity,
    setShininess,
    setSpecularColor,
    setDiffuseIntensity,
    lights,
    shadowEnabled,
    shadowQuality,
    shadowSoftness,
    shadowAnimationMode,
    setShadowEnabled,
    setShadowQuality,
    setShadowSoftness,
    setShadowAnimationMode,
  } = useLightingStore(
    useShallow((state) => ({
      lightEnabled: state.lightEnabled,
      specularIntensity: state.specularIntensity,
      shininess: state.shininess,
      specularColor: state.specularColor,
      diffuseIntensity: state.diffuseIntensity,
      setSpecularIntensity: state.setSpecularIntensity,
      setShininess: state.setShininess,
      setSpecularColor: state.setSpecularColor,
      setDiffuseIntensity: state.setDiffuseIntensity,
      lights: state.lights,
      shadowEnabled: state.shadowEnabled,
      shadowQuality: state.shadowQuality,
      shadowSoftness: state.shadowSoftness,
      shadowAnimationMode: state.shadowAnimationMode,
      setShadowEnabled: state.setShadowEnabled,
      setShadowQuality: state.setShadowQuality,
      setShadowSoftness: state.setShadowSoftness,
      setShadowAnimationMode: state.setShadowAnimationMode,
    }))
  );

  // UI settings (Opacity)
  const {
    opacitySettings,
    hasSeenVolumetricWarning,
    setOpacityMode,
    setSimpleAlphaOpacity,
    setLayerCount,
    setLayerOpacity,
    setVolumetricDensity,
    setSampleQuality,
    setVolumetricAnimationQuality,
    setHasSeenVolumetricWarning,
  } = useUIStore(
    useShallow((state) => ({
      opacitySettings: state.opacitySettings,
      hasSeenVolumetricWarning: state.hasSeenVolumetricWarning,
      setOpacityMode: state.setOpacityMode,
      setSimpleAlphaOpacity: state.setSimpleAlphaOpacity,
      setLayerCount: state.setLayerCount,
      setLayerOpacity: state.setLayerOpacity,
      setVolumetricDensity: state.setVolumetricDensity,
      setSampleQuality: state.setSampleQuality,
      setVolumetricAnimationQuality: state.setVolumetricAnimationQuality,
      setHasSeenVolumetricWarning: state.setHasSeenVolumetricWarning,
    }))
  );

  const surfaceSettings = shaderSettings.surface;

  // Check if any light is enabled for shadow controls
  const hasEnabledLights = lights.some((light) => light.enabled);

  // Only show when faces are visible
  if (!facesVisible) {
    return null;
  }

  // Check if lighting controls should be shown
  const showLightingControls = shaderType === 'surface' && lightEnabled;

  const tabs = [
    {
      id: 'colors' as const,
      label: 'Colors',
      content: (
        <ColorsTabContent
          colorAlgorithm={colorAlgorithm}
          faceColor={faceColor}
          setFaceColor={setFaceColor}
          lchLightness={lchLightness}
          setLchLightness={setLchLightness}
          lchChroma={lchChroma}
          setLchChroma={setLchChroma}
        />
      ),
    },
    {
      id: 'material' as const,
      label: 'Material',
      content: (
        <MaterialTabContent
          faceOpacity={surfaceSettings.faceOpacity}
          setFaceOpacity={(value) => setSurfaceSettings({ faceOpacity: value })}
          showLightingControls={showLightingControls}
          diffuseIntensity={diffuseIntensity}
          setDiffuseIntensity={setDiffuseIntensity}
          specularColor={specularColor}
          setSpecularColor={setSpecularColor}
          specularIntensity={specularIntensity}
          setSpecularIntensity={setSpecularIntensity}
          shininess={shininess}
          setShininess={setShininess}
          // Opacity props (raymarching fractals)
          isRaymarchingFractalType={isRaymarchingFractalType}
          opacityMode={opacitySettings.mode}
          simpleAlphaOpacity={opacitySettings.simpleAlphaOpacity}
          layerCount={opacitySettings.layerCount}
          layerOpacity={opacitySettings.layerOpacity}
          volumetricDensity={opacitySettings.volumetricDensity}
          sampleQuality={opacitySettings.sampleQuality}
          volumetricAnimationQuality={opacitySettings.volumetricAnimationQuality}
          hasSeenVolumetricWarning={hasSeenVolumetricWarning}
          onOpacityModeChange={setOpacityMode}
          onSimpleAlphaChange={setSimpleAlphaOpacity}
          onLayerCountChange={setLayerCount}
          onLayerOpacityChange={setLayerOpacity}
          onVolumetricDensityChange={setVolumetricDensity}
          onSampleQualityChange={setSampleQuality}
          onVolumetricAnimationQualityChange={setVolumetricAnimationQuality}
          onSeenVolumetricWarning={() => setHasSeenVolumetricWarning(true)}
        />
      ),
    },
    {
      id: 'fx' as const,
      label: 'FX',
      content: (
        <FxTabContent
          fresnelEnabled={surfaceSettings.fresnelEnabled}
          setFresnelEnabled={(enabled) =>
            setSurfaceSettings({ fresnelEnabled: enabled })
          }
          fresnelIntensity={fresnelIntensity}
          setFresnelIntensity={setFresnelIntensity}
          // Shadow props
          hasEnabledLights={hasEnabledLights}
          shadowEnabled={shadowEnabled}
          shadowQuality={shadowQuality}
          shadowSoftness={shadowSoftness}
          shadowAnimationMode={shadowAnimationMode}
          onShadowEnabledChange={setShadowEnabled}
          onShadowQualityChange={setShadowQuality}
          onShadowSoftnessChange={setShadowSoftness}
          onShadowAnimationModeChange={setShadowAnimationMode}
        />
      ),
    },
  ];

  return (
    <Section title="Faces" defaultOpen={defaultOpen} data-testid="section-faces">
      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={(id) => setActiveTab(id as FacesTabId)}
        tabListClassName="mb-4"
        data-testid="faces-tabs"
      />
    </Section>
  );
};

// =============================================================================
// Colors Tab Content
// =============================================================================

interface ColorsTabContentProps {
  colorAlgorithm: string;
  faceColor: string;
  setFaceColor: (color: string) => void;
  lchLightness: number;
  setLchLightness: (value: number) => void;
  lchChroma: number;
  setLchChroma: (value: number) => void;
}

const ColorsTabContent: React.FC<ColorsTabContentProps> = ({
  colorAlgorithm,
  faceColor,
  setFaceColor,
  lchLightness,
  setLchLightness,
  lchChroma,
  setLchChroma,
}) => {
  return (
    <div className="space-y-4">
      {/* Color Algorithm Selection */}
      <ColorAlgorithmSelector />

      {/* Live Preview */}
      <ColorPreview />

      {/* Algorithm-Specific Controls */}
      {/* Monochromatic and Analogous use base color */}
      {(colorAlgorithm === 'monochromatic' ||
        colorAlgorithm === 'analogous') && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">
            Base Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={faceColor}
              onChange={(e) => setFaceColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-panel-border"
            />
            <span className="text-xs font-mono text-text-secondary">
              {faceColor}
            </span>
          </div>
        </div>
      )}

      {colorAlgorithm === 'cosine' && (
        <div className="space-y-4">
          <PresetSelector />
          <CosineGradientEditor />
          <DistributionControls />
        </div>
      )}

      {colorAlgorithm === 'normal' && (
        <div className="space-y-4">
          <PresetSelector />
          <CosineGradientEditor />
          <DistributionControls />
        </div>
      )}

      {colorAlgorithm === 'distance' && (
        <div className="space-y-4">
          <PresetSelector />
          <CosineGradientEditor />
          <DistributionControls />
        </div>
      )}

      {colorAlgorithm === 'lch' && (
        <div className="space-y-4">
          <LchPresetSelector />
          <Slider
            label="Lightness"
            min={0.1}
            max={1}
            step={0.01}
            value={lchLightness}
            onChange={setLchLightness}
            onReset={() => setLchLightness(DEFAULT_LCH_LIGHTNESS)}
            showValue
          />
          <Slider
            label="Chroma"
            min={0}
            max={0.4}
            step={0.01}
            value={lchChroma}
            onChange={setLchChroma}
            onReset={() => setLchChroma(DEFAULT_LCH_CHROMA)}
            showValue
          />
          <DistributionControls />
        </div>
      )}

      {colorAlgorithm === 'multiSource' && (
        <div className="space-y-4">
          <PresetSelector />
          <CosineGradientEditor />
          <DistributionControls />
          <MultiSourceWeightsEditor />
        </div>
      )}

      {colorAlgorithm === 'radial' && (
        <div className="space-y-4">
          <PresetSelector />
          <CosineGradientEditor />
          <DistributionControls />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Material Tab Content
// =============================================================================

interface MaterialTabContentProps {
  faceOpacity: number;
  setFaceOpacity: (value: number) => void;
  showLightingControls: boolean;
  diffuseIntensity: number;
  setDiffuseIntensity: (value: number) => void;
  specularColor: string;
  setSpecularColor: (color: string) => void;
  specularIntensity: number;
  setSpecularIntensity: (value: number) => void;
  shininess: number;
  setShininess: (value: number) => void;
  // Raymarching fractals opacity props
  isRaymarchingFractalType: boolean;
  opacityMode: OpacityMode;
  simpleAlphaOpacity: number;
  layerCount: 2 | 3 | 4;
  layerOpacity: number;
  volumetricDensity: number;
  sampleQuality: SampleQuality;
  volumetricAnimationQuality: VolumetricAnimationQuality;
  hasSeenVolumetricWarning: boolean;
  onOpacityModeChange: (mode: OpacityMode) => void;
  onSimpleAlphaChange: (value: number) => void;
  onLayerCountChange: (count: 2 | 3 | 4) => void;
  onLayerOpacityChange: (value: number) => void;
  onVolumetricDensityChange: (value: number) => void;
  onSampleQualityChange: (quality: SampleQuality) => void;
  onVolumetricAnimationQualityChange: (quality: VolumetricAnimationQuality) => void;
  onSeenVolumetricWarning: () => void;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider pt-2 pb-1 border-t border-panel-border mt-2 first:mt-0 first:border-t-0 first:pt-0">
    {title}
  </div>
);

const MaterialTabContent: React.FC<MaterialTabContentProps> = ({
  faceOpacity,
  setFaceOpacity,
  showLightingControls,
  diffuseIntensity,
  setDiffuseIntensity,
  specularColor,
  setSpecularColor,
  specularIntensity,
  setSpecularIntensity,
  shininess,
  setShininess,
  // Raymarching fractals opacity props
  isRaymarchingFractalType,
  opacityMode,
  simpleAlphaOpacity,
  layerCount,
  layerOpacity,
  volumetricDensity,
  sampleQuality,
  volumetricAnimationQuality,
  hasSeenVolumetricWarning,
  onOpacityModeChange,
  onSimpleAlphaChange,
  onLayerCountChange,
  onLayerOpacityChange,
  onVolumetricDensityChange,
  onSampleQualityChange,
  onVolumetricAnimationQualityChange,
  onSeenVolumetricWarning,
}) => {
  // State for volumetric warning toast
  const [showVolumetricWarning, setShowVolumetricWarning] = useState(false);

  // Handle opacity mode change with volumetric warning
  const handleOpacityModeChange = useCallback(
    (mode: OpacityMode) => {
      if (mode === 'volumetricDensity' && !hasSeenVolumetricWarning) {
        setShowVolumetricWarning(true);
        onSeenVolumetricWarning();
      }
      onOpacityModeChange(mode);
    },
    [hasSeenVolumetricWarning, onOpacityModeChange, onSeenVolumetricWarning]
  );

  // Auto-dismiss warning after 3 seconds
  useEffect(() => {
    if (showVolumetricWarning) {
      const timer = setTimeout(() => setShowVolumetricWarning(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showVolumetricWarning]);

  return (
    <div className="space-y-3">
      {/* Raymarching Fractals Opacity Mode Controls */}
      {isRaymarchingFractalType && (
        <>
          <SectionHeader title="Opacity Mode" />

          {/* Opacity Mode Dropdown */}
          <div className="space-y-2">
            <select
              value={opacityMode}
              onChange={(e) => handleOpacityModeChange(e.target.value as OpacityMode)}
              className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              title={OPACITY_MODE_TOOLTIPS[opacityMode]}
            >
              {OPACITY_MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {OPACITY_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary">
              {OPACITY_MODE_TOOLTIPS[opacityMode]}
            </p>
          </div>

          {/* Volumetric Warning Toast */}
          {showVolumetricWarning && (
            <div className="bg-warning/20 border border-warning/50 rounded px-3 py-2 text-xs text-warning">
              Volumetric mode may reduce performance on some devices.
            </div>
          )}

          {/* Simple Alpha Mode Controls */}
          {opacityMode === 'simpleAlpha' && (
            <Slider
              label="Face Opacity"
              min={SIMPLE_ALPHA_RANGE.min}
              max={SIMPLE_ALPHA_RANGE.max}
              step={SIMPLE_ALPHA_RANGE.step}
              value={simpleAlphaOpacity}
              onChange={onSimpleAlphaChange}
              onReset={() => onSimpleAlphaChange(SIMPLE_ALPHA_RANGE.default)}
              showValue
            />
          )}

          {/* Layered Surfaces Mode Controls */}
          {opacityMode === 'layeredSurfaces' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Layer Count
                </label>
                <select
                  value={layerCount}
                  onChange={(e) => onLayerCountChange(Number(e.target.value) as 2 | 3 | 4)}
                  className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {LAYER_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} Layers
                    </option>
                  ))}
                </select>
              </div>
              <Slider
                label="Layer Opacity"
                min={LAYER_OPACITY_RANGE.min}
                max={LAYER_OPACITY_RANGE.max}
                step={LAYER_OPACITY_RANGE.step}
                value={layerOpacity}
                onChange={onLayerOpacityChange}
                onReset={() => onLayerOpacityChange(LAYER_OPACITY_RANGE.default)}
                showValue
              />
            </>
          )}

          {/* Volumetric Density Mode Controls */}
          {opacityMode === 'volumetricDensity' && (
            <>
              <Slider
                label="Density"
                min={VOLUMETRIC_DENSITY_RANGE.min}
                max={VOLUMETRIC_DENSITY_RANGE.max}
                step={VOLUMETRIC_DENSITY_RANGE.step}
                value={volumetricDensity}
                onChange={onVolumetricDensityChange}
                onReset={() => onVolumetricDensityChange(VOLUMETRIC_DENSITY_RANGE.default)}
                showValue
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Sample Quality
                </label>
                <select
                  value={sampleQuality}
                  onChange={(e) => onSampleQualityChange(e.target.value as SampleQuality)}
                  className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {SAMPLE_QUALITY_OPTIONS.map((quality) => (
                    <option key={quality} value={quality}>
                      {SAMPLE_QUALITY_LABELS[quality]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Animation Quality
                </label>
                <select
                  value={volumetricAnimationQuality}
                  onChange={(e) =>
                    onVolumetricAnimationQualityChange(e.target.value as VolumetricAnimationQuality)
                  }
                  className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="reduce">Reduce during animation</option>
                  <option value="full">Full quality always</option>
                </select>
                <p className="text-xs text-text-secondary">
                  {volumetricAnimationQuality === 'reduce'
                    ? 'Lower quality during rotation for better performance'
                    : 'Maintain full quality (may affect performance)'}
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* Face Opacity - Only shown for non-mandelbulb objects */}
      {!isRaymarchingFractalType && (
        <Slider
          label="Face Opacity"
          min={0}
          max={1}
          step={0.1}
          value={faceOpacity}
          onChange={setFaceOpacity}
          onReset={() => setFaceOpacity(DEFAULT_SURFACE_SETTINGS.faceOpacity)}
          showValue
          data-testid="slider-face-opacity"
        />
      )}

      {/* Diffuse and Specular - Only when lighting is enabled */}
      {showLightingControls && (
        <>
          {/* Diffuse */}
          <SectionHeader title="Diffuse" />
          <Slider
            label="Diffuse Intensity"
            min={0}
            max={2}
            step={0.01}
            value={diffuseIntensity}
            onChange={setDiffuseIntensity}
            onReset={() => setDiffuseIntensity(DEFAULT_DIFFUSE_INTENSITY)}
            showValue
          />

          {/* Specular */}
          <SectionHeader title="Specular" />

          {/* Specular Color */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              Specular Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={specularColor}
                onChange={(e) => setSpecularColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-panel-border"
              />
              <span className="text-xs font-mono text-text-secondary">
                {specularColor}
              </span>
              {specularColor !== DEFAULT_SPECULAR_COLOR && (
                <button
                  onClick={() => setSpecularColor(DEFAULT_SPECULAR_COLOR)}
                  className="text-xs text-accent hover:text-accent/80 transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Specular Intensity */}
          <Slider
            label="Specular Intensity"
            min={0}
            max={2}
            step={0.1}
            value={specularIntensity}
            onChange={setSpecularIntensity}
            onReset={() => setSpecularIntensity(DEFAULT_SPECULAR_INTENSITY)}
            showValue
          />

          {/* Shininess */}
          <Slider
            label="Shininess"
            min={1}
            max={128}
            step={1}
            value={shininess}
            onChange={setShininess}
            onReset={() => setShininess(DEFAULT_SHININESS)}
            showValue
          />
        </>
      )}

      {!showLightingControls && (
        <p className="text-xs text-text-secondary italic">
          Enable lighting in the Visual section to access diffuse and specular
          settings.
        </p>
      )}
    </div>
  );
};

// =============================================================================
// FX Tab Content
// =============================================================================

interface FxTabContentProps {
  fresnelEnabled: boolean;
  setFresnelEnabled: (enabled: boolean) => void;
  fresnelIntensity: number;
  setFresnelIntensity: (value: number) => void;
  // Shadow props
  hasEnabledLights: boolean;
  shadowEnabled: boolean;
  shadowQuality: ShadowQuality;
  shadowSoftness: number;
  shadowAnimationMode: ShadowAnimationMode;
  onShadowEnabledChange: (enabled: boolean) => void;
  onShadowQualityChange: (quality: ShadowQuality) => void;
  onShadowSoftnessChange: (softness: number) => void;
  onShadowAnimationModeChange: (mode: ShadowAnimationMode) => void;
}

const FxTabContent: React.FC<FxTabContentProps> = ({
  fresnelEnabled,
  setFresnelEnabled,
  fresnelIntensity,
  setFresnelIntensity,
  // Shadow props
  hasEnabledLights,
  shadowEnabled,
  shadowQuality,
  shadowSoftness,
  shadowAnimationMode,
  onShadowEnabledChange,
  onShadowQualityChange,
  onShadowSoftnessChange,
  onShadowAnimationModeChange,
}) => {
  return (
    <div className="space-y-4">
      {/* Fresnel Rim Effect */}
      <Switch
        checked={fresnelEnabled}
        onCheckedChange={setFresnelEnabled}
        label="Fresnel Rim"
      />

      {fresnelEnabled && (
        <Slider
          label="Fresnel Intensity"
          min={0}
          max={1}
          step={0.1}
          value={fresnelIntensity}
          onChange={setFresnelIntensity}
          onReset={() => setFresnelIntensity(DEFAULT_FRESNEL_INTENSITY)}
          showValue
        />
      )}

      {/* Shadow Controls - Available for any object type with enabled lights */}
      {hasEnabledLights && (
        <>
          <SectionHeader title="Shadows" />

          {/* Shadow Toggle */}
          <Switch
            checked={shadowEnabled}
            onCheckedChange={onShadowEnabledChange}
            label="Shadows"
            data-testid="shadow-enabled-toggle"
          />

          {/* Shadow Quality & Softness - Only when shadows enabled */}
          {shadowEnabled && (
            <>
              {/* Shadow Quality */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Shadow Quality
                </label>
                <select
                  value={shadowQuality}
                  onChange={(e) => onShadowQualityChange(e.target.value as ShadowQuality)}
                  className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  title={SHADOW_QUALITY_TOOLTIPS[shadowQuality]}
                  data-testid="shadow-quality-select"
                >
                  {SHADOW_QUALITY_OPTIONS.map((quality) => (
                    <option key={quality} value={quality}>
                      {SHADOW_QUALITY_LABELS[quality]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-secondary">
                  {SHADOW_QUALITY_TOOLTIPS[shadowQuality]}
                </p>
              </div>

              {/* Shadow Softness */}
              <Slider
                label="Shadow Softness"
                min={SHADOW_SOFTNESS_RANGE.min}
                max={SHADOW_SOFTNESS_RANGE.max}
                step={SHADOW_SOFTNESS_RANGE.step}
                value={shadowSoftness}
                onChange={onShadowSoftnessChange}
                onReset={() => onShadowSoftnessChange(DEFAULT_SHADOW_SOFTNESS)}
                showValue
                data-testid="shadow-softness-slider"
              />

              {/* Shadow Animation Mode */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Animation Quality
                </label>
                <select
                  value={shadowAnimationMode}
                  onChange={(e) => onShadowAnimationModeChange(e.target.value as ShadowAnimationMode)}
                  className="w-full px-3 py-2 bg-control-bg border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  title={SHADOW_ANIMATION_MODE_TOOLTIPS[shadowAnimationMode]}
                  data-testid="shadow-animation-mode-select"
                >
                  {SHADOW_ANIMATION_MODE_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>
                      {SHADOW_ANIMATION_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-secondary">
                  {SHADOW_ANIMATION_MODE_TOOLTIPS[shadowAnimationMode]}
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// =============================================================================
// Multi-Source Weights Editor
// =============================================================================

/**
 * Multi-Source Weights Editor for multiSource algorithm
 */
const MultiSourceWeightsEditor: React.FC = () => {
  const { multiSourceWeights, setMultiSourceWeights } = useAppearanceStore(
    useShallow((state) => ({
      multiSourceWeights: state.multiSourceWeights,
      setMultiSourceWeights: state.setMultiSourceWeights,
    }))
  );

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-text-secondary">
        Source Weights
      </div>

      <Slider
        label="Depth"
        min={0}
        max={1}
        step={0.1}
        value={multiSourceWeights.depth}
        onChange={(value) => setMultiSourceWeights({ depth: value })}
        onReset={() => setMultiSourceWeights({ depth: 0.5 })}
        showValue
        tooltip="Weight for depth/iteration-based coloring"
      />

      <Slider
        label="Orbit Trap"
        min={0}
        max={1}
        step={0.1}
        value={multiSourceWeights.orbitTrap}
        onChange={(value) => setMultiSourceWeights({ orbitTrap: value })}
        onReset={() => setMultiSourceWeights({ orbitTrap: 0.3 })}
        showValue
        tooltip="Weight for orbit trap coloring (fractals)"
      />

      <Slider
        label="Normal"
        min={0}
        max={1}
        step={0.1}
        value={multiSourceWeights.normal}
        onChange={(value) => setMultiSourceWeights({ normal: value })}
        onReset={() => setMultiSourceWeights({ normal: 0.2 })}
        showValue
        tooltip="Weight for normal direction-based coloring"
      />
    </div>
  );
};
