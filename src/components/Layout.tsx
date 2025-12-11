/**
 * Layout Component
 * Main application layout with canvas and control panel
 */

import React from 'react';
import { ControlPanel } from './ui/ControlPanel';
import { Section } from './ui/Section';
import { DimensionSelector } from './controls/DimensionSelector';
import { ObjectTypeSelector } from './controls/ObjectTypeSelector';
import { RotationControls } from './controls/RotationControls';
import { ProjectionControls } from './controls/ProjectionControls';
import { ScaleControls } from './controls/ScaleControls';
import { ShearControls } from './controls/ShearControls';
import { TranslationControls } from './controls/TranslationControls';
import { AnimationControls } from './controls/AnimationControls';
import { CrossSectionControls } from './controls/CrossSectionControls';
import { VisualControls } from './controls/VisualControls';
import { PropertiesPanel } from './controls/PropertiesPanel';
import { EducationPanel } from './controls/EducationPanel';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ExportButton } from './ExportButton';
import { ShareButton } from './ShareButton';

export interface LayoutProps {
  children?: React.ReactNode;
  appTitle?: string;
  showHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  appTitle = 'MDimension',
  showHeader = true,
}) => {
  return (
    <div className="flex h-screen bg-app-bg overflow-hidden">
      {/* Main canvas area */}
      <main className="flex-1 relative flex flex-col">
        {showHeader && (
          <header className="h-16 flex items-center justify-between px-6 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm">
            <h1 className="text-xl font-bold text-text-primary">{appTitle}</h1>
            <div className="flex items-center gap-4">
              {/* Future: Add global controls, theme toggle, etc. */}
            </div>
          </header>
        )}

        <div className="flex-1 overflow-hidden">
          {children || (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-text-secondary text-lg">Canvas area</p>
            </div>
          )}
        </div>
      </main>

      {/* Control panel */}
      <ControlPanel title="Visualization Controls">
        <Section title="Object" defaultOpen={true}>
          <div className="space-y-4">
            <DimensionSelector />
            <ObjectTypeSelector />
          </div>
        </Section>

        <Section title="Animation" defaultOpen={true}>
          <AnimationControls />
        </Section>

        <Section title="Rotation" defaultOpen={false}>
          <RotationControls />
        </Section>

        <Section title="Projection" defaultOpen={false}>
          <ProjectionControls />
        </Section>

        <Section title="Cross-Section" defaultOpen={false}>
          <CrossSectionControls />
        </Section>

        <Section title="Scale" defaultOpen={false}>
          <ScaleControls />
        </Section>

        <Section title="Shear" defaultOpen={false}>
          <ShearControls />
        </Section>

        <Section title="Translation" defaultOpen={false}>
          <TranslationControls />
        </Section>

        <Section title="Visual" defaultOpen={false}>
          <VisualControls />
        </Section>

        <Section title="Properties" defaultOpen={false}>
          <PropertiesPanel />
        </Section>

        <Section title="Export" defaultOpen={true}>
          <div className="space-y-3">
            <ExportButton />
            <ShareButton />
          </div>
        </Section>

        <Section title="Learn" defaultOpen={false}>
          <EducationPanel />
        </Section>

        <Section title="Keyboard Shortcuts" defaultOpen={false}>
          <KeyboardShortcuts />
        </Section>
      </ControlPanel>
    </div>
  );
};
