/**
 * BlackHoleControls Component
 *
 * Controls for configuring n-dimensional black hole visualization.
 * Provides artist-friendly controls for:
 * - Visual presets (Interstellar, Cosmic, Ethereal)
 * - Basic parameters (horizon size, gravity, manifold)
 * - Photon shell glow
 * - Lensing strength
 * - Cross-section slices for 4D+
 *
 * @see docs/prd/ndimensional-visualizer.md
 */

import { useShallow } from 'zustand/react/shallow';
import { Slider } from '@/components/ui/Slider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { Section } from '@/components/sections/Section';
import { type BlackHoleVisualPreset } from '@/lib/geometry/extended/types';
import { useExtendedObjectStore, type ExtendedObjectState } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React from 'react';

/**
 * Props for the BlackHoleControls component.
 */
export interface BlackHoleControlsProps {
  /**
   * Optional CSS class name for additional styling.
   * Applied to the root container element.
   */
  className?: string;
}

/**
 * Visual preset options for dropdown
 */
const visualPresetOptions: Array<{ value: BlackHoleVisualPreset; label: string; description: string }> = [
  { value: 'interstellar', label: 'Interstellar', description: 'Movie-accurate thin disk with strong lensing' },
  { value: 'cosmic', label: 'Cosmic', description: 'Thicker volumetric manifold with softer glow' },
  { value: 'ethereal', label: 'Ethereal', description: 'Dreamlike thick field with intense glow' },
  { value: 'custom', label: 'Custom', description: 'Your current settings' },
];

/**
 * BlackHoleControls component
 *
 * Provides controls for black hole visualization:
 * - Visual presets for quick configuration
 * - Basic parameters (horizon, gravity, manifold)
 * - Slice parameters for 4D+
 *
 * @param props - Component props
 * @param props.className - Optional CSS class name
 * @returns React component
 */
