/**
 * MiscControls Component
 *
 * UI controls for miscellaneous post-processing effects.
 *
 * Controls:
 * - Anti-aliasing method selector: None, FXAA, SMAA
 * - SMAA threshold slider (when SMAA is selected)
 *
 * @see {@link PostProcessing} for the effect implementation
 * @see {@link usePostProcessingStore} for state management
 * @see https://threejs.org/docs/#examples/en/postprocessing/SMAAPass
 */

import { Select, type SelectOption } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { type AntiAliasingMethod, DEFAULT_SMAA_THRESHOLD } from '@/stores/defaults/visualDefaults';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface MiscControlsProps {
  className?: string;
}

/** Anti-aliasing method options for the select dropdown */
const ANTI_ALIASING_OPTIONS: SelectOption<AntiAliasingMethod>[] = [
  { value: 'none', label: 'None' },
  { value: 'fxaa', label: 'FXAA' },
  { value: 'smaa', label: 'SMAA' },
];

/**
 * MiscControls component that provides UI for miscellaneous post-processing settings.
 */
export const MiscControls: React.FC<MiscControlsProps> = React.memo(({
  className = '',
}) => {
  const {
    antiAliasingMethod,
    setAntiAliasingMethod,
    smaaThreshold,
    setSmaaThreshold,
    objectOnlyDepth,
    setObjectOnlyDepth,
  } = usePostProcessingStore(
    useShallow((state) => ({
      antiAliasingMethod: state.antiAliasingMethod,
      setAntiAliasingMethod: state.setAntiAliasingMethod,
      smaaThreshold: state.smaaThreshold,
      setSmaaThreshold: state.setSmaaThreshold,
      objectOnlyDepth: state.objectOnlyDepth,
      setObjectOnlyDepth: state.setObjectOnlyDepth,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Anti-aliasing Method */}
      <Select<AntiAliasingMethod>
        label="Anti-aliasing"
        options={ANTI_ALIASING_OPTIONS}
        value={antiAliasingMethod}
        onChange={setAntiAliasingMethod}
        data-testid="anti-aliasing-select"
      />

      {/* SMAA Threshold - only visible when SMAA is selected */}
      {antiAliasingMethod === 'smaa' && (
        <Slider
          label="SMAA Threshold"
          value={smaaThreshold}
          min={0.01}
          max={0.2}
          step={0.01}
          onChange={setSmaaThreshold}
          onReset={() => setSmaaThreshold(DEFAULT_SMAA_THRESHOLD)}
          tooltip="Edge detection sensitivity. Lower = more aggressive anti-aliasing."
          minLabel="Strong"
          maxLabel="Subtle"
          data-testid="smaa-threshold-slider"
        />
      )}

      {/* Object Only Depth */}
      <Switch
        checked={objectOnlyDepth}
        onCheckedChange={setObjectOnlyDepth}
        label="Object Only Depth"
      />
    </div>
  );
});

MiscControls.displayName = 'MiscControls';
