/**
 * PostProcessing Section Component
 * Section wrapper for post-processing controls (bloom, bokeh, tone mapping, SSR, refraction, misc)
 */

import { Section } from '@/components/ui/Section';
import { Tabs } from '@/components/ui/Tabs';
import React, { useState } from 'react';
import { BloomControls } from './BloomControls';
import { BokehControls } from './BokehControls';
import { ToneMappingControls } from './ToneMappingControls';
import { SSRControls } from './SSRControls';
import { RefractionControls } from './RefractionControls';
import { MiscControls } from './MiscControls';

export interface PostProcessingSectionProps {
  defaultOpen?: boolean;
}

export const PostProcessingSection: React.FC<PostProcessingSectionProps> = ({
  defaultOpen = false,
}) => {
  const [activeTab, setActiveTab] = useState('bloom');

  return (
    <Section title="Post-Processing" defaultOpen={defaultOpen}>
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        className="-mx-3"
        contentClassName="px-0"
        tabs={[
          {
            id: 'bloom',
            label: 'Bloom',
            content: <BloomControls />,
          },
          {
            id: 'tonemapping',
            label: 'Tone Map',
            content: <ToneMappingControls />,
          },
          {
            id: 'bokeh',
            label: 'Bokeh',
            content: <BokehControls />,
          },
          {
            id: 'ssr',
            label: 'SSR',
            content: <SSRControls />,
          },
          {
            id: 'refraction',
            label: 'Refract',
            content: <RefractionControls />,
          },
          {
            id: 'misc',
            label: 'Misc',
            content: <MiscControls />,
          },
        ]}
        data-testid="postprocessing-tabs"
      />
    </Section>
  );
};
