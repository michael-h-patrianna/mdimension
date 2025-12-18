/**
 * FX Controls Component (formerly MiscControls)
 *
 * UI controls for post-processing FX effects:
 * - Anti-aliasing method selector: None, FXAA, SMAA
 * - Object depth settings
 *
 * Note: Ambient Occlusion controls moved to LightingControls (Lights section)
 *
 * @see {@link PostProcessing} for the effect implementation
 * @see {@link usePostProcessingStore} for state management
 */

import { ControlGroup } from '@/components/ui/ControlGroup';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { type AntiAliasingMethod } from '@/stores/defaults/visualDefaults';
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
 * FX Controls component for post-processing effects.
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
      {/* Anti-aliasing */}
      <ControlGroup title="Anti-aliasing">
        <Select<AntiAliasingMethod>
          label=""
          options={ANTI_ALIASING_OPTIONS}
          value={antiAliasingMethod}
          onChange={setAntiAliasingMethod}
          data-testid="anti-aliasing-select"
        />

        {/* SMAA Threshold - only visible when SMAA is selected */}
        {antiAliasingMethod === 'smaa' && (
          <Slider
            label="Threshold"
            value={smaaThreshold}
            min={0.01}
            max={0.2}
            step={0.01}
            onChange={setSmaaThreshold}
            showValue
            tooltip="Edge detection sensitivity. Lower = more aggressive."
            minLabel="Strong"
            maxLabel="Subtle"
            data-testid="smaa-threshold-slider"
          />
        )}
      </ControlGroup>

      {/* Depth Settings */}
      <ControlGroup title="Depth">
        <Switch
          checked={objectOnlyDepth}
          onCheckedChange={setObjectOnlyDepth}
          label="Object Only Depth"
        />
        <p className="text-[10px] text-text-secondary mt-1">
          Exclude background from depth-based effects.
        </p>
      </ControlGroup>
    </div>
  );
});

MiscControls.displayName = 'MiscControls';
