import React from 'react';
import type { ProjectionType } from '@/stores/projectionStore';

export interface ProjectionTypeToggleProps {
  value: ProjectionType;
  onChange: (type: ProjectionType) => void;
}

export const ProjectionTypeToggle: React.FC<ProjectionTypeToggleProps> = ({
  value,
  onChange,
}) => {
  const options: { value: ProjectionType; label: string }[] = [
    { value: 'perspective', label: 'Perspective' },
    { value: 'orthographic', label: 'Orthographic' },
  ];

  return (
    <div className="flex gap-1 p-1 bg-panel-bg border border-panel-border rounded-lg">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              flex-1 px-4 py-2 text-sm font-medium rounded-md
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-app-bg
              ${
                isSelected
                  ? 'bg-accent text-app-bg'
                  : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-panel-border'
              }
            `}
            aria-pressed={isSelected}
            aria-label={`${option.label} projection`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
