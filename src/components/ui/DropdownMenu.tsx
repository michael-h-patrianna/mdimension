import React, { useState, useRef, useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';

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

  const handleItemClick = (item: DropdownMenuItem) => {
    if (!item.disabled && item.onClick) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)} role="button" className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
            <m.div 
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={`
                    glass-panel absolute top-full mt-1 min-w-[180px]
                    rounded-lg py-1.5 z-50
                    ${align === 'right' ? 'right-0' : 'left-0'}
                `}
                style={{ backdropFilter: 'blur(16px)' }}
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
                  disabled={item.disabled}
                  className={`
                    w-full text-left px-3 py-2 text-xs flex justify-between items-center
                    ${item.disabled 
                      ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                      : 'text-text-secondary hover:text-white hover:bg-white/10 hover:text-glow'
                    }
                    transition-all duration-200
                  `}
                  data-testid={item['data-testid']}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[10px] text-text-tertiary ml-4 font-mono opacity-70">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              )})}
            </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
