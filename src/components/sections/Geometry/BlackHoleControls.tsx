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
    // Scale (3D mesh scale)
    setScale: state.setBlackHoleScale,
    // Basic settings
    setHorizonRadius: state.setBlackHoleHorizonRadius,
    setSpin: state.setBlackHoleSpin,
    setManifoldThickness: state.setBlackHoleManifoldThickness,
    setDiskInnerRadiusMul: state.setBlackHoleDiskInnerRadiusMul,
    setDiskOuterRadiusMul: state.setBlackHoleDiskOuterRadiusMul,
    // Cross-section
    setParameterValue: state.setBlackHoleParameterValue,
    resetParameters: state.resetBlackHoleParameters,
  }));

  const {
    config,
    applyVisualPreset,
    setScale,
    setHorizonRadius,
    setSpin,
    setManifoldThickness,
    setDiskInnerRadiusMul,
    setDiskOuterRadiusMul,
    setParameterValue,
    resetParameters,
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

      {/* Geometry Settings */}
      <Section title="Geometry" defaultOpen={true}>
        <Slider
          label="Scale"
          min={0.1}
          max={0.7}
          step={0.05}
          value={config.scale}
          onChange={setScale}
          showValue
          data-testid="blackhole-scale"
        />

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
          label="Spin (Kerr)"
          min={0}
          max={0.998}
          step={0.001}
          value={config.spin}
          onChange={setSpin}
          showValue
          tooltip="Black hole rotation (0=Schwarzschild, 1=Extreme Kerr)"
          data-testid="blackhole-spin"
        />

        <Slider
          label="Disk Thickness"
          min={0.01}
          max={1.0}
          step={0.01}
          value={config.manifoldThickness}
          onChange={setManifoldThickness}
          showValue
          data-testid="blackhole-manifold-thickness"
        />
        
        <Slider
            label="Inner Radius"
            min={1}
            max={5}
            step={0.1}
            value={config.diskInnerRadiusMul}
            onChange={setDiskInnerRadiusMul}
            showValue
            tooltip="Accretion disk inner edge (ISCO multiplier)"
            data-testid="blackhole-inner-radius"
        />
        
        <Slider
            label="Outer Radius"
            min={3}
            max={30}
            step={1}
            value={config.diskOuterRadiusMul}
            onChange={setDiskOuterRadiusMul}
            showValue
            tooltip="Accretion disk outer edge"
            data-testid="blackhole-outer-radius"
        />
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
