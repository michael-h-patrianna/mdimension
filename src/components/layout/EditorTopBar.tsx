import { TopBarControls } from '@/components/layout/TopBarControls';
import { SceneManager } from '@/components/presets/SceneManager';
import { StyleManager } from '@/components/presets/StyleManager';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { InputModal } from '@/components/ui/InputModal';
import { Modal } from '@/components/ui/Modal';
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery';
import { useToast } from '@/hooks/useToast';
import { soundManager } from '@/lib/audio/SoundManager';
import { exportSceneToPNG, generateTimestampFilename } from '@/lib/export';
import { PRESETS } from '@/lib/presets';
import { generateShareUrl } from '@/lib/url';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useExportStore } from '@/stores/exportStore';
import { useGeometryStore } from '@/stores/geometryStore';
import { useLayoutStore, type LayoutStore } from '@/stores/layoutStore';
import { usePostProcessingStore } from '@/stores/postProcessingStore';
import { usePresetManagerStore, type PresetManagerState, type SavedScene, type SavedStyle } from '@/stores/presetManagerStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTransformStore } from '@/stores/transformStore';
import { useUIStore } from '@/stores/uiStore';
import { m } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/Button';

interface EditorTopBarProps {
  showRightPanel: boolean;
  toggleRightPanel: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  showRightPanel,
  toggleRightPanel,
}) => {
  const { addToast } = useToast();

  const layoutSelector = useShallow((state: LayoutStore) => ({
    toggleShortcuts: state.toggleShortcuts,
    showLeftPanel: state.showLeftPanel,
    toggleLeftPanel: state.toggleLeftPanel,
    isCinematicMode: state.isCinematicMode,
    toggleCinematicMode: state.toggleCinematicMode,
  }));
  const { toggleShortcuts, showLeftPanel, toggleLeftPanel, toggleCinematicMode } = useLayoutStore(layoutSelector);

  // New Preset Manager Store
  const presetSelector = useShallow((state: PresetManagerState) => ({
    savedStyles: state.savedStyles,
    saveStyle: state.saveStyle,
    loadStyle: state.loadStyle,
    savedScenes: state.savedScenes,
    saveScene: state.saveScene,
    loadScene: state.loadScene,
  }));
  const {
    savedStyles,
    saveStyle,
    loadStyle,
    savedScenes,
    saveScene,
    loadScene
  } = usePresetManagerStore(presetSelector);

  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const [isStyleManagerOpen, setIsStyleManagerOpen] = useState(false);
  const [isSceneManagerOpen, setIsSceneManagerOpen] = useState(false);

  // Modal states for inputs
  const [saveStyleOpen, setSaveStyleOpen] = useState(false);
  const [saveSceneOpen, setSaveSceneOpen] = useState(false);
  const [shareUrlOpen, setShareUrlOpen] = useState(false);
  const [currentShareUrl, setCurrentShareUrl] = useState('');

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

  const showPerfMonitor = useUIStore((state) => state.showPerfMonitor);
  const setShowPerfMonitor = useUIStore((state) => state.setShowPerfMonitor);

  const isDesktop = useMediaQuery(BREAKPOINTS.sm);

  // Sync sound state for menu toggle
  const [isSoundEnabled, setIsSoundEnabled] = useState(soundManager.isEnabled);
  useEffect(() => {
     setIsSoundEnabled(soundManager.isEnabled);
  }, []);

  const handleExport = async () => {
    soundManager.playSuccess();
    // Small delay to ensure UI updates if needed
    await new Promise((resolve) => setTimeout(resolve, 50));
    const filename = generateTimestampFilename('ndimensional');
    exportSceneToPNG({ filename });

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
      soundManager.playSuccess();
      addToast('Share URL copied to clipboard!', 'success');
    } catch (error) {
      console.warn('Clipboard API failed:', error);
      setCurrentShareUrl(url);
      setShareUrlOpen(true);
    }
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    preset.apply();
    soundManager.playClick();
    addToast(`Loaded example: ${preset.label}`, 'info');
  };

  const setExportModalOpen = useExportStore((state) => state.setModalOpen);

  // --- Utility Actions for Mobile Menu ---
  const toggleSound = () => {
    const newState = !isSoundEnabled;
    soundManager.toggle(newState);
    setIsSoundEnabled(newState);
    if (newState) {
        soundManager.playClick();
        addToast('Sound Enabled', 'info');
    } else {
        addToast('Sound Muted', 'info');
    }
  };

  const toggleFullscreen = () => {
    soundManager.playClick();
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
  };

  // --- Submenu Definitions ---

  const themeItems = [
      { label: (theme === 'blue' ? '✓ ' : '  ') + 'Blue', onClick: () => setTheme('blue') },
      { label: (theme === 'cyan' ? '✓ ' : '  ') + 'Cyan', onClick: () => setTheme('cyan') },
      { label: (theme === 'green' ? '✓ ' : '  ') + 'Green', onClick: () => setTheme('green') },
      { label: (theme === 'magenta' ? '✓ ' : '  ') + 'Magenta', onClick: () => setTheme('magenta') },
      { label: (theme === 'orange' ? '✓ ' : '  ') + 'Orange', onClick: () => setTheme('orange') },
      { label: (theme === 'rainbow' ? '✓ ' : '  ') + 'Rainbow', onClick: () => setTheme('rainbow') },
  ];

  const savedSceneItems = savedScenes.map((s: SavedScene) => ({
      label: s.name,
      onClick: () => {
          loadScene(s.id);
          soundManager.playClick();
          addToast(`Loaded scene: ${s.name}`, 'info');
      }
  }));

  const exampleSceneItems = PRESETS.map(p => ({
      label: p.label,
      onClick: () => handleApplyPreset(p)
  }));

  const sceneSubmenuItems = [
      { label: 'Actions' },
      { label: '+ Save Current Scene...', onClick: () => setSaveSceneOpen(true) },
      { label: 'Manage Scenes...', onClick: () => { setIsSceneManagerOpen(true); soundManager.playClick(); } },
      { label: '---' },
      { label: 'Saved Scenes' },
      ...(savedScenes.length === 0 ? [{ label: '(None)', disabled: true }] : savedSceneItems),
      { label: '---' },
      { label: 'Examples' },
      ...exampleSceneItems
  ];

  const savedStyleItems = savedStyles.map((s: SavedStyle) => ({
      label: s.name,
      onClick: () => {
          loadStyle(s.id);
          soundManager.playClick();
          addToast(`Applied style: ${s.name}`, 'info');
      }
  }));

  const styleSubmenuItems = [
    { label: 'Actions' },
    { label: '+ Save Current Style...', onClick: () => setSaveStyleOpen(true) },
    { label: 'Manage Styles...', onClick: () => { setIsStyleManagerOpen(true); soundManager.playClick(); } },
    { label: '---' },
    { label: 'Saved Styles' },
    ...(savedStyles.length === 0 ? [{ label: '(None)', disabled: true }] : savedStyleItems)
  ];

  // --- Menu Definitions ---

  const fileItems = [
    { label: 'Export Image (PNG)', onClick: handleExport, shortcut: '⌘E', 'data-testid': 'menu-export' },
    {
        label: 'Export Video (MP4)',
        onClick: () => { setExportModalOpen(true); soundManager.playClick(); },
        shortcut: '⌘⇧E',
        'data-testid': 'menu-export-video'
    },
    { label: 'Copy Share Link', onClick: handleShare, shortcut: '⌘S', 'data-testid': 'menu-share' },
  ];

  const viewItems = [
    { label: showLeftPanel ? 'Hide Explorer' : 'Show Explorer', onClick: () => { toggleLeftPanel(); soundManager.playClick(); } },
    { label: showRightPanel ? 'Hide Inspector' : 'Show Inspector', onClick: () => { toggleRightPanel(); soundManager.playClick(); } },
    { label: 'Cinematic Mode', onClick: toggleCinematicMode, shortcut: 'C' },
    { label: 'Keyboard Shortcuts', onClick: toggleShortcuts, shortcut: '?' },
    { label: '---' },
    { label: 'Select Theme', items: themeItems }, // SUBMENU
  ];

  // --- Mobile Unified Menu ---
  const mobileMenuItems = [
    { label: 'FILE', items: fileItems }, // Nested for cleaner mobile view
    { label: 'VIEW', items: viewItems },
    { label: 'SCENES', items: sceneSubmenuItems },
    { label: 'STYLES', items: styleSubmenuItems },
    { label: '---' },
    { label: 'TOOLS' },
    { label: isSoundEnabled ? 'Mute Sound' : 'Enable Sound', onClick: toggleSound },
    { label: showPerfMonitor ? 'Hide Performance' : 'Show Performance', onClick: () => setShowPerfMonitor(!showPerfMonitor) },
    { label: 'Toggle Fullscreen', onClick: toggleFullscreen },
  ];

  // --- Style Menu ---

  const onConfirmSaveStyle = (name: string) => {
    if (name) {
      saveStyle(name);
      addToast(`Style "${name}" saved!`, 'success');
      soundManager.playSuccess();
    }
  };

  // --- Scene Menu ---

  const onConfirmSaveScene = (name: string) => {
    if (name) {
      saveScene(name);
      addToast(`Scene "${name}" saved!`, 'success');
      soundManager.playSuccess();
    }
  };

  return (
    <>
      <div className="glass-panel h-12 flex items-center justify-between px-4 z-40 shrink-0 select-none relative mb-2 rounded-xl mx-2 mt-2" data-testid="top-bar">
        {/* Left: Branding & Menu */}
        <div className="flex items-center gap-4">
          {/* Left Panel Toggle */}
          <Button
              variant={showLeftPanel ? 'primary' : 'ghost'}
              size="icon"
              onClick={toggleLeftPanel}
              ariaLabel="Toggle Explorer"
              data-testid="toggle-left-panel"
              className={`p-1.5 ${
                showLeftPanel ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
          >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
          </Button>

          {/* Holographic Logo (Hidden on very small screens, visible on desktop) */}
          <m.div
            className="text-lg font-bold text-accent tracking-[0.2em] hidden md:block relative cursor-default group"
            whileHover={{ scale: 1.05 }}
            onMouseEnter={() => soundManager.playHover()}
          >
            <span className="text-glow relative z-10">MDIMENSION</span>
            <div className="absolute inset-0 text-accent/50 blur-[2px] opacity-0 group-hover:opacity-100 group-hover:translate-x-[2px] transition-all duration-200" aria-hidden="true">MDIMENSION</div>
            <div className="absolute inset-0 text-white/30 blur-[4px] opacity-0 group-hover:opacity-100 group-hover:-translate-x-[2px] transition-all duration-200" aria-hidden="true">MDIMENSION</div>
          </m.div>

          <div className="h-4 w-px bg-white/10 hidden md:block" />

          {/* Desktop Menus (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-text-secondary">
            <DropdownMenu
              trigger={<Button variant="ghost" size="sm" data-testid="menu-file" className="px-2 py-1 font-medium tracking-wide">FILE</Button>}
              items={fileItems}
            />
            <DropdownMenu
              trigger={<Button variant="ghost" size="sm" data-testid="menu-view" className="px-2 py-1 font-medium tracking-wide">VIEW</Button>}
              items={viewItems}
            />
            <DropdownMenu
              trigger={<Button variant="ghost" size="sm" data-testid="menu-scenes" className="px-2 py-1 font-medium tracking-wide">SCENES</Button>}
              items={sceneSubmenuItems}
            />
            <DropdownMenu
              trigger={<Button variant="ghost" size="sm" data-testid="menu-styles" className="px-2 py-1 font-medium tracking-wide">STYLES</Button>}
              items={styleSubmenuItems}
            />
          </div>

          {/* Mobile Unified Menu (Visible only on Mobile) */}
          <div className="flex sm:hidden">
            <DropdownMenu
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  ariaLabel="Menu"
                  className="p-1.5"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                </Button>
              }
              items={mobileMenuItems}
            />
          </div>
        </div>

        {/* Center: Global Controls (Responsive Positioning) */}
        {/* On Mobile: Relative flow. On Desktop: Absolute center. */}
        <div className="flex-1 flex justify-center sm:absolute sm:left-1/2 sm:-translate-x-1/2 pointer-events-none">
          <div className="pointer-events-auto">
               <TopBarControls compact={!isDesktop} />
          </div>
        </div>

        {/* Right: Tools */}
        <div className="flex items-center gap-2">
           {/* Right Panel Toggle */}
           <Button
              variant={showRightPanel ? 'primary' : 'ghost'}
              size="icon"
              onClick={toggleRightPanel}
              ariaLabel="Toggle Inspector"
              data-testid="toggle-right-panel"
              className={`p-1.5 ${
                showRightPanel ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
          >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
          </Button>
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

      <InputModal
        isOpen={saveStyleOpen}
        onClose={() => setSaveStyleOpen(false)}
        onConfirm={onConfirmSaveStyle}
        title="Save Style"
        placeholder="Enter style name..."
        confirmText="Save"
      />

      <InputModal
        isOpen={saveSceneOpen}
        onClose={() => setSaveSceneOpen(false)}
        onConfirm={onConfirmSaveScene}
        title="Save Scene"
        placeholder="Enter scene name..."
        confirmText="Save"
      />

      <InputModal
        isOpen={shareUrlOpen}
        onClose={() => setShareUrlOpen(false)}
        onConfirm={() => {}} // No-op, just copy
        title="Share Link"
        message="Copy this URL to share your scene:"
        initialValue={currentShareUrl}
        readOnly
        confirmText="Close"
        cancelText="Close"
      />
    </>
  );
};
