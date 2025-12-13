/**
 * Environment Section Component
 * Section wrapper for environment/scene controls
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
import { EnvironmentControls } from './EnvironmentControls';

export interface EnvironmentSectionProps {
  defaultOpen?: boolean;
}

export const EnvironmentSection: React.FC<EnvironmentSectionProps> = ({
  defaultOpen = false,
}) => {
  return (
    <Section title="Environment" defaultOpen={defaultOpen}>
      <EnvironmentControls />
    </Section>
  );
};
