import React from 'react';
import { useProjectionStore } from '@/stores/projectionStore';
import { ProjectionTypeToggle } from './ProjectionTypeToggle';
import { Slider } from '@/components/ui/Slider';
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
        <Tooltip
          content="Lower values create stronger perspective effects. Higher values reduce foreshortening."
          position="top"
        >
          <Slider
            label="Projection Distance"
            min={2.0}
            max={10.0}
            step={0.1}
            value={distance}
            onChange={setDistance}
            onReset={() => setDistance(4.0)} // Default distance
            minLabel="2.0 (Strong)"
            maxLabel="10.0 (Weak)"
          />
        </Tooltip>
      )}

      {/* FOV Slider */}
      <Tooltip
        content="Controls the Three.js camera field of view. Higher values create a wider angle view."
        position="top"
      >
        <Slider
          label="Field of View"
          min={30}
          max={120}
          step={1}
          value={fov}
          onChange={setFov}
          onReset={() => setFov(60)} // Default FOV
          unit="°"
          minLabel="30° (Narrow)"
          maxLabel="120° (Wide)"
        />
      </Tooltip>
    </div>
  );
};