import React from 'react';
import { useProjectionStore } from '@/stores/projectionStore';
import { ProjectionTypeToggle } from './ProjectionTypeToggle';
import { Tooltip } from '@/components/ui/Tooltip';

export const ProjectionControls: React.FC = () => {
  const { type, distance, fov, setType, setDistance, setFov, resetToDefaults } = useProjectionStore();

  return (
    <div className="space-y-4 p-4 bg-panel-bg border border-panel-border rounded-lg">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">
          Projection Settings
        </h3>
        <button
          onClick={resetToDefaults}
          className="text-xs text-text-secondary hover:text-accent transition-colors"
          aria-label="Reset to defaults"
        >
          Reset
        </button>
      </div>

      {/* Projection Type Toggle */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          Projection Type
        </label>
        <ProjectionTypeToggle value={type} onChange={setType} />
      </div>

      {/* Info Text */}
      <div className="text-xs text-text-secondary bg-app-bg p-3 rounded border border-panel-border">
        {type === 'perspective' ? (
          <p>
            <strong className="text-text-primary">Perspective:</strong> Creates a vanishing point effect.
            Objects further in higher dimensions appear smaller, simulating depth perception.
          </p>
        ) : (
          <p>
            <strong className="text-text-primary">Orthographic:</strong> No foreshortening.
            Simply drops higher dimension coordinates. Inner and outer structures appear the same size.
          </p>
        )}
      </div>

      {/* Distance Slider (only for Perspective) */}
      {type === 'perspective' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Tooltip
              content="Lower values create stronger perspective effects. Higher values reduce foreshortening."
              position="top"
            >
              <label className="block text-sm font-medium text-text-primary cursor-help">
                Projection Distance
              </label>
            </Tooltip>
            <span className="text-sm text-accent font-mono">
              {distance.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="2.0"
            max="10.0"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(parseFloat(e.target.value))}
            className="w-full h-2 bg-panel-border rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-accent
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-accent
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:transition-all
              [&::-moz-range-thumb]:hover:scale-110"
            aria-label="Projection distance"
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>2.0 (Strong)</span>
            <span>10.0 (Weak)</span>
          </div>
        </div>
      )}

      {/* FOV Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Tooltip
            content="Controls the Three.js camera field of view. Higher values create a wider angle view."
            position="top"
          >
            <label className="block text-sm font-medium text-text-primary cursor-help">
              Field of View
            </label>
          </Tooltip>
          <span className="text-sm text-accent font-mono">
            {fov}°
          </span>
        </div>
        <input
          type="range"
          min="30"
          max="120"
          step="1"
          value={fov}
          onChange={(e) => setFov(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-panel-border rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-accent
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:transition-all
            [&::-moz-range-thumb]:hover:scale-110"
          aria-label="Field of view"
        />
        <div className="flex justify-between text-xs text-text-secondary">
          <span>30° (Narrow)</span>
          <span>120° (Wide)</span>
        </div>
      </div>
    </div>
  );
};
