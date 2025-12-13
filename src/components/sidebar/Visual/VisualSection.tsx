/**
 * Visual Section Component
 * Section wrapper for visual appearance controls
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
import { MaterialControls } from './MaterialControls';
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

        {/* Material Controls - Diffuse & Specular */}
        <MaterialControls />

        {/* Color & Visual Settings */}
        <VisualControls />
      </div>
    </Section>
  );
};
