import React, { useState } from 'react';
import { TopBarControls } from '@/components/layout/TopBarControls';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Modal } from '@/components/ui/Modal';
import { StyleManager } from '@/components/presets/StyleManager';
import { SceneManager } from '@/components/presets/SceneManager';
import { exportSceneToPNG, generateTimestampFilename } from '@/lib/export';
import { generateShareUrl } from '@/lib/url';
import { useGeometryStore } from '@/stores/geometryStore';
import { useTransformStore } from '@/stores/transformStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { PRESETS } from '@/lib/presets';
import { useToast } from '@/contexts/ToastContext';
import { useLayoutStore } from '@/stores/layoutStore';
import { usePresetManagerStore } from '@/stores/presetManagerStore';
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
  
  // New Preset Manager Store
  const { 
    savedStyles, 
    saveStyle, 
    loadStyle, 
    savedScenes, 
    saveScene, 
    loadScene 
  } = usePresetManagerStore();

  const { theme, setTheme } = useThemeStore();

  const [isStyleManagerOpen, setIsStyleManagerOpen] = useState(false);
  const [isSceneManagerOpen, setIsSceneManagerOpen] = useState(false);

  const toggleTheme = () => {
      if (theme === 'cyan') setTheme('green');
      else if (theme === 'green') setTheme('magenta');
      else setTheme('cyan');
  };

  // Store access for Share URL generation
  const dimension = useGeometryStore((state) => state.dimension);
  const objectType = useGeometryStore((state) => state.objectType);
  const uniformScale = useTransformStore((state) => state.uniformScale);
  const shaderType = useAppearanceStore((state) => state.shaderType);
  const shaderSettings = useAppearanceStore((state) => state.shaderSettings);
  const edgeColor = useAppearanceStore((state) => state.edgeColor);
  const backgroundColor = useAppearanceStore((state) => state.backgroundColor);
  const bloomEnabled = usePostProcessingStore((state) => state.bloomEnabled);
  const bloomIntensity = usePostProcessingStore((state) => state.bloomIntensity);

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
    addToast(`Loaded example: ${preset.label}`, 'info');
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

  // --- Style Menu ---
  const handleSaveStyle = () => {
      setTimeout(() => {
          const name = window.prompt('Enter a name for this style:');
          if (name) {
              saveStyle(name);
              addToast(`Style "${name}" saved!`, 'success');
          }
      }, 10);
  };

  const styleItems = [
    { label: 'Actions' },
    { label: '+ Save Current Style...', onClick: handleSaveStyle },
    { label: 'Manage Styles...', onClick: () => setIsStyleManagerOpen(true) },
    { label: '---' },
    { label: 'Saved Styles' },
    ...(savedStyles.length === 0 ? [{ label: '(None)', disabled: true }] : savedStyles.map(s => ({
        label: s.name,
        onClick: () => {
            loadStyle(s.id);
            addToast(`Applied style: ${s.name}`, 'info');
        }
    })))
  ];

  // --- Scene Menu ---
  const handleSaveScene = () => {
      setTimeout(() => {
          const name = window.prompt('Enter a name for this scene:');
          if (name) {
              saveScene(name);
              addToast(`Scene "${name}" saved!`, 'success');
          }
      }, 10);
  };

  const sceneItems = [
      { label: 'Actions' },
      { label: '+ Save Current Scene...', onClick: handleSaveScene },
      { label: 'Manage Scenes...', onClick: () => setIsSceneManagerOpen(true) },
      { label: '---' },
      { label: 'Saved Scenes' },
      ...(savedScenes.length === 0 ? [{ label: '(None)', disabled: true }] : savedScenes.map(s => ({
          label: s.name,
          onClick: () => {
              loadScene(s.id);
              addToast(`Loaded scene: ${s.name}`, 'info');
          }
      }))),
      { label: '---' },
      { label: 'Examples' },
      ...PRESETS.map(p => ({
          label: p.label,
          onClick: () => handleApplyPreset(p)
      }))
  ];

  return (
    <>
      <div className="glass-panel h-12 flex items-center justify-between px-4 z-40 shrink-0 select-none relative mb-2 rounded-xl mx-2 mt-2" data-testid="top-bar">
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

          <div className="text-lg font-bold text-accent tracking-[0.2em] hidden sm:block text-glow">
            MDIMENSION
          </div>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <DropdownMenu 
              trigger={<button className="hover:text-text-primary px-2 py-1 rounded hover:bg-white/5 transition-colors font-medium tracking-wide" data-testid="menu-file">FILE</button>}
              items={fileItems}
            />
            <DropdownMenu 
              trigger={<button className="hover:text-text-primary px-2 py-1 rounded hover:bg-white/5 transition-colors font-medium tracking-wide" data-testid="menu-view">VIEW</button>}
              items={viewItems}
            />
            
            <div className="w-px h-3 bg-white/10 mx-1" />

            <DropdownMenu 
              trigger={<button className="hover:text-text-primary px-2 py-1 rounded hover:bg-white/5 transition-colors text-accent/90 hover:text-accent tracking-wide" data-testid="menu-styles">STYLES</button>}
              items={styleItems}
            />
             <DropdownMenu 
              trigger={<button className="hover:text-text-primary px-2 py-1 rounded hover:bg-white/5 transition-colors text-accent/90 hover:text-accent tracking-wide" data-testid="menu-scenes">SCENES</button>}
              items={sceneItems}
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

      <Modal 
        isOpen={isStyleManagerOpen} 
        onClose={() => setIsStyleManagerOpen(false)} 
        title="Manage Styles"
      >
        <StyleManager onClose={() => setIsStyleManagerOpen(false)} />
      </Modal>

      <Modal 
        isOpen={isSceneManagerOpen} 
        onClose={() => setIsSceneManagerOpen(false)} 
        title="Manage Scenes"
      >
        <SceneManager onClose={() => setIsSceneManagerOpen(false)} />
      </Modal>
    </>
  );
};