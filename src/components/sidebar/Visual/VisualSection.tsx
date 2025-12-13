/**
 * Visual Section Component
 * Section wrapper for visual appearance controls
 *
 * Note: Material controls (diffuse, specular) have been moved to the
 * Faces section's Material tab for better organization.
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
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

        {/* Color & Visual Settings */}
        <VisualControls />
      </div>
    </Section>
  );
};
