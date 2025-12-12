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
 * - Ambient intensity slider
 * - Specular highlight configuration
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
import {
  useVisualStore,
  DEFAULT_LIGHT_HORIZONTAL_ANGLE,
  DEFAULT_LIGHT_VERTICAL_ANGLE,
  DEFAULT_AMBIENT_INTENSITY,
  DEFAULT_SPECULAR_INTENSITY,
  DEFAULT_SPECULAR_POWER,
} from '@/stores/visualStore';

/**
 * Props for LightingControls component.
 */
export interface LightingControlsProps {
  /** Optional CSS class name for styling */
  className?: string;
}

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
  const specularPower = useVisualStore((state) => state.specularPower);
  const showLightIndicator = useVisualStore((state) => state.showLightIndicator);

  // Lighting actions
  const setLightEnabled = useVisualStore((state) => state.setLightEnabled);
  const setLightColor = useVisualStore((state) => state.setLightColor);
  const setLightHorizontalAngle = useVisualStore((state) => state.setLightHorizontalAngle);
  const setLightVerticalAngle = useVisualStore((state) => state.setLightVerticalAngle);
  const setAmbientIntensity = useVisualStore((state) => state.setAmbientIntensity);
  const setSpecularIntensity = useVisualStore((state) => state.setSpecularIntensity);
  const setSpecularPower = useVisualStore((state) => state.setSpecularPower);
  const setShowLightIndicator = useVisualStore((state) => state.setShowLightIndicator);

  // Only show lighting controls for Surface shader
  if (shaderType !== 'surface') {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
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

      {/* Specular Intensity */}
      {lightEnabled && (
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
      )}

      {/* Specular Power */}
      {lightEnabled && (
        <Slider
          label="Specular Power"
          min={1}
          max={128}
          step={1}
          value={specularPower}
          onChange={setSpecularPower}
          onReset={() => setSpecularPower(DEFAULT_SPECULAR_POWER)}
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
    </div>
  );
};
