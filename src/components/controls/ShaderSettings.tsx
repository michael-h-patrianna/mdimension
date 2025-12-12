/**
 * Shader Settings Component
 *
 * Displays surface shader settings when the Faces toggle is ON.
 * Settings include face opacity, surface color, and fresnel rim lighting toggle.
 *
 * Features:
 * - Surface color picker
 * - Face opacity slider
 * - Fresnel rim lighting toggle
 * - Only visible when facesVisible is true
 *
 * @example
 * ```tsx
 * <ShaderSettings />
 * ```
 *
 * @see {@link useVisualStore} for shader settings state
 * @see {@link LightingControls} for Surface shader lighting settings
 * @see {@link RenderModeToggles} for controlling facesVisible
 */

import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { COLOR_MODE_OPTIONS, type ColorMode } from '@/lib/shaders/palette';
import { DEFAULT_SURFACE_SETTINGS, useVisualStore } from '@/stores/visualStore';
import React from 'react';

/**
 * Props for ShaderSettings component
 */
export interface ShaderSettingsProps {
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * Renders per-shader settings controls based on selected shader type.
 *
 * @param props - Component props
 * @param props.className
 * @returns Shader-specific settings UI
 */
export const ShaderSettings: React.FC<ShaderSettingsProps> = ({
  className = '',
}) => {
  const facesVisible = useVisualStore((state) => state.facesVisible);
  const shaderSettings = useVisualStore((state) => state.shaderSettings);

  // Per-shader settings actions
  const setSurfaceSettings = useVisualStore(
    (state) => state.setSurfaceSettings
  );
  const faceColor = useVisualStore((state) => state.faceColor);
  const setFaceColor = useVisualStore((state) => state.setFaceColor);
  const colorMode = useVisualStore((state) => state.colorMode);
  const setColorMode = useVisualStore((state) => state.setColorMode);

  // Get surface settings
  const surfaceSettings = shaderSettings.surface;

  // Only show surface settings when faces are visible (per component spec)
  if (!facesVisible) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Surface Settings (shown when Faces toggle is ON) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Surface Color
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

      {/* Color Mode dropdown - controls palette variation for surfaces */}
      <Select
        label="Color Mode"
        options={COLOR_MODE_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
        value={colorMode}
        onChange={(v) => setColorMode(v as ColorMode)}
      />

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

      <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
};
