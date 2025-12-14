/**
 * Lighting Controls Component
 *
 * Controls for configuring the multi-light system:
 * - Show/hide light gizmos toggle
 * - Light list (add, remove, select)
 * - Light editor (selected light properties)
 * - Ambient intensity slider
 *
 * Falls back to legacy single-light controls when no lights array exists.
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import {
  useVisualStore,
  DEFAULT_AMBIENT_INTENSITY,
  DEFAULT_AMBIENT_COLOR,
} from '@/stores/visualStore';
import { LightList } from './LightList';
import { LightEditor } from './LightEditor';

export interface LightingControlsProps {
  className?: string;
}

export const LightingControls: React.FC<LightingControlsProps> = React.memo(({
  className = '',
}) => {
  const {
    shaderType,
    selectedLightId,
    showLightGizmos,
    ambientIntensity,
    ambientColor,
    setShowLightGizmos,
    setAmbientIntensity,
    setAmbientColor,
  } = useVisualStore(
    useShallow((state) => ({
      shaderType: state.shaderType,
      selectedLightId: state.selectedLightId,
      showLightGizmos: state.showLightGizmos,
      ambientIntensity: state.ambientIntensity,
      ambientColor: state.ambientColor,
      setShowLightGizmos: state.setShowLightGizmos,
      setAmbientIntensity: state.setAmbientIntensity,
      setAmbientColor: state.setAmbientColor,
    }))
  );

  // Only show for Surface shader
  if (shaderType !== 'surface') {
    return null;
  }

  const hasSelectedLight = selectedLightId !== null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Show Light Gizmos Switch */}
      <Switch
        label="Show Gizmos"
        checked={showLightGizmos}
        onCheckedChange={setShowLightGizmos}
      />

      {/* Light List */}
      <div className="border-t border-panel-border pt-4">
        <LightList />
      </div>

      {/* Light Editor (when light selected) */}
      {hasSelectedLight && (
        <div className="border-t border-panel-border pt-4">
          <h4 className="text-xs font-medium text-text-secondary mb-3 uppercase tracking-wide">
            Light Properties
          </h4>
          <LightEditor />
        </div>
      )}

      {/* Ambient Light (always visible) */}
      <div className="border-t border-panel-border pt-4 space-y-3">
        <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Ambient Light
        </h4>

        {/* Ambient Color */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-secondary">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={ambientColor}
              onChange={(e) => setAmbientColor(e.target.value)}
              className="w-10 h-8 rounded cursor-pointer border border-panel-border"
            />
            <span className="text-xs font-mono text-text-secondary">{ambientColor}</span>
            {ambientColor !== DEFAULT_AMBIENT_COLOR && (
              <button
                onClick={() => setAmbientColor(DEFAULT_AMBIENT_COLOR)}
                className="ml-auto text-xs text-text-tertiary hover:text-accent transition-colors"
                title="Reset to default"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Ambient Intensity */}
        <Slider
          label="Intensity"
          min={0}
          max={1}
          step={0.05}
          value={ambientIntensity}
          onChange={setAmbientIntensity}
          onReset={() => setAmbientIntensity(DEFAULT_AMBIENT_INTENSITY)}
          showValue
          tooltip="Global ambient lighting level"
        />
      </div>
    </div>
  );
});