export const BlackHoleControls: React.FC<BlackHoleControlsProps> = React.memo(({
  className = '',
}) => {
  // Consolidate extended object store selectors with useShallow
  const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
    config: state.blackhole,
    // Visual preset
    applyVisualPreset: state.applyBlackHoleVisualPreset,
    // Basic settings
    setHorizonRadius: state.setBlackHoleHorizonRadius,
    setGravityStrength: state.setBlackHoleGravityStrength,
    setManifoldIntensity: state.setBlackHoleManifoldIntensity,
    setManifoldThickness: state.setBlackHoleManifoldThickness,
    setPhotonShellWidth: state.setBlackHolePhotonShellWidth,
    setBloomBoost: state.setBlackHoleBloomBoost,
    // Shell glow
    setShellGlowStrength: state.setBlackHoleShellGlowStrength,
    setShellGlowColor: state.setBlackHoleShellGlowColor,
    // Edge glow
    setEdgeGlowEnabled: state.setBlackHoleEdgeGlowEnabled,
    setEdgeGlowIntensity: state.setBlackHoleEdgeGlowIntensity,
    setEdgeGlowColor: state.setBlackHoleEdgeGlowColor,
    // Doppler
    setDopplerEnabled: state.setBlackHoleDopplerEnabled,
    setDopplerStrength: state.setBlackHoleDopplerStrength,
    // Jets
    setJetsEnabled: state.setBlackHoleJetsEnabled,
    setJetsHeight: state.setBlackHoleJetsHeight,
    setJetsIntensity: state.setBlackHoleJetsIntensity,
    setJetsColor: state.setBlackHoleJetsColor,
    // Cross-section
    setParameterValue: state.setBlackHoleParameterValue,
    resetParameters: state.resetBlackHoleParameters,
    // Advanced lensing
    setDimensionEmphasis: state.setBlackHoleDimensionEmphasis,
    setDistanceFalloff: state.setBlackHoleDistanceFalloff,
    setEpsilonMul: state.setBlackHoleEpsilonMul,
    setBendScale: state.setBlackHoleBendScale,
    setBendMaxPerStep: state.setBlackHoleBendMaxPerStep,
    setLensingClamp: state.setBlackHoleLensingClamp,
    setRayBendingMode: state.setBlackHoleRayBendingMode,
  }));

  const {
    config,
    applyVisualPreset,
    setHorizonRadius,
    setGravityStrength,
    setManifoldIntensity,
    setManifoldThickness,
    setPhotonShellWidth,
    setBloomBoost,
    setShellGlowStrength,
    setShellGlowColor,
    setEdgeGlowEnabled,
    setEdgeGlowIntensity,
    setEdgeGlowColor,
    setDopplerEnabled,
    setDopplerStrength,
    setJetsEnabled,
    setJetsHeight,
    setJetsIntensity,
    setJetsColor,
    setParameterValue,
    resetParameters,
    setDimensionEmphasis,
    setDistanceFalloff,
    setEpsilonMul,
    setBendScale,
    setBendMaxPerStep,
    setLensingClamp,
    setRayBendingMode,
  } = useExtendedObjectStore(extendedObjectSelector);

  // Get current dimension for cross-section controls
  const dimension = useGeometryStore((state) => state.dimension);

  return (
    <div className={className} data-testid="blackhole-controls">
      {/* Visual Preset Selection */}
      <Section title="Visual Preset" defaultOpen={true}>
        <div className="space-y-2">
          <div className="relative">
            <select
              className="w-full bg-surface-tertiary border border-white/10 rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent appearance-none cursor-pointer"
              value={config.visualPreset}
              onChange={(e) => applyVisualPreset(e.target.value as BlackHoleVisualPreset)}
              data-testid="blackhole-visual-preset"
            >
              {visualPresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-text-tertiary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-text-tertiary pt-1">
            {visualPresetOptions.find(o => o.value === config.visualPreset)?.description}
          </p>
        </div>
      </Section>

      {/* Basic Parameters */}
      <Section title="Core Settings" defaultOpen={true}>
        <Slider
          label="Horizon Radius"
          min={0.1}
          max={5.0}
          step={0.1}
          value={config.horizonRadius}
          onChange={setHorizonRadius}
          showValue
          data-testid="blackhole-horizon-radius"
        />

        <Slider
          label="Gravity Strength"
          min={0}
          max={3.0}
          step={0.1}
          value={config.gravityStrength}
          onChange={setGravityStrength}
          showValue
          data-testid="blackhole-gravity-strength"
        />

        <Slider
          label="Manifold Intensity"
          min={0}
          max={5.0}
          step={0.1}
          value={config.manifoldIntensity}
          onChange={setManifoldIntensity}
          showValue
          data-testid="blackhole-manifold-intensity"
        />

        <Slider
          label="Manifold Thickness"
          min={0.01}
          max={1.0}
          step={0.01}
          value={config.manifoldThickness}
          onChange={setManifoldThickness}
          showValue
          data-testid="blackhole-manifold-thickness"
        />

        <Slider
          label="Bloom Boost"
          min={0}
          max={5.0}
          step={0.1}
          value={config.bloomBoost}
          onChange={setBloomBoost}
          showValue
          data-testid="blackhole-bloom-boost"
        />
      </Section>

      {/* Advanced Lensing Settings */}
      <Section title="Gravitational Lensing" defaultOpen={false}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-text-secondary">Bending Mode</label>
            <div className="flex gap-1 p-0.5 bg-surface-tertiary rounded">
              <button
                onClick={() => setRayBendingMode('spiral')}
                className={`flex-1 px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                  config.rayBendingMode === 'spiral' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                SPIRAL
              </button>
              <button
                onClick={() => setRayBendingMode('orbital')}
                className={`flex-1 px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                  config.rayBendingMode === 'orbital' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                ORBITAL
              </button>
            </div>
          </div>

          <Slider
            label="Dimension Emphasis"
            min={0}
            max={2.0}
            step={0.1}
            value={config.dimensionEmphasis}
            onChange={setDimensionEmphasis}
            showValue
            tooltip="N-dimensional scaling factor"
          />

          <Slider
            label="Distance Falloff"
            min={0.5}
            max={4.0}
            step={0.1}
            value={config.distanceFalloff}
            onChange={setDistanceFalloff}
            showValue
            tooltip="Gravity decay over distance"
          />

          <Slider
            label="Numerical Stability"
            min={0.0001}
            max={0.5}
            step={0.001}
            value={config.epsilonMul}
            onChange={setEpsilonMul}
            showValue
            tooltip="Epsilon term to prevent singularity"
          />

          <Slider
            label="Bend Multiplier"
            min={0}
            max={5.0}
            step={0.1}
            value={config.bendScale}
            onChange={setBendScale}
            showValue
          />

          <Slider
            label="Max Bend Per Step"
            min={0}
            max={0.8}
            step={0.05}
            value={config.bendMaxPerStep}
            onChange={setBendMaxPerStep}
            showValue
          />

          <Slider
            label="Lensing Clamp"
            min={0}
            max={50}
            step={1}
            value={config.lensingClamp}
            onChange={setLensingClamp}
            showValue
          />
        </div>
      </Section>

      {/* Photon Shell & Glow */}
      <Section title="Photon Shell" defaultOpen={false}>
        <Slider
          label="Shell Width"
          min={0}
          max={0.3}
          step={0.01}
          value={config.photonShellWidth}
          onChange={setPhotonShellWidth}
          showValue
          data-testid="blackhole-shell-width"
        />

        <Slider
          label="Shell Glow"
          min={0}
          max={10.0}
          step={0.5}
          value={config.shellGlowStrength}
          onChange={setShellGlowStrength}
          showValue
          data-testid="blackhole-shell-glow"
        />

        <div className="flex items-center justify-between">
          <label className="text-xs text-text-secondary">Shell Color</label>
          <ColorPicker
            value={config.shellGlowColor}
            onChange={setShellGlowColor}
            disableAlpha={true}
            className="w-24"
          />
        </div>
      </Section>

      {/* Edge Glow / Horizon */}
      <Section title="Event Horizon" defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary">Edge Glow</label>
            <ToggleButton
              pressed={config.edgeGlowEnabled}
              onToggle={() => setEdgeGlowEnabled(!config.edgeGlowEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle edge glow"
            >
              {config.edgeGlowEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>

          {config.edgeGlowEnabled && (
            <>
              <Slider
                label="Intensity"
                min={0}
                max={5.0}
                step={0.1}
                value={config.edgeGlowIntensity}
                onChange={setEdgeGlowIntensity}
                showValue
                data-testid="blackhole-edge-intensity"
              />
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary">Color</label>
                <ColorPicker
                  value={config.edgeGlowColor}
                  onChange={setEdgeGlowColor}
                  disableAlpha={true}
                  className="w-24"
                />
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Doppler Effect */}
      <Section title="Doppler Effect" defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary">Enable Doppler</label>
            <ToggleButton
              pressed={config.dopplerEnabled}
              onToggle={() => setDopplerEnabled(!config.dopplerEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle Doppler effect"
            >
              {config.dopplerEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>

          {config.dopplerEnabled && (
            <Slider
              label="Strength"
              min={0}
              max={2.0}
              step={0.1}
              value={config.dopplerStrength}
              onChange={setDopplerStrength}
              showValue
              data-testid="blackhole-doppler-strength"
            />
          )}

          <p className="text-xs text-text-tertiary">
            Relativistic color shift from orbital motion
          </p>
        </div>
      </Section>

      {/* Polar Jets */}
      <Section title="Polar Jets" defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary">Enable Jets</label>
            <ToggleButton
              pressed={config.jetsEnabled}
              onToggle={() => setJetsEnabled(!config.jetsEnabled)}
              className="text-xs px-2 py-1 h-auto"
              ariaLabel="Toggle polar jets"
            >
              {config.jetsEnabled ? 'ON' : 'OFF'}
            </ToggleButton>
          </div>

          {config.jetsEnabled && (
            <>
              <Slider
                label="Height"
                min={1}
                max={30}
                step={1}
                value={config.jetsHeight}
                onChange={setJetsHeight}
                showValue
                data-testid="blackhole-jets-height"
              />
              <Slider
                label="Intensity"
                min={0}
                max={5.0}
                step={0.1}
                value={config.jetsIntensity}
                onChange={setJetsIntensity}
                showValue
                data-testid="blackhole-jets-intensity"
              />
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary">Color</label>
                <ColorPicker
                  value={config.jetsColor}
                  onChange={setJetsColor}
                  disableAlpha={true}
                  className="w-24"
                />
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Cross Section - 4D+ */}
      {dimension >= 4 && (
        <Section
          title={`Cross Section (${dimension - 3} dim${dimension > 4 ? 's' : ''})`}
          defaultOpen={true}
          onReset={() => resetParameters()}
        >
          {Array.from({ length: dimension - 3 }, (_, i) => (
            <Slider
              key={`slice-dim-${i + 3}`}
              label={`Dim ${i + 4}`}
              min={-2.0}
              max={2.0}
              step={0.1}
              value={config.parameterValues[i] ?? 0}
              onChange={(v) => setParameterValue(i, v)}
              showValue
              data-testid={`blackhole-slice-dim-${i + 4}`}
            />
          ))}
          <p className="text-xs text-text-tertiary">
            Explore different {dimension}D cross-sections
          </p>
        </Section>
      )}

      {/* Rendering Info */}
      <div className="px-4 py-2 text-xs text-text-secondary border-t border-white/5">
        <p>Rendering: Volumetric Raymarching</p>
        <p className="text-text-tertiary mt-1">
          {dimension}D black hole with gravitational lensing
        </p>
      </div>
    </div>
  );
});

BlackHoleControls.displayName = 'BlackHoleControls';

export default BlackHoleControls;
