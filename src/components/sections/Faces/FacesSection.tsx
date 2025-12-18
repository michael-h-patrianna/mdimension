/**
 * Faces Section Component
 *
 * Sidebar section for all face/surface settings organized in tabs:
 * - Colors: Color algorithm selection and configuration
 * - Material: Opacity, diffuse, and specular settings
 * - FX: Fresnel rim effects
 *
 * Shadow controls moved to ShadowsSection.
 *
 * Only visible when facesVisible is true.
 */

import { Section } from '@/components/sections/Section';
import { Slider } from '@/components/ui/Slider';
import { ColorPicker } from '@/components/ui/ColorPicker';
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
import { isRaymarchingFractal } from '@/lib/geometry/registry';
import { useGeometryStore } from '@/stores/geometryStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import {
  DEFAULT_SPECULAR_COLOR,
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
import { ControlGroup } from '@/components/ui/ControlGroup';

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
    faceEmission,
    faceEmissionThreshold,
    faceEmissionColorShift,
    faceEmissionPulsing,
    faceRimFalloff,
    setFaceEmission,
    setFaceEmissionThreshold,
    setFaceEmissionColorShift,
    setFaceEmissionPulsing,
    setFaceRimFalloff,
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
      faceEmission: state.faceEmission,
      faceEmissionThreshold: state.faceEmissionThreshold,
      faceEmissionColorShift: state.faceEmissionColorShift,
      faceEmissionPulsing: state.faceEmissionPulsing,
      faceRimFalloff: state.faceRimFalloff,
      setFaceEmission: state.setFaceEmission,
      setFaceEmissionThreshold: state.setFaceEmissionThreshold,
      setFaceEmissionColorShift: state.setFaceEmissionColorShift,
      setFaceEmissionPulsing: state.setFaceEmissionPulsing,
      setFaceRimFalloff: state.setFaceRimFalloff,
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
          // New emission props
          faceEmission={faceEmission}
          faceEmissionThreshold={faceEmissionThreshold}
          faceEmissionColorShift={faceEmissionColorShift}
          faceEmissionPulsing={faceEmissionPulsing}
          faceRimFalloff={faceRimFalloff}
          setFaceEmission={setFaceEmission}
          setFaceEmissionThreshold={setFaceEmissionThreshold}
          setFaceEmissionColorShift={setFaceEmissionColorShift}
          setFaceEmissionPulsing={setFaceEmissionPulsing}
          setFaceRimFalloff={setFaceRimFalloff}
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
        />
      ),
    },
  ];

  return (
    <Section title="Faces" defaultOpen={defaultOpen} data-testid="section-faces">
      <div className={`transition-opacity duration-300 ${!facesVisible ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={(id) => setActiveTab(id as FacesTabId)}
          tabListClassName="mb-4"
          data-testid="faces-tabs"
        />
        {!facesVisible && (
            <div className="text-center p-4 mt-2 border border-dashed border-white/10 rounded-lg bg-black/20">
                <p className="text-xs text-text-secondary">Enable Faces to edit settings</p>
            </div>
        )}
      </div>
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
      <ControlGroup title="Algorithm">
        <ColorAlgorithmSelector />
      </ControlGroup>

      {/* Live Preview */}
      <ControlGroup title="Preview">
        <ColorPreview />
      </ControlGroup>

      {/* Algorithm-Specific Controls */}
      <ControlGroup title="Settings" defaultOpen>
        {/* Monochromatic and Analogous use base color */}
        {(colorAlgorithm === 'monochromatic' ||
          colorAlgorithm === 'analogous') && (
          <ColorPicker
            label="Base Color"
            value={faceColor}
            onChange={setFaceColor}
            // Opacity is handled by Material tab for now
            disableAlpha={true}
          />
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
              showValue
            />
            <Slider
              label="Chroma"
              min={0}
              max={0.4}
              step={0.01}
              value={lchChroma}
              onChange={setLchChroma}
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

        {(colorAlgorithm === 'phase' || 
          colorAlgorithm === 'mixed' || 
          colorAlgorithm === 'blackbody') && (
          <div className="space-y-4">
            <PresetSelector />
            <CosineGradientEditor />
            <DistributionControls />
          </div>
        )}
      </ControlGroup>
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
  // New emission props
  faceEmission: number;
  faceEmissionThreshold: number;
  faceEmissionColorShift: number;
  faceEmissionPulsing: boolean;
  faceRimFalloff: number;
  setFaceEmission: (value: number) => void;
  setFaceEmissionThreshold: (value: number) => void;
  setFaceEmissionColorShift: (value: number) => void;
  setFaceEmissionPulsing: (value: boolean) => void;
  setFaceRimFalloff: (value: number) => void;
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
  faceEmission,
  faceEmissionThreshold,
  faceEmissionColorShift,
  faceEmissionPulsing,
  faceRimFalloff,
  setFaceEmission,
  setFaceEmissionThreshold,
  setFaceEmissionColorShift,
  setFaceEmissionPulsing,
  setFaceRimFalloff,
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
    <div className="space-y-4">
      {/* Emission & Rim */}
      <ControlGroup title="Emission & Rim" collapsible defaultOpen>
        <Slider
          label="Emission Strength"
          min={0}
          max={5}
          step={0.1}
          value={faceEmission}
          onChange={setFaceEmission}
          showValue
        />
        <Slider
          label="Emission Threshold"
          min={0}
          max={1}
          step={0.05}
          value={faceEmissionThreshold}
          onChange={setFaceEmissionThreshold}
          showValue
        />
        <Slider
          label="Color Shift"
          min={-1}
          max={1}
          step={0.1}
          value={faceEmissionColorShift}
          onChange={setFaceEmissionColorShift}
          showValue
        />
         <div className="flex items-center justify-between py-2">
            <label className="text-xs text-text-secondary">Pulsing</label>
            <Switch
                checked={faceEmissionPulsing}
                onCheckedChange={setFaceEmissionPulsing}
            />
        </div>
        <Slider
          label="Rim Falloff"
          min={0}
          max={10}
          step={0.5}
          value={faceRimFalloff}
          onChange={setFaceRimFalloff}
          showValue
        />
      </ControlGroup>

      {/* Raymarching Fractals Opacity Mode Controls */}
      {isRaymarchingFractalType && (
        <ControlGroup title="Opacity Mode" collapsible defaultOpen>
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
        </ControlGroup>
      )}

      {/* Face Opacity - Only shown for non-mandelbulb objects */}
      {!isRaymarchingFractalType && (
        <ControlGroup title="Opacity">
          <Slider
            label=""
            min={0}
            max={1}
            step={0.1}
            value={faceOpacity}
            onChange={setFaceOpacity}
            showValue
            data-testid="slider-face-opacity"
          />
        </ControlGroup>
      )}

      {/* Diffuse and Specular - Only when lighting is enabled */}
      {showLightingControls && (
        <ControlGroup title="Lighting Response" collapsible defaultOpen>
          {/* Diffuse */}
          <Slider
            label="Diffuse Intensity"
            min={0}
            max={2}
            step={0.01}
            value={diffuseIntensity}
            onChange={setDiffuseIntensity}
            showValue
          />

          <div className="h-px bg-white/5 my-2" />

          {/* Specular Color */}
          <div className="flex items-center justify-between">
              <ColorPicker
                label="Specular Color"
                value={specularColor}
                onChange={setSpecularColor}
                disableAlpha={true}
              />
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


          {/* Specular Intensity */}
          <Slider
            label="Specular Intensity"
            min={0}
            max={2}
            step={0.1}
            value={specularIntensity}
            onChange={setSpecularIntensity}
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
            showValue
          />
        </ControlGroup>
      )}

      {!showLightingControls && (
        <div className="p-4 rounded-lg bg-black/20 border border-white/5 border-dashed text-center">
            <p className="text-xs text-text-secondary italic">
            Enable lighting in the Visual section to access diffuse and specular settings.
            </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// FX Tab Content (Fresnel Rim Effect only - Shadows moved to ShadowsSection)
// =============================================================================

interface FxTabContentProps {
  fresnelEnabled: boolean;
  setFresnelEnabled: (enabled: boolean) => void;
  fresnelIntensity: number;
  setFresnelIntensity: (value: number) => void;
}

const FxTabContent: React.FC<FxTabContentProps> = ({
  fresnelEnabled,
  setFresnelEnabled,
  fresnelIntensity,
  setFresnelIntensity,
}) => {
  return (
    <div className="space-y-4">
      {/* Fresnel Rim Effect */}
      <ControlGroup
        title="Fresnel Rim"
        rightElement={
          <Switch
            checked={fresnelEnabled}
            onCheckedChange={setFresnelEnabled}
          />
        }
      >
        <p className="text-[10px] text-text-secondary mb-2">
            Add a glowing rim effect to the edges of the object, simulating backlighting.
        </p>
        <div className={!fresnelEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <Slider
            label=""
            min={0}
            max={1}
            step={0.1}
            value={fresnelIntensity}
            onChange={setFresnelIntensity}
            showValue
            />
        </div>
      </ControlGroup>
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
        showValue
        tooltip="Weight for normal direction-based coloring"
      />
    </div>
  );
};
