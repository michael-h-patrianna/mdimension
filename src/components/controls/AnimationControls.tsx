/**
 * Animation Controls Component
 * Controls for auto-rotating the visualization
 */

import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
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
  const isoclinicMode = useAnimationStore((state) => state.isoclinicMode);

  const toggle = useAnimationStore((state) => state.toggle);
  const setSpeed = useAnimationStore((state) => state.setSpeed);
  const toggleDirection = useAnimationStore((state) => state.toggleDirection);
  const togglePlane = useAnimationStore((state) => state.togglePlane);
  const animateAll = useAnimationStore((state) => state.animateAll);
  const stopAll = useAnimationStore((state) => state.stopAll);
  const setIsoclinicMode = useAnimationStore((state) => state.setIsoclinicMode);

  // Get all rotation planes for current dimension
  const planes = useMemo(() => getRotationPlanes(dimension), [dimension]);

  const hasAnimatingPlanes = animatingPlanes.size > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Play/Pause Button */}
      <div className="flex gap-2">
        <Button
          variant={isPlaying ? 'secondary' : 'primary'}
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
              <button
                key={plane.name}
                onClick={() => togglePlane(plane.name)}
                className={`
                  px-2 py-1 text-xs font-mono rounded transition-colors bg-panel-border
                  ${isActive
                    ? 'text-accent'
                    : ' text-text-secondary hover:bg-panel-border/80'
                  }
                `}
                aria-pressed={isActive}
              >
                {plane.name}
              </button>
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

      {/* Isoclinic Mode (4D only) */}
      {dimension === 4 && (
        <Tooltip content="Special 4D double rotation: XY and ZW rotate together at the same rate">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsoclinicMode(!isoclinicMode)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
                ${isoclinicMode
                  ? 'bg-accent-magenta/20 text-accent-magenta border border-accent-magenta/50'
                  : 'bg-panel-border text-text-secondary border border-panel-border'
                }
              `}
              aria-pressed={isoclinicMode}
            >
              <span>Isoclinic Rotation</span>
            </button>
          </div>
        </Tooltip>
      )}

      {/* Status */}

    </div>
  );
};
