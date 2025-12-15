import React, { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';

export interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  onReset?: () => void;
  'data-testid'?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  defaultOpen = false,
  children,
  className = '',
  onReset,
  'data-testid': dataTestId,
}) => {
  // Persistence logic
  const storageKey = `section-state-${title.replace(/\s+/g, '-').toLowerCase()}`;
  
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored !== null ? JSON.parse(stored) : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(isOpen));
  }, [isOpen, storageKey]);

  return (
    <div 
      className={`group rounded-xl transition-all duration-300 ${isOpen ? 'bg-white/5 shadow-lg shadow-black/20' : 'hover:bg-white/5'} ${className}`}
      data-testid={dataTestId}
    >
      <div className="flex items-center justify-between pr-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex-1 flex items-center justify-between py-3 px-3 text-left focus:outline-none rounded-t-xl
            ${isOpen ? 'border-b border-white/5' : ''}
          `}
          aria-expanded={isOpen}
          data-testid={dataTestId ? `${dataTestId}-header` : undefined}
        >
          <div className="flex items-center gap-2">
            {/* Decorative indicator */}
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isOpen ? 'bg-accent shadow-[0_0_8px_var(--color-accent)] scale-125' : 'bg-text-tertiary group-hover:bg-text-secondary'}`} />
            <span className={`text-xs font-bold tracking-wider transition-colors duration-300 ${isOpen ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}>
              {title.toUpperCase()}
            </span>
          </div>

          <m.svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-tertiary"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path d="M1 1L5 5L9 1" />
          </m.svg>
        </button>

        {isOpen && onReset && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="p-1.5 text-text-tertiary hover:text-accent transition-colors rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100"
            title={`Reset ${title} settings`}
            data-testid={dataTestId ? `${dataTestId}-reset` : undefined}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            id={`section-content-${title}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-4 pt-2 border-l border-white/5 ml-[19px] space-y-4">
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
