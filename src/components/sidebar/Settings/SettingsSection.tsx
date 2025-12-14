/**
 * Settings Section Component
 * Section wrapper for app settings controls
 */

import { needsObjectOnlyDepth } from '@/lib/rendering/layers';
import { Section } from '@/components/ui/Section';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { DEFAULT_MAX_FPS } from '@/stores/defaults/visualDefaults';
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
  const showDepthBuffer = useVisualStore((state) => state.showDepthBuffer);
  const setShowDepthBuffer = useVisualStore((state) => state.setShowDepthBuffer);
  const maxFps = useVisualStore((state) => state.maxFps);
  const setMaxFps = useVisualStore((state) => state.setMaxFps);

  // Check if depth buffer is available (any depth-based effect is enabled)
  const bokehEnabled = useVisualStore((state) => state.bokehEnabled);
  const ssrEnabled = useVisualStore((state) => state.ssrEnabled);
  const refractionEnabled = useVisualStore((state) => state.refractionEnabled);
  const bokehFocusMode = useVisualStore((state) => state.bokehFocusMode);

  const depthBufferAvailable = needsObjectOnlyDepth({
    ssrEnabled,
    refractionEnabled,
    bokehEnabled,
    bokehFocusMode,
  });

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
      <div className="mt-3 pt-3 border-t border-panel-border">
        <Switch
          checked={showDepthBuffer && depthBufferAvailable}
          onCheckedChange={setShowDepthBuffer}
          disabled={!depthBufferAvailable}
          label="Show Depth Buffer"
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
          onReset={() => setMaxFps(DEFAULT_MAX_FPS)}
          unit=" fps"
          tooltip="Limit frame rate to reduce power consumption"
          data-testid="max-fps-slider"
        />
      </div>
    </Section>
  );
};
