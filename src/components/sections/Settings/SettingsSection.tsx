/**
 * Settings Section Component
 * Section wrapper for app settings controls
 */

import { Section } from '@/components/sections/Section';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { DEFAULT_MAX_FPS } from '@/stores/defaults/visualDefaults';
import { useUIStore } from '@/stores/uiStore';
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
 * @returns Settings section
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  defaultOpen = true,
}) => {

  const showAxisHelper = useUIStore((state) => state.showAxisHelper);
  const setShowAxisHelper = useUIStore((state) => state.setShowAxisHelper);
  const showDepthBuffer = useUIStore((state) => state.showDepthBuffer);
  const setShowDepthBuffer = useUIStore((state) => state.setShowDepthBuffer);
  const showNormalBuffer = useUIStore((state) => state.showNormalBuffer);
  const setShowNormalBuffer = useUIStore((state) => state.setShowNormalBuffer);
  const showTemporalDepthBuffer = useUIStore((state) => state.showTemporalDepthBuffer);
  const setShowTemporalDepthBuffer = useUIStore((state) => state.setShowTemporalDepthBuffer);
  const maxFps = useUIStore((state) => state.maxFps);
  const setMaxFps = useUIStore((state) => state.setMaxFps);

  // Buffer visualization button styles
  const getBufferButtonClass = (isActive: boolean) => `
    flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border
    ${isActive
      ? 'bg-accent/20 text-accent border-accent/50 shadow-[0_0_8px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]'
      : 'bg-panel-bg text-text-secondary border-panel-border hover:text-text-primary hover:bg-panel-border/50'
    }
  `;

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
        <div className="text-xs text-text-secondary mb-2">Debug Buffers</div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowDepthBuffer(!showDepthBuffer)}
            className={getBufferButtonClass(showDepthBuffer)}
            data-testid="show-depth-buffer-btn"
          >
            Depth
          </button>
          <button
            onClick={() => setShowNormalBuffer(!showNormalBuffer)}
            className={getBufferButtonClass(showNormalBuffer)}
            data-testid="show-normal-buffer-btn"
          >
            Normal
          </button>
          <button
            onClick={() => setShowTemporalDepthBuffer(!showTemporalDepthBuffer)}
            className={getBufferButtonClass(showTemporalDepthBuffer)}
            data-testid="show-temporal-depth-btn"
          >
            Temporal
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-panel-border">
        <Slider
          label="Max FPS"
          value={maxFps}
          min={15}
          max={120}
          step={1}
          onChange={setMaxFps}
          onReset={() => setMaxFps(DEFAULT_MAX_FPS)}
          unit=" fps"
          tooltip="Limit frame rate to reduce power consumption"
          data-testid="max-fps-slider"
        />
      </div>
    </Section>
  );
};
