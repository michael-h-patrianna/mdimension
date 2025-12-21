/**
 * MandelbulbAnimationDrawer Component
 *
 * Animation controls for Mandelbulb/Mandelbulb fractal, displayed in the
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
import { useExtendedObjectStore, type ExtendedObjectState } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { AnimationDrawerContainer } from './AnimationDrawerContainer';

/**
 * MandelbulbAnimationDrawer component
 *
 * Renders animation controls for Mandelbulb/Mandelbulb fractals within
 * the timeline drawer. Uses consistent styling with other animation
 * system panels.
 *
 * @returns React component
 */
export const MandelbulbAnimationDrawer: React.FC = React.memo(() => {
  const dimension = useGeometryStore((state) => state.dimension);

  // Get config and setters from store
  const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
    config: state.mandelbulb,
    // Power Animation
    setPowerAnimationEnabled: state.setMandelbulbPowerAnimationEnabled,
    setPowerMin: state.setMandelbulbPowerMin,
    setPowerMax: state.setMandelbulbPowerMax,
    setPowerSpeed: state.setMandelbulbPowerSpeed,
    // Phase Shifts
    setPhaseShiftEnabled: state.setMandelbulbPhaseShiftEnabled,
    setPhaseSpeed: state.setMandelbulbPhaseSpeed,
    setPhaseAmplitude: state.setMandelbulbPhaseAmplitude,
    // Dimension Mixing
    setDimensionMixEnabled: state.setMandelbulbDimensionMixEnabled,
    setMixIntensity: state.setMandelbulbMixIntensity,
    setMixFrequency: state.setMandelbulbMixFrequency,
    // Origin Drift
    setOriginDriftEnabled: state.setMandelbulbOriginDriftEnabled,
    setDriftAmplitude: state.setMandelbulbDriftAmplitude,
    // Slice Animation
    setSliceAnimationEnabled: state.setMandelbulbSliceAnimationEnabled,
    setSliceSpeed: state.setMandelbulbSliceSpeed,
    setSliceAmplitude: state.setMandelbulbSliceAmplitude,
  }));

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
    // Dimension Mixing
    setDimensionMixEnabled,
    setMixIntensity,
    setMixFrequency,
    // Origin Drift
    setOriginDriftEnabled,
    setDriftAmplitude,
    // Slice Animation
    setSliceAnimationEnabled,
    setSliceSpeed,
    setSliceAmplitude,
  } = useExtendedObjectStore(extendedObjectSelector);

  return (
    <AnimationDrawerContainer data-testid="mandelbulb-animation-drawer">
      {/* Power Animation */}
      <div className="space-y-4" data-testid="animation-panel-powerAnimation">
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
      <div className="space-y-4" data-testid="animation-panel-phaseShifts">
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

      {/* Dimension Mixing */}
      <div className="space-y-4" data-testid="animation-panel-dimensionMixing">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Dimension Mixing
          </label>
          <ToggleButton
            pressed={config.dimensionMixEnabled}
            onToggle={() => setDimensionMixEnabled(!config.dimensionMixEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle dimension mixing"
          >
            {config.dimensionMixEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.dimensionMixEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Intensity</span>
            <input
              type="range"
              min={0}
              max={0.3}
              step={0.01}
              value={config.mixIntensity}
              onChange={(e) => setMixIntensity(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Mixing intensity"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.mixIntensity.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Frequency</span>
            <input
              type="range"
              min={0.1}
              max={2.0}
              step={0.1}
              value={config.mixFrequency}
              onChange={(e) => setMixFrequency(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Mixing frequency"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.mixFrequency.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Origin Drift (4D+) */}
      {dimension >= 4 && (
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
          </div>
        </div>
      )}

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

MandelbulbAnimationDrawer.displayName = 'MandelbulbAnimationDrawer';

export default MandelbulbAnimationDrawer;
