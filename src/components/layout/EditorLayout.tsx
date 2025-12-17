import React, { useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useThemeStore } from '@/stores/themeStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { useShallow } from 'zustand/react/shallow';
import { EditorTopBar } from './EditorTopBar';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorBottomPanel } from './EditorBottomPanel';
import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';
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
    hiddenLeft: { x: -340, opacity: 0 },
    visible: { 
        x: 0, 
        opacity: 1,
        transition: {
            type: 'spring' as const,
            damping: 28,
            stiffness: 300,
            mass: 0.8,
            staggerChildren: 0.05
        }
    },
    hiddenRight: { x: 340, opacity: 0 },
  };

  return (
    <div className="relative h-screen w-screen bg-background overflow-hidden selection:bg-accent selection:text-black font-sans text-text-primary">
      {/* 1. Full-screen Canvas Layer (The Curtain) */}
      <div className="absolute inset-0 z-0">
         {children}
      </div>

      {/* Cinematic Background Gradient (Overlay on canvas if needed, or background) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/5 via-background/10 to-background/50 pointer-events-none z-0 mix-blend-overlay" />
      
      {/* 2. UI Overlay Layer */}
      <div className="relative z-10 flex flex-col h-full w-full pointer-events-none">
        
        {!isCinematicMode && (
            <div className="pointer-events-auto shrink-0 z-50">
                <EditorTopBar 
                    showRightPanel={!isCollapsed}
                    toggleRightPanel={toggleCollapsed}
                />
            </div>
        )}
        
        {/* Floating Exit Cinematic Button */}
        <AnimatePresence>
            {isCinematicMode && (
                <div className="absolute top-6 right-6 z-50 pointer-events-auto">
                    <m.button
                        initial={{ scale: 0, opacity: 0, rotate: -90 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0, rotate: 90 }}
                        onClick={toggleCinematicMode}
                        className="p-3 rounded-full glass-panel text-text-secondary hover:text-white hover:border-accent/50 transition-all group"
                        title="Exit Cinematic Mode (C)"
                        data-testid="exit-cinematic"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </m.button>
                </div>
            )}
        </AnimatePresence>

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
            
            {/* Mobile Overlay Backdrop */}
            <AnimatePresence>
                {!isDesktop && !isCinematicMode && (showLeftPanel || !isCollapsed) && (
                    <m.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleOverlayClick}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 pointer-events-auto"
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
                        className={`
                            glass-panel border-r border-white/10
                            h-full overflow-hidden w-80 pointer-events-auto flex flex-col
                            ${!isDesktop ? 'absolute left-0 top-0 z-30 shadow-2xl' : 'relative z-20 ml-2 mb-2 rounded-xl'}
                        `}
                    >
                        <div className="w-full h-full overflow-y-auto custom-scrollbar p-1">
                            <EditorLeftPanel />
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
            
            {/* Center Area (Transparent, lets clicks pass to canvas) */}
            <div className="flex-1 flex flex-col min-w-0 relative z-0">
                <div className="flex-1 relative w-full min-h-0 pointer-events-none">
                     {/* Loader */}
                     {!children && (
                        <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary">
                           <div className="relative w-16 h-16 mb-6">
                              <div className="absolute inset-0 border-t-2 border-accent rounded-full animate-spin"></div>
                              <div className="absolute inset-2 border-r-2 border-accent/50 rounded-full animate-spin-slow reverse"></div>
                              <div className="absolute inset-4 border-b-2 border-accent/20 rounded-full animate-pulse"></div>
                           </div>
                           <p className="text-xs font-mono tracking-[0.3em] opacity-70 animate-pulse text-accent">INITIALIZING SYSTEM</p>
                       </div>
                     )}
                </div>
                {!isCinematicMode && isDesktop && (
                    <div className="pointer-events-auto shrink-0 mb-2 mx-2">
                        <EditorBottomPanel />
                    </div>
                )}
            </div>

            {/* Right Panel */}
            <AnimatePresence mode="popLayout">
                {!isCinematicMode && !isCollapsed && (
                    <m.div 
                        initial="hiddenRight"
                        animate="visible"
                        exit="hiddenRight"
                        variants={panelVariants}
                        className={`
                            glass-panel border-l border-white/10
                            h-full overflow-hidden w-80 pointer-events-auto flex flex-col
                            ${!isDesktop ? 'absolute right-0 top-0 z-30 shadow-2xl' : 'relative z-20 mr-2 mb-2 rounded-xl'}
                        `}
                    >
                        <div className="w-full h-full overflow-y-auto custom-scrollbar p-1">
                            <EditorRightPanel />
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
      </div>
      
      {!isCinematicMode && <ShortcutsOverlay />}
    </div>
  );
};
