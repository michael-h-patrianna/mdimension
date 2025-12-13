/**
 * Export Section Component
 * Section wrapper for export and share controls
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
import { ExportButton } from './ExportButton';
import { ShareButton } from './ShareButton';

export interface ExportSectionProps {
  defaultOpen?: boolean;
}

export const ExportSection: React.FC<ExportSectionProps> = ({
  defaultOpen = true,
}) => {
  return (
    <Section title="Export & Share" defaultOpen={defaultOpen}>
      <div className="space-y-3">
        <ExportButton />
        <ShareButton />
      </div>
    </Section>
  );
};
