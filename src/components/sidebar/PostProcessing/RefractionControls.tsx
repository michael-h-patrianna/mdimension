/**
 * RefractionControls Component
 *
 * UI controls for managing screen-space refraction post-processing effect.
 *
 * Controls:
 * - Enable/Disable toggle: Turns refraction effect on/off
 * - IOR slider: Index of refraction (1.0-2.5, default 1.5 for glass)
 * - Strength slider: Refraction distortion strength (0-1)
 * - Chromatic Aberration slider: Color separation amount (0-1)
 *
 * @see {@link PostProcessing} for the refraction effect implementation
 * @see {@link usePostProcessingStore} for state management
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import {
  DEFAULT_REFRACTION_IOR,
  DEFAULT_REFRACTION_STRENGTH,
  DEFAULT_REFRACTION_CHROMATIC_ABERRATION,
} from '@/stores/defaults/visualDefaults';
import { usePostProcessingStore } from '@/stores/postProcessingStore';

export interface RefractionControlsProps {
  className?: string;
}

/**
 * RefractionControls component that provides UI for adjusting screen-space refraction settings.
 */
export const RefractionControls: React.FC<RefractionControlsProps> = React.memo(({
  className = '',
}) => {
  const {
    refractionEnabled,
    refractionIOR,
    refractionStrength,
    refractionChromaticAberration,
    setRefractionEnabled,
    setRefractionIOR,
    setRefractionStrength,
    setRefractionChromaticAberration,
  } = usePostProcessingStore(
    useShallow((state) => ({
      // State
      refractionEnabled: state.refractionEnabled,
      refractionIOR: state.refractionIOR,
      refractionStrength: state.refractionStrength,
      refractionChromaticAberration: state.refractionChromaticAberration,
      // Actions
      setRefractionEnabled: state.setRefractionEnabled,
      setRefractionIOR: state.setRefractionIOR,
      setRefractionStrength: state.setRefractionStrength,
      setRefractionChromaticAberration: state.setRefractionChromaticAberration,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable/Disable Refraction */}
      <Switch
        checked={refractionEnabled}
        onCheckedChange={setRefractionEnabled}
        label="Screen-Space Refraction"
      />

      {/* Refraction controls - only visible when enabled */}
      {refractionEnabled && (
        <>
          {/* Index of Refraction */}
          <Slider
            label="IOR (Index of Refraction)"
            min={1.0}
            max={2.5}
            step={0.05}
            value={refractionIOR}
            onChange={setRefractionIOR}
            onReset={() => setRefractionIOR(DEFAULT_REFRACTION_IOR)}
            showValue
          />

          {/* Strength */}
          <Slider
            label="Strength"
            min={0}
            max={1}
            step={0.05}
            value={refractionStrength}
            onChange={setRefractionStrength}
            onReset={() => setRefractionStrength(DEFAULT_REFRACTION_STRENGTH)}
            showValue
          />

          {/* Chromatic Aberration */}
          <Slider
            label="Chromatic Aberration"
            min={0}
            max={1}
            step={0.01}
            value={refractionChromaticAberration}
            onChange={setRefractionChromaticAberration}
            onReset={() => setRefractionChromaticAberration(DEFAULT_REFRACTION_CHROMATIC_ABERRATION)}
            showValue
          />
        </>
      )}
    </div>
  );
});
