import React, { useState } from 'react';
import { Tabs, Tab } from '@/components/ui/Tabs';

// Import existing sidebar sections
import { ProjectionSection } from '@/components/sections/Projection/ProjectionSection';
import { FacesSection } from '@/components/sections/Faces/FacesSection';
import { EdgesSection } from '@/components/sections/Edges/EdgesSection';
import { LightsSection } from '@/components/sections/Lights/LightsSection';
import { EnvironmentSection } from '@/components/sections/Environment/EnvironmentSection';
import { PostProcessingSection } from '@/components/sections/PostProcessing/PostProcessingSection';
import { SettingsSection } from '@/components/sections/Settings/SettingsSection';
import { ExportSection } from '@/components/sections/Export/ExportSection';
import { DocumentationSection } from '@/components/sections/Documentation/DocumentationSection';
import { PerformanceSection } from '@/components/sections/Performance/PerformanceSection';

export const EditorRightPanel: React.FC = () => {
  // Default to 'render' tab as per user feedback (this is where they spend "hours")
  const [activeTab, setActiveTab] = useState('render');

  const tabs: Tab[] = [
    {
      id: 'render',
      label: 'Style',
      content: (
        <div className="space-y-1">
          {/* Visual Style & Effects */}
          <FacesSection defaultOpen={true} />
          <EdgesSection defaultOpen={false} />
        </div>
      ),
    },
    {
      id: 'scene',
      label: 'Scene',
      content: (
        <div className="space-y-1">
          {/* Spatial & Environmental Setup */}
          <EnvironmentSection defaultOpen={true} />
          <LightsSection defaultOpen={false} />
          <PostProcessingSection defaultOpen={false} />
        </div>
      ),
    },
    {
      id: 'system',
      label: 'System',
      content: (
        <div className="space-y-1">
          {/* Technical & Meta */}
          <ProjectionSection defaultOpen={true} />
          <PerformanceSection defaultOpen={false} />
          <SettingsSection defaultOpen={true} />
          <ExportSection defaultOpen={false} />
          <DocumentationSection defaultOpen={false} />
        </div>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-panel-bg border-l border-panel-border w-80 shrink-0">
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs
          data-testid="right-panel-tabs"
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
          tabListClassName="px-2 pt-2 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm"
          contentClassName="flex-1 overflow-y-auto px-0 scrollbar-thin scrollbar-thumb-panel-border hover:scrollbar-thumb-text-secondary/50"
        />
      </div>
    </div>
  );
};