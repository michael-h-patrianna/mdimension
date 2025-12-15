import React, { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { EditorTopBar } from './EditorTopBar';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorBottomPanel } from './EditorBottomPanel';
import { ShortcutsOverlay } from '@/components/ui/ShortcutsOverlay';

interface EditorLayoutProps {
  children?: React.ReactNode;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ children }) => {
  const theme = useThemeStore((state) => state.theme);
  const { isCollapsed, toggleCollapsed } = useLayoutStore();
  const [showLeftPanel, setShowLeftPanel] = useState(true);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden selection:bg-accent selection:text-black font-sans text-text-primary relative">
      {/* Cinematic Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-background to-background pointer-events-none z-0" />
      
      <EditorTopBar 
        showLeftPanel={showLeftPanel}
        setShowLeftPanel={setShowLeftPanel}
        showRightPanel={!isCollapsed}
        toggleRightPanel={toggleCollapsed}
      />
      
      <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">
        {/* Left Panel */}
        <div 
            className={`bg-panel-bg/80 backdrop-blur-xl border-r border-panel-border transition-all duration-500 ease-[cubic-bezier(0.32,0.725,0,1)] overflow-hidden ${showLeftPanel ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-10 border-r-0'}`}
        >
            <div className="w-80 h-full overflow-y-auto custom-scrollbar">
                <EditorLeftPanel />
            </div>
        </div>
        
        {/* Center Canvas Area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="flex-1 relative z-0 w-full h-full">
                {children || (
                     <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary">
                        <div className="w-16 h-16 border-2 border-dashed border-text-tertiary/20 rounded-full flex items-center justify-center mb-4 animate-spin-slow">
                           <div className="w-2 h-2 bg-accent rounded-full" />
                        </div>
                        <p className="text-sm font-mono tracking-[0.2em] opacity-50">INITIALIZING VIEWPORT...</p>
                    </div>
                )}
            </div>
            <EditorBottomPanel />
        </div>

        {/* Right Panel */}
        <div 
            className={`bg-panel-bg/80 backdrop-blur-xl border-l border-panel-border transition-all duration-500 ease-[cubic-bezier(0.32,0.725,0,1)] overflow-hidden ${!isCollapsed ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 border-l-0'}`}
        >
            <div className="w-80 h-full overflow-y-auto custom-scrollbar">
                <EditorRightPanel />
            </div>
        </div>
      </div>
      
      <ShortcutsOverlay />
    </div>
  );
};
