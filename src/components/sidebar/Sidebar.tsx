/**
 * Sidebar Component
 * Main control panel sidebar that loads all section components
 */

import { ControlPanel } from '@/components/ui/ControlPanel'
import type { LayoutMode } from '@/stores/layoutStore'
import React from 'react'
import { AnimationSection } from './Animation/AnimationSection'
import { DocumentationSection } from './Documentation/DocumentationSection'
import { EdgesSection } from './Edges/EdgesSection'
import { EnvironmentSection } from './Environment/EnvironmentSection'
import { ExportSection } from './Export/ExportSection'
import { FacesSection } from './Faces/FacesSection'
import { GeometrySection } from './Geometry/GeometrySection'
import { LightsSection } from './Lights/LightsSection'
import { PerformanceSection } from './Performance/PerformanceSection'
import { PostProcessingSection } from './PostProcessing/PostProcessingSection'
import { ProjectionSection } from './Projection/ProjectionSection'
import { RenderModeToggles } from './RenderMode/RenderModeToggles'
import { SettingsSection } from './Settings/SettingsSection'
import { ShortcutsSection } from './Shortcuts/ShortcutsSection'

export interface SidebarProps {
  title?: string
  /** Layout mode passed to ControlPanel */
  layoutMode?: LayoutMode
}

/**
 * Sidebar - Main control panel with all settings sections.
 *
 * @param props - Component props
 * @param props.title - Panel title
 * @param props.layoutMode - Layout mode ('overlay' | 'side-by-side')
 * @returns React component
 */
export const Sidebar: React.FC<SidebarProps> = ({
  title = 'SYSTEM CONTROLS',
  layoutMode = 'overlay',
}) => {
  return (
    <ControlPanel title={title} layoutMode={layoutMode}>
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
      <PerformanceSection defaultOpen={false} />
      <SettingsSection defaultOpen={false} />
      <ExportSection defaultOpen={false} />
      <DocumentationSection defaultOpen={false} />
      <ShortcutsSection defaultOpen={false} />
    </ControlPanel>
  )
}
