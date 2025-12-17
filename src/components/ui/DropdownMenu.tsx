import React, { useState, useRef, useEffect } from 'react';
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
        y: -5, 
        scale: 0.95,
        transition: {
            duration: 0.1
        }
    },
    open: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
            type: "spring" as const,
            damping: 20,
            stiffness: 300,
            staggerChildren: 0.03,
            delayChildren: 0.02
        }
    }
  };

  const itemVariants = {
    closed: { opacity: 0, x: -10 },
    open: { opacity: 1, x: 0 }
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <div onClick={handleToggle} role="button" className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
            <m.div 
                initial="closed"
                animate="open"
                exit="closed"
                variants={menuVariants}
                className={`
                    glass-panel absolute top-full mt-1 min-w-[180px]
                    rounded-lg py-1.5 z-50 overflow-hidden
                    ${align === 'right' ? 'right-0' : 'left-0'}
                `}
                style={{ backdropFilter: 'blur(16px)' }}
            >
              {items.map((item, index) => {
                if (item.label === '---') {
                    return <m.div key={index} variants={itemVariants} className="h-px bg-white/10 my-1 mx-2" />;
                }
                
                if (!item.onClick) {
                    return (
                        <m.div key={index} variants={itemVariants} className="px-3 py-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider select-none">
                            {item.label}
                        </m.div>
                    );
                }

                return (
                <m.button
                  key={index}
                  variants={itemVariants}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleItemClick(item);
                  }}
                  onMouseEnter={() => soundManager.playHover()}
                  disabled={item.disabled}
                  className={`
                    w-full text-left px-3 py-2 text-xs flex justify-between items-center group
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
                </m.button>
              )})}
            </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
