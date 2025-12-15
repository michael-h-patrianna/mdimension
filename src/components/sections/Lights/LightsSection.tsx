/**
 * Lights Section Component
 * Section wrapper for lighting controls
 */

import { Section } from '@/components/sections/Section';
import React from 'react';
import { LightingControls } from './LightingControls';

export interface LightsSectionProps {
  defaultOpen?: boolean;
}

export const LightsSection: React.FC<LightsSectionProps> = ({
  defaultOpen = false,
}) => {
  return (
    <Section title="Lights" defaultOpen={defaultOpen}>
      <LightingControls />
    </Section>
  );
};
