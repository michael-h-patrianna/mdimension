import React, { useState } from 'react';
import { DimensionSelector } from '@/components/sections/Geometry/DimensionSelector';
import { ObjectSettingsSection } from '@/components/sections/Geometry/ObjectSettingsSection';
import { ObjectTypeExplorer } from '@/components/sections/ObjectTypes/ObjectTypeExplorer';
import { Tabs, Tab } from '@/components/ui/Tabs';
import { SpotlightCard } from '@/components/ui/SpotlightCard';

export const EditorLeftPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('type');

  const tabs: Tab[] = [
    {
      id: 'type',
      label: 'Type',
      content: <ObjectTypeExplorer />,
    },
    {
      id: 'geometry',
      label: 'Geometry',
      content: <ObjectSettingsSection />,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-transparent shrink-0 overflow-hidden">
        {/* Fixed Header Section with Dimension Selector */}
        <div className="p-4 border-b border-panel-border bg-panel-bg/30 backdrop-blur-sm z-10">
            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4">Space & Object</h2>
            
            {/* Dimension Selector Area - Spotlight Effect */}
            <SpotlightCard className="p-3 bg-black/20" spotlightColor="rgba(var(--color-accent), 0.15)">
                 <div className="flex justify-between items-baseline mb-2">
                    <label className="text-[10px] text-accent font-bold uppercase tracking-wider text-glow-subtle">Dimensions</label>
                </div>
                <DimensionSelector />
            </SpotlightCard>
        </div>
        
        {/* Tabs Section */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <Tabs
              tabs={tabs}
              value={activeTab}
              onChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0"
              tabListClassName="px-3 pt-3 pb-0 bg-transparent"
              contentClassName="flex-1 overflow-y-auto p-4 custom-scrollbar"
              variant="default"
              fullWidth
              data-testid="left-panel-tabs"
            />
        </div>
    </div>
  );
};