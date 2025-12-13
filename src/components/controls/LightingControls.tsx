/**
 * Lighting Controls Component
 *
 * Provides user interface controls for configuring scene lighting when using the
 * Surface shader. Controls include directional light settings, ambient lighting,
 * specular highlights, and visual indicators.
 *
 * Features:
 * - Toggle for enabling/disabling directional light
 * - Color picker for light color
 * - Spherical coordinate controls (horizontal/vertical angles)
 * - Ambient and diffuse intensity sliders
 * - Specular color and highlight configuration
 * - Tone mapping with algorithm selection and exposure
 * - Visual light direction indicator toggle
 *
 * @example
 * ```tsx
 * <LightingControls />
 * ```
 *
 * @remarks
 * - Only visible when shaderType is 'surface'
 * - Returns null for other shader types
 * - Uses Slider component for all numeric inputs
 * - Follows same pattern as VisualControls component
 *
 * @see {@link useVisualStore} for lighting state management
 * @see {@link Slider} for slider component
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import {
  useVisualStore,
  DEFAULT_LIGHT_HORIZONTAL_ANGLE,
  DEFAULT_LIGHT_VERTICAL_ANGLE,
  DEFAULT_AMBIENT_INTENSITY,
  DEFAULT_SPECULAR_INTENSITY,
  DEFAULT_SHININESS,
  DEFAULT_SPECULAR_COLOR,
  DEFAULT_DIFFUSE_INTENSITY,
  DEFAULT_TONE_MAPPING_ENABLED,
  DEFAULT_TONE_MAPPING_ALGORITHM,
  DEFAULT_EXPOSURE,
} from '@/stores/visualStore';
import type { ToneMappingAlgorithm } from '@/lib/shaders/types';
import { TONE_MAPPING_OPTIONS } from '@/lib/shaders/types';

/**
 * Props for LightingControls component.
 */
export interface LightingControlsProps {
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * Section header component for grouping controls
 */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider pt-2 pb-1 border-t border-panel-border mt-2 first:mt-0 first:border-t-0 first:pt-0">
    {title}
  </div>
);

/**
 * Renders lighting configuration controls for the Surface shader.
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 *
 * @returns Lighting controls UI or null if not using Surface shader
 */
