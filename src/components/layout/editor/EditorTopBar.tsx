import React from 'react';
import { TopBarControls } from '@/components/layout/editor/TopBarControls';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { exportSceneToPNG, generateTimestampFilename } from '@/lib/export';
import { generateShareUrl } from '@/lib/url';
import { useGeometryStore } from '@/stores/geometryStore';
import { useTransformStore } from '@/stores/transformStore';
import { useVisualStore } from '@/stores/visualStore';
import { PRESETS } from '@/lib/presets';
import { useToast } from '@/contexts/ToastContext';
import { useLayoutStore } from '@/stores/layoutStore';
import { usePresetStore } from '@/stores/presetStore';
import { useThemeStore } from '@/stores/themeStore';

interface EditorTopBarProps {
  showRightPanel: boolean;
  toggleRightPanel: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  showRightPanel,
  toggleRightPanel,
}) => {
  const { addToast } = useToast();
  const { toggleShortcuts, showLeftPanel, toggleLeftPanel } = useLayoutStore();
  const { savedPresets, saveCurrentAsPreset, loadPreset } = usePresetStore();
  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
      if (theme === 'cyan') setTheme('green');
      else if (theme === 'green') setTheme('magenta');
      else setTheme('cyan');
  };

  // Store access for Share URL generation
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const shaderType = useVisualStore((state) => state.shaderType);
  const shaderSettings = useVisualStore((state) => state.shaderSettings);
  const edgeColor = useVisualStore((state) => state.edgeColor);
  const backgroundColor = useVisualStore((state) => state.backgroundColor);
  const bloomEnabled = useVisualStore((state) => state.bloomEnabled);
  const bloomIntensity = useVisualStore((state) => state.bloomIntensity);

  const handleExport = async () => {
    // Small delay to ensure UI updates if needed
    await new Promise((resolve) => setTimeout(resolve, 50));
    const filename = generateTimestampFilename('ndimensional');
    exportSceneToPNG({ filename });
    addToast('Screenshot exported successfully', 'success');
  };

  const handleShare = async () => {
    const url = generateShareUrl({
      dimension,
      objectType,
      uniformScale,
      shaderType,
      shaderSettings,
      edgeColor,
      backgroundColor,
      bloomEnabled,
      bloomIntensity,
    });

    try {
      await navigator.clipboard.writeText(url);
      addToast('Share URL copied to clipboard!', 'success');
    } catch (error) {
      console.warn('Clipboard API failed:', error);
      window.prompt('Copy this URL to share:', url);
    }
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    preset.apply();
    addToast(`Loaded preset: ${preset.label}`, 'info');
  };

  // Cinematic toggle logic is now in TopBarControls, but kept here for menu item compatibility
  const toggleCinematic = useLayoutStore((state) => state.toggleCinematicMode);

  const fileItems = [
    { label: 'Export Image (PNG)', onClick: handleExport, shortcut: '⌘E', 'data-testid': 'menu-export' },
    { label: 'Copy Share Link', onClick: handleShare, shortcut: '⌘S', 'data-testid': 'menu-share' },
  ];

  const viewItems = [
    { label: showLeftPanel ? 'Hide Explorer' : 'Show Explorer', onClick: toggleLeftPanel },
    { label: showRightPanel ? 'Hide Inspector' : 'Show Inspector', onClick: toggleRightPanel },
    { label: `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`, onClick: toggleTheme },
    { label: 'Cinematic Mode', onClick: toggleCinematic, shortcut: 'C' },
    { label: 'Keyboard Shortcuts', onClick: toggleShortcuts, shortcut: '?' },
  ];

  const handleSavePreset = () => {
      setTimeout(() => {
          const name = window.prompt('Enter a name for this preset:');
          if (name) {
              saveCurrentAsPreset(name);
              addToast(`Preset "${name}" saved!`, 'success');
          }
      }, 10);
  };

  const presetItems = [
    { label: '+ Save Current State...', onClick: handleSavePreset, 'data-testid': 'preset-save-new' },
    ...savedPresets.map(p => ({
        label: `📂 ${p.name}`,
        onClick: () => {
            loadPreset(p.id);
            addToast(`Loaded preset: ${p.name}`, 'info');
        },
        'data-testid': `preset-saved-${p.id}`
    })),
    ...PRESETS.map(p => ({
      label: p.label,
      onClick: () => handleApplyPreset(p),
      'data-testid': `preset-${p.id}`
    }))
  ];

  return (
    <div className="h-12 bg-panel-bg/80 backdrop-blur-md border-b border-panel-border flex items-center justify-between px-4 z-20 shrink-0 select-none relative" data-testid="top-bar">
      {/* Left: Branding & Menu */}
      <div className="flex items-center gap-4">
        {/* Left Panel Toggle */}
        <button
            onClick={toggleLeftPanel}
            className={`p-1.5 rounded-md transition-colors ${
              showLeftPanel ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
            title="Toggle Explorer"
            data-testid="toggle-left-panel"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
        </button>

        <div className="text-lg font-bold text-accent tracking-tighter hidden sm:block">
          MDIMENSION
        </div>
        <div className="h-4 w-px bg-panel-border hidden sm:block" />
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <DropdownMenu 
            trigger={<button className="hover:text-text-primary px-2 py-1 rounded hover:bg-white/5 transition-colors" data-testid="menu-file">File</button>}
            items={fileItems}
          />
          <DropdownMenu 
            trigger={<button className="hover:text-text-primary px-2 py-1 rounded hover:bg-white/5 transition-colors" data-testid="menu-view">View</button>}
            items={viewItems}
          />
           <DropdownMenu 
            trigger={<button className="hover:text-text-primary px-2 py-1 rounded hover:bg-white/5 transition-colors text-accent/80" data-testid="menu-presets">Presets</button>}
            items={presetItems}
          />
        </div>
      </div>

      {/* Center: Global Controls */}
      <div className="flex-1 flex justify-center absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="pointer-events-auto">
             <TopBarControls />
        </div>
      </div>

      {/* Right: Tools */}
      <div className="flex items-center gap-2">
         {/* Right Panel Toggle */}
         <button
            onClick={toggleRightPanel}
            className={`p-1.5 rounded-md transition-colors ${
              showRightPanel ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
            title="Toggle Inspector"
            data-testid="toggle-right-panel"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
        </button>
      </div>
    </div>
  );
};
