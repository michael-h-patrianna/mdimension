/**
 * JuliaAnimationDrawer Component
 *
 * Animation controls for Quaternion Julia fractal, displayed in the
 * TimelineControls bottom drawer.
 *
 * Animation Systems:
 * - Julia Constant Animation: Animates the c constant in z = z^n + c
 * - Power Morphing: Smoothly transitions between power values
 * - Origin Drift: 4D+ only, shifts the sampling origin
 * - Dimension Mixing: 4D+ only, blends dimensional components
 *
 * @see docs/prd/quaternion-julia-fractal.md
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { AnimationDrawerContainer } from './AnimationDrawerContainer';

/**
 * JuliaAnimationDrawer component
 *
 * Renders animation controls for Quaternion Julia fractals within
 * the timeline drawer. Uses consistent styling with other animation
 * system panels.
 *
 * @returns React component
 */
export const JuliaAnimationDrawer: React.FC = React.memo(() => {
  const dimension = useGeometryStore((state) => state.dimension);

  // Get config and setters from store
  const {
    config,
    setConstantAnimationEnabled,
    setConstantAnimationAmplitude,
    setConstantAnimationFrequency,
    setPowerAnimationEnabled,
    setPowerAnimationMinPower,
    setPowerAnimationMaxPower,
    setPowerAnimationSpeed,
    setOriginDriftEnabled,
    setOriginDriftAmplitude,
    setOriginDriftBaseFrequency,
    setDimensionMixEnabled,
    setMixIntensity,
    setMixFrequency,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.quaternionJulia,
      setConstantAnimationEnabled: state.setQuaternionJuliaConstantAnimationEnabled,
      setConstantAnimationAmplitude: state.setQuaternionJuliaConstantAnimationAmplitude,
      setConstantAnimationFrequency: state.setQuaternionJuliaConstantAnimationFrequency,
      setPowerAnimationEnabled: state.setQuaternionJuliaPowerAnimationEnabled,
      setPowerAnimationMinPower: state.setQuaternionJuliaPowerAnimationMinPower,
      setPowerAnimationMaxPower: state.setQuaternionJuliaPowerAnimationMaxPower,
      setPowerAnimationSpeed: state.setQuaternionJuliaPowerAnimationSpeed,
      setOriginDriftEnabled: state.setQuaternionJuliaOriginDriftEnabled,
      setOriginDriftAmplitude: state.setQuaternionJuliaOriginDriftAmplitude,
      setOriginDriftBaseFrequency: state.setQuaternionJuliaOriginDriftBaseFrequency,
      setDimensionMixEnabled: state.setQuaternionJuliaDimensionMixEnabled,
      setMixIntensity: state.setQuaternionJuliaMixIntensity,
      setMixFrequency: state.setQuaternionJuliaMixFrequency,
    }))
  );

  return (
    <AnimationDrawerContainer data-testid="julia-animation-drawer">
      {/* Julia Constant Animation - Custom UI for array params */}
      <div className="space-y-3" data-testid="animation-panel-juliaConstant">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Julia Constant Path
          </label>
          <ToggleButton
            pressed={config.juliaConstantAnimation.enabled}
            onToggle={() => setConstantAnimationEnabled(!config.juliaConstantAnimation.enabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle Julia constant animation"
          >
            {config.juliaConstantAnimation.enabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.juliaConstantAnimation.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Amplitude</span>
            <input
              type="range"
              min={0.01}
              max={0.5}
              step={0.01}
              value={config.juliaConstantAnimation.amplitude[0]}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setConstantAnimationAmplitude([v, v, v, v]);
              }}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Julia constant amplitude"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.juliaConstantAnimation.amplitude[0].toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Frequency</span>
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={config.juliaConstantAnimation.frequency[0]}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                // Different ratios per component for more organic motion
                setConstantAnimationFrequency([v, v * 0.8, v * 1.2, v * 0.6]);
              }}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Julia constant frequency"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.juliaConstantAnimation.frequency[0].toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Power Morphing */}
      <div className="space-y-3" data-testid="animation-panel-powerAnimation">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Power Morphing
          </label>
          <ToggleButton
            pressed={config.powerAnimation.enabled}
            onToggle={() => setPowerAnimationEnabled(!config.powerAnimation.enabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle power morphing"
          >
            {config.powerAnimation.enabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.powerAnimation.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Min Power</span>
            <input
              type="range"
              min={2}
              max={6}
              step={0.5}
              value={config.powerAnimation.minPower}
              onChange={(e) => setPowerAnimationMinPower(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Power morphing min power"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.powerAnimation.minPower.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Max Power</span>
            <input
              type="range"
              min={4}
              max={8}
              step={0.5}
              value={config.powerAnimation.maxPower}
              onChange={(e) => setPowerAnimationMaxPower(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Power morphing max power"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.powerAnimation.maxPower.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Speed</span>
            <input
              type="range"
              min={0.01}
              max={0.1}
              step={0.005}
              value={config.powerAnimation.speed}
              onChange={(e) => setPowerAnimationSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Power morphing speed"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.powerAnimation.speed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Origin Drift - 4D+ only */}
      {dimension >= 4 && (
        <div className="space-y-3" data-testid="animation-panel-originDrift">
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
                value={config.originDriftAmplitude}
                onChange={(e) => setOriginDriftAmplitude(parseFloat(e.target.value))}
                className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                aria-label="Origin drift amplitude"
              />
              <span className="text-xs font-mono w-10 text-right">
                {config.originDriftAmplitude.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-16">Frequency</span>
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.01}
                value={config.originDriftBaseFrequency}
                onChange={(e) => setOriginDriftBaseFrequency(parseFloat(e.target.value))}
                className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                aria-label="Origin drift frequency"
              />
              <span className="text-xs font-mono w-10 text-right">
                {config.originDriftBaseFrequency.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dimension Mixing - 4D+ only */}
      {dimension >= 4 && (
        <div className="space-y-3" data-testid="animation-panel-dimensionMix">
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
                min={0.0}
                max={0.3}
                step={0.01}
                value={config.mixIntensity}
                onChange={(e) => setMixIntensity(parseFloat(e.target.value))}
                className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
                aria-label="Dimension mixing intensity"
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
                aria-label="Dimension mixing frequency"
              />
              <span className="text-xs font-mono w-10 text-right">
                {config.mixFrequency.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
    </AnimationDrawerContainer>
  );
});

JuliaAnimationDrawer.displayName = 'JuliaAnimationDrawer';

export default JuliaAnimationDrawer;
