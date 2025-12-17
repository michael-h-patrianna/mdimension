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
      className={`
        group rounded-lg transition-all duration-300 relative overflow-hidden mb-2
        ${isOpen 
          ? 'bg-white/[0.02] border border-white/10 shadow-sm' 
          : 'bg-transparent border border-transparent hover:bg-white/5'
        } 
        ${className}
      `}
      data-testid={dataTestId}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between py-2.5 px-3 text-left focus:outline-none rounded-lg z-10"
          aria-expanded={isOpen}
          data-testid={dataTestId ? `${dataTestId}-header` : undefined}
        >
          <div className="flex items-center gap-3">
            {/* LED Indicator */}
            <div className="relative flex items-center justify-center w-2 h-2">
                <m.div 
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${isOpen ? 'bg-accent' : 'bg-white/20 group-hover:bg-white/40'}`}
                    animate={isOpen ? {
                        boxShadow: [
                            "0 0 0px var(--color-accent)",
                            "0 0 8px var(--color-accent)",
                            "0 0 0px var(--color-accent)"
                        ]
                    } : {}}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>

            <h3 className={`text-[11px] font-bold tracking-widest uppercase transition-colors duration-200 ${isOpen ? 'text-text-primary text-glow-subtle' : 'text-text-secondary group-hover:text-text-primary'}`}>
              {title}
            </h3>
          </div>
          
          {/* Chevron */}
          <m.div
            animate={{ 
              rotate: isOpen ? 180 : 0,
            }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`transition-colors duration-200 ${isOpen ? 'text-accent' : 'text-text-tertiary opacity-50 group-hover:opacity-100'}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </m.div>
        </button>

        {isOpen && onReset && (
          <m.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="mr-2 p-1 text-text-tertiary hover:text-accent transition-colors rounded hover:bg-white/10 relative z-20"
            title={`Reset ${title} settings`}
            data-testid={dataTestId ? `${dataTestId}-reset` : undefined}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </m.button>
        )}
      </div>
      
      {/* Separator - Visible only when open */}
      {isOpen && <div className="mx-3 h-[1px] bg-white/5" />}

      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            id={`section-content-${title}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-4 pt-4 space-y-5">
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
