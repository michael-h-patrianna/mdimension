/**
 * MiscControls Component
 *
 * UI controls for miscellaneous post-processing effects.
 *
 * Controls:
 * - Anti-aliasing method selector: None, FXAA, SMAA
 *
 * @see {@link PostProcessing} for the effect implementation
 * @see {@link useVisualStore} for state management
 * @see https://threejs.org/docs/#examples/en/postprocessing/SMAAPass
 */

import { Select, type SelectOption } from '@/components/ui/Select';
import { type AntiAliasingMethod } from '@/stores/defaults/visualDefaults';
import { useVisualStore } from '@/stores/visualStore';
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
  } = useVisualStore(
    useShallow((state) => ({
      antiAliasingMethod: state.antiAliasingMethod,
      setAntiAliasingMethod: state.setAntiAliasingMethod,
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
    </div>
  );
});

MiscControls.displayName = 'MiscControls';
