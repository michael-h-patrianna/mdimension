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
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ControlGroup } from '@/components/ui/ControlGroup';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { isRaymarchingFractal, supportsEmission } from '@/lib/geometry/registry';
import { useAppearanceStore, type AppearanceSlice } from '@/stores/appearanceStore';
import { DEFAULT_FACE_PBR } from '@/stores/defaults/visualDefaults';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLightingStore, type LightingSlice } from '@/stores/lightingStore';
import { usePBRStore, type PBRSlice } from '@/stores/pbrStore';
import React from 'react';
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

type FacesTabId = 'colors' | 'material';

export const FacesSection: React.FC<FacesSectionProps> = ({
  defaultOpen = false,
}) => {
  const [activeTab, setActiveTab] = React.useState<FacesTabId>('colors');

  // Get object type and dimension to check rendering mode
  const objectType = useGeometryStore((state) => state.objectType);
  const dimension = useGeometryStore((state) => state.dimension);

  // Raymarching fractals (mandelbulb, julia, schroedinger, blackhole) are always fully opaque
  const isRaymarchingFractalType = isRaymarchingFractal(objectType, dimension);

  // Appearance settings
  const appearanceSelector = useShallow((state: AppearanceSlice) => ({
    facesVisible: state.facesVisible,
    colorAlgorithm: state.colorAlgorithm,
    faceColor: state.faceColor,
    setFaceColor: state.setFaceColor,
    shaderSettings: state.shaderSettings,
    setSurfaceSettings: state.setSurfaceSettings,
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
  }));
  const {
    facesVisible,
    colorAlgorithm,
    faceColor,
    setFaceColor,
    shaderSettings,
    setSurfaceSettings,
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
  } = useAppearanceStore(appearanceSelector);

  // Lighting settings
  const lightingSelector = useShallow((state: LightingSlice) => ({
    lightEnabled: state.lightEnabled,
  }));
  const { lightEnabled } = useLightingStore(lightingSelector);

  // PBR settings for faces (from dedicated PBR store)
  const pbrSelector = useShallow((state: PBRSlice) => ({
    roughness: state.face.roughness,
    metallic: state.face.metallic,
    specularIntensity: state.face.specularIntensity,
    specularColor: state.face.specularColor,
    setRoughness: state.setFaceRoughness,
    setMetallic: state.setFaceMetallic,
    setSpecularIntensity: state.setFaceSpecularIntensity,
    setSpecularColor: state.setFaceSpecularColor,
  }));
  const {
    roughness,
    metallic,
    specularIntensity,
    specularColor,
    setRoughness,
    setMetallic,
    setSpecularIntensity,
    setSpecularColor,
  } = usePBRStore(pbrSelector);

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
          specularColor={specularColor}
          setSpecularColor={setSpecularColor}
          specularIntensity={specularIntensity}
          setSpecularIntensity={setSpecularIntensity}
          roughness={roughness}
          setRoughness={setRoughness}
          metallic={metallic}
          setMetallic={setMetallic}
          // Emission props (only for types that support it)
          showEmissionControls={supportsEmission(objectType)}
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
          // Hide opacity for raymarching fractals (always fully opaque)
          hideOpacity={isRaymarchingFractalType}
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
  specularColor: string;
  setSpecularColor: (color: string) => void;
  specularIntensity: number;
  setSpecularIntensity: (value: number) => void;
  roughness: number;
  setRoughness: (value: number) => void;
  metallic: number;
  setMetallic: (value: number) => void;
  // Emission props (only for types that support volumetric emission)
  showEmissionControls: boolean;
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
  // Hide opacity controls for raymarching fractals (always fully opaque)
  hideOpacity?: boolean;
}

const MaterialTabContent: React.FC<MaterialTabContentProps> = ({
  faceOpacity,
  setFaceOpacity,
  showLightingControls,
  specularColor,
  setSpecularColor,
  specularIntensity,
  setSpecularIntensity,
  roughness,
  setRoughness,
  metallic,
  setMetallic,
  // Emission props (only for types that support volumetric emission)
  showEmissionControls,
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
  hideOpacity = false,
}) => {
  return (
    <div className="space-y-4">
      {/* Face Opacity - Hidden for raymarching fractals (always fully opaque) */}
      {!hideOpacity && (

          <Slider
            label="Opacity"
            min={0}
            max={1}
            step={0.1}
            value={faceOpacity}
            onChange={setFaceOpacity}
            showValue
            data-testid="slider-face-opacity"
          />

      )}

      {/* PBR Material - Only when lighting is enabled */}
      {showLightingControls && (
        <ControlGroup title="PBR Material" collapsible defaultOpen>

          {/* Metallic */}
          <Slider
            label="Metallic"
            min={0}
            max={1}
            step={0.05}
            value={metallic}
            onChange={setMetallic}
            showValue
            tooltip="0 = dielectric (plastic, wood), 1 = metal (gold, chrome)"
            data-testid="slider-metallic"
          />

          {/* Roughness (GGX PBR) */}
          <Slider
            label="Roughness"
            min={0}
            max={1}
            step={0.05}
            value={roughness}
            onChange={setRoughness}
            showValue
            tooltip="Surface roughness (0 = mirror, 1 = matte)"
            data-testid="slider-roughness"
          />

          <div className="h-px bg-white/5 my-2" />

          {/* Specular Intensity */}
          <Slider
            label="Specular Intensity"
            min={0}
            max={2}
            step={0.1}
            value={specularIntensity}
            onChange={setSpecularIntensity}
            showValue
            tooltip="Artistic multiplier for specular highlights"
          />

          {/* Specular Color */}
          <div className="flex items-center justify-between">
              <ColorPicker
                label="Specular Color"
                value={specularColor}
                onChange={setSpecularColor}
                disableAlpha={true}
              />
              {specularColor !== DEFAULT_FACE_PBR.specularColor && (
                <button
                  onClick={() => setSpecularColor(DEFAULT_FACE_PBR.specularColor)}
                  className="text-xs text-accent hover:text-accent/80 transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
          </div>
        </ControlGroup>
      )}

      {!showLightingControls && (
        <div className="p-4 rounded-lg bg-black/20 border border-white/5 border-dashed text-center">
            <p className="text-xs text-text-secondary italic">
            Enable lighting in the Visual section to access PBR material settings.
            </p>
        </div>
      )}

      {/* Emission & Rim - Only shown for types that support volumetric emission */}
      {showEmissionControls && (
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
      )}
    </div>
  );
};

// =============================================================================
// Multi-Source Weights Editor
// =============================================================================

/**
 * Multi-Source Weights Editor for multiSource algorithm
 * @returns The weights editor component
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
