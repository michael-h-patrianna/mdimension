/**
 * Faces Section Component
 *
 * Sidebar section for all face/surface color settings.
 * Contains the advanced color system with algorithm selection,
 * cosine gradient palettes, distribution controls, and presets.
 *
 * Only visible when facesVisible is true.
 */

import { Section } from '@/components/ui/Section';
import { Slider } from '@/components/ui/Slider';
import {
  DEFAULT_FRESNEL_INTENSITY,
  DEFAULT_LCH_CHROMA,
  DEFAULT_LCH_LIGHTNESS,
  DEFAULT_SURFACE_SETTINGS,
  useVisualStore,
} from '@/stores/visualStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ColorAlgorithmSelector } from './ColorAlgorithmSelector';
import { ColorPreview } from './ColorPreview';
import { CosineGradientEditor } from './CosineGradientEditor';
import { DistributionControls } from './DistributionControls';
import { PresetSelector } from './PresetSelector';

export interface FacesSectionProps {
  defaultOpen?: boolean;
}

export const FacesSection: React.FC<FacesSectionProps> = ({
  defaultOpen = false,
}) => {
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
  } = useVisualStore(
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
    }))
  );

  const surfaceSettings = shaderSettings.surface;

  // Only show when faces are visible
  if (!facesVisible) {
    return null;
  }

  return (
    <Section title="Faces" defaultOpen={defaultOpen}>
      <div className="space-y-6">
        {/* Color Algorithm Selection */}
        <ColorAlgorithmSelector />

        {/* Live Preview */}
        <ColorPreview />

        {/* Algorithm-Specific Controls */}
        {/* Monochromatic and Analogous use base color */}
        {(colorAlgorithm === 'monochromatic' || colorAlgorithm === 'analogous') && (
          <div className="space-y-4">
            {/* Base Color Picker */}
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
            <Slider
              label="Lightness"
              min={0.1}
              max={1}
              step={0.01}
              value={lchLightness}
              onChange={setLchLightness}
              onReset={() => setLchLightness(DEFAULT_LCH_LIGHTNESS)}
              showValue
              tooltip="Controls overall brightness of colors"
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
              tooltip="Controls color saturation"
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

        {/* Common Controls - Always Visible */}
        <div className="pt-4 border-t border-panel-border space-y-4">
          <Slider
            label="Face Opacity"
            min={0}
            max={1}
            step={0.1}
            value={surfaceSettings.faceOpacity}
            onChange={(value) => setSurfaceSettings({ faceOpacity: value })}
            onReset={() =>
              setSurfaceSettings({
                faceOpacity: DEFAULT_SURFACE_SETTINGS.faceOpacity,
              })
            }
            showValue
          />

          {/* Fresnel Toggle and Intensity */}
          <div className="space-y-2">
            <button
              onClick={() =>
                setSurfaceSettings({
                  fresnelEnabled: !surfaceSettings.fresnelEnabled,
                })
              }
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
                ${
                  surfaceSettings.fresnelEnabled
                    ? 'bg-accent/20 text-accent border border-accent/50'
                    : 'bg-panel-border text-text-secondary border border-panel-border'
                }
              `}
              aria-pressed={surfaceSettings.fresnelEnabled}
            >
              <span>Fresnel Rim</span>
            </button>

            {surfaceSettings.fresnelEnabled && (
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
          </div>
        </div>
      </div>
    </Section>
  );
};

/**
 * Multi-Source Weights Editor for multiSource algorithm
 */
const MultiSourceWeightsEditor: React.FC = () => {
  const { multiSourceWeights, setMultiSourceWeights } = useVisualStore(
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
