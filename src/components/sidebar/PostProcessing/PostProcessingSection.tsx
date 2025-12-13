/**
 * PostProcessing Section Component
 * Section wrapper for post-processing controls (bloom, tone mapping)
 */

import React from 'react';
import { Section } from '@/components/ui/Section';
import { BloomControls } from './BloomControls';
import { ToneMappingControls } from './ToneMappingControls';

export interface PostProcessingSectionProps {
  defaultOpen?: boolean;
}

export const PostProcessingSection: React.FC<PostProcessingSectionProps> = ({
  defaultOpen = false,
}) => {
  return (
    <Section title="Post-Processing" defaultOpen={defaultOpen}>
      <div className="space-y-6">
        {/* Bloom Controls */}
        <BloomControls />

        {/* Tone Mapping Controls */}
        <ToneMappingControls />
      </div>
    </Section>
  );
};
