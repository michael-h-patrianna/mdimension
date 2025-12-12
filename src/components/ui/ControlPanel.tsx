import React, { useState } from 'react';

export interface ControlPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  defaultCollapsed?: boolean;
}

const STYLES = {
  aside: "fixed right-4 top-4 bottom-4 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-50 flex flex-col items-end pointer-events-none",
  container: "pointer-events-auto glass-panel rounded-2xl flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
  header: "flex-none h-14 flex items-center justify-between px-4 border-b border-border/10 bg-glass/20",
  title: "text-xs font-bold tracking-[0.2em] text-accent text-glow select-none",
  button: "flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-accent hover:bg-white/5 transition-colors",
  content: "flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 transition-opacity duration-300"
} as const;

export const ControlPanel: React.FC<ControlPanelProps> = ({
  children,
  title = 'CONTROLS',
  className = '',
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <aside 
      className={`${STYLES.aside} ${className}`}
      aria-label="Control Panel"
    >
      {/* Floating Glass Card Container */}
      <div 
        className={`${STYLES.container} ${
          isCollapsed ? 'w-14 h-14 rounded-full' : 'w-80 h-full'
        }`}
        data-testid="control-panel-container"
      >
        {/* Header */}
        <div className={STYLES.header}>
          {!isCollapsed && (
            <h2 className={STYLES.title}>
              {title}
            </h2>
          )}
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`${STYLES.button} ${isCollapsed ? 'w-full h-full rounded-full' : ''}`}
            aria-label={isCollapsed ? "Expand control panel" : "Collapse control panel"}
            aria-expanded={!isCollapsed}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={`transition-transform duration-500 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
            >
              <path d="M18 15l-6-6-6 6"/>
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div 
          className={`${STYLES.content} ${isCollapsed ? 'opacity-0 pointer-events-none invisible' : 'opacity-100 visible'}`}
          data-testid="control-panel-content"
        >
          {children}
        </div>
      </div>
    </aside>
  );
};