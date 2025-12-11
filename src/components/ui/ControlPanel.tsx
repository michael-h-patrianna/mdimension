import React, { useState } from 'react';

export interface ControlPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  defaultCollapsed?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  children,
  title = 'Controls',
  className = '',
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCollapsed();
    }
  };

  return (
    <aside
      className={`fixed right-0 top-0 h-screen bg-panel-bg border-l border-panel-border transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-12' : 'w-80 md:w-96'
      } ${className}`}
      aria-label="Control panel"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-panel-border bg-panel-bg">
        {!isCollapsed && (
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          onKeyDown={handleKeyDown}
          className="p-2 rounded-lg hover:bg-panel-border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-cyan ml-auto"
          aria-label={isCollapsed ? 'Expand control panel' : 'Collapse control panel'}
          aria-expanded={!isCollapsed}
        >
          <svg
            className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${
              isCollapsed ? 'rotate-180' : 'rotate-0'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      {!isCollapsed && (
        <div
          className="h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-panel-border scrollbar-track-transparent"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#2A2A4E transparent',
          }}
        >
          {children}
        </div>
      )}
    </aside>
  );
};
