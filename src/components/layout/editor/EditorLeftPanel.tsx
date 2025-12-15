import React, { useState } from 'react';
import { DimensionSelector } from '@/components/sidebar/Geometry/DimensionSelector';
import { ObjectSettingsSection } from '@/components/sidebar/Geometry/ObjectSettingsSection';
import { ObjectTypeExplorer } from './ObjectTypeExplorer';
import { Tabs, Tab } from '@/components/ui/Tabs';

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
    <div className="h-full flex flex-col bg-panel-bg shrink-0 overflow-hidden">
        {/* Fixed Header Section with Dimension Selector */}
        <div className="p-4 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm z-10">
            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4">Space & Object</h2>
            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <label className="text-[10px] text-text-secondary/70 font-bold uppercase tracking-wider">Dimensions</label>
                </div>
                <DimensionSelector />
            </div>
        </div>
        
        {/* Tabs Section */}
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
          tabListClassName="px-2 pt-2 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm"
          contentClassName="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-panel-border hover:scrollbar-thumb-text-secondary/50"
          data-testid="left-panel-tabs"
        />
    </div>
  );
};