import React, { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useLayoutStore } from '@/stores/layoutStore';
import { useCameraStore } from '@/stores/cameraStore';
import { useShallow } from 'zustand/react/shallow';

export const CanvasContextMenu: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { toggleCinematicMode, toggleCollapsed, toggleLeftPanel } = useLayoutStore(useShallow((state) => ({
    toggleCinematicMode: state.toggleCinematicMode,
    toggleCollapsed: state.toggleCollapsed,
    toggleLeftPanel: state.toggleLeftPanel
  })));
  const resetCamera = useCameraStore(state => state.reset);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Check if target is canvas or background
      // We assume canvas is in the 'absolute inset-0 z-0' div
      const target = e.target as HTMLElement;
      // Allow if it's the canvas container or canvas itself
      const isCanvas = target.tagName === 'CANVAS' || target.id === 'canvas-container' || target.closest('#canvas-container');
      
      if (isCanvas) {
        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setIsVisible(true);
      } else {
         // Check if we clicked on empty space in layout
         if (target.classList.contains('bg-background') || target.classList.contains('glass-panel')) {
             // Maybe?
         } else {
             setIsVisible(false);
         }
      }
    };

    const handleClick = () => setIsVisible(false);
    const handleScroll = () => setIsVisible(false);

    // Global listener for simplicity, but filtered logic above
    // Actually, we can attach to window and filter
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const items = [
    { label: 'Reset Camera', shortcut: 'R', action: resetCamera },
    { label: 'Toggle Cinematic Mode', shortcut: 'C', action: toggleCinematicMode },
    { type: 'separator' },
    { label: 'Toggle Left Panel', shortcut: 'Shift+\\', action: toggleLeftPanel },
    { label: 'Toggle Right Panel', shortcut: '\\', action: toggleCollapsed },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.9, x: -10, y: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed z-50 min-w-[180px] glass-panel rounded-lg shadow-xl overflow-hidden py-1"
          style={{ top: position.y, left: position.x }}
        >
          {items.map((item, index) => {
            if (item.type === 'separator') {
              return <div key={index} className="h-[1px] bg-white/10 my-1 mx-2" />;
            }
            return (
              <button
                key={index}
                onClick={() => {
                    if (item.action) item.action();
                    setIsVisible(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/10 flex justify-between items-center transition-colors group"
              >
                <span>{item.label}</span>
                {item.shortcut && <span className="text-[9px] font-mono text-text-tertiary group-hover:text-text-secondary">{item.shortcut}</span>}
              </button>
            );
          })}
        </m.div>
      )}
    </AnimatePresence>
  );
};
