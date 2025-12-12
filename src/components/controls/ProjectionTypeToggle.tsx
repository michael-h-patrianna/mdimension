import React from 'react';
import { ToggleButton } from '@/components/ui/ToggleButton';
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
    <div 
      className="flex gap-2"
      role="group"
      aria-label="Projection Type"
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          pressed={value === option.value}
          onToggle={() => onChange(option.value)}
          ariaLabel={`${option.label} projection`}
          className="flex-1 justify-center"
        >
          {option.label}
        </ToggleButton>
      ))}
    </div>
  );
};