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
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
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
  const extendedObjectSelector = useShallow((state: any) => ({
    config: state.polytope,
    setModulationEnabled: state.setPolytopeFacetOffsetEnabled,
    setModulationAmplitude: state.setPolytopeFacetOffsetAmplitude,
    setModulationFrequency: state.setPolytopeFacetOffsetFrequency,
    setModulationWave: state.setPolytopeFacetOffsetPhaseSpread,
    setModulationBias: state.setPolytopeFacetOffsetBias,
  }));

  const {
    config,
    setModulationEnabled,
    setModulationAmplitude,
    setModulationFrequency,
    setModulationWave,
    setModulationBias,
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
    </AnimationDrawerContainer>
  );
});

PolytopeAnimationDrawer.displayName = 'PolytopeAnimationDrawer';

export default PolytopeAnimationDrawer;
