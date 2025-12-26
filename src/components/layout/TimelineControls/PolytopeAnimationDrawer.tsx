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
import { Slider } from '@/components/ui/Slider';
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
  }));

  const {
    config,
    // Modulation
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
          <Slider
            label="Amplitude"
            min={0}
            max={1.0}
            step={0.01}
            value={config.facetOffsetAmplitude}
            onChange={setModulationAmplitude}
            showValue
          />

          <Slider
            label="Frequency"
            min={0.01}
            max={0.20}
            step={0.005}
            value={config.facetOffsetFrequency}
            onChange={setModulationFrequency}
            showValue
          />

          <Slider
            label="Wave"
            min={0}
            max={1.0}
            step={0.01}
            value={config.facetOffsetPhaseSpread}
            onChange={setModulationWave}
            showValue
          />

          <Slider
            label="Bias"
            min={0}
            max={1.0}
            step={0.01}
            value={config.facetOffsetBias}
            onChange={setModulationBias}
            showValue
          />
        </div>
      </div>
    </AnimationDrawerContainer>
  );
});

PolytopeAnimationDrawer.displayName = 'PolytopeAnimationDrawer';

export default PolytopeAnimationDrawer;
