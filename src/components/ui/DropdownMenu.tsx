import React, { useState, useRef, useEffect } from 'react';

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
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
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)} role="button" className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div 
            className={`
                absolute top-full mt-1 min-w-[160px] bg-panel-bg border border-panel-border 
                rounded-md shadow-xl py-1 z-50 backdrop-blur-md
                ${align === 'right' ? 'right-0' : 'left-0'}
            `}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item);
              }}
              disabled={item.disabled}
              className={`
                w-full text-left px-4 py-2 text-xs flex justify-between items-center
                ${item.disabled 
                  ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
                }
                transition-colors
              `}
              data-testid={item['data-testid']}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] text-text-tertiary ml-4 font-mono">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
