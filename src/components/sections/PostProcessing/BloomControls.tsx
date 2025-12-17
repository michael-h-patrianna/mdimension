/**
 * BloomControls Component
 *
 * UI controls for managing bloom post-processing effects.
 * Uses Three.js UnrealBloomPass for correct intensity behavior.
 *
 * Controls:
 * - Enable/Disable toggle: Turns bloom effect on/off
 * - Intensity slider: Controls bloom strength (0-2, 0 = no bloom)
 * - Threshold slider: Luminance threshold for bloom (0-1)
 * - Radius slider: Bloom spread/radius (0-1)
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name for styling
 *
 * @returns UI controls for bloom post-processing
 *
 * @example
 * ```tsx
 * <ControlPanel>
 *   <BloomControls />
 * </ControlPanel>
 * ```
 *
 * @remarks
 * - All values are validated and clamped in the visual store
 * - Double-click on value badge to reset individual parameters
 * - Intensity 0 produces no visible bloom (same as off)
 *
 * @see {@link PostProcessing} for the bloom effect implementation
 * @see {@link usePostProcessingStore} for state management
 * @see https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import {
} from '@/stores/defaults/visualDefaults';
import { usePostProcessingStore } from '@/stores/postProcessingStore';

export interface BloomControlsProps {
  className?: string;
}

/**
 * BloomControls component that provides UI for adjusting bloom post-processing settings.
 * @param root0
 * @param root0.className
 */
export const BloomControls: React.FC<BloomControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate all visual store subscriptions with useShallow to reduce re-renders
  const {
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    setBloomIntensity,
    setBloomThreshold,
    setBloomRadius,
  } = usePostProcessingStore(
    useShallow((state) => ({
      // State
      bloomIntensity: state.bloomIntensity,
      bloomThreshold: state.bloomThreshold,
      bloomRadius: state.bloomRadius,
      // Actions
      setBloomIntensity: state.setBloomIntensity,
      setBloomThreshold: state.setBloomThreshold,
      setBloomRadius: state.setBloomRadius,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
          {/* Intensity */}
          <Slider
            label="Intensity"
            min={0}
            max={2}
            step={0.1}
            value={bloomIntensity}
            onChange={setBloomIntensity}
            showValue
          />

          {/* Threshold */}
          <Slider
            label="Threshold"
            min={0}
            max={1}
            step={0.05}
            value={bloomThreshold}
            onChange={setBloomThreshold}
            showValue
          />

          {/* Radius */}
          <Slider
            label="Radius"
            min={0}
            max={1}
            step={0.05}
            value={bloomRadius}
            onChange={setBloomRadius}
            showValue
          />
    </div>
  );
});
