/**
 * Light Editor Component
 *
 * Displays and edits properties of the currently selected light:
 * - Name input
 * - Type selector (Point, Directional, Spot)
 * - Enable toggle
 * - Color picker
 * - Intensity slider
 * - Position X/Y/Z inputs
 * - Rotation X/Y/Z inputs (for directional/spot)
 * - Cone Angle slider (spot only)
 * - Penumbra slider (spot only)
 * - Transform mode toggle (Move/Rotate)
 */

import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { ToggleButton } from '@/components/ui/ToggleButton';
import type { LightType, TransformMode } from '@/lib/lights/types';
import { useVisualStore } from '@/stores/visualStore';
import React, { memo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Vector3Input } from './Vector3Input';

export interface LightEditorProps {
  className?: string;
}

/** Light type options for selector */
const LIGHT_TYPE_OPTIONS: { value: LightType; label: string }[] = [
  { value: 'point', label: 'Point' },
  { value: 'directional', label: 'Directional' },
  { value: 'spot', label: 'Spot' },
];

/** Radians to degrees conversion */
const RAD_TO_DEG = 180 / Math.PI;

export const LightEditor: React.FC<LightEditorProps> = memo(function LightEditor({
  className = '',
}) {
  const {
    lights,
    selectedLightId,
    transformMode,
    updateLight,
    setTransformMode,
    duplicateLight,
    selectLight,
  } = useVisualStore(
    useShallow((state) => ({
      lights: state.lights,
      selectedLightId: state.selectedLightId,
      transformMode: state.transformMode,
      updateLight: state.updateLight,
      setTransformMode: state.setTransformMode,
      duplicateLight: state.duplicateLight,
      selectLight: state.selectLight,
    }))
  );

  // Find selected light
  const selectedLight = lights.find((l) => l.id === selectedLightId);

  // Update handlers
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { name: e.target.value });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleTypeChange = useCallback(
    (type: LightType) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { type });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleToggleEnabled = useCallback(() => {
    if (selectedLightId && selectedLight) {
      updateLight(selectedLightId, { enabled: !selectedLight.enabled });
    }
  }, [selectedLightId, selectedLight, updateLight]);

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { color: e.target.value });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleIntensityChange = useCallback(
    (intensity: number) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { intensity });
      }
    },
    [selectedLightId, updateLight]
  );

  const handlePositionChange = useCallback(
    (position: [number, number, number]) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { position });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleRotationChange = useCallback(
    (rotation: [number, number, number]) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { rotation });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleConeAngleChange = useCallback(
    (coneAngle: number) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { coneAngle });
      }
    },
    [selectedLightId, updateLight]
  );

  const handlePenumbraChange = useCallback(
    (penumbra: number) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { penumbra });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleRangeChange = useCallback(
    (range: number) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { range });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleDecayChange = useCallback(
    (decay: number) => {
      if (selectedLightId) {
        updateLight(selectedLightId, { decay });
      }
    },
    [selectedLightId, updateLight]
  );

  const handleDuplicate = useCallback(() => {
    if (selectedLightId) {
      const newId = duplicateLight(selectedLightId);
      if (newId) {
        selectLight(newId);
      }
    }
  }, [selectedLightId, duplicateLight, selectLight]);

  const handleTransformModeChange = useCallback(
    (mode: TransformMode) => {
      setTransformMode(mode);
    },
    [setTransformMode]
  );

  // Show placeholder if no light selected
  if (!selectedLight) {
    return (
      <div className={`text-center text-sm text-text-tertiary py-4 ${className}`}>
        Select a light to edit
      </div>
    );
  }

  const showRotation = selectedLight.type === 'directional' || selectedLight.type === 'spot';
  const showSpotSettings = selectedLight.type === 'spot';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with name and duplicate */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={selectedLight.name}
          onChange={handleNameChange}
          className="flex-1 px-2 py-1 text-sm bg-panel-border/50 border border-panel-border rounded text-text-primary focus:outline-none focus:border-accent"
          aria-label="Light name"
        />
        <button
          onClick={handleDuplicate}
          className="p-1.5 rounded text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          aria-label="Duplicate light"
          title="Duplicate (D key)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
      </div>

      {/* Type and Enable row */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select
            label="Type"
            options={LIGHT_TYPE_OPTIONS}
            value={selectedLight.type}
            onChange={handleTypeChange}
          />
        </div>
        <ToggleButton
          pressed={selectedLight.enabled}
          onToggle={handleToggleEnabled}
          ariaLabel={selectedLight.enabled ? 'Disable light' : 'Enable light'}
        >
          {selectedLight.enabled ? 'On' : 'Off'}
        </ToggleButton>
      </div>

      {/* Color picker */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-text-secondary">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={selectedLight.color}
            onChange={handleColorChange}
            className="w-10 h-8 rounded cursor-pointer border border-panel-border"
          />
          <span className="text-xs font-mono text-text-secondary">{selectedLight.color}</span>
        </div>
      </div>

      {/* Intensity slider */}
      <Slider
        label="Intensity"
        min={0.1}
        max={3}
        step={0.1}
        value={selectedLight.intensity}
        onChange={handleIntensityChange}
        onReset={() => handleIntensityChange(1.0)}
        showValue
      />

      {/* Range and Decay sliders (point and spot lights only) */}
      {(selectedLight.type === 'point' || selectedLight.type === 'spot') && (
        <>
          <Slider
            label="Range"
            min={1}
            max={100}
            step={1}
            value={selectedLight.range}
            onChange={handleRangeChange}
            onReset={() => handleRangeChange(0)}
            showValue
          />

          <Slider
            label="Decay"
            min={0.1}
            max={3}
            step={0.1}
            value={selectedLight.decay}
            onChange={handleDecayChange}
            onReset={() => handleDecayChange(2)}
            showValue
          />
        </>
      )}

      {/* Position input */}
      <Vector3Input
        label="Position"
        value={selectedLight.position}
        onChange={handlePositionChange}
        step={0.5}
      />

      {/* Rotation input (directional/spot only) */}
      {showRotation && (
        <Vector3Input
          label="Rotation"
          value={selectedLight.rotation}
          onChange={handleRotationChange}
          step={5}
          displayMultiplier={RAD_TO_DEG}
          unit="deg"
        />
      )}

      {/* Spot light settings */}
      {showSpotSettings && (
        <>
          <Slider
            label="Cone Angle"
            min={1}
            max={120}
            step={1}
            value={selectedLight.coneAngle}
            onChange={handleConeAngleChange}
            onReset={() => handleConeAngleChange(30)}
            unit="deg"
            showValue
          />

          <Slider
            label="Penumbra"
            min={0}
            max={1}
            step={0.05}
            value={selectedLight.penumbra}
            onChange={handlePenumbraChange}
            onReset={() => handlePenumbraChange(0.5)}
            showValue
          />
        </>
      )}

      {/* Transform mode toggle */}
      <div className="space-y-1 pt-2 border-t border-panel-border">
        <label className="block text-xs font-medium text-text-secondary">
          Transform Mode
        </label>
        <div className="flex gap-2">
          <ToggleButton
            pressed={transformMode === 'translate'}
            onToggle={() => handleTransformModeChange('translate')}
            ariaLabel="Move mode"
            className="flex-1"
          >
            Move (W)
          </ToggleButton>
          <ToggleButton
            pressed={transformMode === 'rotate'}
            onToggle={() => handleTransformModeChange('rotate')}
            ariaLabel="Rotate mode"
            className="flex-1"
          >
            Rotate (E)
          </ToggleButton>
        </div>
        <p className="text-xs text-text-tertiary mt-1">
          Press Escape to deselect
        </p>
      </div>
    </div>
  );
});
