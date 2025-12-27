/**
 * Gravity Controls Component
 *
 * Controls for gravitational lensing effect applied to the environment layer.
 * When a black hole is selected, gravity is always enabled and settings sync
 * with the black hole's internal lensing parameters.
 */

import { ControlGroup } from '@/components/ui/ControlGroup';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { usePostProcessingStore, type PostProcessingSlice } from '@/stores/postProcessingStore';
import React, { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

// Selector for black hole state - defined outside component per useShallow rules
const blackHoleSelector = (s: ReturnType<typeof useExtendedObjectStore.getState>) => ({
  gravityStrength: s.blackhole.gravityStrength,
  setGravityStrength: s.setBlackHoleGravityStrength,
  bendScale: s.blackhole.bendScale,
  setBendScale: s.setBlackHoleBendScale,
  lensingFalloff: s.blackhole.lensingFalloff,
  setLensingFalloff: s.setBlackHoleLensingFalloff,
  distanceFalloff: s.blackhole.distanceFalloff,
  setDistanceFalloff: s.setBlackHoleDistanceFalloff,
  chromaticAberration: s.blackhole.deferredLensingChromaticAberration,
  setChromaticAberration: s.setBlackHoleDeferredLensingChromaticAberration,
});

export const GravityControls: React.FC = () => {
  // Global State
  const ppSelector = useShallow((state: PostProcessingSlice) => ({
    gravityEnabled: state.gravityEnabled,
    setGravityEnabled: state.setGravityEnabled,
    gravityStrength: state.gravityStrength,
    setGravityStrength: state.setGravityStrength,
    gravityDistortionScale: state.gravityDistortionScale,
    setGravityDistortionScale: state.setGravityDistortionScale,
    gravityFalloff: state.gravityFalloff,
    setGravityFalloff: state.setGravityFalloff,
    gravityChromaticAberration: state.gravityChromaticAberration,
    setGravityChromaticAberration: state.setGravityChromaticAberration,
  }));
  const ppState = usePostProcessingStore(ppSelector);

  // Black Hole State - for syncing when black hole is active
  const isBlackHole = useGeometryStore(s => s.objectType === 'blackhole');
  const bhSelector = useShallow(blackHoleSelector);
  const blackHoleState = useExtendedObjectStore(bhSelector);

  // When black hole is selected, sync global gravity settings from black hole
  useEffect(() => {
    if (isBlackHole) {
      // Force gravity enabled when black hole is active
      if (!ppState.gravityEnabled) {
        ppState.setGravityEnabled(true);
      }
      // Sync from black hole to global on initial selection
      ppState.setGravityStrength(blackHoleState.gravityStrength);
      ppState.setGravityDistortionScale(blackHoleState.bendScale);
      ppState.setGravityFalloff(blackHoleState.lensingFalloff);
      ppState.setGravityChromaticAberration(blackHoleState.chromaticAberration);
    }
    // Only run when isBlackHole changes, not on every black hole state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlackHole]);

  // Synced handlers that update both global AND black hole settings
  const handleStrengthChange = useCallback((value: number) => {
    ppState.setGravityStrength(value);
    if (isBlackHole) {
      blackHoleState.setGravityStrength(value);
    }
  }, [ppState, blackHoleState, isBlackHole]);

  const handleDistortionScaleChange = useCallback((value: number) => {
    ppState.setGravityDistortionScale(value);
    if (isBlackHole) {
      blackHoleState.setBendScale(value);
    }
  }, [ppState, blackHoleState, isBlackHole]);

  const handleFalloffChange = useCallback((value: number) => {
    ppState.setGravityFalloff(value);
    if (isBlackHole) {
      blackHoleState.setLensingFalloff(value);
      blackHoleState.setDistanceFalloff(value);
    }
  }, [ppState, blackHoleState, isBlackHole]);

  const handleChromaticAberrationChange = useCallback((value: number) => {
    ppState.setGravityChromaticAberration(value);
    if (isBlackHole) {
      blackHoleState.setChromaticAberration(value);
    }
  }, [ppState, blackHoleState, isBlackHole]);

  // For black hole, gravity is always enabled
  const isEnabled = isBlackHole ? true : ppState.gravityEnabled;

  return (
    <div className="space-y-4">
      {/* Main Toggle - disabled for black hole (always on) */}
      <Switch
        checked={isEnabled}
        onCheckedChange={ppState.setGravityEnabled}
        label="Gravitational Lensing"
        disabled={isBlackHole}
      />

      {isBlackHole && (
        <p className="text-[10px] text-text-secondary mt-1 mb-2">
          Gravity is always active for Black Holes. Settings sync with internal lensing.
        </p>
      )}

      <div className={!isEnabled ? 'opacity-50 pointer-events-none' : ''}>
        <ControlGroup title="Gravity Parameters">
          {/* Gravity Strength */}
          <Slider
            label="Strength"
            value={ppState.gravityStrength}
            min={0.1}
            max={10}
            step={0.1}
            onChange={handleStrengthChange}
            showValue
          />

          {/* Distortion Scale */}
          <Slider
            label="Distortion Scale"
            value={ppState.gravityDistortionScale}
            min={0.1}
            max={5}
            step={0.1}
            onChange={handleDistortionScaleChange}
            showValue
          />

          {/* Falloff */}
          <Slider
            label="Falloff"
            value={ppState.gravityFalloff}
            min={0.5}
            max={4}
            step={0.1}
            onChange={handleFalloffChange}
            showValue
          />

          {/* Chromatic Aberration */}
          <Slider
            label="Chromatic Aberration"
            value={ppState.gravityChromaticAberration}
            min={0}
            max={1}
            step={0.01}
            onChange={handleChromaticAberrationChange}
            showValue
          />
        </ControlGroup>
      </div>
    </div>
  );
};
