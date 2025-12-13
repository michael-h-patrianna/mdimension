/**
 * Projection Section Component
 * Section wrapper for projection controls
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
import { ProjectionControls } from './ProjectionControls';

export interface ProjectionSectionProps {
  defaultOpen?: boolean;
}

export const ProjectionSection: React.FC<ProjectionSectionProps> = ({
  defaultOpen = false,
}) => {
  return (
    <Section title="Projection" defaultOpen={defaultOpen}>
      <ProjectionControls />
    </Section>
  );
};
