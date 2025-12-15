import React, { useState } from 'react';
import { Tabs, Tab } from '@/components/ui/Tabs';

// Import existing sidebar sections
import { ProjectionSection } from '@/components/sidebar/Projection/ProjectionSection';
import { FacesSection } from '@/components/sidebar/Faces/FacesSection';
import { EdgesSection } from '@/components/sidebar/Edges/EdgesSection';
import { LightsSection } from '@/components/sidebar/Lights/LightsSection';
import { EnvironmentSection } from '@/components/sidebar/Environment/EnvironmentSection';
import { PostProcessingSection } from '@/components/sidebar/PostProcessing/PostProcessingSection';
import { SettingsSection } from '@/components/sidebar/Settings/SettingsSection';
import { ExportSection } from '@/components/sidebar/Export/ExportSection';
import { DocumentationSection } from '@/components/sidebar/Documentation/DocumentationSection';
import { PerformanceSection } from '@/components/sidebar/Performance/PerformanceSection';
import { AnimationSection } from '@/components/sidebar/Animation/AnimationSection';

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
          <LightsSection defaultOpen={false} />
          <PostProcessingSection defaultOpen={false} />
        </div>
      ),
    },
    {
      id: 'scene',
      label: 'Scene',
      content: (
        <div className="space-y-1">
          {/* Spatial & Environmental Setup */}
          <AnimationSection defaultOpen={true} />
          <ProjectionSection defaultOpen={true} />
          <EnvironmentSection defaultOpen={true} />
        </div>
      ),
    },
    {
      id: 'system',
      label: 'System',
      content: (
        <div className="space-y-1">
          {/* Technical & Meta */}
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