/**
 * Shader Settings Component
 *
 * Displays per-shader configuration UI based on the currently selected shader type.
 * Each shader type has its own specific settings that are shown conditionally.
 *
 * Features:
 * - Wireframe: No additional settings (uses Edge Thickness from Visuals)
 * - Dual Outline: Inner/outer colors and gap
 * - Surface: Face opacity, fresnel toggle (lighting in LightingControls)
 *
 * @example
 * ```tsx
 * <ShaderSettings />
 * ```
 *
 * @see {@link useVisualStore} for shader settings state
 * @see {@link LightingControls} for Surface shader lighting settings
 */

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { useVisualStore } from '@/stores/visualStore';
import {
  DEFAULT_DUAL_OUTLINE_SETTINGS,
  DEFAULT_SURFACE_SETTINGS,
} from '@/lib/shaders/types';

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
 * @returns Shader-specific settings UI
 */
export const ShaderSettings: React.FC<ShaderSettingsProps> = ({
  className = '',
}) => {
  const shaderType = useVisualStore((state) => state.shaderType);
  const shaderSettings = useVisualStore((state) => state.shaderSettings);

  // Per-shader settings actions
  const setDualOutlineSettings = useVisualStore(
    (state) => state.setDualOutlineSettings
  );
  const setSurfaceSettings = useVisualStore(
    (state) => state.setSurfaceSettings
  );
  const faceColor = useVisualStore((state) => state.faceColor);
  const setFaceColor = useVisualStore((state) => state.setFaceColor);

  // Get settings for current shader type
  const dualOutlineSettings = shaderSettings.dualOutline;
  const surfaceSettings = shaderSettings.surface;

  // Wireframe shader has no additional settings - uses Edge Thickness from Visuals
  if (shaderType === 'wireframe') {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Dual Outline Settings */}
      {shaderType === 'dualOutline' && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              Inner Line Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={dualOutlineSettings.innerColor}
                onChange={(e) =>
                  setDualOutlineSettings({ innerColor: e.target.value })
                }
                className="w-10 h-10 rounded cursor-pointer border border-panel-border"
              />
              <span className="text-xs font-mono text-text-secondary">
                {dualOutlineSettings.innerColor}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              Outer Line Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={dualOutlineSettings.outerColor}
                onChange={(e) =>
                  setDualOutlineSettings({ outerColor: e.target.value })
                }
                className="w-10 h-10 rounded cursor-pointer border border-panel-border"
              />
              <span className="text-xs font-mono text-text-secondary">
                {dualOutlineSettings.outerColor}
              </span>
            </div>
          </div>

          <Slider
            label="Line Gap"
            min={1}
            max={5}
            step={0.5}
            value={dualOutlineSettings.gap}
            onChange={(value) => setDualOutlineSettings({ gap: value })}
            onReset={() =>
              setDualOutlineSettings({
                gap: DEFAULT_DUAL_OUTLINE_SETTINGS.gap,
              })
            }
            showValue
          />
        </>
      )}

      {/* Surface Settings (basic - lighting handled by LightingControls) */}
      {shaderType === 'surface' && (
        <>
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

          <p className="text-xs text-text-secondary">
            Configure lighting in the Lighting section below.
          </p>
        </>
      )}
    </div>
  );
};
