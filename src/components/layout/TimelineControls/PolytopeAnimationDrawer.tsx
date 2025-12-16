/**
 * PolytopeAnimationDrawer Component
 *
 * Animation controls for polytope objects (hypercube, simplex, cross-polytope),
 * displayed in the TimelineControls bottom drawer.
 *
 * Organic Animation Systems (applied post-projection to 3D):
 * - Pulse: Gentle breathing effect using layered sine waves
 * - Flow: Organic vertex drift creating flowing deformation
 * - Ripple: Smooth radial waves emanating from center
 *
 * All animations use irrational frequency ratios (golden ratio, sqrt(2))
 * for smooth, never-repeating motion.
 *
 * @see docs/prd/polytopes-animations.md
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { AnimationDrawerContainer } from './AnimationDrawerContainer';

/**
 * PolytopeAnimationDrawer component
 *
 * Renders organic animation controls for polytope objects within the timeline drawer.
 * Uses consistent styling with other animation system panels.
 *
 * @returns React component
 */
export const PolytopeAnimationDrawer: React.FC = React.memo(() => {
  // Get config and setters from store
  const {
    config,
    // Pulse Animation (uses facetOffset* properties for intensity)
    setFacetOffsetEnabled,
    setFacetOffsetAmplitude,
    // Flow Animation (uses dualMorph* properties for intensity)
    setDualMorphEnabled,
    setDualMorphT,
    // Ripple Animation (uses explode* properties for intensity)
    setExplodeEnabled,
    setExplodeMax,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      config: state.polytope,
      // Pulse Animation
      setFacetOffsetEnabled: state.setPolytopeFacetOffsetEnabled,
      setFacetOffsetAmplitude: state.setPolytopeFacetOffsetAmplitude,
      // Flow Animation
      setDualMorphEnabled: state.setPolytopeDualMorphEnabled,
      setDualMorphT: state.setPolytopeDualMorphT,
      // Ripple Animation
      setExplodeEnabled: state.setPolytopeExplodeEnabled,
      setExplodeMax: state.setPolytopeExplodeMax,
    }))
  );

  return (
    <AnimationDrawerContainer data-testid="polytope-animation-drawer">
      {/* Pulse Animation - gentle organic breathing */}
      <div className="space-y-3" data-testid="animation-panel-facetOffset">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Pulse
          </label>
          <ToggleButton
            pressed={config.facetOffsetEnabled}
            onToggle={() => setFacetOffsetEnabled(!config.facetOffsetEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle pulse animation"
          >
            {config.facetOffsetEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.facetOffsetEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Intensity</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.01}
              value={config.facetOffsetAmplitude}
              onChange={(e) => setFacetOffsetAmplitude(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Pulse intensity"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.facetOffsetAmplitude.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Flow Animation - organic vertex drift */}
      <div className="space-y-3" data-testid="animation-panel-dualMorph">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Flow
          </label>
          <ToggleButton
            pressed={config.dualMorphEnabled}
            onToggle={() => setDualMorphEnabled(!config.dualMorphEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle flow animation"
          >
            {config.dualMorphEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.dualMorphEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Intensity</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.01}
              value={config.dualMorphT}
              onChange={(e) => setDualMorphT(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Flow intensity"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.dualMorphT.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Ripple Animation - smooth radial waves */}
      <div className="space-y-3" data-testid="animation-panel-explode">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Ripple
          </label>
          <ToggleButton
            pressed={config.explodeEnabled}
            onToggle={() => setExplodeEnabled(!config.explodeEnabled)}
            className="text-xs px-2 py-1 h-auto"
            ariaLabel="Toggle ripple animation"
          >
            {config.explodeEnabled ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className={`space-y-3 ${!config.explodeEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-16">Intensity</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.01}
              value={config.explodeMax}
              onChange={(e) => setExplodeMax(parseFloat(e.target.value))}
              className="flex-1 accent-accent h-1.5 bg-panel-border rounded-lg cursor-pointer"
              aria-label="Ripple intensity"
            />
            <span className="text-xs font-mono w-10 text-right">
              {config.explodeMax.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </AnimationDrawerContainer>
  );
});

PolytopeAnimationDrawer.displayName = 'PolytopeAnimationDrawer';

export default PolytopeAnimationDrawer;

