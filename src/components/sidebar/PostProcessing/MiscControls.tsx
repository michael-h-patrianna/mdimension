/**
 * MiscControls Component
 *
 * UI controls for miscellaneous post-processing effects.
 *
 * Controls:
 * - FXAA toggle: Fast Approximate Anti-Aliasing
 *
 * @see {@link PostProcessing} for the effect implementation
 * @see {@link useVisualStore} for state management
 * @see https://threejs.org/docs/#examples/en/postprocessing/FXAAPass
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Switch } from '@/components/ui/Switch';
import { useVisualStore } from '@/stores/visualStore';

export interface MiscControlsProps {
  className?: string;
}

/**
 * MiscControls component that provides UI for miscellaneous post-processing settings.
 */
export const MiscControls: React.FC<MiscControlsProps> = React.memo(({
  className = '',
}) => {
  const {
    fxaaEnabled,
    setFxaaEnabled,
  } = useVisualStore(
    useShallow((state) => ({
      fxaaEnabled: state.fxaaEnabled,
      setFxaaEnabled: state.setFxaaEnabled,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* FXAA Anti-aliasing */}
      <Switch
        checked={fxaaEnabled}
        onCheckedChange={setFxaaEnabled}
        label="FXAA"
        data-testid="fxaa-switch"
      />
    </div>
  );
});

MiscControls.displayName = 'MiscControls';
