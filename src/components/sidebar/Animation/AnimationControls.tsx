/**
 * Animation Controls Component
 * Controls for auto-rotating the visualization
 */

import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { DEFAULT_MANDELBOX_CONFIG } from '@/lib/geometry/extended/types';
import { getRotationPlanes } from '@/lib/math';
import {
  DEFAULT_SPEED,
  MAX_SPEED,
  MIN_SPEED,
  useAnimationStore,
} from '@/stores/animationStore';
import { useExtendedObjectStore } from '@/stores/extendedObjectStore';
import { useGeometryStore } from '@/stores/geometryStore';
import {
  DEFAULT_ANIMATION_BIAS,
  MAX_ANIMATION_BIAS,
  MIN_ANIMATION_BIAS,
  useVisualStore,
} from '@/stores/visualStore';
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

export interface AnimationControlsProps {
  className?: string;
}

export const AnimationControls: React.FC<AnimationControlsProps> = React.memo(({
  className = '',
}) => {
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);

  // Mandelbox-specific animation settings
  const {
    mandelboxConfig,
    setScaleAnimationEnabled,
    setScaleCenter,
    setScaleAmplitude,
    setScaleSpeed,
    setJuliaMode,
    setJuliaSpeed,
    setJuliaRadius,
  } = useExtendedObjectStore(
    useShallow((state) => ({
      mandelboxConfig: state.mandelbox,
      setScaleAnimationEnabled: state.setMandelboxScaleAnimationEnabled,
      setScaleCenter: state.setMandelboxScaleCenter,
      setScaleAmplitude: state.setMandelboxScaleAmplitude,
      setScaleSpeed: state.setMandelboxScaleSpeed,
      setJuliaMode: state.setMandelboxJuliaMode,
      setJuliaSpeed: state.setMandelboxJuliaSpeed,
      setJuliaRadius: state.setMandelboxJuliaRadius,
    }))
  );

  // Consolidate animation store selectors with useShallow to reduce subscriptions
  const {
    isPlaying,
    speed,
    direction,
    animatingPlanes,
    toggle,
    setSpeed,
    toggleDirection,
    togglePlane,
    animateAll,
  } = useAnimationStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      speed: state.speed,
      direction: state.direction,
      animatingPlanes: state.animatingPlanes,
      toggle: state.toggle,
      setSpeed: state.setSpeed,
      toggleDirection: state.toggleDirection,
      togglePlane: state.togglePlane,
      animateAll: state.animateAll,
    }))
  );

  // Get animation bias from visual store
  const animationBias = useVisualStore((state) => state.animationBias);
  const setAnimationBias = useVisualStore((state) => state.setAnimationBias);

  // Get all rotation planes for current dimension
  const planes = useMemo(() => getRotationPlanes(dimension), [dimension]);

  const hasAnimatingPlanes = animatingPlanes.size > 0;

  return (
    <div className={`space-y-4 ${className}`} data-testid="animation-controls">
      {/* Play/Pause Button */}
      <div className="flex gap-2">
        <Button
          variant='primary'
          size="md"
          onClick={toggle}
          className="flex-1"
          disabled={!hasAnimatingPlanes}
          data-testid="animation-play-button"
          glow={isPlaying}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>

        <Tooltip content={direction === 1 ? 'Clockwise' : 'Counter-clockwise'}>
          <Button 
            variant="secondary" 
            size="md" 
            onClick={toggleDirection}
            data-testid="animation-direction-toggle"
          >
            {direction === 1 ? '↻' : '↺'}
          </Button>
        </Tooltip>
      </div>

      {/* Speed Control */}
      <Slider
        label="Speed"
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={0.1}
        value={speed}
        onChange={setSpeed}
        onReset={() => setSpeed(DEFAULT_SPEED)}
        unit="x"
        showValue
        data-testid="animation-speed"
      />

      {/* Bias Control - varies rotation speeds per plane */}
      <Slider
        label="Bias"
        min={MIN_ANIMATION_BIAS}
        max={MAX_ANIMATION_BIAS}
        step={0.05}
        value={animationBias}
        onChange={setAnimationBias}
        onReset={() => setAnimationBias(DEFAULT_ANIMATION_BIAS)}
        minLabel="Uniform"
        maxLabel="Varied"
        showValue
        data-testid="animation-bias"
      />

      {/* Plane Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Animate Planes
        </label>
        <div className="flex flex-wrap gap-1" data-testid="animation-planes">
          {planes.map((plane) => {
            const isActive = animatingPlanes.has(plane.name);
            return (
              <ToggleButton
                key={plane.name}
                pressed={isActive}
                onToggle={() => togglePlane(plane.name)}
                className="text-xs font-mono "
                ariaLabel={`Toggle animation for plane ${plane.name}`}
                data-testid={`plane-toggle-${plane.name}`}
              >
                {plane.name}
              </ToggleButton>
            );
          })}
        </div>
      </div>

      {/* Animate All */}
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => animateAll(dimension)}
          className="w-full"
          data-testid="animation-all"
        >
          Animate All
        </Button>
      </div>

      {/* Mandelbox-specific Animation Controls */}
      {objectType === 'mandelbox' && (
        <>
          {/* Scale Animation Section */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="text-xs text-text-secondary font-medium">
              Scale Animation
            </label>
            <ToggleButton
              pressed={mandelboxConfig.scaleAnimationEnabled}
              onToggle={() => setScaleAnimationEnabled(!mandelboxConfig.scaleAnimationEnabled)}
              ariaLabel="Toggle scale animation"
              className="w-full"
              data-testid="mandelbox-scale-anim-toggle"
            >
              {mandelboxConfig.scaleAnimationEnabled ? 'Enabled' : 'Disabled'}
            </ToggleButton>
            {mandelboxConfig.scaleAnimationEnabled && (
              <div className="space-y-2 pl-2">
                <Slider
                  label="Center"
                  min={-3}
                  max={3}
                  step={0.1}
                  value={mandelboxConfig.scaleCenter}
                  onChange={setScaleCenter}
                  onReset={() => setScaleCenter(DEFAULT_MANDELBOX_CONFIG.scaleCenter)}
                  showValue
                  data-testid="mandelbox-scale-center"
                />
                <Slider
                  label="Amplitude"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={mandelboxConfig.scaleAmplitude}
                  onChange={setScaleAmplitude}
                  onReset={() => setScaleAmplitude(DEFAULT_MANDELBOX_CONFIG.scaleAmplitude)}
                  showValue
                  data-testid="mandelbox-scale-amplitude"
                />
                <Slider
                  label="Speed"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={mandelboxConfig.scaleSpeed}
                  onChange={setScaleSpeed}
                  onReset={() => setScaleSpeed(DEFAULT_MANDELBOX_CONFIG.scaleSpeed)}
                  unit="x"
                  showValue
                  data-testid="mandelbox-scale-speed"
                />
                <p className="text-xs text-text-tertiary">
                  Animates scale from {(mandelboxConfig.scaleCenter - mandelboxConfig.scaleAmplitude).toFixed(1)} to {(mandelboxConfig.scaleCenter + mandelboxConfig.scaleAmplitude).toFixed(1)}
                </p>
              </div>
            )}
          </div>

          {/* Julia Mode Section */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="text-xs text-text-secondary font-medium">
              Julia Mode
            </label>
            <ToggleButton
              pressed={mandelboxConfig.juliaMode}
              onToggle={() => setJuliaMode(!mandelboxConfig.juliaMode)}
              ariaLabel="Toggle Julia mode"
              className="w-full"
              data-testid="mandelbox-julia-mode-toggle"
            >
              {mandelboxConfig.juliaMode ? 'Enabled' : 'Disabled'}
            </ToggleButton>
            {mandelboxConfig.juliaMode && (
              <div className="space-y-2 pl-2">
                <Slider
                  label="Speed"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={mandelboxConfig.juliaSpeed}
                  onChange={setJuliaSpeed}
                  onReset={() => setJuliaSpeed(DEFAULT_MANDELBOX_CONFIG.juliaSpeed)}
                  unit="x"
                  showValue
                  data-testid="mandelbox-julia-speed"
                />
                <Slider
                  label="Radius"
                  min={0.5}
                  max={10}
                  step={0.1}
                  value={mandelboxConfig.juliaRadius}
                  onChange={setJuliaRadius}
                  onReset={() => setJuliaRadius(DEFAULT_MANDELBOX_CONFIG.juliaRadius)}
                  showValue
                  data-testid="mandelbox-julia-radius"
                />
                <p className="text-xs text-text-tertiary">
                  Uses a global animated constant instead of per-pixel values, creating smooth morphing transitions.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});
