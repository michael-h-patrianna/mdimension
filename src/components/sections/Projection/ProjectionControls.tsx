import { useProjectionStore } from '@/stores/projectionStore';
import React from 'react';
import { ProjectionTypeToggle } from './ProjectionTypeToggle';
import { useShallow } from 'zustand/react/shallow';

export const ProjectionControls: React.FC = () => {
  const { type, setType } = useProjectionStore(useShallow((state) => ({
    type: state.type,
    setType: state.setType
  })));

  return (
    <div>
      {/* Projection Type Toggle */}
      <div className="space-y-2">
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
    </div>
  );
};
