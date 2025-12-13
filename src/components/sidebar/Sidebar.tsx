/**
 * Sidebar Component
 * Main control panel sidebar with all settings sections
 */

import { AnimationControls } from '@/components/controls/AnimationControls';
import { BloomControls } from '@/components/controls/BloomControls';
import { DimensionSelector } from '@/components/controls/DimensionSelector';
import { EducationPanel } from '@/components/controls/EducationPanel';
import { LightingControls } from '@/components/controls/LightingControls';
import { ObjectSettingsSection } from '@/components/controls/ObjectSettingsSection';
import { ObjectTypeSelector } from '@/components/controls/ObjectTypeSelector';
import { ProjectionControls } from '@/components/controls/ProjectionControls';
import { RenderModeToggles } from '@/components/controls/RenderModeToggles';
import { ShaderSettings } from '@/components/controls/ShaderSettings';
import { VisualControls } from '@/components/controls/VisualControls';
import { ExportButton } from '@/components/ExportButton';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { ShareButton } from '@/components/ShareButton';
import { ControlPanel } from '@/components/ui/ControlPanel';
import { Section } from '@/components/ui/Section';
import { ThemeSelector } from '@/components/ui/ThemeSelector';
import React from 'react';

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

      <Section title="Object Geometry" defaultOpen={true}>
        <div className="space-y-4">
          <DimensionSelector />
          <ObjectTypeSelector />
          <ObjectSettingsSection />
        </div>
      </Section>

      <Section title="Animation" defaultOpen={true}>
        <AnimationControls />
      </Section>

      <Section title="Projection" defaultOpen={false}>
        <ProjectionControls />
      </Section>

      <Section title="Visual" defaultOpen={false}>
        <div className="space-y-6">
          {/* Per-Shader Settings (shown when faces are visible) */}
          <ShaderSettings />

          {/* Bloom Controls */}
          <BloomControls />

          {/* Lighting Controls - for surface rendering */}
          <LightingControls />

          {/* Color & Visual Settings */}
          <VisualControls />
        </div>
      </Section>

      <Section title="Settings" defaultOpen={true}>
        <ThemeSelector />
      </Section>

      <Section title="Export & Share" defaultOpen={true}>
        <div className="space-y-3">
          <ExportButton />
          <ShareButton />
        </div>
      </Section>

      <Section title="Documentation" defaultOpen={false}>
        <EducationPanel />
      </Section>

      <Section title="Shortcuts" defaultOpen={false}>
        <KeyboardShortcuts />
      </Section>
    </ControlPanel>
  );
};
