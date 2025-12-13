/**
 * BokehControls Component
 *
 * UI controls for managing bokeh (depth of field) post-processing effects.
 * Uses Three.js BokehPass for realistic depth blur.
 *
 * Controls:
 * - Enable/Disable toggle: Turns bokeh effect on/off
 * - Focus slider: Distance from camera where objects are in focus (0.1-10)
 * - Aperture slider: Camera aperture size - affects blur amount (0.001-0.1)
 * - Max Blur slider: Maximum blur intensity (0-0.1)
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name for styling
 *
 * @returns UI controls for bokeh post-processing
 *
 * @example
 * ```tsx
 * <ControlPanel>
 *   <BokehControls />
 * </ControlPanel>
 * ```
 *
 * @remarks
 * - All values are validated and clamped in the visual store
 * - Double-click on value badge to reset individual parameters
 * - Higher aperture values create stronger blur effect
 *
 * @see {@link PostProcessing} for the bokeh effect implementation
 * @see {@link useVisualStore} for state management
 * @see https://threejs.org/docs/#examples/en/postprocessing/BokehPass
 */

import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import {
  DEFAULT_BOKEH_APERTURE,
  DEFAULT_BOKEH_FOCUS,
  DEFAULT_BOKEH_MAX_BLUR,
  useVisualStore,
} from '@/stores/visualStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface BokehControlsProps {
  className?: string;
}

/**
 * BokehControls component that provides UI for adjusting bokeh/depth of field settings.
 * @param root0
 * @param root0.className
 */
export const BokehControls: React.FC<BokehControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate all visual store subscriptions with useShallow to reduce re-renders
  const {
    bokehEnabled,
    bokehFocus,
    bokehAperture,
    bokehMaxBlur,
    setBokehEnabled,
    setBokehFocus,
    setBokehAperture,
    setBokehMaxBlur,
  } = useVisualStore(
    useShallow((state) => ({
      // State
      bokehEnabled: state.bokehEnabled,
      bokehFocus: state.bokehFocus,
      bokehAperture: state.bokehAperture,
      bokehMaxBlur: state.bokehMaxBlur,
      // Actions
      setBokehEnabled: state.setBokehEnabled,
      setBokehFocus: state.setBokehFocus,
      setBokehAperture: state.setBokehAperture,
      setBokehMaxBlur: state.setBokehMaxBlur,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable/Disable Bokeh */}
      <Switch
        checked={bokehEnabled}
        onCheckedChange={setBokehEnabled}
        label="Depth of Field"
      />

      {/* Bokeh controls - only visible when enabled */}
      {bokehEnabled && (
        <>
          {/* Focus Distance */}
          <Slider
            label="Focus"
            min={0.1}
            max={10}
            step={0.1}
            value={bokehFocus}
            onChange={setBokehFocus}
            onReset={() => setBokehFocus(DEFAULT_BOKEH_FOCUS)}
            showValue
          />

          {/* Aperture */}
          <Slider
            label="Aperture"
            min={0.001}
            max={0.1}
            step={0.001}
            value={bokehAperture}
            onChange={setBokehAperture}
            onReset={() => setBokehAperture(DEFAULT_BOKEH_APERTURE)}
            showValue
          />

          {/* Max Blur */}
          <Slider
            label="Max Blur"
            min={0}
            max={0.1}
            step={0.0005}
            value={bokehMaxBlur}
            onChange={setBokehMaxBlur}
            onReset={() => setBokehMaxBlur(DEFAULT_BOKEH_MAX_BLUR)}
            showValue
          />
        </>
      )}
    </div>
  );
});
