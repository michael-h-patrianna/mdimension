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
  // Default to 'visuals' tab as per user feedback (primary creative focus)
  const [activeTab, setActiveTab] = useState('visuals');

  const tabs: Tab[] = [
    {
      id: 'visuals',
      label: 'Visuals',
      content: (
        <div className="space-y-1 px-1">
          {/* The "Art" - Materials, Lines, FX */}
          <FacesSection defaultOpen={true} />
          <EdgesSection defaultOpen={false} />
          <PostProcessingSection defaultOpen={false} />
        </div>
      ),
    },
    {
      id: 'scene',
      label: 'Scene',
      content: (
        <div className="space-y-1 px-1">
          {/* The "Stage" - Lighting, Background, Lens */}
          <EnvironmentSection defaultOpen={true} />
          <LightsSection defaultOpen={false} />
          <ProjectionSection defaultOpen={false} />
        </div>
      ),
    },
    {
      id: 'system',
      label: 'System',
      content: (
        <div className="space-y-1 px-1">
          {/* The "App" - Settings, Meta, Output */}
          <SettingsSection defaultOpen={true} />
          <PerformanceSection defaultOpen={false} />
          <ExportSection defaultOpen={false} />
          <DocumentationSection defaultOpen={false} />
        </div>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-panel-bg border-l border-panel-border w-80 shrink-0 overflow-hidden">
      {/* Header Section */}
      <div className="p-4 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm z-10 shrink-0">
        <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Scene & Render</h2>
      </div>

      {/* Tabs & Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Tabs
          data-testid="right-panel-tabs"
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
          tabListClassName="px-3 pt-3 pb-0 bg-transparent"
          contentClassName="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-panel-border hover:scrollbar-thumb-text-secondary/50"
          variant="default" 
          fullWidth
        />
      </div>
    </div>
  );
};