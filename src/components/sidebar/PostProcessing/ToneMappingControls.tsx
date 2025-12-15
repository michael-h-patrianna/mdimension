/**
 * ToneMappingControls Component
 *
 * UI controls for managing tone mapping settings.
 * Uses Three.js tone mapping algorithms via OutputPass.
 *
 * @see https://threejs.org/docs/#api/en/constants/Renderer
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import {
  DEFAULT_EXPOSURE,
} from '@/stores/defaults/visualDefaults';
import { useLightingStore } from '@/stores/lightingStore';
import { TONE_MAPPING_OPTIONS, type ToneMappingAlgorithm } from '@/lib/shaders/types';

export interface ToneMappingControlsProps {
  className?: string;
}

/**
 * ToneMappingControls component for adjusting tone mapping settings.
 */
export const ToneMappingControls: React.FC<ToneMappingControlsProps> = React.memo(({
  className = '',
}) => {
  const {
    toneMappingEnabled,
    toneMappingAlgorithm,
    exposure,
    setToneMappingEnabled,
    setToneMappingAlgorithm,
    setExposure,
  } = useLightingStore(
    useShallow((state) => ({
      toneMappingEnabled: state.toneMappingEnabled,
      toneMappingAlgorithm: state.toneMappingAlgorithm,
      exposure: state.exposure,
      setToneMappingEnabled: state.setToneMappingEnabled,
      setToneMappingAlgorithm: state.setToneMappingAlgorithm,
      setExposure: state.setExposure,
    }))
  );

  // Filter out 'none' option - use the toggle for disabling instead
  const selectOptions = TONE_MAPPING_OPTIONS
    .filter((opt) => opt.value !== 'none')
    .map((opt) => ({
      value: opt.value,
      label: opt.label,
    }));

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable/Disable Tone Mapping */}
      <Switch
        checked={toneMappingEnabled}
        onCheckedChange={setToneMappingEnabled}
        label="Tone Mapping"
      />

      {/* Tone Mapping controls - only visible when enabled */}
      {toneMappingEnabled && (
        <>
          {/* Tone Mapping Algorithm */}
          <Select
            label="Algorithm"
            value={toneMappingAlgorithm}
            options={selectOptions}
            onChange={(value) => setToneMappingAlgorithm(value as ToneMappingAlgorithm)}
          />

          {/* Exposure */}
          <Slider
            label="Exposure"
            min={0.1}
            max={3}
            step={0.1}
            value={exposure}
            onChange={setExposure}
            onReset={() => setExposure(DEFAULT_EXPOSURE)}
            showValue
          />
        </>
      )}
    </div>
  );
});
