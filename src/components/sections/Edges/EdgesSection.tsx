/**
 * Visual Section Component
 * Section wrapper for visual appearance controls
 *
 * Note: Material controls (diffuse, specular) have been moved to the
 * Faces section's Material tab for better organization.
 */

import { Section } from '@/components/sections/Section';
import React from 'react';
import { EdgeControls } from './EdgeControls';
import { ShaderSettings } from './ShaderSettings';

export interface EdgesSectionProps {
  defaultOpen?: boolean;
}

export const EdgesSection: React.FC<EdgesSectionProps> = ({
  defaultOpen = false,
}) => {
  return (
    <Section title="Edges" defaultOpen={defaultOpen}>
      <div className="space-y-6">
        {/* Per-Shader Settings (shown when faces are visible) */}
        <ShaderSettings />


        <EdgeControls />
      </div>
    </Section>
  );
};
