import React, { useState, useRef, useEffect } from 'react';

export interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  icon,
  defaultOpen = true,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [shouldRender, setShouldRender] = useState(defaultOpen);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen && shouldRender) {
      // Opening animation
      // Measure height after children are rendered
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(contentHeight);

      // After animation completes, set height to auto
      const timer = setTimeout(() => {
        setHeight(undefined);
      }, 300);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      // Closing animation
      // First set to actual height
      setHeight(contentRef.current.scrollHeight);

      // Then trigger collapse in next frame
      requestAnimationFrame(() => {
        setHeight(0);
      });
      return;
    }
    return;
  }, [isOpen, shouldRender]);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleOpen();
    }
  };

  return (
    <div className={`border-b border-panel-border ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-panel-border/30 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-cyan"
        aria-expanded={isOpen}
        aria-controls={`section-content-${title}`}
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-accent-cyan">{icon}</span>}
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <svg
          className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        id={`section-content-${title}`}
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: height !== undefined ? `${height}px` : 'auto' }}
        aria-hidden={!isOpen}
      >
        <div className="px-4 py-4">
          {shouldRender && children}
        </div>
      </div>
    </div>
  );
};
