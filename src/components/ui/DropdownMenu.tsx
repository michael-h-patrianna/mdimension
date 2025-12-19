import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'motion/react';
import { soundManager } from '@/lib/audio/SoundManager';

export interface DropdownMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  shortcut?: string;
  'data-testid'?: string;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  className?: string;
  align?: 'left' | 'right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  className = '',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const offset = 4;

  // Update position - memoized to avoid stale closure in event listeners
  const updatePosition = useCallback(() => {
    if (triggerRef.current && isOpen) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current?.getBoundingClientRect() || { width: 180, height: 0 };

      // Position below trigger
      let top = triggerRect.bottom + offset + window.scrollY;
      let left = align === 'right'
        ? triggerRect.right - contentRect.width + window.scrollX
        : triggerRect.left + window.scrollX;

      // Viewport collision - flip above if overflows bottom
      const viewportHeight = window.innerHeight;
      if (top + contentRect.height > window.scrollY + viewportHeight) {
        top = triggerRect.top - contentRect.height - offset + window.scrollY;
      }

      // Clamp horizontal to viewport
      const viewportWidth = window.innerWidth;
      left = Math.max(8, Math.min(left, viewportWidth - contentRect.width - 8));

      setCoords({ top, left });
    }
  }, [isOpen, align]);

  // Position updates on open, resize, scroll
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true); // Capture phase for nested scrolls
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Click outside handler - checks both trigger and content refs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
        soundManager.playClick();
    }
    setIsOpen(!isOpen);
  };

  const handleItemClick = (item: DropdownMenuItem) => {
    if (!item.disabled && item.onClick) {
      soundManager.playClick();
      item.onClick();
      setIsOpen(false);
    }
  };

  const menuVariants = {
    closed: { 
        opacity: 0, 
        y: -10, 
        scale: 0.98,
        transition: {
            duration: 0.1,
            ease: "easeOut" as const
        }
    },
    open: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
            type: "spring" as const,
            damping: 25,
            stiffness: 400,
            mass: 0.6
        }
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        role="button"
        className={`cursor-pointer ${className}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {trigger}
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <m.div
              ref={contentRef}
              initial="closed"
              animate="open"
              exit="closed"
              variants={menuVariants}
              className="glass-panel min-w-[180px] rounded-lg py-1.5 z-50 overflow-hidden"
              style={{
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                backdropFilter: 'blur(16px)'
              }}
            >
              {items.map((item, index) => {
                if (item.label === '---') {
                  return <div key={index} className="h-px bg-white/10 my-1 mx-2" />;
                }

                if (!item.onClick) {
                  return (
                    <div key={index} className="px-3 py-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider select-none">
                      {item.label}
                    </div>
                  );
                }

                return (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick(item);
                    }}
                    onMouseEnter={() => soundManager.playHover()}
                    disabled={item.disabled}
                    className={`
                      w-full text-left px-3 py-2 text-xs flex justify-between items-center group relative
                      ${item.disabled
                        ? 'text-text-tertiary cursor-not-allowed opacity-50'
                        : 'text-text-secondary hover:text-white hover:bg-white/10 hover:text-glow'
                      }
                      transition-all duration-200
                    `}
                    data-testid={item['data-testid']}
                  >
                    <span className="relative z-10">{item.label}</span>
                    {/* Subtle shine on hover */}
                    {!item.disabled && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                    )}
                    {item.shortcut && (
                      <span className="text-[10px] text-text-tertiary ml-4 font-mono opacity-70 border border-white/10 px-1 rounded bg-black/20">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
