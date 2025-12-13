/**
 * Light Source Controls Component
 *
 * Controls for configuring light sources: enable/disable, color, direction angles,
 * indicator visibility, and ambient intensity.
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import {
  useVisualStore,
  DEFAULT_LIGHT_HORIZONTAL_ANGLE,
  DEFAULT_LIGHT_VERTICAL_ANGLE,
  DEFAULT_LIGHT_STRENGTH,
  DEFAULT_AMBIENT_INTENSITY,
} from '@/stores/visualStore';

export interface LightingControlsProps {
  className?: string;
}

export const LightingControls: React.FC<LightingControlsProps> = React.memo(({
  className = '',
}) => {
  const {
    shaderType,
    lightEnabled,
    lightColor,
    lightStrength,
    lightHorizontalAngle,
    lightVerticalAngle,
    ambientIntensity,
    showLightIndicator,
    setLightEnabled,
    setLightColor,
    setLightStrength,
    setLightHorizontalAngle,
    setLightVerticalAngle,
    setAmbientIntensity,
    setShowLightIndicator,
  } = useVisualStore(
    useShallow((state) => ({
      shaderType: state.shaderType,
      lightEnabled: state.lightEnabled,
      lightColor: state.lightColor,
      lightStrength: state.lightStrength,
      lightHorizontalAngle: state.lightHorizontalAngle,
      lightVerticalAngle: state.lightVerticalAngle,
      ambientIntensity: state.ambientIntensity,
      showLightIndicator: state.showLightIndicator,
      setLightEnabled: state.setLightEnabled,
      setLightColor: state.setLightColor,
      setLightStrength: state.setLightStrength,
      setLightHorizontalAngle: state.setLightHorizontalAngle,
      setLightVerticalAngle: state.setLightVerticalAngle,
      setAmbientIntensity: state.setAmbientIntensity,
      setShowLightIndicator: state.setShowLightIndicator,
    }))
  );

  // Only show for Surface shader
  if (shaderType !== 'surface') {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
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

      {/* Light Strength */}
      {lightEnabled && (
        <Slider
          label="Light Strength"
          min={0}
          max={3}
          step={0.1}
          value={lightStrength}
          onChange={setLightStrength}
          onReset={() => setLightStrength(DEFAULT_LIGHT_STRENGTH)}
          showValue
        />
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
    </div>
  );
});
