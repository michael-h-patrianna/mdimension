/**
 * Settings Section Component
 * Section wrapper for app settings controls
 */

import { Section } from '@/components/sections/Section';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useUIStore } from '@/stores/uiStore';
import React from 'react';
import { ThemeSelector } from './ThemeSelector';

export interface SettingsSectionProps {
  defaultOpen?: boolean;
}

/**
 * Settings section containing theme selector and developer tools.
 * Note: Debug buffer visualization has been moved to Performance Monitor > Buffers tab.
 *
 * @param props - Component props
 * @param props.defaultOpen - Whether the section is initially expanded
 * @returns Settings section
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  defaultOpen = true,
}) => {

  const showAxisHelper = useUIStore((state) => state.showAxisHelper);
  const setShowAxisHelper = useUIStore((state) => state.setShowAxisHelper);
  const maxFps = useUIStore((state) => state.maxFps);
  const setMaxFps = useUIStore((state) => state.setMaxFps);

  return (
    <Section title="Settings" defaultOpen={defaultOpen}>
      <ThemeSelector />

      <div className="mt-3 pt-3 border-t border-panel-border">
        <Switch
          checked={showAxisHelper}
          onCheckedChange={setShowAxisHelper}
          label="Show Axis Helper"
        />
      </div>
      <div className="mt-3 pt-3 border-t border-panel-border">
        <Slider
          label="Max FPS"
          value={maxFps}
          min={15}
          max={120}
          step={1}
          onChange={setMaxFps}
          unit=" fps"
          tooltip="Limit frame rate to reduce power consumption"
          data-testid="max-fps-slider"
        />
      </div>
    </Section>
  );
};
