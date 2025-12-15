import React, { useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useThemeStore } from '@/stores/themeStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { useShallow } from 'zustand/react/shallow';
import { EditorTopBar } from './EditorTopBar';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorBottomPanel } from './EditorBottomPanel';
import { ShortcutsOverlay } from '@/components/ui/ShortcutsOverlay';
import { useIsDesktop } from '@/hooks/useMediaQuery';

interface EditorLayoutProps {
  children?: React.ReactNode;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ children }) => {
  const theme = useThemeStore((state) => state.theme);
  const { 
    isCollapsed, 
    toggleCollapsed, 
    isCinematicMode, 
    toggleCinematicMode, 
    setCinematicMode,
    setCollapsed,
    showLeftPanel,
    setLeftPanel 
  } = useLayoutStore(
    useShallow((state) => ({
      isCollapsed: state.isCollapsed,
      toggleCollapsed: state.toggleCollapsed,
      isCinematicMode: state.isCinematicMode,
      toggleCinematicMode: state.toggleCinematicMode,
      setCinematicMode: state.setCinematicMode,
      setCollapsed: state.setCollapsed,
      showLeftPanel: state.showLeftPanel,
      setLeftPanel: state.setLeftPanel,
    }))
  );
  
  const isDesktop = useIsDesktop();

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync fullscreen state with cinematic mode
  useEffect(() => {
    const handleFullscreenChange = () => {
        // If exiting fullscreen, ensure cinematic mode is off
        if (!document.fullscreenElement) {
          setCinematicMode(false);
        }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setCinematicMode]);

  // Handle overlay mode interactions
  const handleOverlayClick = () => {
    if (!isDesktop) {
        setLeftPanel(false);
        setCollapsed(true);
    }
  };

  // Auto-collapse on mobile init
  useEffect(() => {
    if (!isDesktop) {
        setLeftPanel(false);
        setCollapsed(true);
    } else {
        setLeftPanel(true);
        setCollapsed(false);
    }
  }, [isDesktop, setCollapsed, setLeftPanel]);

  const panelVariants = {
    hiddenLeft: { x: -320, opacity: 0 },
    visible: { x: 0, opacity: 1 },
    hiddenRight: { x: 320, opacity: 0 },
  };

  const transition = { type: 'spring' as const, damping: 25, stiffness: 200 };

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden selection:bg-accent selection:text-black font-sans text-text-primary relative">
      {/* Cinematic Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-background to-background pointer-events-none z-0" />
      
      {!isCinematicMode && (
          <EditorTopBar 
            showRightPanel={!isCollapsed}
            toggleRightPanel={toggleCollapsed}
          />
      )}
      
      {/* Floating Exit Cinematic Button */}
      <AnimatePresence>
        {isCinematicMode && (
            <m.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={toggleCinematicMode}
                className="fixed top-4 right-4 z-50 p-2 rounded-full bg-black/50 backdrop-blur-md text-white/50 hover:text-white hover:bg-black/70 transition-all border border-white/10 shadow-lg group"
                title="Exit Cinematic Mode (C)"
                data-testid="exit-cinematic"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </m.button>
        )}
      </AnimatePresence>

      <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">
        
        {/* Mobile Overlay Backdrop */}
        <AnimatePresence>
            {!isDesktop && !isCinematicMode && (showLeftPanel || !isCollapsed) && (
                <m.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleOverlayClick}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20"
                />
            )}
        </AnimatePresence>

        {/* Left Panel */}
        <AnimatePresence mode="popLayout">
            {!isCinematicMode && showLeftPanel && (
                <m.div 
                    initial="hiddenLeft"
                    animate="visible"
                    exit="hiddenLeft"
                    variants={panelVariants}
                    transition={transition}
                    className={`
                        bg-panel-bg/80 backdrop-blur-xl border-r border-panel-border 
                        h-full overflow-hidden w-80
                        ${!isDesktop ? 'absolute left-0 top-0 z-30 shadow-2xl' : 'relative z-20'}
                    `}
                >
                    <div className="w-full h-full overflow-y-auto custom-scrollbar">
                        <EditorLeftPanel />
                    </div>
                </m.div>
            )}
        </AnimatePresence>
        
        {/* Center Canvas Area */}
        <div className="flex-1 flex flex-col min-w-0 relative z-0">
            <div className="flex-1 relative w-full min-h-0">
                {children || (
                     <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary">
                        <div className="w-16 h-16 border-2 border-dashed border-text-tertiary/20 rounded-full flex items-center justify-center mb-4 animate-spin-slow">
                           <div className="w-2 h-2 bg-accent rounded-full" />
                        </div>
                        <p className="text-sm font-mono tracking-[0.2em] opacity-50">INITIALIZING VIEWPORT...</p>
                    </div>
                )}
            </div>
            {!isCinematicMode && isDesktop && <EditorBottomPanel />}
        </div>

        {/* Right Panel */}
        <AnimatePresence mode="popLayout">
            {!isCinematicMode && !isCollapsed && (
                <m.div 
                    initial="hiddenRight"
                    animate="visible"
                    exit="hiddenRight"
                    variants={panelVariants}
                    transition={transition}
                    className={`
                        bg-panel-bg/80 backdrop-blur-xl border-l border-panel-border 
                        h-full overflow-hidden w-80
                        ${!isDesktop ? 'absolute right-0 top-0 z-30 shadow-2xl' : 'relative z-20'}
                    `}
                >
                    <div className="w-full h-full overflow-y-auto custom-scrollbar">
                        <EditorRightPanel />
                    </div>
                </m.div>
            )}
        </AnimatePresence>
      </div>
      
      {!isCinematicMode && <ShortcutsOverlay />}
    </div>
  );
};
