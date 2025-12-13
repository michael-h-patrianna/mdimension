/**
 * Visual Section Component
 * Section wrapper for visual appearance controls
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
import { BloomControls } from './BloomControls';
import { LightingControls } from './LightingControls';
import { ShaderSettings } from './ShaderSettings';
import { VisualControls } from './VisualControls';

export interface VisualSectionProps {
  defaultOpen?: boolean;
}

export const VisualSection: React.FC<VisualSectionProps> = ({
  defaultOpen = false,
}) => {
  return (
    <Section title="Visual" defaultOpen={defaultOpen}>
      <div className="space-y-6">
        {/* Per-Shader Settings (shown when faces are visible) */}
        <ShaderSettings />

        {/* Bloom Controls */}
        <BloomControls />

        {/* Lighting Controls - for surface rendering */}
        <LightingControls />

        {/* Color & Visual Settings */}
        <VisualControls />
      </div>
    </Section>
  );
};
