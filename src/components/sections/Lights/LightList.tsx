/**
 * Light List Component
 *
 * Displays list of all lights with:
 * - Ambient light entry at top (non-deletable)
 * - Light items showing name, type, enable state
 * - Add new light select (Point, Directional, Spot)
 * - Maximum 4 lights enforced
 */

import { Select, type SelectOption } from '@/components/ui/Select';
import type { LightSource, LightType } from '@/rendering/lights/types';
import { MAX_LIGHTS } from '@/rendering/lights/types';
import { useLightingStore, type LightingSlice } from '@/stores/lightingStore';
import React, { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AMBIENT_LIGHT_ID, LightListItem } from './LightListItem';

export interface LightListProps {
  className?: string;
}

/** Light type options for the select */
const LIGHT_TYPE_OPTIONS: SelectOption<LightType | ''>[] = [
  { value: '', label: 'Add Light...' },
  { value: 'point', label: 'Point Light' },
  { value: 'directional', label: 'Directional Light' },
  { value: 'spot', label: 'Spot Light' },
];

export const LightList: React.FC<LightListProps> = memo(function LightList({
  className = '',
}) {
  const lightingSelector = useShallow((state: LightingSlice) => ({
    lights: state.lights,
    selectedLightId: state.selectedLightId,
    addLight: state.addLight,
    removeLight: state.removeLight,
    updateLight: state.updateLight,
    selectLight: state.selectLight,
    ambientIntensity: state.ambientIntensity,
    ambientColor: state.ambientColor,
    setAmbientIntensity: state.setAmbientIntensity,
  }));
  const {
    lights,
    selectedLightId,
    addLight,
    removeLight,
    updateLight,
    selectLight,
    ambientIntensity,
    ambientColor,
    setAmbientIntensity,
  } = useLightingStore(lightingSelector);

  // Create a virtual ambient light entry for display in the list
  const ambientLightEntry: LightSource = useMemo(() => ({
    id: AMBIENT_LIGHT_ID,
    type: 'point', // Type doesn't matter for ambient, just needed for interface
    name: 'Ambient Light',
    color: ambientColor,
    intensity: ambientIntensity,
    enabled: ambientIntensity > 0,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    coneAngle: 45,
    penumbra: 0.5,
    range: 10,
    decay: 2,
  }), [ambientColor, ambientIntensity]);

  // Toggle ambient light by setting intensity to 0 or restoring to 1
  const handleAmbientToggle = () => {
    if (ambientIntensity > 0) {
      setAmbientIntensity(0);
    } else {
      setAmbientIntensity(1);
    }
  };

  const canAddLight = lights.length < MAX_LIGHTS;

  const handleAddLight = (type: LightType | '') => {
    if (!type) return; // Ignore placeholder selection
    const newId = addLight(type as LightType);
    if (newId) {
      selectLight(newId);
    }
  };

  // Check if ambient light is selected
  const isAmbientSelected = selectedLightId === AMBIENT_LIGHT_ID;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Light list - ambient light always first */}
      <div className="space-y-1">
        {/* Ambient light entry (always present, non-deletable) */}
        <LightListItem
          key={AMBIENT_LIGHT_ID}
          light={ambientLightEntry}
          isSelected={isAmbientSelected}
          onSelect={() => selectLight(AMBIENT_LIGHT_ID)}
          onToggle={handleAmbientToggle}
          onRemove={() => {}} // No-op, ambient can't be removed
          isDeleteDisabled={true}
        />

        {/* Other lights */}
        {lights.map((light: LightSource) => (
          <LightListItem
            key={light.id}
            light={light}
            isSelected={light.id === selectedLightId}
            onSelect={() => selectLight(light.id)}
            onToggle={() => updateLight(light.id, { enabled: !light.enabled })}
            onRemove={() => removeLight(light.id)}
          />
        ))}
      </div>

      {/* Add light select - native select has no z-index issues */}
      <Select<LightType | ''>
        options={LIGHT_TYPE_OPTIONS}
        value=""
        onChange={handleAddLight}
        disabled={!canAddLight}
      />


    </div>
  );
});
