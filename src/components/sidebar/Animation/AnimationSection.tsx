/**
 * Animation Section Component
 * Section wrapper for animation controls
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
import { AnimationControls } from './AnimationControls';

export interface AnimationSectionProps {
  defaultOpen?: boolean;
}

export const AnimationSection: React.FC<AnimationSectionProps> = ({
  defaultOpen = true,
}) => {
  return (
    <Section title="Animation" defaultOpen={defaultOpen}>
      <AnimationControls />
    </Section>
  );
};
