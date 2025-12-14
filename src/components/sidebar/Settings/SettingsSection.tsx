/**
 * Settings Section Component
 * Section wrapper for app settings controls
 */

import { Section } from '@/components/ui/Section';
import { Switch } from '@/components/ui/Switch';
import { useVisualStore } from '@/stores/visualStore';
import React from 'react';
import { ThemeSelector } from './ThemeSelector';

export interface SettingsSectionProps {
  defaultOpen?: boolean;
}

/**
 * Settings section containing theme selector and developer tools.
 *
 * @param props - Component props
 * @param props.defaultOpen - Whether the section is initially expanded
 * @returns Settings section with theme and performance monitor controls
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  defaultOpen = true,
}) => {
  const showPerfMonitor = useVisualStore((state) => state.showPerfMonitor);
  const setShowPerfMonitor = useVisualStore((state) => state.setShowPerfMonitor);
  const showAxisHelper = useVisualStore((state) => state.showAxisHelper);
  const setShowAxisHelper = useVisualStore((state) => state.setShowAxisHelper);

  return (
    <Section title="Settings" defaultOpen={defaultOpen}>
      <ThemeSelector />
      <div className="mt-3 pt-3 border-t border-panel-border">
        <Switch
          checked={showPerfMonitor}
          onCheckedChange={setShowPerfMonitor}
          label="Performance Monitor"
          data-testid="perf-monitor-toggle"
        />
      </div>
      <div className="mt-3 pt-3 border-t border-panel-border">
        <Switch
          checked={showAxisHelper}
          onCheckedChange={setShowAxisHelper}
          label="Show Axis Helper"
        />
      </div>
    </Section>
  );
};
