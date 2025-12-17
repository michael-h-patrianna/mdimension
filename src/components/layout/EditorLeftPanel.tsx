import React, { useState } from 'react';
import { DimensionSelector } from '@/components/sections/Geometry/DimensionSelector';
import { ObjectSettingsSection } from '@/components/sections/Geometry/ObjectSettingsSection';
import { ObjectTypeExplorer } from '@/components/sections/ObjectTypes/ObjectTypeExplorer';
import { Tabs, Tab } from '@/components/ui/Tabs';
import { Icon } from '@/components/ui/Icon';

export const EditorLeftPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('type');

  const tabs: Tab[] = [
    {
      id: 'type',
      label: (
        <div className="flex items-center gap-2">
            <Icon name="sphere" size={14} />
            <span>Type</span>
        </div>
      ),
      content: (
        <div className="p-4 bg-black/10 min-h-full">
           <ObjectTypeExplorer />
        </div>
      ),
    },
    {
      id: 'geometry',
      label: (
        <div className="flex items-center gap-2">
            <Icon name="cog" size={14} />
            <span>Geometry</span>
        </div>
      ),
      content: (
        <div className="min-h-full">
           <ObjectSettingsSection />
        </div>
      ),
    },
  ];

  return (
    <div 
      className="h-full flex flex-col bg-panel-bg/50 border-r border-panel-border shrink-0 overflow-hidden relative backdrop-blur-md w-[320px]"
    >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm z-20 shrink-0 h-[60px]">
            <div className="flex items-center gap-2 px-1 overflow-hidden whitespace-nowrap">
                <Icon name="menu" className="text-accent" />
                <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                  Space & Object
                </h2>
            </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
           {/* Fixed Header Section with Dimension Selector */}
          <div className="border-b border-white/5 bg-black/10 shrink-0">
             <div className="flex justify-between items-baseline px-4 py-2 bg-white/5 border-b border-white/5">
                <label className="text-[10px] text-accent font-bold uppercase tracking-wider text-glow-subtle flex items-center gap-2">
                    <Icon name="info" size={12} />
                    Dimensions
                </label>
            </div>
            <div className="p-4">
                <DimensionSelector />
            </div>
          </div>
          
          {/* Tabs Section */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <Tabs
                tabs={tabs}
                value={activeTab}
                onChange={setActiveTab}
                className="flex-1 flex flex-col min-h-0"
                tabListClassName="px-3 pt-0 pb-0 bg-transparent"
                contentClassName="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-panel-border hover:scrollbar-thumb-text-secondary/50 p-0"
                variant="default"
                fullWidth
                data-testid="left-panel-tabs"
              />
          </div>
        </div>
    </div>
  );
};
