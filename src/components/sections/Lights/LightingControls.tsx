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
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Switch } from '@/components/ui/Switch';
import {
  DEFAULT_AMBIENT_INTENSITY,
  DEFAULT_AMBIENT_COLOR,
} from '@/stores/defaults/visualDefaults';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useLightingStore } from '@/stores/lightingStore';
import { LightList } from './LightList';
import { LightEditor } from './LightEditor';

export interface LightingControlsProps {
  className?: string;
}

export const LightingControls: React.FC<LightingControlsProps> = React.memo(({
  className = '',
}) => {
  const shaderType = useAppearanceStore((state) => state.shaderType);

  const {
    selectedLightId,
    showLightGizmos,
    ambientIntensity,
    ambientColor,
    setShowLightGizmos,
    setAmbientIntensity,
    setAmbientColor,
  } = useLightingStore(
    useShallow((state) => ({
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
        <div className="flex items-center justify-between">
            <ColorPicker
                label="Color"
                value={ambientColor}
                onChange={setAmbientColor}
                disableAlpha={true}
            />
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


        {/* Ambient Intensity */}
        <Slider
          label="Intensity"
          min={0}
          max={3}
          step={0.05}
          value={ambientIntensity}
          onChange={setAmbientIntensity}
          showValue
          tooltip="Global ambient lighting level"
        />
      </div>
    </div>
  );
});
