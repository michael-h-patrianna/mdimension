/**
 * PostProcessing Section Component
 * Section wrapper for post-processing controls (bloom, bokeh, tone mapping, SSR, refraction, misc)
 */

import { Section } from '@/components/sections/Section';
import { Tabs } from '@/components/ui/Tabs';
import React, { useState } from 'react';
import { BloomControls } from './BloomControls';
import { BokehControls } from './BokehControls';
import { CinematicControls } from './CinematicControls';
import { MiscControls } from './MiscControls';
import { RefractionControls } from './RefractionControls';
import { SSRControls } from './SSRControls';

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
        contentClassName="px-3 py-4"
        tabs={[
          {
            id: 'bloom',
            label: 'Bloom',
            content: <BloomControls />,
          },
          {
            id: 'cinematic',
            label: 'Cinematic',
            content: <CinematicControls />,
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
