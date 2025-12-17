/**
 * SchroedingerAnimationDrawer Component
 *
 * Animation controls for Schroedinger/Schroedinger fractal, displayed in the
 * TimelineControls bottom drawer.
 *
 * Animation Systems:
 * - Origin Drift: Animates the origin in extra dimensions
 * - Slice Animation: 4D+ only, animates the 4D slice position
 *
 * @see docs/prd/ndimensional-visualizer.md
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { AnimationDrawerContainer } from './AnimationDrawerContainer';

/**
 * SchroedingerAnimationDrawer component
 *
 * Renders animation controls for Schroedinger/Schroedinger fractals within
 * the timeline drawer. Uses consistent styling with other animation
 * system panels.
 *
 * @returns React component
 */
export const SchroedingerAnimationDrawer: React.FC = React.memo(() => {
  const dimension = useGeometryStore((state) => state.dimension);

  // Get config and setters from store
  const {
    config,
    // Origin Drift Animation
    setOriginDriftEnabled,
    setDriftAmplitude,
    setDriftBaseFrequency,
    setDriftFrequencySpread,
    // Slice Animation
    setSliceAnimationEnabled,
    setSliceSpeed,
    setSliceAmplitude,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.schroedinger,
      // Origin Drift Animation
      setOriginDriftEnabled: state.setSchroedingerOriginDriftEnabled,
      setDriftAmplitude: state.setSchroedingerDriftAmplitude,
      setDriftBaseFrequency: state.setSchroedingerDriftBaseFrequency,
      setDriftFrequencySpread: state.setSchroedingerDriftFrequencySpread,
      // Slice Animation
      setSliceAnimationEnabled: state.setSchroedingerSliceAnimationEnabled,
      setSliceSpeed: state.setSchroedingerSliceSpeed,
      setSliceAmplitude: state.setSchroedingerSliceAmplitude,
    }))
  );

  return (
    <AnimationDrawerContainer data-testid="schroedinger-animation-drawer">
      {/* Origin Drift Animation */}
      <div className="space-y-4" data-testid="animation-panel-originDrift">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Origin Drift
          </label>
          <ToggleButton
            pressed={config.originDriftEnabled}
            onToggle={() => setOriginDriftEnabled(!config.originDriftEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle origin drift"
          >
            {config.originDriftEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.originDriftEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Amplitude</span>
            <input
              type="range"
              min={0.01}
              max={0.5}
              step={0.01}
              value={config.driftAmplitude}
              onChange={(e) => setDriftAmplitude(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Drift amplitude"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.driftAmplitude.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Frequency</span>
            <input
              type="range"
              min={0.01}
              max={0.5}
              step={0.01}
              value={config.driftBaseFrequency}
              onChange={(e) => setDriftBaseFrequency(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Drift frequency"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.driftBaseFrequency.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Spread</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.driftFrequencySpread}
              onChange={(e) => setDriftFrequencySpread(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Drift spread"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.driftFrequencySpread.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Slice Animation - 4D+ only */}
      {dimension >= 4 && (
        <div className="space-y-4" data-testid="animation-panel-sliceAnimation">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              Slice Animation
            </label>
            <ToggleButton
              pressed={config.sliceAnimationEnabled}
              onToggle={() => setSliceAnimationEnabled(!config.sliceAnimationEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle slice animation"
            >
              {config.sliceAnimationEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>

          <div className={`space-y-3 ${!config.sliceAnimationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-16">Amplitude</span>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={config.sliceAmplitude}
                onChange={(e) => setSliceAmplitude(parseFloat(e.target.value))}
                className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                aria-label="Slice animation amplitude"
              />
              <span className="text-xs font-mono w-10 text-right">
                {config.sliceAmplitude.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-16">Speed</span>
              <input
                type="range"
                min={0.01}
                max={0.1}
                step={0.01}
                value={config.sliceSpeed}
                onChange={(e) => setSliceSpeed(parseFloat(e.target.value))}
                className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                aria-label="Slice animation speed"
              />
              <span className="text-xs font-mono w-10 text-right">
                {config.sliceSpeed.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

    </AnimationDrawerContainer>
  );
});

SchroedingerAnimationDrawer.displayName = 'SchroedingerAnimationDrawer';

export default SchroedingerAnimationDrawer;