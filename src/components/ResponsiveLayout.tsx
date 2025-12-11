/**
 * Responsive Layout Component
 * Adapts layout based on screen size
 */

import React, { useState } from 'react';
import { useIsMobile, useIsTablet } from '@/hooks/useMediaQuery';

export interface ResponsiveLayoutProps {
  canvas: React.ReactNode;
  controls: React.ReactNode;
  header?: React.ReactNode;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  canvas,
  controls,
  header,
}) => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [showControls, setShowControls] = useState(!isMobile);

  // Mobile layout: stacked with toggle
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-app-bg">
        {header && (
          <header className="h-14 flex items-center justify-between px-4 border-b border-panel-border bg-panel-bg">
            {header}
            <button
              onClick={() => setShowControls(!showControls)}
              className="p-2 rounded-lg bg-panel-bg border border-panel-border text-text-secondary hover:text-text-primary transition-colors"
              aria-label={showControls ? 'Hide controls' : 'Show controls'}
            >
              {showControls ? 'Hide' : 'Show'} Controls
            </button>
          </header>
        )}

        <div className="flex-1 relative overflow-hidden">
          {/* Canvas area */}
          <div
            className={`absolute inset-0 transition-all duration-300 ${
              showControls ? 'h-1/2' : 'h-full'
            }`}
          >
            {canvas}
          </div>

          {/* Controls panel - slides up from bottom */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-panel-bg border-t border-panel-border transition-all duration-300 overflow-auto ${
              showControls ? 'h-1/2' : 'h-0'
            }`}
          >
            <div className="p-4">{controls}</div>
          </div>
        </div>
      </div>
    );
  }

  // Tablet layout: side panel that can be collapsed
  if (isTablet) {
    return (
      <div className="flex h-screen bg-app-bg">
        <main className="flex-1 relative flex flex-col">
          {header && (
            <header className="h-14 flex items-center justify-between px-4 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm">
              {header}
              <button
                onClick={() => setShowControls(!showControls)}
                className="p-2 rounded-lg bg-panel-bg border border-panel-border text-text-secondary hover:text-text-primary transition-colors"
                aria-label={showControls ? 'Hide controls' : 'Show controls'}
              >
                {showControls ? '→' : '←'}
              </button>
            </header>
          )}
          <div className="flex-1 overflow-hidden">{canvas}</div>
        </main>

        {/* Collapsible side panel */}
        <aside
          className={`border-l border-panel-border bg-panel-bg transition-all duration-300 overflow-hidden ${
            showControls ? 'w-72' : 'w-0'
          }`}
        >
          <div className="w-72 h-full overflow-auto p-4">{controls}</div>
        </aside>
      </div>
    );
  }

  // Desktop layout: full side panel
  return (
    <div className="flex h-screen bg-app-bg overflow-hidden">
      <main className="flex-1 relative flex flex-col">
        {header && (
          <header className="h-16 flex items-center justify-between px-6 border-b border-panel-border bg-panel-bg/50 backdrop-blur-sm">
            {header}
          </header>
        )}
        <div className="flex-1 overflow-hidden">{canvas}</div>
      </main>

      <aside className="w-80 border-l border-panel-border bg-panel-bg overflow-auto">
        <div className="p-4">{controls}</div>
      </aside>
    </div>
  );
};
