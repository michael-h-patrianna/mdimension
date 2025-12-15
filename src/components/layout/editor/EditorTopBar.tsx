import React from 'react';
import { RenderModeToggles } from '@/components/sidebar/RenderMode/RenderModeToggles';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { exportSceneToPNG, generateTimestampFilename } from '@/lib/export';
import { generateShareUrl } from '@/lib/url';
import { useGeometryStore } from '@/stores/geometryStore';
import { useTransformStore } from '@/stores/transformStore';
import { useVisualStore } from '@/stores/visualStore';
import { PRESETS } from '@/lib/presets';
import { useToast } from '@/contexts/ToastContext';
import { useLayoutStore } from '@/stores/layoutStore';
import { useAnimationStore } from '@/stores/animationStore';

interface EditorTopBarProps {
  showLeftPanel: boolean;
  setShowLeftPanel: (show: boolean) => void;
  showRightPanel: boolean;
  toggleRightPanel: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  showLeftPanel,
  setShowLeftPanel,
  showRightPanel,
  toggleRightPanel,
}) => {
  const { addToast } = useToast();
  const toggleShortcuts = useLayoutStore((state) => state.toggleShortcuts);

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

  const toggleCinematic = () => {
    const areBothHidden = !showLeftPanel && !showRightPanel;
    if (areBothHidden) {
      setShowLeftPanel(true);
      if (!showRightPanel) toggleRightPanel(); // Assuming toggleRightPanel toggles state
    } else {
      setShowLeftPanel(false);
      if (showRightPanel) toggleRightPanel();
    }
    
    // Auto-rotate if entering cinematic mode
    if (!areBothHidden) {
       useAnimationStore.getState().play();
       addToast('Cinematic Mode Enabled', 'info');
    }
  };

  const fileItems = [
    { label: 'Export Image (PNG)', onClick: handleExport, shortcut: '⌘E', 'data-testid': 'menu-export' },
    { label: 'Copy Share Link', onClick: handleShare, shortcut: '⌘S', 'data-testid': 'menu-share' },
  ];

  const viewItems = [
    { label: showLeftPanel ? 'Hide Explorer' : 'Show Explorer', onClick: () => setShowLeftPanel(!showLeftPanel) },
    { label: showRightPanel ? 'Hide Inspector' : 'Show Inspector', onClick: toggleRightPanel },
    { label: 'Cinematic Mode', onClick: toggleCinematic, shortcut: 'C' },
    { label: 'Keyboard Shortcuts', onClick: toggleShortcuts, shortcut: '?' },
  ];

  const presetItems = PRESETS.map(p => ({
    label: p.label,
    onClick: () => handleApplyPreset(p),
    'data-testid': `preset-${p.id}`
  }));

  return (
    <div className="h-12 bg-panel-bg/80 backdrop-blur-md border-b border-panel-border flex items-center justify-between px-4 z-20 shrink-0 select-none relative" data-testid="top-bar">
      {/* Left: Branding & Menu */}
      <div className="flex items-center gap-4">
        {/* Left Panel Toggle */}
        <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
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
             <RenderModeToggles />
        </div>
      </div>

      {/* Right: Tools */}
      <div className="flex items-center gap-2">
         {/* Cinematic Toggle */}
         <button
            onClick={toggleCinematic}
            className={`p-1.5 rounded-md transition-colors text-text-secondary hover:text-accent hover:bg-white/5`}
            title="Cinematic Mode (C)"
            data-testid="toggle-cinematic"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
               <circle cx="12" cy="12" r="3" />
            </svg>
        </button>

         <div className="h-4 w-px bg-panel-border mx-1" />
         
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
