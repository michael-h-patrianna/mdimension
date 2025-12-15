/**
 * Geometry Section Component
 * Section wrapper for object geometry controls
 */

import { Section } from '@/components/sections/Section';
import React from 'react';
import { DimensionSelector } from './DimensionSelector';
import { ObjectSettingsSection } from './ObjectSettingsSection';
import { ObjectTypeSelector } from './ObjectTypeSelector';

export interface GeometrySectionProps {
  defaultOpen?: boolean;
}

export const GeometrySection: React.FC<GeometrySectionProps> = ({
  defaultOpen = true,
}) => {
  return (
    <Section title="Geometry" defaultOpen={defaultOpen} data-testid="geometry-section">
      <div className="space-y-4">
        <DimensionSelector />
        <ObjectTypeSelector />
        <ObjectSettingsSection />
      </div>
    </Section>
  );
};
