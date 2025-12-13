/**
 * BloomControls Component
 *
 * UI controls for managing bloom post-processing effects.
 * Implements controls for Dual Filter Bloom matching the original MultiScoper implementation.
 *
 * Controls:
 * - Enable/Disable toggle: Turns bloom effect on/off
 * - Intensity slider: Controls bloom brightness (0-2)
 * - Threshold slider: Luminance threshold for bloom (0-1)
 * - Soft Knee slider: Smooth transition at threshold edge (0-1)
 * - Radius slider: Bloom spread/radius (0-1)
 * - Levels slider: Number of mip levels for blur chain (1-8)
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
 * @example
 * With custom styling:
 * ```tsx
 * <BloomControls className="my-custom-class" />
 * ```
 *
 * @remarks
 * - All values are validated and clamped in the visual store
 * - Double-click on value badge to reset individual parameters
 * - Follows the same UI pattern as VisualControls
 * - Uses mipmapBlur for shape-preserving blur (Jimenez 2014 dual filter)
 * - 6 mip levels by default (matches original kMaxMipLevels)
 *
 * @see {@link PostProcessing} for the bloom effect implementation
 * @see {@link useVisualStore} for state management
 * @see MultiScoper/src/rendering/effects/BloomEffect.cpp for original implementation
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { ToggleButton } from '@/components/ui/ToggleButton';
import {
  useVisualStore,
  DEFAULT_BLOOM_INTENSITY,
  DEFAULT_BLOOM_THRESHOLD,
  DEFAULT_BLOOM_RADIUS,
  DEFAULT_BLOOM_SOFT_KNEE,
  DEFAULT_BLOOM_LEVELS,
} from '@/stores/visualStore';

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
    bloomEnabled,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    bloomSoftKnee,
    bloomLevels,
    setBloomEnabled,
    setBloomIntensity,
    setBloomThreshold,
    setBloomRadius,
    setBloomSoftKnee,
    setBloomLevels,
  } = useVisualStore(
    useShallow((state) => ({
      // State
      bloomEnabled: state.bloomEnabled,
      bloomIntensity: state.bloomIntensity,
      bloomThreshold: state.bloomThreshold,
      bloomRadius: state.bloomRadius,
      bloomSoftKnee: state.bloomSoftKnee,
      bloomLevels: state.bloomLevels,
      // Actions
      setBloomEnabled: state.setBloomEnabled,
      setBloomIntensity: state.setBloomIntensity,
      setBloomThreshold: state.setBloomThreshold,
      setBloomRadius: state.setBloomRadius,
      setBloomSoftKnee: state.setBloomSoftKnee,
      setBloomLevels: state.setBloomLevels,
    }))
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable/Disable Bloom */}
      <ToggleButton
        pressed={bloomEnabled}
        onToggle={setBloomEnabled}
        ariaLabel={bloomEnabled ? "Disable Bloom" : "Enable Bloom"}
      >
        Enable Bloom
      </ToggleButton>

      {/* Bloom controls - only visible when enabled */}
      {bloomEnabled && (
        <>
          {/* Intensity */}
          <Slider
            label="Intensity"
            min={0}
            max={2}
            step={0.1}
            value={bloomIntensity}
            onChange={setBloomIntensity}
            onReset={() => setBloomIntensity(DEFAULT_BLOOM_INTENSITY)}
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
            onReset={() => setBloomThreshold(DEFAULT_BLOOM_THRESHOLD)}
            showValue
          />

          {/* Soft Knee - smooth transition at threshold edge */}
          <Slider
            label="Soft Knee"
            min={0}
            max={1}
            step={0.05}
            value={bloomSoftKnee}
            onChange={setBloomSoftKnee}
            onReset={() => setBloomSoftKnee(DEFAULT_BLOOM_SOFT_KNEE)}
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
            onReset={() => setBloomRadius(DEFAULT_BLOOM_RADIUS)}
            showValue
          />

          {/* Levels - number of mip levels for blur chain */}
          <Slider
            label="Blur Levels"
            min={1}
            max={8}
            step={1}
            value={bloomLevels}
            onChange={setBloomLevels}
            onReset={() => setBloomLevels(DEFAULT_BLOOM_LEVELS)}
            showValue
          />
        </>
      )}
    </div>
  );
});