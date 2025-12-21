/**
 * PolytopeAnimationDrawer Component
 *
 * Animation controls for polytope objects (hypercube, simplex, cross-polytope),
 * displayed in the TimelineControls bottom drawer.
 *
 * Radial breathing modulation - vertices scale toward/away from origin.
 * Creates smooth, organic breathing motion.
 *
 * Parameters:
 * - Amplitude: Scale intensity (0-1)
 * - Frequency: Oscillation speed (0.01-0.20)
 * - Wave: Phase offset based on distance from center (0-1)
 * - Bias: Per-vertex/dimension phase variation (0-1)
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useExtendedObjectStore, type ExtendedObjectState } from '@/stores/extendedObjectStore';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { AnimationDrawerContainer } from './AnimationDrawerContainer';

/**
 * PolytopeAnimationDrawer component
 *
 * Renders radial breathing modulation controls for polytope objects.
 * Wave creates distance-based phase offset, Bias creates per-vertex variation.
 *
 * @returns React component
 */
export const PolytopeAnimationDrawer: React.FC = React.memo(() => {
  // Get config and setters from store
  const extendedObjectSelector = useShallow((state: ExtendedObjectState) => ({
    config: state.polytope,
    // Modulation
    setModulationEnabled: state.setPolytopeFacetOffsetEnabled,
    setModulationAmplitude: state.setPolytopeFacetOffsetAmplitude,
    setModulationFrequency: state.setPolytopeFacetOffsetFrequency,
    setModulationWave: state.setPolytopeFacetOffsetPhaseSpread,
    setModulationBias: state.setPolytopeFacetOffsetBias,
    // Truncation
    setTruncationEnabled: state.setPolytopeTruncationEnabled,
    setTruncationMode: state.setPolytopeTruncationMode,
    setTruncationSpeed: state.setPolytopeTruncationSpeed,
    // Dual Flow
    setDualMorphEnabled: state.setPolytopeDualMorphEnabled,
    setDualMorphSpeed: state.setPolytopeDualMorphSpeed,
    // Ripple Wave
    setExplodeEnabled: state.setPolytopeExplodeEnabled,
    setExplodeSpeed: state.setPolytopeExplodeSpeed,
    setExplodeMax: state.setPolytopeExplodeMax,
  }));

  const {
    config,
    // Modulation
    setModulationEnabled,
    setModulationAmplitude,
    setModulationFrequency,
    setModulationWave,
    setModulationBias,
    // Truncation
    setTruncationEnabled,
    setTruncationMode,
    setTruncationSpeed,
    // Dual Flow
    setDualMorphEnabled,
    setDualMorphSpeed,
    // Ripple Wave
    setExplodeEnabled,
    setExplodeSpeed,
    setExplodeMax,
  } = useExtendedObjectStore(extendedObjectSelector);

  return (
    <AnimationDrawerContainer data-testid="polytope-animation-drawer">
      {/* Vertex Modulation - smooth radial breathing */}
      <div className="space-y-4" data-testid="animation-panel-modulation">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Modulation
          </label>
          <ToggleButton
            pressed={config.facetOffsetEnabled}
            onToggle={() => setModulationEnabled(!config.facetOffsetEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle vertex modulation"
          >
            {config.facetOffsetEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.facetOffsetEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Amplitude control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Amplitude</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.01}
              value={config.facetOffsetAmplitude}
              onChange={(e) => setModulationAmplitude(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Modulation amplitude"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.facetOffsetAmplitude.toFixed(2)}
            </span>
          </div>

          {/* Frequency control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Frequency</span>
            <input
              type="range"
              min={0.01}
              max={0.20}
              step={0.005}
              value={config.facetOffsetFrequency}
              onChange={(e) => setModulationFrequency(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Modulation frequency"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.facetOffsetFrequency.toFixed(2)}
            </span>
          </div>

          {/* Wave control - phase offset based on distance */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Wave</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.01}
              value={config.facetOffsetPhaseSpread}
              onChange={(e) => setModulationWave(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Modulation wave"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.facetOffsetPhaseSpread.toFixed(2)}
            </span>
          </div>

          {/* Bias control - per-vertex/dimension variation */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Bias</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.01}
              value={config.facetOffsetBias}
              onChange={(e) => setModulationBias(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Modulation bias"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.facetOffsetBias.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Truncation Animation */}
      <div className="space-y-4" data-testid="animation-panel-truncation">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Truncation
          </label>
          <ToggleButton
            pressed={config.truncationEnabled}
            onToggle={() => setTruncationEnabled(!config.truncationEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle truncation"
          >
            {config.truncationEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.truncationEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Mode</span>
            <select
              className="flex-1 bg-surface-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
              value={config.truncationMode}
              onChange={(e) => setTruncationMode(e.target.value as any)}
            >
              <option value="vertexTruncate">Vertex Truncate</option>
              <option value="edgeTruncate">Edge Truncate</option>
              <option value="cantellate">Cantellate</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Speed</span>
            <input
              type="range"
              min={0.01}
              max={0.5}
              step={0.01}
              value={config.truncationSpeed}
              onChange={(e) => setTruncationSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Truncation speed"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.truncationSpeed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Dual Flow (Morph) */}
      <div className="space-y-4" data-testid="animation-panel-dualMorph">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Dual Flow
          </label>
          <ToggleButton
            pressed={config.dualMorphEnabled}
            onToggle={() => setDualMorphEnabled(!config.dualMorphEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle dual flow"
          >
            {config.dualMorphEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.dualMorphEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Speed</span>
            <input
              type="range"
              min={0.01}
              max={0.3}
              step={0.01}
              value={config.dualMorphSpeed}
              onChange={(e) => setDualMorphSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Flow speed"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.dualMorphSpeed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Ripple Wave (Explode) */}
      <div className="space-y-4" data-testid="animation-panel-explode">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Ripple Wave
          </label>
          <ToggleButton
            pressed={config.explodeEnabled}
            onToggle={() => setExplodeEnabled(!config.explodeEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle ripple wave"
          >
            {config.explodeEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.explodeEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Amplitude</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.05}
              value={config.explodeMax}
              onChange={(e) => setExplodeMax(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Ripple amplitude"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.explodeMax.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Speed</span>
            <input
              type="range"
              min={0.01}
              max={0.3}
              step={0.01}
              value={config.explodeSpeed}
              onChange={(e) => setExplodeSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Ripple speed"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.explodeSpeed.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </AnimationDrawerContainer>
  );
});

PolytopeAnimationDrawer.displayName = 'PolytopeAnimationDrawer';

export default PolytopeAnimationDrawer;
