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
    lights,
    selectedLightId,
    showLightGizmos,
    ambientIntensity,
    setShowLightGizmos,
    setAmbientIntensity,
  } = useVisualStore(
    useShallow((state) => ({
      shaderType: state.shaderType,
      lights: state.lights,
      selectedLightId: state.selectedLightId,
      showLightGizmos: state.showLightGizmos,
      ambientIntensity: state.ambientIntensity,
      setShowLightGizmos: state.setShowLightGizmos,
      setAmbientIntensity: state.setAmbientIntensity,
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

      {/* Ambient Intensity (always visible) */}
      <div className="border-t border-panel-border pt-4">
        <Slider
          label="Ambient Intensity"
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
