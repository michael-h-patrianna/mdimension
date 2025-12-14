import React, { useState } from 'react';

export interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  defaultOpen = false,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`group rounded-lg transition-all duration-300 ${isOpen ? 'bg-white/5' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
       className={`w-full flex items-center justify-between py-2 px-3 text-left focus:outline-none
  ${isOpen ? 'border border-accent/50 shadow-[0_0_10px_color-mix(in_oklch,var(--color-accent)_20%,transparent)]' : ''}
`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {/* Decorative indicator */}
          <div className={`w-1 h-1 rounded-full transition-colors duration-300 ${isOpen ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'bg-text-tertiary'}`} />
          <span className={`text-xs font-semibold tracking-wider transition-colors duration-300 ${isOpen ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
            {title.toUpperCase()}
          </span>
        </div>

        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-tertiary transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        >
          <path d="M1 1L5 5L9 1" />
        </svg>
      </button>

      <div
        id={`section-content-${title}`}
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mb-4' : 'grid-rows-[0fr] opacity-0'}`}
        aria-hidden={!isOpen}
      >
        <div className="overflow-hidden px-3">
          <div className="pt-2 pb-2 border-border/10 ml-[5px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
