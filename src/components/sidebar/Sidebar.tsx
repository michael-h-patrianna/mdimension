/**
 * Sidebar Component
 * Main control panel sidebar that loads all section components
 */

import { ControlPanel } from '@/components/ui/ControlPanel';
import React from 'react';
import { AnimationSection } from './Animation/AnimationSection';
import { DocumentationSection } from './Documentation/DocumentationSection';
import { EdgesSection } from './Edges/EdgesSection';
import { EnvironmentSection } from './Environment/EnvironmentSection';
import { ExportSection } from './Export/ExportSection';
import { FacesSection } from './Faces/FacesSection';
import { GeometrySection } from './Geometry/GeometrySection';
import { LightsSection } from './Lights/LightsSection';
import { PostProcessingSection } from './PostProcessing/PostProcessingSection';
import { ProjectionSection } from './Projection/ProjectionSection';
import { RenderModeToggles } from './RenderMode/RenderModeToggles';
import { SettingsSection } from './Settings/SettingsSection';
import { ShortcutsSection } from './Shortcuts/ShortcutsSection';

export interface SidebarProps {
  title?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  title = 'SYSTEM CONTROLS',
}) => {
  return (
    <ControlPanel title={title}>
      {/* Render Mode Toggles - always visible at top */}
      <div className="pb-3 mb-3 border-b border-panel-border">
        <RenderModeToggles />
      </div>

      <GeometrySection defaultOpen={true} />
      <AnimationSection defaultOpen={true} />
      <FacesSection defaultOpen={false} />
      <EdgesSection defaultOpen={false} />
      <LightsSection defaultOpen={false} />
      <EnvironmentSection defaultOpen={false} />
      <PostProcessingSection defaultOpen={false} />
      <ProjectionSection defaultOpen={false} />
      <SettingsSection defaultOpen={false} />
      <ExportSection defaultOpen={false} />
      <DocumentationSection defaultOpen={false} />
      <ShortcutsSection defaultOpen={false} />
    </ControlPanel>
  );
};
