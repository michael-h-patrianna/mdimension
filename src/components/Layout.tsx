/**
 * Layout Component
 * Main application layout with canvas and control panel
 */

import React from 'react';
import { useThemeStore } from '../stores/themeStore';
import { ControlPanel } from './ui/ControlPanel';
import { Section } from './ui/Section';
import { ThemeSelector } from './ui/ThemeSelector';
import { DimensionSelector } from './controls/DimensionSelector';
import { ObjectTypeSelector } from './controls/ObjectTypeSelector';
import { ObjectSettingsSection } from './controls/ObjectSettingsSection';
import { RotationControls } from './controls/RotationControls';
import { ProjectionControls } from './controls/ProjectionControls';
import { ScaleControls } from './controls/ScaleControls';
import { ShearControls } from './controls/ShearControls';
import { TranslationControls } from './controls/TranslationControls';
import { AnimationControls } from './controls/AnimationControls';
import { CrossSectionControls } from './controls/CrossSectionControls';
import { VisualControls } from './controls/VisualControls';
import { RenderModeToggles } from './controls/RenderModeToggles';
import { ShaderSettings } from './controls/ShaderSettings';
import { BloomControls } from './controls/BloomControls';
import { LightingControls } from './controls/LightingControls';
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
  const theme = useThemeStore((state) => state.theme);

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden selection:bg-accent selection:text-black" data-theme={theme}>
      
      {/* Background/Canvas Layer */}
      <div className="absolute inset-0 z-0">
        {children || (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-text-secondary text-lg font-mono tracking-widest">INITIALIZING VISUALIZER...</p>
          </div>
        )}
      </div>

      {/* Floating Header */}
      {showHeader && (
        <header className="absolute top-4 left-4 z-40 pointer-events-none">
          <div className="glass-panel px-6 py-3 rounded-full pointer-events-auto flex items-center gap-4">
            <h1 className="text-sm font-bold tracking-[0.2em] text-text-primary">
              <span className="text-accent">{appTitle.charAt(0)}</span>{appTitle.slice(1).toUpperCase()}
            </h1>
            <div className="h-3 w-[1px] bg-border/20" />
            <span className="text-xs font-mono text-text-secondary">v0.1.0</span>
          </div>
        </header>
      )}

      {/* Control panel (Floating HUD) */}
      <ControlPanel title="SYSTEM CONTROLS">
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
    </div>
  );
};
