import React, { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { BloomControls } from './BloomControls';
import { BokehControls } from './BokehControls';
import { CinematicControls } from './CinematicControls';
import { MiscControls } from './MiscControls';
import { RefractionControls } from './RefractionControls';
import { SSRControls } from './SSRControls';

export const PostProcessingControls: React.FC = () => {
  const [activeTab, setActiveTab] = useState('bloom');

  return (
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
  );
};
