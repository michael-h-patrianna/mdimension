/**
 * Sidebar Component
 * Main control panel sidebar that loads all section components
 */

import { ControlPanel } from '@/components/ui/ControlPanel';
import React from 'react';
import { AnimationSection } from './Animation';
import { DocumentationSection } from './Documentation';
import { EnvironmentSection } from './Environment';
import { ExportSection } from './Export';
import { FacesSection } from './Faces';
import { GeometrySection } from './Geometry';
import { LightsSection } from './Lights';
import { PostProcessingSection } from './PostProcessing';
import { ProjectionSection } from './Projection';
import { RenderModeToggles } from './RenderMode';
import { SettingsSection } from './Settings';
import { ShortcutsSection } from './Shortcuts';
import { VisualSection } from './Visual';

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
      <ProjectionSection defaultOpen={false} />
      <VisualSection defaultOpen={false} />
      <LightsSection defaultOpen={false} />
      <PostProcessingSection defaultOpen={false} />
      <EnvironmentSection defaultOpen={false} />
      <SettingsSection defaultOpen={false} />
      <ExportSection defaultOpen={false} />
      <DocumentationSection defaultOpen={false} />
      <ShortcutsSection defaultOpen={false} />
    </ControlPanel>
  );
};