export const LightingControls: React.FC<LightingControlsProps> = ({
  className = '',
}) => {
  // Check if Surface shader is active
  const shaderType = useVisualStore((state) => state.shaderType);

  // Lighting state
  const lightEnabled = useVisualStore((state) => state.lightEnabled);
  const lightColor = useVisualStore((state) => state.lightColor);
  const lightHorizontalAngle = useVisualStore((state) => state.lightHorizontalAngle);
  const lightVerticalAngle = useVisualStore((state) => state.lightVerticalAngle);
  const ambientIntensity = useVisualStore((state) => state.ambientIntensity);
  const specularIntensity = useVisualStore((state) => state.specularIntensity);
  const shininess = useVisualStore((state) => state.shininess);
  const showLightIndicator = useVisualStore((state) => state.showLightIndicator);

  // Enhanced lighting state
  const specularColor = useVisualStore((state) => state.specularColor);
  const diffuseIntensity = useVisualStore((state) => state.diffuseIntensity);
  const toneMappingEnabled = useVisualStore((state) => state.toneMappingEnabled);
  const toneMappingAlgorithm = useVisualStore((state) => state.toneMappingAlgorithm);
  const exposure = useVisualStore((state) => state.exposure);


  // Lighting actions
  const setLightEnabled = useVisualStore((state) => state.setLightEnabled);
  const setLightColor = useVisualStore((state) => state.setLightColor);
  const setLightHorizontalAngle = useVisualStore((state) => state.setLightHorizontalAngle);
  const setLightVerticalAngle = useVisualStore((state) => state.setLightVerticalAngle);
  const setAmbientIntensity = useVisualStore((state) => state.setAmbientIntensity);
  const setSpecularIntensity = useVisualStore((state) => state.setSpecularIntensity);
  const setShininess = useVisualStore((state) => state.setShininess);
  const setShowLightIndicator = useVisualStore((state) => state.setShowLightIndicator);

  // Enhanced lighting actions
  const setSpecularColor = useVisualStore((state) => state.setSpecularColor);
  const setDiffuseIntensity = useVisualStore((state) => state.setDiffuseIntensity);
  const setToneMappingEnabled = useVisualStore((state) => state.setToneMappingEnabled);
  const setToneMappingAlgorithm = useVisualStore((state) => state.setToneMappingAlgorithm);
  const setExposure = useVisualStore((state) => state.setExposure);

  // Only show lighting controls for Surface shader
  if (shaderType !== 'surface') {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ============ GROUP 1: Light Source ============ */}
      <SectionHeader title="Light Source" />

      {/* Light Enable Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLightEnabled(!lightEnabled)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
            ${lightEnabled
              ? 'bg-accent/20 text-accent border border-accent/50'
              : 'bg-panel-border text-text-secondary border border-panel-border'
            }
          `}
          aria-pressed={lightEnabled}
        >
          <span>Light On</span>
        </button>
      </div>

      {/* Light Color */}
      {lightEnabled && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">
            Light Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={lightColor}
              onChange={(e) => setLightColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-panel-border"
            />
            <span className="text-xs font-mono text-text-secondary">{lightColor}</span>
          </div>
        </div>
      )}

      {/* Horizontal Angle */}
      {lightEnabled && (
        <Slider
          label="Horizontal Angle"
          min={0}
          max={360}
          step={1}
          value={lightHorizontalAngle}
          onChange={setLightHorizontalAngle}
          onReset={() => setLightHorizontalAngle(DEFAULT_LIGHT_HORIZONTAL_ANGLE)}
          unit="°"
          showValue
        />
      )}

      {/* Vertical Angle */}
      {lightEnabled && (
        <Slider
          label="Vertical Angle"
          min={-90}
          max={90}
          step={1}
          value={lightVerticalAngle}
          onChange={setLightVerticalAngle}
          onReset={() => setLightVerticalAngle(DEFAULT_LIGHT_VERTICAL_ANGLE)}
          unit="°"
          showValue
        />
      )}

      {/* Show Light Indicator */}
      {lightEnabled && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLightIndicator(!showLightIndicator)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
              ${showLightIndicator
                ? 'bg-accent/20 text-accent border border-accent/50'
                : 'bg-panel-border text-text-secondary border border-panel-border'
              }
            `}
            aria-pressed={showLightIndicator}
          >
            <span>Show Light Indicator</span>
          </button>
        </div>
      )}

      {/* ============ GROUP 2: Ambient / Diffuse ============ */}
      <SectionHeader title="Ambient / Diffuse" />

      {/* Ambient Intensity */}
      <Slider
        label="Ambient Intensity"
        min={0}
        max={1}
        step={0.1}
        value={ambientIntensity}
        onChange={setAmbientIntensity}
        onReset={() => setAmbientIntensity(DEFAULT_AMBIENT_INTENSITY)}
        showValue
      />

      {/* Diffuse Intensity */}
      {lightEnabled && (
        <Slider
          label="Diffuse Intensity"
          min={0}
          max={2}
          step={0.1}
          value={diffuseIntensity}
          onChange={setDiffuseIntensity}
          onReset={() => setDiffuseIntensity(DEFAULT_DIFFUSE_INTENSITY)}
          showValue
        />
      )}

      {/* ============ GROUP 3: Specular ============ */}
      {lightEnabled && (
        <>
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
              <span className="text-xs font-mono text-text-secondary">{specularColor}</span>
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

          {/* Shininess (Three.js naming) */}
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

      {/* ============ GROUP 4: Tone Mapping ============ */}
      <SectionHeader title="Tone Mapping" />

      {/* Tone Mapping Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setToneMappingEnabled(!toneMappingEnabled)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
            ${toneMappingEnabled
              ? 'bg-accent/20 text-accent border border-accent/50'
              : 'bg-panel-border text-text-secondary border border-panel-border'
            }
          `}
          aria-pressed={toneMappingEnabled}
        >
          <span>Tone Mapping</span>
        </button>
        {toneMappingEnabled !== DEFAULT_TONE_MAPPING_ENABLED && (
          <button
            onClick={() => setToneMappingEnabled(DEFAULT_TONE_MAPPING_ENABLED)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
            title="Reset to default"
          >
            Reset
          </button>
        )}
      </div>

      {/* Tone Mapping Algorithm */}
      {toneMappingEnabled && (
        <div className="space-y-2">
          <Select
            label="Algorithm"
            options={TONE_MAPPING_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
            value={toneMappingAlgorithm}
            onChange={(value) => setToneMappingAlgorithm(value as ToneMappingAlgorithm)}
          />
          {toneMappingAlgorithm !== DEFAULT_TONE_MAPPING_ALGORITHM && (
            <button
              onClick={() => setToneMappingAlgorithm(DEFAULT_TONE_MAPPING_ALGORITHM)}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
              title="Reset to default"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Exposure */}
      {toneMappingEnabled && (
        <Slider
          label="Exposure"
          min={0.1}
          max={3}
          step={0.1}
          value={exposure}
          onChange={setExposure}
          onReset={() => setExposure(DEFAULT_EXPOSURE)}
          showValue
        />
      )}
    </div>
  );
};
