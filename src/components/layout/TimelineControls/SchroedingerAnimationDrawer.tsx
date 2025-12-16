/**
 * SchroedingerAnimationDrawer Component
 *
 * Animation controls for Schroedinger/Schroedinger fractal, displayed in the
 * TimelineControls bottom drawer.
 *
 * Animation Systems:
 * - Power Animation: Smoothly oscillates the power value
 * - Phase Shifts: Adds phase offsets to create flowing distortions
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
    // Power Animation
    setPowerAnimationEnabled,
    setPowerMin,
    setPowerMax,
    setPowerSpeed,
    // Phase Shifts
    setPhaseShiftEnabled,
    setPhaseSpeed,
    setPhaseAmplitude,
    // Slice Animation
    setSliceAnimationEnabled,
    setSliceSpeed,
    setSliceAmplitude,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.schroedinger,
      // Power Animation
      setPowerAnimationEnabled: state.setSchroedingerPowerAnimationEnabled,
      setPowerMin: state.setSchroedingerPowerMin,
      setPowerMax: state.setSchroedingerPowerMax,
      setPowerSpeed: state.setSchroedingerPowerSpeed,
      // Phase Shifts
      setPhaseShiftEnabled: state.setSchroedingerPhaseShiftEnabled,
      setPhaseSpeed: state.setSchroedingerPhaseSpeed,
      setPhaseAmplitude: state.setSchroedingerPhaseAmplitude,
      // Slice Animation
      setSliceAnimationEnabled: state.setSchroedingerSliceAnimationEnabled,
      setSliceSpeed: state.setSchroedingerSliceSpeed,
      setSliceAmplitude: state.setSchroedingerSliceAmplitude,
    }))
  );

  return (
    <AnimationDrawerContainer data-testid="schroedinger-animation-drawer">
      {/* Power Animation */}
      <div className="space-y-3" data-testid="animation-panel-powerAnimation">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Power Animation
          </label>
          <ToggleButton
            pressed={config.powerAnimationEnabled}
            onToggle={() => setPowerAnimationEnabled(!config.powerAnimationEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle power animation"
          >
            {config.powerAnimationEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.powerAnimationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Min</span>
            <input
              type="range"
              min={2}
              max={16}
              step={0.5}
              value={config.powerMin}
              onChange={(e) => setPowerMin(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Power animation min"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.powerMin.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Max</span>
            <input
              type="range"
              min={3}
              max={24}
              step={0.5}
              value={config.powerMax}
              onChange={(e) => setPowerMax(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Power animation max"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.powerMax.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Speed</span>
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={config.powerSpeed}
              onChange={(e) => setPowerSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Power animation speed"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.powerSpeed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Phase Shifts */}
      <div className="space-y-3" data-testid="animation-panel-phaseShifts">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Phase Shifts
          </label>
          <ToggleButton
            pressed={config.phaseShiftEnabled}
            onToggle={() => setPhaseShiftEnabled(!config.phaseShiftEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle phase shifts"
          >
            {config.phaseShiftEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.phaseShiftEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Amplitude</span>
            <input
              type="range"
              min={0}
              max={0.785}
              step={0.01}
              value={config.phaseAmplitude}
              onChange={(e) => setPhaseAmplitude(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Phase shifts amplitude"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.phaseAmplitude.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Speed</span>
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={config.phaseSpeed}
              onChange={(e) => setPhaseSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Phase shifts speed"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.phaseSpeed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Slice Animation - 4D+ only */}
      {dimension >= 4 && (
        <div className="space-y-3" data-testid="animation-panel-sliceAnimation">
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
