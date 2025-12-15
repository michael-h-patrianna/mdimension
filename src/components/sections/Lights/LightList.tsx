/**
 * Light List Component
 *
 * Displays list of all lights with:
 * - Light items showing name, type, enable state
 * - Add new light dropdown (Point, Directional, Spot)
 * - Maximum 4 lights enforced
 */

import React, { memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLightingStore } from '@/stores/lightingStore';
import { MAX_LIGHTS } from '@/rendering/lights/types';
import type { LightType } from '@/rendering/lights/types';
import { LightListItem } from './LightListItem';

export interface LightListProps {
  className?: string;
}

/** Light type options for the dropdown */
const LIGHT_TYPE_OPTIONS: { value: LightType; label: string }[] = [
  { value: 'point', label: 'Point Light' },
  { value: 'directional', label: 'Directional Light' },
  { value: 'spot', label: 'Spot Light' },
];

export const LightList: React.FC<LightListProps> = memo(function LightList({
  className = '',
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const {
    lights,
    selectedLightId,
    addLight,
    removeLight,
    updateLight,
    selectLight,
  } = useLightingStore(
    useShallow((state) => ({
      lights: state.lights,
      selectedLightId: state.selectedLightId,
      addLight: state.addLight,
      removeLight: state.removeLight,
      updateLight: state.updateLight,
      selectLight: state.selectLight,
    }))
  );

  const canAddLight = lights.length < MAX_LIGHTS;

  const handleAddLight = (type: LightType) => {
    const newId = addLight(type);
    if (newId) {
      selectLight(newId);
    }
    setShowAddMenu(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Light list */}
      {lights.length === 0 ? (
        <div className="text-center text-sm text-text-tertiary py-4">
          No lights. Add one below.
        </div>
      ) : (
        <div className="space-y-1">
          {lights.map((light) => (
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
      )}

      {/* Add light button/dropdown */}
      <div className="relative">
        <button
          onClick={() => canAddLight && setShowAddMenu(!showAddMenu)}
          disabled={!canAddLight}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors border
            ${canAddLight
              ? 'border-dashed border-panel-border text-text-secondary hover:border-accent hover:text-accent'
              : 'border-transparent bg-panel-border/30 text-text-tertiary cursor-not-allowed'
            }
          `}
          aria-expanded={showAddMenu}
          aria-haspopup="true"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          <span>{canAddLight ? 'Add Light' : `Max ${MAX_LIGHTS} lights`}</span>
        </button>

        {/* Dropdown menu */}
        {showAddMenu && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowAddMenu(false)}
            />
            <div className="absolute left-0 right-0 mt-1 py-1 bg-panel-bg border border-panel-border rounded-md shadow-lg z-20">
              {LIGHT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAddLight(option.value)}
                  className="w-full px-3 py-2 text-sm text-left text-text-primary hover:bg-accent/20 transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Light count indicator */}
      <div className="text-xs text-text-tertiary text-center">
        {lights.length} / {MAX_LIGHTS} lights
      </div>
    </div>
  );
});
