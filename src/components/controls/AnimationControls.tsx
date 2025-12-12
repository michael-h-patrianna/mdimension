/**
 * Animation Controls Component
 * Controls for auto-rotating the visualization
 */

import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { getRotationPlanes } from '@/lib/math';
import {
  DEFAULT_SPEED,
  MAX_SPEED,
  MIN_SPEED,
  useAnimationStore,
} from '@/stores/animationStore';
import { useGeometryStore } from '@/stores/geometryStore';
import React, { useMemo } from 'react';

export interface AnimationControlsProps {
  className?: string;
}

export const AnimationControls: React.FC<AnimationControlsProps> = ({
  className = '',
}) => {
  const dimension = useGeometryStore((state) => state.dimension);

  const isPlaying = useAnimationStore((state) => state.isPlaying);
  const speed = useAnimationStore((state) => state.speed);
  const direction = useAnimationStore((state) => state.direction);
  const animatingPlanes = useAnimationStore((state) => state.animatingPlanes);

  const toggle = useAnimationStore((state) => state.toggle);
  const setSpeed = useAnimationStore((state) => state.setSpeed);
  const toggleDirection = useAnimationStore((state) => state.toggleDirection);
  const togglePlane = useAnimationStore((state) => state.togglePlane);
  const animateAll = useAnimationStore((state) => state.animateAll);
  const stopAll = useAnimationStore((state) => state.stopAll);

  // Get all rotation planes for current dimension
  const planes = useMemo(() => getRotationPlanes(dimension), [dimension]);

  const hasAnimatingPlanes = animatingPlanes.size > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Play/Pause Button */}
      <div className="flex gap-2">
        <Button
          variant='primary'
          size="md"
          onClick={toggle}
          className="flex-1"
          disabled={!hasAnimatingPlanes}
          data-testid="animation-play-button"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>

        <Tooltip content={direction === 1 ? 'Clockwise' : 'Counter-clockwise'}>
          <Button variant="secondary" size="md" onClick={toggleDirection}>
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
      />

      {/* Plane Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Animate Planes
        </label>
        <div className="flex flex-wrap gap-1">
          {planes.map((plane) => {
            const isActive = animatingPlanes.has(plane.name);
            return (
              <ToggleButton
                key={plane.name}
                pressed={isActive}
                onToggle={() => togglePlane(plane.name)}
                className="text-xs font-mono "
                ariaLabel={`Toggle animation for plane ${plane.name}`}
              >
                {plane.name}
              </ToggleButton>
            );
          })}
        </div>
      </div>

      {/* Animate All / Stop All */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => animateAll(dimension)}
          className="flex-1"
        >
          Animate All
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={stopAll}
          disabled={!hasAnimatingPlanes && !isPlaying}
          className="flex-1"
        >
          Stop All
        </Button>
      </div>
    </div>
  );
};
