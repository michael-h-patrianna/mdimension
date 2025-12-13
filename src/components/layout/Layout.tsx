/**
 * Layout Component
 * Main application layout with canvas and sidebar
 */

import { Sidebar } from '@/components/sidebar';
import { useThemeStore } from '@/stores/themeStore';
import React from 'react';

export interface LayoutProps {
  children?: React.ReactNode;
  appTitle?: string;
  showHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  appTitle = 'MDimension',
  showHeader = true,
}) => {
  const theme = useThemeStore((state) => state.theme);

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden selection:bg-accent selection:text-black" data-theme={theme}>

      {/* Background/Canvas Layer */}
      <div className="absolute inset-0 z-0">
        {children || (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-text-secondary text-lg font-mono tracking-widest">INITIALIZING VISUALIZER...</p>
          </div>
        )}
      </div>

      {/* Floating Header */}
      {showHeader && (
        <header className="absolute top-4 left-4 z-40 pointer-events-none">
          <div className="glass-panel px-6 py-3 rounded-full pointer-events-auto flex items-center gap-4">
            <h1 className="text-sm font-bold tracking-[0.2em] text-text-primary">
              <span className="text-accent">{appTitle.charAt(0)}</span>{appTitle.slice(1).toUpperCase()}
            </h1>
            <div className="h-3 w-[1px] bg-border/20" />
            <span className="text-xs font-mono text-text-secondary">v0.1.0</span>
          </div>
        </header>
      )}

      {/* Control panel (Floating HUD) */}
      <Sidebar />
    </div>
  );
};
